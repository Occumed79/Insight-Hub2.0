import { Router, type IRouter, type Request } from "express";
import type { Response as ExpressResponse } from "express";

const router: IRouter = Router();
const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4";
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const cache = new Map<string, { value: unknown; expiresAt: number; staleUntil: number }>();
const inFlight = new Map<string, Promise<unknown>>();

type JsonRecord = Record<string, unknown>;
type SearchCandidate = {
  row: JsonRecord;
  recordType: "opinion" | "recap";
};
type RawResponse = {
  status: number;
  ok: boolean;
  headers: Headers;
  body: string;
};
type CacheState = "fresh" | "refreshed" | "stale";

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: unknown, max = 1800): string {
  const cleaned = stripHtml(text(value));
  if (!cleaned) return "";
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "CourtListener timed out. Please retry.";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|token|authorization|cookie)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 320);
}

function parseRetryAfter(headers: Headers): number {
  const raw = headers.get("retry-after");
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 15_000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.min(Math.max(date - Date.now(), 0), 15_000) : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readLimitedBody(response: globalThis.Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`CourtListener response exceeded the ${maxBytes} byte safety limit.`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error(`CourtListener response exceeded the ${maxBytes} byte safety limit.`);
  }
  return new TextDecoder().decode(buffer);
}

async function requestRaw(
  url: string,
  token: string,
  config: { timeoutMs?: number; maxBytes?: number; retries?: number } = {},
): Promise<RawResponse> {
  const timeoutMs = config.timeoutMs ?? 20_000;
  const maxBytes = config.maxBytes ?? 6_000_000;
  const retries = config.retries ?? 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
          "User-Agent": "Occu-Med Insight Hub/2.0 legal-reference research",
        },
      });
      const body = await readLimitedBody(response, maxBytes);
      if (TRANSIENT_STATUSES.has(response.status) && attempt < retries) {
        await sleep(parseRetryAfter(response.headers) || 350 * (2 ** attempt));
        continue;
      }
      return { status: response.status, ok: response.ok, headers: response.headers, body };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
      await sleep(350 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("CourtListener request failed.");
}

async function fetchCourtListenerJson(
  path: string,
  token: string,
  config: { timeoutMs?: number; maxBytes?: number; retries?: number } = {},
): Promise<unknown> {
  const response = await requestRaw(`${COURTLISTENER_BASE}${path}`, token, config);
  let payload: unknown = null;
  try {
    payload = response.body ? JSON.parse(response.body) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(
      text(record?.detail)
      || text(record?.message)
      || text(record?.error)
      || `CourtListener returned HTTP ${response.status}`,
    );
  }
  if (payload === null && response.body.trim()) throw new Error("CourtListener returned invalid JSON.");
  return payload;
}

async function cachedLoad<T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  loader: () => Promise<T>,
): Promise<{ value: T; cacheState: CacheState }> {
  const now = Date.now();
  const existing = cache.get(key) as { value: T; expiresAt: number; staleUntil: number } | undefined;
  if (existing && existing.expiresAt > now) return { value: existing.value, cacheState: "fresh" };

  const active = inFlight.get(key) as Promise<T> | undefined;
  if (active) return { value: await active, cacheState: "refreshed" };

  const request = loader();
  inFlight.set(key, request as Promise<unknown>);
  try {
    const value = await request;
    for (const [entryKey, entry] of cache) {
      if (entry.staleUntil <= Date.now()) cache.delete(entryKey);
    }
    while (cache.size >= 300) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      staleUntil: Date.now() + ttlMs + staleMs,
    });
    return { value, cacheState: "refreshed" };
  } catch (error) {
    if (existing && existing.staleUntil > now) return { value: existing.value, cacheState: "stale" };
    throw error;
  } finally {
    inFlight.delete(key);
  }
}

function collectText(record: JsonRecord | null): string {
  if (!record) return "";
  const direct = [
    record.snippet,
    record.plain_text,
    record.text,
    record.html_with_citations,
    record.html,
    record.html_lawbox,
    record.html_columbia,
    record.html_anon_2020,
    record.xml_harvard,
    record.syllabus,
    record.procedural_history,
    record.posture,
    record.description,
    record.short_description,
  ];

  const nested = [
    ...asArray(record.opinions),
    ...asArray(record.recap_documents),
    ...asArray(record.documents),
  ].flatMap((item) => {
    const child = asRecord(item);
    return child ? [
      child.snippet,
      child.plain_text,
      child.text,
      child.html_with_citations,
      child.html,
      child.description,
      child.short_description,
    ] : [];
  });

  for (const value of [...direct, ...nested]) {
    const candidate = compact(value);
    if (candidate.length >= 80) return candidate;
  }
  return "";
}

function numericIds(values: unknown[]): string[] {
  const ids = values
    .map((value) => {
      const record = asRecord(value);
      return text(record?.id ?? record?.pk ?? value);
    })
    .filter((value) => /^\d+$/.test(value));
  return Array.from(new Set(ids));
}

function opinionIds(row: JsonRecord): string[] {
  const nested = numericIds(asArray(row.opinions));
  const direct = [text(row.opinion_id), text(row.opinionId)].filter((value) => /^\d+$/.test(value));
  return Array.from(new Set([...nested, ...direct]));
}

function recapDocumentIds(row: JsonRecord): string[] {
  const nested = numericIds([...asArray(row.recap_documents), ...asArray(row.documents)]);
  const direct = [
    text(row.recap_document_id),
    text(row.recapDocumentId),
    text(row.document_id),
  ].filter((value) => /^\d+$/.test(value));
  return Array.from(new Set([...nested, ...direct]));
}

async function hydrateContent(
  candidate: SearchCandidate,
  token: string,
): Promise<{ content: string; contentSource: string; partialErrors: string[] }> {
  const direct = collectText(candidate.row);
  if (direct) {
    return {
      content: direct,
      contentSource: candidate.recordType === "opinion" ? "CourtListener opinion excerpt" : "RECAP filing excerpt",
      partialErrors: [],
    };
  }

  const ids = candidate.recordType === "opinion"
    ? opinionIds(candidate.row)
    : recapDocumentIds(candidate.row);
  const errors: string[] = [];

  for (const id of ids.slice(0, 2)) {
    try {
      const endpoint = candidate.recordType === "opinion"
        ? `/opinions/${id}/`
        : `/recap-documents/${id}/`;
      const loaded = await cachedLoad(
        `courtlistener:${endpoint}`,
        6 * 60 * 60_000,
        24 * 60 * 60_000,
        () => fetchCourtListenerJson(endpoint, token, { maxBytes: 8_000_000 }),
      );
      const hydrated = collectText(asRecord(loaded.value));
      if (hydrated) {
        return {
          content: hydrated,
          contentSource: candidate.recordType === "opinion" ? "Full opinion text" : "RECAP document text",
          partialErrors: errors,
        };
      }
    } catch (error) {
      errors.push(safeError(error));
    }
  }

  const metadata = compact(
    candidate.row.description
    || candidate.row.short_description
    || candidate.row.suitNature
    || candidate.row.suit_nature,
    900,
  );
  return {
    content: metadata,
    contentSource: metadata ? "Court docket description" : "No public text available",
    partialErrors: errors,
  };
}

function sourceUrl(row: JsonRecord): string {
  const raw = text(row.absolute_url) || text(row.resource_uri);
  if (!raw) return "https://www.courtlistener.com/";
  if (raw.startsWith("/")) return `https://www.courtlistener.com${raw}`;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.hostname === "www.courtlistener.com"
      ? parsed.toString()
      : "https://www.courtlistener.com/";
  } catch {
    return "https://www.courtlistener.com/";
  }
}

function dateValue(row: JsonRecord): string {
  return text(row.dateFiled)
    || text(row.date_filed)
    || text(row.entry_date_filed)
    || text(row.date_created);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

router.get("/public-data/courtlistener", async (req: Request, res: ExpressResponse) => {
  res.setHeader("Cache-Control", "no-store");
  const query = text(req.query.query);
  if (!query) return res.status(400).json({ ok: false, error: "query is required" });
  if (query.length > 160) return res.status(400).json({ ok: false, error: "query must be 160 characters or fewer" });

  const token = getEnv("COURTLISTENER_API_TOKEN");
  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "COURTLISTENER_API_TOKEN is not configured.",
    });
  }

  try {
    const normalizedQuery = query.replace(/"/g, "").trim();
    const key = `courtlistener-search:${normalizedQuery.toLowerCase()}`;
    const loaded = await cachedLoad(key, 5 * 60_000, 30 * 60_000, async () => {
      const baseParams = {
        q: `"${normalizedQuery}"`,
        order_by: "dateFiled desc",
      };
      const searches = await Promise.allSettled([
        fetchCourtListenerJson(`/search/?${new URLSearchParams({ ...baseParams, type: "o" })}`, token),
        fetchCourtListenerJson(`/search/?${new URLSearchParams({ ...baseParams, type: "r" })}`, token),
      ]);
      const successful = searches.filter((entry): entry is PromiseFulfilledResult<unknown> => entry.status === "fulfilled");
      if (successful.length === 0) {
        const first = searches.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
        throw first?.reason ?? new Error("CourtListener searches failed.");
      }

      const opinionPayload = searches[0].status === "fulfilled" ? searches[0].value : null;
      const recapPayload = searches[1].status === "fulfilled" ? searches[1].value : null;
      const candidates: SearchCandidate[] = [
        ...asArray(asRecord(opinionPayload)?.results)
          .slice(0, 12)
          .map((item) => ({ row: asRecord(item), recordType: "opinion" as const })),
        ...asArray(asRecord(recapPayload)?.results)
          .slice(0, 16)
          .map((item) => ({ row: asRecord(item), recordType: "recap" as const })),
      ].filter((candidate): candidate is SearchCandidate => !!candidate.row);

      const hydrated = await mapWithConcurrency(candidates, 4, async (candidate) => {
        const row = candidate.row;
        const content = await hydrateContent(candidate, token);
        const citation = text(row.citation)
          || asArray(row.citation).map(text).filter(Boolean).join(", ");
        const documentDescription = compact(
          row.description || row.short_description || row.document_type || row.suitNature || row.suit_nature,
          300,
        );
        return {
          caseName: text(row.caseName) || text(row.case_name) || text(row.caption) || "Court record",
          docketNumber: text(row.docketNumber) || text(row.docket_number),
          dateFiled: dateValue(row),
          court: text(row.court) || text(row.court_name) || text(row.court_citation_string),
          citation,
          snippet: content.content,
          contentSource: content.contentSource,
          contentAvailable: content.content.length >= 80,
          recordType: candidate.recordType,
          documentDescription,
          sourceUrl: sourceUrl(row),
          partialErrors: content.partialErrors,
        };
      });

      const seen = new Set<string>();
      const references = hydrated
        .sort((a, b) => {
          if (a.contentAvailable !== b.contentAvailable) return a.contentAvailable ? -1 : 1;
          return b.dateFiled.localeCompare(a.dateFiled);
        })
        .filter((reference) => {
          const dedupeKey = reference.sourceUrl !== "https://www.courtlistener.com/"
            ? reference.sourceUrl
            : `${reference.caseName}|${reference.docketNumber}|${reference.dateFiled}`;
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        })
        .slice(0, 24)
        .map(({ partialErrors, ...reference }) => reference);

      return {
        references,
        searchPartialErrors: searches.flatMap((entry, index) => entry.status === "rejected"
          ? [{ source: index === 0 ? "opinions" : "recap", error: safeError(entry.reason) }]
          : []),
        hydrationFailureCount: hydrated.reduce((sum, item) => sum + item.partialErrors.length, 0),
      };
    });

    return res.json({
      ok: true,
      query,
      references: loaded.value.references,
      contentAvailableCount: loaded.value.references.filter((reference) => reference.contentAvailable).length,
      metadataOnlyCount: loaded.value.references.filter((reference) => !reference.contentAvailable).length,
      partialErrors: loaded.value.searchPartialErrors,
      hydrationFailureCount: loaded.value.hydrationFailureCount,
      cacheState: loaded.cacheState,
      source: "CourtListener REST API",
      sourceUrl: "https://www.courtlistener.com/",
      limitation: "Results combine CourtListener opinions and RECAP federal-court records. Returned text is an excerpt for research triage, not a legal conclusion. A name match does not establish identity, relevance, liability, negligence, wrongdoing, or an adverse outcome.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

export default router;
