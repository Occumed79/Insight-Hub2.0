import { Router, type IRouter, type Request } from "express";
import type { Response as ExpressResponse } from "express";

const router: IRouter = Router();
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const cache = new Map<string, { value: unknown; expiresAt: number; staleUntil: number }>();
const inFlight = new Map<string, Promise<unknown>>();

type JsonRecord = Record<string, unknown>;
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

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 700): string {
  const compact = stripHtml(value);
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "The upstream source timed out. Please retry.";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|password|token|authorization|cookie)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 320);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCountry(value: unknown): string {
  const country = text(value);
  if (!country) throw new Error("country is required");
  if (country.length > 100) throw new Error("country must be 100 characters or fewer");
  return country;
}

function countryMatches(country: string, ...values: unknown[]): boolean {
  const needle = normalize(country);
  if (!needle) return false;
  return values.some((value) => {
    const normalized = normalize(text(value));
    return normalized === needle
      || normalized.startsWith(`${needle} `)
      || normalized.includes(` ${needle} `)
      || normalized.endsWith(` ${needle}`);
  });
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
    throw new Error(`Upstream response exceeded the ${maxBytes} byte safety limit.`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Upstream response exceeded the ${maxBytes} byte safety limit.`);
  }
  return new TextDecoder().decode(buffer);
}

async function fetchJson(
  url: string,
  options: RequestInit = {},
  config: { timeoutMs?: number; maxBytes?: number; retries?: number } = {},
): Promise<unknown> {
  const timeoutMs = config.timeoutMs ?? 20_000;
  const maxBytes = config.maxBytes ?? 8_000_000;
  const retries = config.retries ?? 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const body = await readLimitedBody(response, maxBytes);
      if (TRANSIENT_STATUSES.has(response.status) && attempt < retries) {
        await sleep(parseRetryAfter(response.headers) || 350 * (2 ** attempt));
        continue;
      }

      let payload: unknown = null;
      try {
        payload = body ? JSON.parse(body) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const record = asRecord(payload);
        throw new Error(
          text(record?.message)
          || text(record?.detail)
          || text(record?.error)
          || `Source returned HTTP ${response.status}`,
        );
      }
      if (payload === null && body.trim()) throw new Error("Upstream source returned invalid JSON.");
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
      await sleep(350 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Upstream request failed.");
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
    while (cache.size >= 100) {
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

function noStore(res: ExpressResponse): void {
  res.setHeader("Cache-Control", "no-store");
}

router.get("/aor/health-outbreaks", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let country: string;
  try {
    country = normalizeCountry(req.query.country);
  } catch (error) {
    return res.status(400).json({ ok: false, error: safeError(error) });
  }

  try {
    const loaded = await cachedLoad(
      "who-disease-outbreak-news",
      15 * 60_000,
      6 * 60 * 60_000,
      async () => {
        const params = new URLSearchParams({
          "$top": "100",
          "$orderby": "PublicationDate desc",
          "$select": "Id,PublicationDate,PublicationDateAndTime,UrlName,ItemDefaultUrl,Title,OverrideTitle,Summary,Overview,Assessment,Advice,Response,DonId",
        });
        return asRecord(await fetchJson(`https://www.who.int/api/news/diseaseoutbreaknews?${params.toString()}`, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Occu-Med Insight Hub/2.0 health-risk research",
          },
        }));
      },
    );

    const allItems = asArray(loaded.value?.value)
      .map((item) => asRecord(item))
      .filter((item): item is JsonRecord => !!item);
    const matched = allItems.filter((item) => countryMatches(
      country,
      item.Title,
      item.OverrideTitle,
      item.Summary,
      item.Overview,
      item.Assessment,
      item.Advice,
      item.Response,
    ));
    const selected = (matched.length > 0 ? matched : allItems.slice(0, 12)).slice(0, 20);
    const matchedIds = new Set(matched.map((item) => text(item.Id) || text(item.DonId) || text(item.UrlName)));
    const outbreaks = selected.map((item) => {
      const path = text(item.ItemDefaultUrl)
        || (text(item.UrlName) ? `/emergencies/disease-outbreak/news/item/${text(item.UrlName)}` : "");
      const id = text(item.Id) || text(item.DonId) || text(item.UrlName);
      return {
        id,
        title: text(item.OverrideTitle) || text(item.Title) || "WHO Disease Outbreak News",
        publicationDate: text(item.PublicationDateAndTime) || text(item.PublicationDate),
        summary: truncate(text(item.Summary) || text(item.Overview) || text(item.Response), 900),
        assessment: truncate(text(item.Assessment), 650),
        advice: truncate(text(item.Advice), 500),
        matchedCountry: matchedIds.has(id),
        sourceUrl: path
          ? (path.startsWith("http") ? path : `https://www.who.int${path.startsWith("/") ? "" : "/"}${path}`)
          : "https://www.who.int/emergencies/disease-outbreak-news",
      };
    });

    return res.json({
      ok: true,
      country,
      directMatches: matched.length,
      outbreaks,
      fallbackUsed: matched.length === 0,
      cacheState: loaded.cacheState,
      source: "World Health Organization Disease Outbreak News",
      sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news",
      endpoint: "/api/news/diseaseoutbreaknews",
      limitation: "WHO Disease Outbreak News is not an exhaustive list of every event WHO is monitoring. Country matching is text-based and requires human review, especially for cross-border events and differently named territories.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/aor/disaster-alerts", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let country: string;
  try {
    country = normalizeCountry(req.query.country);
  } catch (error) {
    return res.status(400).json({ ok: false, error: safeError(error) });
  }

  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.trunc(rawDays), 1), 365) : 90;
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 86_400_000);
  const params = new URLSearchParams({
    country,
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
    pagesize: "100",
    pagenumber: "1",
  });

  try {
    const key = `gdacs:${normalize(country)}:${days}`;
    const loaded = await cachedLoad(
      key,
      10 * 60_000,
      60 * 60_000,
      () => fetchJson(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Occu-Med Insight Hub/2.0 disaster-risk research",
        },
      }),
    );
    const payloadRecord = asRecord(loaded.value);
    const rawFeatures = asArray(payloadRecord?.features).length > 0
      ? asArray(payloadRecord?.features)
      : Array.isArray(loaded.value)
        ? loaded.value
        : asArray(payloadRecord?.data);

    const events = rawFeatures.map((item) => {
      const feature = asRecord(item);
      const properties = asRecord(feature?.properties) ?? feature;
      const affectedCountries = asArray(properties?.affectedcountries)
        .map((countryItem) => {
          const countryRecord = asRecord(countryItem);
          return {
            name: text(countryRecord?.countryname) || text(countryRecord?.name),
            iso2: text(countryRecord?.iso2),
            iso3: text(countryRecord?.iso3),
          };
        })
        .filter((entry) => entry.name || entry.iso2 || entry.iso3);
      const urlRecord = asRecord(properties?.url);
      const eventType = text(properties?.eventtype) || text(properties?.eventType);
      const eventId = text(properties?.eventid) || text(properties?.eventId);
      return {
        eventType,
        eventId,
        episodeId: text(properties?.episodeid) || text(properties?.episodeId),
        name: text(properties?.name)
          || text(properties?.eventname)
          || text(properties?.title)
          || `${eventType || "Disaster"} alert`,
        description: truncate(text(properties?.description) || text(properties?.subtitle), 500),
        alertLevel: text(properties?.alertlevel) || text(properties?.alertLevel),
        alertScore: numberValue(properties?.alertscore ?? properties?.alertScore),
        severity: text(properties?.severity),
        fromDate: text(properties?.fromdate) || text(properties?.fromDate),
        toDate: text(properties?.todate) || text(properties?.toDate),
        country: text(properties?.country),
        affectedCountries,
        sourceUrl: text(urlRecord?.report)
          || text(urlRecord?.details)
          || text(properties?.url)
          || (eventType && eventId
            ? `https://www.gdacs.org/report.aspx?eventtype=${encodeURIComponent(eventType)}&eventid=${encodeURIComponent(eventId)}`
            : "https://www.gdacs.org/"),
      };
    }).filter((event) => {
      if (!event.eventId && !event.name) return false;
      if (event.affectedCountries.length === 0 && !event.country) return true;
      return countryMatches(country, event.country, ...event.affectedCountries.flatMap((entry) => [entry.name, entry.iso2, entry.iso3]));
    });

    return res.json({
      ok: true,
      country,
      days,
      events,
      cacheState: loaded.cacheState,
      source: "Global Disaster Alert and Coordination System (GDACS)",
      sourceUrl: "https://www.gdacs.org/",
      limitation: "GDACS alerts are automated multi-hazard awareness products. Alert levels, modeled exposure, event geometry, and impact estimates can change as new information becomes available.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/aor/source-readiness", (_req: Request, res: ExpressResponse) => {
  noStore(res);
  const acledConfigured = !!getEnv("ACLED_USERNAME") && !!getEnv("ACLED_PASSWORD");
  return res.json({
    ok: true,
    sources: [
      {
        id: "state",
        name: "U.S. Department of State",
        configured: true,
        live: true,
        requirement: null,
      },
      {
        id: "who",
        name: "WHO Disease Outbreak News",
        configured: true,
        live: true,
        requirement: null,
      },
      {
        id: "gdacs",
        name: "GDACS",
        configured: true,
        live: true,
        requirement: null,
      },
      {
        id: "acled",
        name: "ACLED",
        configured: acledConfigured,
        live: acledConfigured,
        requirement: acledConfigured ? null : "ACLED_USERNAME and ACLED_PASSWORD",
      },
      {
        id: "cfr",
        name: "CFR Global Conflict Tracker",
        configured: false,
        live: false,
        requirement: "Link-only until a validated, terms-compliant structured connector is available",
      },
    ],
  });
});

export default router;
