import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const SEC_DIRECTORY_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";
const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_FORMS = ["8-K", "10-Q", "10-K", "6-K", "20-F", "40-F", "DEF 14A", "S-1", "S-3"];

type SecIssuer = {
  cik: string;
  name: string;
  ticker?: string;
  exchange?: string;
};

type SecFiling = {
  id: string;
  cik: string;
  companyName: string;
  ticker?: string;
  exchange?: string;
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate?: string;
  acceptanceDateTime?: string;
  primaryDocument?: string;
  primaryDocumentDescription?: string;
  items?: string;
  isXbrl: boolean;
  isInlineXbrl: boolean;
  filingUrl: string;
  documentUrl?: string;
};

type DirectoryPayload = {
  fields?: unknown;
  data?: unknown;
};

type SubmissionCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

let directoryCache: { expiresAt: number; issuers: SecIssuer[] } | null = null;
const submissionCache = new Map<string, SubmissionCacheEntry>();

function secUserAgent(): string | null {
  const value = process.env["SEC_USER_AGENT"]?.trim();
  return value || null;
}

function normalizeCik(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 10) return null;
  return digits.padStart(10, "0");
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|holdings?)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)) : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).map((item) => Number.isFinite(item) ? item : 0)
    : [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSecJson(url: string): Promise<unknown> {
  const userAgent = secUserAgent();
  if (!userAgent) {
    throw new Error("SEC_USER_AGENT is not configured. Add a descriptive organization and contact email in Render before using SEC filings.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SEC returned HTTP ${response.status}.`);
    }

    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadIssuerDirectory(): Promise<SecIssuer[]> {
  if (directoryCache && directoryCache.expiresAt > Date.now()) return directoryCache.issuers;

  const payload = await fetchSecJson(SEC_DIRECTORY_URL) as DirectoryPayload;
  const fields = asStringArray(payload.fields);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const cikIndex = fields.indexOf("cik");
  const nameIndex = fields.indexOf("name");
  const tickerIndex = fields.indexOf("ticker");
  const exchangeIndex = fields.indexOf("exchange");

  if (cikIndex < 0 || nameIndex < 0 || tickerIndex < 0) {
    throw new Error("SEC ticker directory returned an unexpected structure.");
  }

  const issuers = rows.flatMap((row): SecIssuer[] => {
    if (!Array.isArray(row)) return [];
    const cik = normalizeCik(row[cikIndex]);
    const name = normalizeText(row[nameIndex]);
    const ticker = normalizeText(row[tickerIndex]);
    const exchange = exchangeIndex >= 0 ? normalizeText(row[exchangeIndex]) : "";
    if (!cik || !name) return [];
    return [{ cik, name, ticker: ticker || undefined, exchange: exchange || undefined }];
  });

  directoryCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, issuers };
  return issuers;
}

function issuerScore(query: string, issuer: SecIssuer): number {
  const normalizedQuery = normalizeCompanyName(query);
  const normalizedName = normalizeCompanyName(issuer.name);
  const ticker = issuer.ticker?.toLowerCase() ?? "";
  const lowered = query.trim().toLowerCase();

  if (ticker && ticker === lowered) return 100;
  if (normalizedName === normalizedQuery) return 96;
  if (ticker && ticker.startsWith(lowered)) return 90;
  if (normalizedName.startsWith(normalizedQuery)) return 82;
  if (normalizedName.includes(normalizedQuery)) return 68;
  if (normalizedQuery.includes(normalizedName)) return 58;
  return 0;
}

async function loadSubmissions(cik: string): Promise<unknown> {
  const cached = submissionCache.get(cik);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const payload = await fetchSecJson(`${SEC_SUBMISSIONS_BASE}/CIK${cik}.json`);
  submissionCache.set(cik, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}

function parseFilings(payload: unknown, issuer: SecIssuer, allowedForms: Set<string>, limit: number): SecFiling[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const root = payload as Record<string, unknown>;
  const filings = root.filings && typeof root.filings === "object" && !Array.isArray(root.filings)
    ? root.filings as Record<string, unknown>
    : null;
  const recent = filings?.recent && typeof filings.recent === "object" && !Array.isArray(filings.recent)
    ? filings.recent as Record<string, unknown>
    : null;
  if (!recent) return [];

  const accessionNumbers = asStringArray(recent.accessionNumber);
  const forms = asStringArray(recent.form);
  const filingDates = asStringArray(recent.filingDate);
  const reportDates = asStringArray(recent.reportDate);
  const acceptanceDateTimes = asStringArray(recent.acceptanceDateTime);
  const primaryDocuments = asStringArray(recent.primaryDocument);
  const primaryDescriptions = asStringArray(recent.primaryDocDescription);
  const items = asStringArray(recent.items);
  const isXbrl = asNumberArray(recent.isXBRL);
  const isInlineXbrl = asNumberArray(recent.isInlineXBRL);
  const companyName = normalizeText(root.name) || issuer.name;
  const cikPath = String(Number(issuer.cik));

  const results: SecFiling[] = [];
  for (let index = 0; index < accessionNumbers.length && results.length < limit; index += 1) {
    const accessionNumber = accessionNumbers[index];
    const form = forms[index] || "SEC filing";
    if (!accessionNumber || (allowedForms.size > 0 && !allowedForms.has(form))) continue;

    const accessionPath = accessionNumber.replace(/-/g, "");
    const primaryDocument = primaryDocuments[index] || undefined;
    const archiveBase = `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}`;

    results.push({
      id: `${issuer.cik}-${accessionNumber}`,
      cik: issuer.cik,
      companyName,
      ticker: issuer.ticker,
      exchange: issuer.exchange,
      accessionNumber,
      form,
      filingDate: filingDates[index] || "",
      reportDate: reportDates[index] || undefined,
      acceptanceDateTime: acceptanceDateTimes[index] || undefined,
      primaryDocument,
      primaryDocumentDescription: primaryDescriptions[index] || undefined,
      items: items[index] || undefined,
      isXbrl: isXbrl[index] === 1,
      isInlineXbrl: isInlineXbrl[index] === 1,
      filingUrl: `${archiveBase}/${accessionNumber}-index.html`,
      documentUrl: primaryDocument ? `${archiveBase}/${primaryDocument}` : undefined,
    });
  }

  return results;
}

router.get("/sec-filings/search", async (req: Request, res: Response) => {
  const query = normalizeText(req.query.q);
  if (query.length < 2) {
    res.status(400).json({ error: "Enter at least two characters of a ticker or public company name." });
    return;
  }

  try {
    const issuers = await loadIssuerDirectory();
    const matches = issuers
      .map((issuer) => ({ issuer, score: issuerScore(query, issuer) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.issuer.name.localeCompare(b.issuer.name))
      .slice(0, 12)
      .map((entry) => entry.issuer);

    res.json({ query, issuers: matches, source: SEC_DIRECTORY_URL, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unable to search the SEC issuer directory.",
    });
  }
});

router.post("/sec-filings/feed", async (req: Request, res: Response) => {
  const rawIssuers = Array.isArray(req.body?.issuers) ? req.body.issuers : [];
  if (rawIssuers.length === 0) {
    res.status(400).json({ error: "Add at least one SEC issuer before refreshing the filing feed." });
    return;
  }
  if (rawIssuers.length > 50) {
    res.status(400).json({ error: "A single manual refresh supports up to 50 issuers." });
    return;
  }

  const issuers = rawIssuers.flatMap((value: unknown): SecIssuer[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const cik = normalizeCik(record.cik);
    const name = normalizeText(record.name);
    if (!cik || !name) return [];
    return [{
      cik,
      name,
      ticker: normalizeText(record.ticker) || undefined,
      exchange: normalizeText(record.exchange) || undefined,
    }];
  });

  if (issuers.length !== rawIssuers.length) {
    res.status(400).json({ error: "One or more issuer records are invalid." });
    return;
  }

  const requestedForms: string[] = Array.isArray(req.body?.forms)
    ? req.body.forms.map((value: unknown) => normalizeText(value)).filter((value: string) => value.length > 0)
    : DEFAULT_FORMS;
  const allowedForms = new Set<string>(requestedForms);
  const rawLimit = Number(req.body?.limitPerIssuer ?? 40);
  const limitPerIssuer = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 40;

  const filings: SecFiling[] = [];
  const errors: Array<{ cik: string; companyName: string; error: string }> = [];
  const startedAt = new Date().toISOString();

  for (let index = 0; index < issuers.length; index += 1) {
    const issuer = issuers[index];
    try {
      const payload = await loadSubmissions(issuer.cik);
      filings.push(...parseFilings(payload, issuer, allowedForms, limitPerIssuer));
    } catch (error) {
      errors.push({
        cik: issuer.cik,
        companyName: issuer.name,
        error: error instanceof Error ? error.message : "SEC submissions request failed.",
      });
    }

    if (index < issuers.length - 1) await sleep(150);
  }

  filings.sort((a, b) => {
    const dateDelta = b.filingDate.localeCompare(a.filingDate);
    if (dateDelta !== 0) return dateDelta;
    return a.companyName.localeCompare(b.companyName);
  });

  res.json({
    startedAt,
    completedAt: new Date().toISOString(),
    source: "SEC EDGAR Submissions API",
    freshness: "Live at manual refresh time, with a five-minute server cache",
    issuerCount: issuers.length,
    filingCount: filings.length,
    forms: requestedForms,
    filings,
    errors,
  });
});

export default router;
