import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4";

type JsonRecord = Record<string, unknown>;

type SearchCandidate = {
  row: JsonRecord;
  recordType: "opinion" | "recap";
};

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
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
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
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|token|authorization)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 300);
}

async function fetchCourtListenerJson(path: string, token: string, timeoutMs = 25_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${COURTLISTENER_BASE}${path}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
        "User-Agent": "Occu-Med Insight Hub/2.0 legal-reference research",
      },
    });
    const body = await response.text();
    let payload: unknown = null;
    try {
      payload = body ? JSON.parse(body) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const record = asRecord(payload);
      throw new Error(text(record?.detail) || text(record?.message) || `CourtListener returned HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
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
  const nested = numericIds([
    ...asArray(row.recap_documents),
    ...asArray(row.documents),
  ]);
  const direct = [
    text(row.recap_document_id),
    text(row.recapDocumentId),
    text(row.document_id),
  ].filter((value) => /^\d+$/.test(value));
  return Array.from(new Set([...nested, ...direct]));
}

async function hydrateContent(candidate: SearchCandidate, token: string): Promise<{ content: string; contentSource: string }> {
  const direct = collectText(candidate.row);
  if (direct) {
    return {
      content: direct,
      contentSource: candidate.recordType === "opinion" ? "CourtListener opinion excerpt" : "RECAP filing excerpt",
    };
  }

  const ids = candidate.recordType === "opinion"
    ? opinionIds(candidate.row)
    : recapDocumentIds(candidate.row);

  for (const id of ids.slice(0, 2)) {
    try {
      const endpoint = candidate.recordType === "opinion"
        ? `/opinions/${id}/`
        : `/recap-documents/${id}/`;
      const record = asRecord(await fetchCourtListenerJson(endpoint, token));
      const hydrated = collectText(record);
      if (hydrated) {
        return {
          content: hydrated,
          contentSource: candidate.recordType === "opinion" ? "Full opinion text" : "RECAP document text",
        };
      }
    } catch {
      // A single unavailable document must not discard the entire search result set.
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
  };
}

function sourceUrl(row: JsonRecord): string {
  const absoluteUrl = text(row.absolute_url) || text(row.resource_uri);
  if (!absoluteUrl) return "https://www.courtlistener.com/";
  return absoluteUrl.startsWith("http")
    ? absoluteUrl
    : `https://www.courtlistener.com${absoluteUrl.startsWith("/") ? "" : "/"}${absoluteUrl}`;
}

function dateValue(row: JsonRecord): string {
  return text(row.dateFiled)
    || text(row.date_filed)
    || text(row.entry_date_filed)
    || text(row.date_created);
}

router.get("/public-data/courtlistener", async (req: Request, res: Response) => {
  const query = text(req.query.query);
  if (!query) return res.status(400).json({ ok: false, error: "query is required" });

  const token = getEnv("COURTLISTENER_API_TOKEN");
  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "COURTLISTENER_API_TOKEN is not configured.",
    });
  }

  try {
    const baseParams = {
      q: `"${query.replace(/"/g, "")}"`,
      order_by: "dateFiled desc",
    };
    const [opinionPayload, recapPayload] = await Promise.all([
      fetchCourtListenerJson(`/search/?${new URLSearchParams({ ...baseParams, type: "o" })}`, token),
      fetchCourtListenerJson(`/search/?${new URLSearchParams({ ...baseParams, type: "r" })}`, token),
    ]);

    const candidates: SearchCandidate[] = [
      ...asArray(asRecord(opinionPayload)?.results)
        .slice(0, 12)
        .map((item) => ({ row: asRecord(item), recordType: "opinion" as const })),
      ...asArray(asRecord(recapPayload)?.results)
        .slice(0, 16)
        .map((item) => ({ row: asRecord(item), recordType: "recap" as const })),
    ].filter((candidate): candidate is SearchCandidate => !!candidate.row);

    const hydrated = await Promise.all(candidates.map(async (candidate) => {
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
      };
    }));

    const seen = new Set<string>();
    const references = hydrated
      .sort((a, b) => b.dateFiled.localeCompare(a.dateFiled))
      .filter((reference) => {
        const key = reference.sourceUrl !== "https://www.courtlistener.com/"
          ? reference.sourceUrl
          : `${reference.caseName}|${reference.docketNumber}|${reference.dateFiled}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 24);

    return res.json({
      ok: true,
      query,
      references,
      contentAvailableCount: references.filter((reference) => reference.contentAvailable).length,
      metadataOnlyCount: references.filter((reference) => !reference.contentAvailable).length,
      source: "CourtListener REST API",
      sourceUrl: "https://www.courtlistener.com/",
      limitation: "Results combine CourtListener opinions and RECAP federal-court records. Returned text is an excerpt for research triage, not a legal conclusion. A name match does not establish identity, relevance, liability, negligence, wrongdoing, or an adverse outcome.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

export default router;
