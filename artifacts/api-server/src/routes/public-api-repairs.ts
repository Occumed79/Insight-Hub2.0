import { Router, type IRouter, type Request } from "express";
import type { Response as ExpressResponse } from "express";

const router: IRouter = Router();
const ONET_BASE_URL = "https://api-v2.onetcenter.org";
const STATE_TRAVEL_LIST_URL = "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 5_000_000;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type JsonRecord = Record<string, unknown>;
type OnetItem = { name: string; description?: string; value?: unknown; response?: unknown };
type AcledAuth = {
  mode: "bearer" | "cookie";
  value: string;
  expiresAt: number;
  refreshToken?: string;
};
type RawResponse = {
  status: number;
  ok: boolean;
  headers: Headers;
  body: string;
};
type CacheState = "fresh" | "refreshed" | "stale";
type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};
type TravelAdvisoryCandidate = {
  title: string;
  description: string;
  updatedAt: string;
  sourceUrl: string;
  levelText: string;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
let acledAuthCache: AcledAuth | null = null;
let acledAuthRequest: Promise<AcledAuth> | null = null;

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

function limitedText(value: unknown, max: number): string {
  return text(value).slice(0, max);
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
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 1000): string {
  const cleaned = stripHtml(value);
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "The upstream source timed out. Please retry.";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|password|pass|token|authorization|cookie)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 360);
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

async function requestRaw(
  url: string,
  options: RequestInit = {},
  config: { timeoutMs?: number; maxBytes?: number; retries?: number } = {},
): Promise<RawResponse> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
  const retries = config.retries ?? 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const body = await readLimitedBody(response, maxBytes);
      if (TRANSIENT_STATUSES.has(response.status) && attempt < retries) {
        const retryAfter = parseRetryAfter(response.headers);
        await sleep(retryAfter || 350 * (2 ** attempt));
        continue;
      }
      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        body,
      };
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

function parseJsonBody(body: string): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function upstreamMessage(payload: unknown, body: string, status: number): string {
  const record = asRecord(payload);
  return text(record?.message)
    || text(record?.detail)
    || text(record?.error_description)
    || text(record?.error)
    || truncate(body, 240)
    || `Source returned HTTP ${status}`;
}

async function fetchJson(
  url: string,
  options: RequestInit = {},
  config: { timeoutMs?: number; maxBytes?: number; retries?: number } = {},
): Promise<unknown> {
  const response = await requestRaw(url, options, config);
  const payload = parseJsonBody(response.body);
  if (!response.ok) throw new Error(upstreamMessage(payload, response.body, response.status));
  if (payload === null && response.body.trim()) throw new Error("Upstream source returned invalid JSON.");
  return payload;
}

async function fetchText(
  url: string,
  options: RequestInit = {},
  config: { timeoutMs?: number; maxBytes?: number; retries?: number } = {},
): Promise<string> {
  const response = await requestRaw(url, options, config);
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.body;
}

async function cachedLoad<T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  loader: () => Promise<T>,
): Promise<{ value: T; cacheState: CacheState }> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return { value: existing.value, cacheState: "fresh" };
  }

  const active = inFlight.get(key) as Promise<T> | undefined;
  if (active) {
    return { value: await active, cacheState: existing ? "stale" : "refreshed" };
  }

  const request = loader();
  inFlight.set(key, request as Promise<unknown>);
  try {
    const value = await request;
    for (const [entryKey, entry] of cache) {
      if (entry.staleUntil <= Date.now()) cache.delete(entryKey);
    }
    while (cache.size >= 250) {
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
    if (existing && existing.staleUntil > now) {
      return { value: existing.value, cacheState: "stale" };
    }
    throw error;
  } finally {
    inFlight.delete(key);
  }
}

function validateSearchTerm(value: unknown, label: string, max = 160): string {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return result;
}

function parseIsoDate(value: unknown, fallback: string): string {
  const candidate = text(value) || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate) || Number.isNaN(Date.parse(`${candidate}T00:00:00Z`))) {
    throw new Error("Dates must use YYYY-MM-DD.");
  }
  return candidate;
}

function clientError(res: ExpressResponse, error: unknown) {
  return res.status(400).json({ ok: false, error: safeError(error) });
}

function noStore(res: ExpressResponse): void {
  res.setHeader("Cache-Control", "no-store");
}

router.get("/public-data/fec", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let query: string;
  try {
    query = validateSearchTerm(req.query.query, "query");
  } catch (error) {
    return clientError(res, error);
  }

  const apiKey = getEnv("FEC_API_KEY");
  if (!apiKey) return res.status(503).json({ ok: false, error: "FEC_API_KEY is not configured." });

  try {
    const key = `fec:${normalize(query)}`;
    const loaded = await cachedLoad(key, 5 * 60_000, 30 * 60_000, async () => {
      const committeeParams = new URLSearchParams({ api_key: apiKey, q: query, per_page: "12" });
      const committeePayload = asRecord(await fetchJson(`https://api.open.fec.gov/v1/committees/?${committeeParams}`));
      const committees = asArray(committeePayload?.results).map((item) => {
        const row = asRecord(item);
        return {
          committeeId: text(row?.committee_id),
          name: text(row?.name),
          designation: text(row?.designation_full) || text(row?.designation),
          committeeType: text(row?.committee_type_full) || text(row?.committee_type),
          organizationType: text(row?.organization_type_full) || text(row?.organization_type),
          party: text(row?.party_full) || text(row?.party),
          state: text(row?.state),
          treasurer: text(row?.treasurer_name),
          filingFrequency: text(row?.filing_frequency),
          cycles: asArray(row?.cycles).map(text).filter(Boolean),
          sourceUrl: text(row?.committee_id)
            ? `https://www.fec.gov/data/committee/${text(row?.committee_id)}/`
            : "https://www.fec.gov/data/committees/",
        };
      }).filter((item) => item.committeeId && item.name);

      const filingRuns = await Promise.allSettled(committees.slice(0, 5).map(async (committee) => {
        const params = new URLSearchParams({
          api_key: apiKey,
          committee_id: committee.committeeId,
          per_page: "20",
        });
        const payload = asRecord(await fetchJson(`https://api.open.fec.gov/v1/filings/?${params}`));
        return asArray(payload?.results).map((item) => {
          const row = asRecord(item);
          const fileNumber = text(row?.file_number);
          return {
            committeeId: committee.committeeId,
            committeeName: text(row?.committee_name) || committee.name,
            formType: text(row?.form_type),
            reportType: text(row?.report_type_full) || text(row?.report_type),
            reportYear: numberValue(row?.report_year),
            coverageStart: text(row?.coverage_start_date),
            coverageEnd: text(row?.coverage_end_date),
            receiptDate: text(row?.receipt_date),
            totalReceipts: numberValue(row?.total_receipts),
            totalDisbursements: numberValue(row?.total_disbursements),
            cashOnHandEnd: numberValue(row?.cash_on_hand_end_period),
            fileNumber,
            sourceUrl: fileNumber
              ? `https://docquery.fec.gov/cgi-bin/forms/${committee.committeeId}/${fileNumber}/`
              : `https://www.fec.gov/data/committee/${committee.committeeId}/?tab=filings`,
          };
        });
      }));

      return {
        committees,
        filings: filingRuns.flatMap((run) => run.status === "fulfilled" ? run.value : [])
          .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))
          .slice(0, 40),
        partialErrors: filingRuns.flatMap((run, index) => run.status === "rejected"
          ? [{ committeeId: committees[index]?.committeeId || "unknown", error: safeError(run.reason) }]
          : []),
      };
    });

    return res.json({
      ok: true,
      query,
      ...loaded.value,
      cacheState: loaded.cacheState,
      source: "Federal Election Commission OpenFEC API",
      sourceUrl: "https://www.fec.gov/data/",
      limitation: "Name matches require human review. Committee or employee political activity must not be attributed to the employer without explicit sponsorship evidence. Contributor information may not be used for commercial solicitation.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

const CONTRACT_AWARD_CODES = ["A", "B", "C", "D"];
const IDV_AWARD_CODES = ["IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"];

async function searchUsaSpendingGroup(
  filters: JsonRecord,
  awardTypeCodes: string[],
  awardGroup: "contract" | "idv",
): Promise<JsonRecord[]> {
  const payload = asRecord(await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      filters: { ...filters, award_type_codes: awardTypeCodes },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Description",
        "Start Date",
        "End Date",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Place of Performance City",
        "Place of Performance State",
        "Place of Performance Country Code",
        "NAICS Code",
        "NAICS Description",
      ],
      page: 1,
      limit: 50,
      sort: "Award Amount",
      order: "desc",
      subawards: false,
    }),
  }, { timeoutMs: 25_000, maxBytes: 8_000_000 }));

  return asArray(payload?.results).map((item) => {
    const row = asRecord(item);
    return {
      awardId: text(row?.["Award ID"]),
      recipientName: text(row?.["Recipient Name"]),
      awardAmount: numberValue(row?.["Award Amount"]),
      description: truncate(text(row?.Description), 1200),
      startDate: text(row?.["Start Date"]),
      endDate: text(row?.["End Date"]),
      awardingAgency: text(row?.["Awarding Agency"]),
      awardingSubAgency: text(row?.["Awarding Sub Agency"]),
      city: text(row?.["Place of Performance City"]),
      state: text(row?.["Place of Performance State"]),
      country: text(row?.["Place of Performance Country Code"]),
      naics: text(row?.["NAICS Code"]),
      naicsDescription: text(row?.["NAICS Description"]),
      awardGroup,
    };
  });
}

router.post("/public-data/usaspending", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let companyName: string;
  let fromDate: string;
  let toDate: string;
  try {
    companyName = validateSearchTerm(req.body?.companyName, "companyName", 180);
    fromDate = parseIsoDate(req.body?.fromDate, `${new Date().getFullYear() - 5}-01-01`);
    toDate = parseIsoDate(req.body?.toDate, new Date().toISOString().slice(0, 10));
    if (fromDate > toDate) throw new Error("fromDate must be on or before toDate.");
  } catch (error) {
    return clientError(res, error);
  }

  const state = limitedText(req.body?.state, 2).toUpperCase();
  const enabled = ["true", "1", "yes", "on"].includes((getEnv("USASPENDING_API_ENABLED") || "").toLowerCase());
  if (!enabled) return res.status(503).json({ ok: false, error: "USAspending is disabled by USASPENDING_API_ENABLED." });

  const filters: JsonRecord = {
    recipient_search_text: [companyName],
    time_period: [{ start_date: fromDate, end_date: toDate }],
  };
  if (/^[A-Z]{2}$/.test(state)) filters.place_of_performance_locations = [{ country: "USA", state }];

  try {
    const key = `usaspending:${normalize(companyName)}:${state}:${fromDate}:${toDate}`;
    const loaded = await cachedLoad(key, 10 * 60_000, 60 * 60_000, async () => {
      const runs = await Promise.allSettled([
        searchUsaSpendingGroup(filters, CONTRACT_AWARD_CODES, "contract"),
        searchUsaSpendingGroup(filters, IDV_AWARD_CODES, "idv"),
      ]);
      const successful = runs.filter((run): run is PromiseFulfilledResult<JsonRecord[]> => run.status === "fulfilled");
      if (successful.length === 0) {
        const firstFailure = runs.find((run): run is PromiseRejectedResult => run.status === "rejected");
        throw firstFailure?.reason ?? new Error("USAspending requests failed.");
      }

      const seen = new Set<string>();
      const awards = successful.flatMap((run) => run.value)
        .sort((a, b) => (numberValue(b.awardAmount) ?? 0) - (numberValue(a.awardAmount) ?? 0))
        .filter((award) => {
          const keyValue = text(award.awardId)
            || `${text(award.recipientName)}|${text(award.description)}|${text(award.startDate)}`;
          if (seen.has(keyValue)) return false;
          seen.add(keyValue);
          return true;
        })
        .slice(0, 75);

      return {
        awards,
        totalAwardAmount: awards.reduce((sum, award) => sum + (numberValue(award.awardAmount) ?? 0), 0),
        partialErrors: runs.flatMap((run, index) => run.status === "rejected"
          ? [{ group: index === 0 ? "contract" : "idv", error: safeError(run.reason) }]
          : []),
      };
    });

    return res.json({
      ok: true,
      companyName,
      fromDate,
      toDate,
      ...loaded.value,
      cacheState: loaded.cacheState,
      groupsQueried: ["contract", "idv"],
      source: "USAspending.gov API",
      sourceUrl: "https://www.usaspending.gov/",
      limitation: "Awards describe federal spending and contractor footprint. They do not establish current staffing, workplace risk, contract performance, or occupational-health need.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

function firstArray(record: JsonRecord | null): unknown[] {
  if (!record) return [];
  for (const key of ["results", "items", "data", "value", "TravelAdvisories", "travelAdvisories", "advisories"]) {
    const values = asArray(record[key]);
    if (values.length > 0) return values;
  }
  return [];
}

function travelJsonCandidates(payload: unknown): TravelAdvisoryCandidate[] {
  const values = Array.isArray(payload) ? payload : firstArray(asRecord(payload));
  return values.map((item) => {
    const row = asRecord(item);
    return {
      title: text(row?.Title) || text(row?.title) || text(row?.Country) || text(row?.country) || text(row?.CountryName),
      description: text(row?.Description) || text(row?.description) || text(row?.Summary) || text(row?.summary) || text(row?.AdvisoryText) || text(row?.advisoryText),
      updatedAt: text(row?.DateUpdated) || text(row?.dateUpdated) || text(row?.DateIssued) || text(row?.dateIssued) || text(row?.PubDate) || text(row?.pubDate),
      sourceUrl: text(row?.Link) || text(row?.link) || text(row?.URL) || text(row?.url) || text(row?.Permalink),
      levelText: text(row?.AdvisoryLevel) || text(row?.advisoryLevel) || text(row?.Level) || text(row?.level),
    };
  }).filter((item) => item.title || item.description);
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function travelXmlCandidates(xml: string): TravelAdvisoryCandidate[] {
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const fallbackBlocks = blocks.length > 0
    ? blocks
    : [...xml.matchAll(/<traveladvisory\b[^>]*>([\s\S]*?)<\/traveladvisory>/gi)].map((match) => match[1]);
  return fallbackBlocks.map((block) => ({
    title: xmlTag(block, "title") || xmlTag(block, "country") || xmlTag(block, "countryname"),
    description: xmlTag(block, "description") || xmlTag(block, "summary") || xmlTag(block, "advisorytext"),
    updatedAt: xmlTag(block, "pubDate") || xmlTag(block, "dateupdated") || xmlTag(block, "dateissued"),
    sourceUrl: xmlTag(block, "link") || xmlTag(block, "url"),
    levelText: xmlTag(block, "advisorylevel") || xmlTag(block, "level"),
  })).filter((item) => item.title || item.description);
}

function matchesCountry(candidate: TravelAdvisoryCandidate, country: string): boolean {
  const needle = normalize(country);
  const title = normalize(candidate.title.replace(/travel advisory/gi, ""));
  const description = normalize(candidate.description);
  if (!needle || !title) return false;
  return title === needle
    || title.startsWith(`${needle} `)
    || needle.startsWith(`${title} `)
    || description.startsWith(`${needle} `);
}

async function loadTravelAdvisoryCandidates(): Promise<{
  candidates: TravelAdvisoryCandidate[];
  source: string;
  cacheState: CacheState;
}> {
  const loaded = await cachedLoad(
    "state-travel-advisories",
    30 * 60_000,
    24 * 60 * 60_000,
    async () => {
      const attempts: Array<() => Promise<{ candidates: TravelAdvisoryCandidate[]; source: string }>> = [
        async () => ({
          candidates: travelJsonCandidates(await fetchJson("https://cadataapi.state.gov/api/TravelAdvisories", {
            headers: { Accept: "application/json" },
          }, { maxBytes: 8_000_000 })),
          source: "Department of State Consular Affairs Data API",
        }),
        async () => ({
          candidates: travelXmlCandidates(await fetchText("https://travel.state.gov/_res/rss/TAsTWs.xml", {
            headers: {
              "User-Agent": "Occu-MedInsightHub/2.0",
              Accept: "application/xml,text/xml,application/rss+xml",
            },
          }, { maxBytes: 8_000_000 })),
          source: "Department of State Travel Advisories RSS",
        }),
        async () => ({
          candidates: travelXmlCandidates(await fetchText("https://cadatacatalog.state.gov/dataset/4a387c35-29cb-4902-b91d-3da0dc02e4b2/resource/4c727464-8e6f-4536-b0a5-0a343dc6c7ff/download/traveladvisory.xml", {
            headers: { Accept: "application/xml,text/xml" },
          }, { maxBytes: 8_000_000 })),
          source: "Department of State Travel Advisories XML",
        }),
      ];

      const failures: string[] = [];
      for (const attempt of attempts) {
        try {
          const result = await attempt();
          if (result.candidates.length > 0) return result;
          failures.push(`${result.source}: empty response`);
        } catch (error) {
          failures.push(safeError(error));
        }
      }
      throw new Error(`Official State Department advisory feeds were unavailable: ${failures.join("; ")}`);
    },
  );
  return { ...loaded.value, cacheState: loaded.cacheState };
}

router.get("/public-data/aor-risk", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let country: string;
  try {
    country = validateSearchTerm(req.query.country, "country", 100);
  } catch (error) {
    return clientError(res, error);
  }

  try {
    const loaded = await loadTravelAdvisoryCandidates();
    const candidate = loaded.candidates.find((item) => matchesCountry(item, country));
    if (!candidate) {
      return res.json({
        ok: true,
        country,
        found: false,
        advisory: null,
        cacheState: loaded.cacheState,
        source: loaded.source,
        sourceUrl: STATE_TRAVEL_LIST_URL,
        limitation: "No exact country match was resolved from the official structured advisory feeds. Use the official source link for manual review.",
      });
    }

    const combined = `${candidate.title} ${candidate.levelText} ${candidate.description}`;
    const levelMatch = combined.match(/(?:Level\s*)?([1-4])\s*[-–:]?\s*(Exercise Normal Precautions|Exercise Increased Caution|Reconsider Travel|Do Not Travel)?/i);
    const level = levelMatch ? Number(levelMatch[1]) : null;
    const levelLabel = levelMatch?.[2]
      || ({ 1: "Exercise Normal Precautions", 2: "Exercise Increased Caution", 3: "Reconsider Travel", 4: "Do Not Travel" } as Record<number, string>)[level ?? 0]
      || "Level not parsed";
    const riskTerms = ["crime", "terrorism", "unrest", "kidnapping", "hostage taking", "armed conflict", "wrongful detention", "health", "natural disaster", "landmines", "limited healthcare", "political instability"];
    const normalizedCombined = normalize(combined);
    const riskFactors = riskTerms.filter((term) => normalizedCombined.includes(normalize(term)));

    return res.json({
      ok: true,
      country,
      found: true,
      cacheState: loaded.cacheState,
      advisory: {
        title: candidate.title || `${country} Travel Advisory`,
        level,
        levelLabel,
        updatedAt: candidate.updatedAt || null,
        riskFactors,
        summary: truncate(candidate.description || candidate.title, 1200),
        sourceUrl: candidate.sourceUrl || STATE_TRAVEL_LIST_URL,
      },
      source: loaded.source,
      sourceUrl: candidate.sourceUrl || STATE_TRAVEL_LIST_URL,
      limitation: "This is official U.S. travel-advisory context, not a complete security assessment. Conditions can change rapidly and the result should be checked against the full advisory and local operational reporting.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

async function fetchOnet(path: string): Promise<unknown> {
  const apiKey = getEnv("ONET_API_KEY");
  if (!apiKey) throw new Error("ONET_API_KEY is not configured.");
  const loaded = await cachedLoad(`onet:${path}`, 6 * 60 * 60_000, 24 * 60 * 60_000, () => fetchJson(
    `${ONET_BASE_URL}${path}`,
    {
      headers: {
        "X-API-Key": apiKey,
        "User-Agent": "Occu-Med Insight Hub/2.0 occupational research",
        Accept: "application/json",
      },
    },
    { timeoutMs: 20_000, maxBytes: 6_000_000 },
  ));
  return loaded.value;
}

function normalizeOnetSearch(payload: unknown): Array<{ title: string; code: string; score?: number; href?: string }> {
  const record = asRecord(payload);
  return asArray(record?.occupation ?? record?.occupations ?? record?.results).map((item) => {
    const row = asRecord(item);
    return {
      title: text(row?.title) || text(row?.name),
      code: text(row?.code) || text(row?.onetsoc_code),
      score: numberValue(row?.score ?? row?.relevance) ?? undefined,
      href: text(row?.href) || undefined,
    };
  }).filter((item) => item.title && item.code);
}

function normalizeOnetItems(payload: unknown, preferredKey?: string): OnetItem[] {
  const record = asRecord(payload);
  const candidates = [preferredKey, "element", "task", "occupation", "items", "results"]
    .filter((key): key is string => !!key);
  let raw: unknown[] = [];
  for (const key of candidates) {
    raw = asArray(record?.[key]);
    if (raw.length > 0) break;
  }
  return raw.map((item) => {
    if (typeof item === "string") return { name: item };
    const row = asRecord(item);
    return {
      name: text(row?.name) || text(row?.title) || text(row?.element_name) || text(row?.statement),
      description: text(row?.description) || undefined,
      value: row?.value ?? row?.importance ?? row?.context,
      response: row?.response,
    };
  }).filter((item) => item.name || item.description);
}

async function loadOnetOccupation(code: string) {
  const paths = {
    overview: `/online/occupations/${encodeURIComponent(code)}/`,
    tasks: `/online/occupations/${encodeURIComponent(code)}/details/tasks?end=20`,
    workContext: `/online/occupations/${encodeURIComponent(code)}/details/work_context?end=30`,
    abilities: `/online/occupations/${encodeURIComponent(code)}/details/abilities?end=20`,
    workActivities: `/online/occupations/${encodeURIComponent(code)}/details/work_activities?end=20`,
    detailedWorkActivities: `/online/occupations/${encodeURIComponent(code)}/details/detailed_work_activities?end=20`,
  };
  const names = Object.keys(paths) as Array<keyof typeof paths>;
  const entries = await Promise.allSettled(names.map((name) => fetchOnet(paths[name])));
  const fulfilledCount = entries.filter((entry) => entry.status === "fulfilled").length;
  if (fulfilledCount === 0) {
    const first = entries.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    throw first?.reason ?? new Error("O*NET occupation detail requests failed.");
  }
  const value = (index: number): unknown => entries[index]?.status === "fulfilled" ? entries[index].value : {};
  return {
    overview: asRecord(value(0)) ?? {},
    tasks: normalizeOnetItems(value(1), "task"),
    workContext: normalizeOnetItems(value(2), "element"),
    abilities: normalizeOnetItems(value(3), "element"),
    workActivities: normalizeOnetItems(value(4), "element"),
    detailedWorkActivities: normalizeOnetItems(value(5), "element"),
    partialErrors: entries.flatMap((entry, index) => entry.status === "rejected"
      ? [{ section: names[index], error: safeError(entry.reason) }]
      : []),
  };
}

function itemText(item: OnetItem): string {
  return `${item.name} ${item.description || ""}`.toLowerCase();
}

function demandSummary(items: OnetItem[], label: string): string {
  if (items.length === 0) return `No strong ${label} indicators were returned in the available O*NET detail fields.`;
  return `${items.length} source-backed ${label} indicator${items.length === 1 ? "" : "s"} identified, including ${items.slice(0, 3).map((item) => item.name).join(", ")}.`;
}

function buildOnetContext(
  keyword: string,
  matches: Array<{ title: string; code: string; score?: number; href?: string }>,
  bundle: Awaited<ReturnType<typeof loadOnetOccupation>>,
) {
  const overview = bundle.overview;
  const physicalPattern = /strength|stamina|dexterity|coordination|balance|lift|carry|climb|bend|kneel|crouch|crawl|reach|stand|walk|run|push|pull|repetitive motion|using hands/;
  const cognitivePattern = /comprehension|expression|reasoning|information ordering|memorization|problem|attention|decision|judgment|analyz|evaluat|planning|scheduling|interpreting|accuracy|time pressure/;
  const safetyPattern = /hazard|danger|safety|protective|contaminant|disease|infection|radiation|high places|confined|burn|cut|bite|stings|noise|vibration|vehicle|equipment|emergency|inspect|reaction time|vision|hearing/;
  const environmentPattern = /outdoor|weather|contaminant|hazard|noise|vibration|hot|cold|radiation|disease|infection|confined|high places|unpleasant/;

  const physicalAbilities = bundle.abilities.filter((item) => physicalPattern.test(itemText(item)));
  const physicalActivities = bundle.workActivities.filter((item) => physicalPattern.test(itemText(item)));
  const physicalDetailed = bundle.detailedWorkActivities.filter((item) => physicalPattern.test(itemText(item)));
  const physicalContext = bundle.workContext.filter((item) => physicalPattern.test(itemText(item)));
  const cognitiveAbilities = bundle.abilities.filter((item) => cognitivePattern.test(itemText(item)));
  const cognitiveActivities = bundle.workActivities.filter((item) => cognitivePattern.test(itemText(item)));
  const cognitiveContext = bundle.workContext.filter((item) => cognitivePattern.test(itemText(item)));
  const safetyContext = bundle.workContext.filter((item) => safetyPattern.test(itemText(item)));
  const safetyActivities = bundle.workActivities.filter((item) => safetyPattern.test(itemText(item)));
  const safetyTasks = bundle.tasks.filter((item) => safetyPattern.test(itemText(item)));
  const safetyAbilities = bundle.abilities.filter((item) => safetyPattern.test(itemText(item)));
  const environmentalContext = bundle.workContext.filter((item) => environmentPattern.test(itemText(item)));

  const safetyIndicators = [
    safetyContext.length > 0 ? "Work context includes hazardous conditions, exposure, or protective-equipment requirements." : "",
    safetyActivities.length > 0 ? "Work activities include safety monitoring, inspection, vehicle, machinery, or emergency responsibilities." : "",
    safetyTasks.length > 0 ? "Task statements reference safety, inspection, hazard control, equipment, or emergency response." : "",
    safetyAbilities.length > 0 ? "Sensory, perceptual, or reaction abilities support safety-critical vigilance." : "",
  ].filter(Boolean);
  if (safetyIndicators.length === 0) safetyIndicators.push("No strong safety-sensitive indicators were returned in the available O*NET detail fields.");

  const environmentalIndicators = environmentalContext.length > 0
    ? environmentalContext.map((item) => item.name).slice(0, 12)
    : ["No strong environmental exposure indicators were returned in the available O*NET work-context fields."];

  return {
    occupation: {
      code: text(overview.code) || matches[0]?.code || "",
      title: text(overview.title) || matches[0]?.title || keyword,
      score: matches[0]?.score,
      description: text(overview.description),
    },
    matches,
    physical_demands: {
      summary: demandSummary([...physicalAbilities, ...physicalActivities, ...physicalContext], "physical-demand"),
      abilities: physicalAbilities.slice(0, 10),
      work_activities: physicalActivities.slice(0, 10),
      detailed_work_activities: physicalDetailed.slice(0, 10),
      work_context: physicalContext.slice(0, 10),
    },
    cognitive_demands: {
      summary: demandSummary([...cognitiveAbilities, ...cognitiveActivities, ...cognitiveContext], "cognitive-demand"),
      abilities: cognitiveAbilities.slice(0, 10),
      work_activities: cognitiveActivities.slice(0, 10),
      work_context: cognitiveContext.slice(0, 10),
    },
    safety_sensitive_indicators: {
      indicators: safetyIndicators,
      work_context: safetyContext.slice(0, 10),
      work_activities: safetyActivities.slice(0, 10),
      tasks: safetyTasks.slice(0, 10),
      abilities: safetyAbilities.slice(0, 10),
    },
    environmental_indicators: {
      indicators: environmentalIndicators,
      work_context: environmentalContext.slice(0, 12),
    },
    essential_function_suggestions: bundle.tasks.slice(0, 12).map((item) => item.name),
    partialErrors: bundle.partialErrors,
    raw: {
      tasks: bundle.tasks,
      work_context: bundle.workContext,
      abilities: bundle.abilities,
      work_activities: bundle.workActivities,
    },
  };
}

function validateOnetCode(value: unknown): string {
  const code = text(value);
  if (!/^\d{2}-\d{4}(?:\.\d{2})?$/.test(code)) throw new Error("A valid O*NET-SOC code is required.");
  return code;
}

router.get("/onet/search", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let keyword: string;
  try {
    keyword = validateSearchTerm(req.query.keyword, "keyword", 120);
  } catch (error) {
    return clientError(res, error);
  }
  try {
    const matches = normalizeOnetSearch(await fetchOnet(`/online/search?${new URLSearchParams({ keyword, end: "20" })}`));
    return res.json({ ok: true, keyword, matches, count: matches.length, source: "O*NET Web Services API v2" });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/onet/occupation/:code", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let code: string;
  try {
    code = validateOnetCode(req.params.code);
  } catch (error) {
    return clientError(res, error);
  }
  try {
    const bundle = await loadOnetOccupation(code);
    return res.json({
      ok: true,
      occupation: {
        code,
        title: text(bundle.overview.title),
        description: text(bundle.overview.description),
        tasks: bundle.tasks,
        work_activities: bundle.workActivities,
        detailed_work_activities: bundle.detailedWorkActivities,
        abilities: bundle.abilities,
        work_context: bundle.workContext,
        rawSummary: bundle.overview,
      },
      partialErrors: bundle.partialErrors,
      source: "O*NET Web Services API v2",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/onet/job-context", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let keyword: string;
  try {
    keyword = validateSearchTerm(req.query.keyword, "keyword", 120);
  } catch (error) {
    return clientError(res, error);
  }
  try {
    const matches = normalizeOnetSearch(await fetchOnet(`/online/search?${new URLSearchParams({ keyword, end: "20" })}`));
    if (matches.length === 0) {
      return res.json({ ok: true, keyword, matches: [], context: null, message: "No matching O*NET occupations found." });
    }
    const bundle = await loadOnetOccupation(matches[0].code);
    return res.json({
      ok: true,
      keyword,
      context: buildOnetContext(keyword, matches, bundle),
      source: "O*NET Web Services API v2",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

async function requestAcledOAuth(refreshToken?: string): Promise<AcledAuth> {
  const username = getEnv("ACLED_USERNAME");
  const password = getEnv("ACLED_PASSWORD");
  if (!refreshToken && (!username || !password)) throw new Error("ACLED_USERNAME and ACLED_PASSWORD are not configured.");

  const form = refreshToken
    ? new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token", client_id: "acled" })
    : new URLSearchParams({
      username: username || "",
      password: password || "",
      grant_type: "password",
      client_id: "acled",
      scope: "authenticated",
    });

  const payload = asRecord(await fetchJson("https://acleddata.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
  }, { timeoutMs: 20_000, maxBytes: 1_000_000, retries: 1 }));
  const accessToken = text(payload?.access_token);
  if (!accessToken) throw new Error(text(payload?.error_description) || text(payload?.error) || "ACLED authentication did not return an access token.");
  const expiresIn = numberValue(payload?.expires_in) ?? 86_400;
  return {
    mode: "bearer",
    value: accessToken,
    refreshToken: text(payload?.refresh_token) || refreshToken,
    expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000,
  };
}

async function requestAcledCookie(): Promise<AcledAuth> {
  const username = getEnv("ACLED_USERNAME");
  const password = getEnv("ACLED_PASSWORD");
  if (!username || !password) throw new Error("ACLED_USERNAME and ACLED_PASSWORD are not configured.");

  const response = await requestRaw("https://acleddata.com/user/login?_format=json", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: username, pass: password }),
  }, { timeoutMs: 20_000, maxBytes: 1_000_000, retries: 1 });
  const payload = parseJsonBody(response.body);
  if (!response.ok) throw new Error(upstreamMessage(payload, response.body, response.status));

  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const rawCookies = cookieHeaders.getSetCookie?.() ?? [response.headers.get("set-cookie") || ""];
  const cookie = rawCookies.map((value) => value.split(";")[0].trim()).filter(Boolean).join("; ");
  if (!cookie) throw new Error("ACLED cookie login succeeded without returning a session cookie.");
  return { mode: "cookie", value: cookie, expiresAt: Date.now() + 8 * 60 * 60_000 };
}

async function getAcledAuth(force = false): Promise<AcledAuth> {
  if (force) acledAuthCache = null;
  if (acledAuthCache && acledAuthCache.expiresAt > Date.now()) return acledAuthCache;
  if (acledAuthRequest) return acledAuthRequest;

  acledAuthRequest = (async () => {
    if (acledAuthCache?.mode === "bearer" && acledAuthCache.refreshToken) {
      try {
        return await requestAcledOAuth(acledAuthCache.refreshToken);
      } catch {
        acledAuthCache = null;
      }
    }

    const oauthFailures: string[] = [];
    try {
      return await requestAcledOAuth();
    } catch (error) {
      oauthFailures.push(safeError(error));
    }

    try {
      return await requestAcledCookie();
    } catch (error) {
      throw new Error(`ACLED rejected both supported authentication methods. OAuth: ${oauthFailures.join("; ")}. Cookie login: ${safeError(error)}.`);
    }
  })();

  try {
    acledAuthCache = await acledAuthRequest;
    return acledAuthCache;
  } finally {
    acledAuthRequest = null;
  }
}

async function fetchAcledEvents(
  country: string,
  startDate: string,
  endDate: string,
  retried = false,
): Promise<{ payload: unknown; authMode: string }> {
  const auth = await getAcledAuth(retried);
  const params = new URLSearchParams({
    _format: "json",
    country,
    event_date: `${startDate}|${endDate}`,
    event_date_where: "BETWEEN",
    fields: "event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|region|country|admin1|admin2|location|latitude|longitude|source|source_scale|notes|fatalities|civilian_targeting|tags|timestamp",
    limit: "1000",
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.mode === "bearer") headers.Authorization = `Bearer ${auth.value}`;
  else headers.Cookie = auth.value;

  const response = await requestRaw(`https://acleddata.com/api/acled/read?${params}`, { headers }, {
    timeoutMs: 25_000,
    maxBytes: 10_000_000,
    retries: 2,
  });
  const payload = parseJsonBody(response.body);
  if ((response.status === 401 || response.status === 403) && !retried) {
    acledAuthCache = null;
    return fetchAcledEvents(country, startDate, endDate, true);
  }
  if (!response.ok) throw new Error(upstreamMessage(payload, response.body, response.status));
  if (payload === null) throw new Error("ACLED returned invalid JSON.");
  return { payload, authMode: auth.mode };
}

router.get("/aor/conflict-events", async (req: Request, res: ExpressResponse) => {
  noStore(res);
  let country: string;
  try {
    country = validateSearchTerm(req.query.country, "country", 100);
  } catch (error) {
    return clientError(res, error);
  }

  if (!getEnv("ACLED_USERNAME") || !getEnv("ACLED_PASSWORD")) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "ACLED_USERNAME and ACLED_PASSWORD are not configured in the server environment.",
      required: ["ACLED_USERNAME", "ACLED_PASSWORD"],
    });
  }

  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.trunc(rawDays), 1), 365) : 90;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  try {
    const key = `acled:${normalize(country)}:${startDate}:${endDate}`;
    const loaded = await cachedLoad(key, 5 * 60_000, 30 * 60_000, () => fetchAcledEvents(country, startDate, endDate));
    const payload = asRecord(loaded.value.payload);
    const events = asArray(payload?.data).map((item) => {
      const row = asRecord(item);
      return {
        id: text(row?.event_id_cnty),
        eventDate: text(row?.event_date),
        eventType: text(row?.event_type),
        subEventType: text(row?.sub_event_type),
        actor1: text(row?.actor1),
        actor2: text(row?.actor2),
        region: text(row?.region),
        country: text(row?.country),
        admin1: text(row?.admin1),
        admin2: text(row?.admin2),
        location: text(row?.location),
        latitude: numberValue(row?.latitude),
        longitude: numberValue(row?.longitude),
        source: text(row?.source),
        sourceScale: text(row?.source_scale),
        notes: truncate(text(row?.notes), 700),
        fatalities: numberValue(row?.fatalities) ?? 0,
        civilianTargeting: text(row?.civilian_targeting),
        tags: text(row?.tags),
      };
    }).filter((event) => event.id || event.eventDate || event.location);

    return res.json({
      ok: true,
      configured: true,
      authenticationMode: loaded.value.authMode,
      cacheState: loaded.cacheState,
      country,
      startDate,
      endDate,
      events,
      source: "Armed Conflict Location & Event Data (ACLED)",
      sourceUrl: "https://acleddata.com/",
      limitation: "ACLED records political violence, demonstrations, and strategic developments under its methodology. Reported fatalities and event classifications may be revised, and use is governed by ACLED licensing and attribution terms.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: safeError(error) });
  }
});

export default router;
