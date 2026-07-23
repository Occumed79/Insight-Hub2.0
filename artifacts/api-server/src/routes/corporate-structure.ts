import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 14;
const MAX_ENTITIES = 320;
const REQUEST_TIMEOUT_MS = 22_000;
const USER_AGENT = "Occu-Med Insight Hub corporate structure research (manual public-source analysis)";
const SEC_DIRECTORY_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";

type Confidence = "confirmed" | "probable" | "inferred";
type Relationship = "parent" | "subsidiary" | "division" | "brand" | "dba" | "affiliate" | "unknown";
type SourceType = "official" | "sec" | "public-web";

type Evidence = {
  url: string;
  label: string;
  sourceType: SourceType;
  snippet: string;
  fetchedAt: string;
};

type CorporateEntity = {
  id: string;
  name: string;
  relationship: Relationship;
  jurisdiction?: string;
  description?: string;
  confidence: Confidence;
  sourceUrls: string[];
  evidence: Evidence[];
};

type SourceRecord = {
  url: string;
  label: string;
  sourceType: SourceType;
  status: "analyzed" | "failed" | "skipped";
  note: string;
};

type SecIssuer = { cik: string; name: string; ticker?: string; exchange?: string };
type DirectoryPayload = { fields?: unknown; data?: unknown };
type PageResult = { url: URL; html: string; label: string; sourceType: SourceType };

type ExtractedEntity = Omit<CorporateEntity, "id" | "sourceUrls" | "evidence"> & {
  snippet: string;
};

let secDirectoryCache: { expiresAt: number; issuers: SecIssuer[] } | null = null;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value: unknown, max = 2_000): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return decodeEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, max);
}

function safeUrl(value: unknown): URL {
  const parsed = new URL(cleanText(value, 2_000));
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Corporate source URLs must use http or https.");
  if (parsed.username || parsed.password) throw new Error("Corporate source URLs cannot contain embedded credentials.");
  return parsed;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const lowered = address.toLowerCase();
  return lowered === "::1" || lowered === "::" || lowered.startsWith("fc") || lowered.startsWith("fd")
    || lowered.startsWith("fe8") || lowered.startsWith("fe9") || lowered.startsWith("fea") || lowered.startsWith("feb")
    || lowered.startsWith("::ffff:127.") || lowered.startsWith("::ffff:10.") || lowered.startsWith("::ffff:192.168.");
}

async function assertPublicDestination(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private or local network destinations are not allowed.");
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Private or local network destinations are not allowed.");
  }
}

async function fetchPublic(input: URL, redirectsRemaining = 4): Promise<{ response: globalThis.Response; finalUrl: URL }> {
  await assertPublicDestination(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(input, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5",
      },
      signal: controller.signal,
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectsRemaining <= 0) throw new Error("Corporate source redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Corporate source returned a redirect without a destination.");
      return fetchPublic(new URL(location, input), redirectsRemaining - 1);
    }
    return { response, finalUrl: input };
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response: globalThis.Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Corporate source is too large to analyze safely.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_SOURCE_BYTES) throw new Error("Corporate source is too large to analyze safely.");
  return new TextDecoder().decode(buffer);
}

function pageLabel(html: string, url: URL): string {
  const og = html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const title = og?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return cleanText(title || url.hostname, 240);
}

function extractLinks(html: string, baseUrl: URL): Array<{ href: URL; text: string }> {
  const output: Array<{ href: URL; text: string }> = [];
  const expression = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html)) !== null) {
    try {
      const href = new URL(decodeEntities(match[1]), baseUrl);
      if (!["http:", "https:"].includes(href.protocol)) continue;
      output.push({ href, text: cleanText(match[2], 300) });
    } catch {
      // Ignore malformed links.
    }
  }
  return output;
}

function isStructureLink(link: { href: URL; text: string }): boolean {
  const value = `${link.href.pathname} ${link.text}`.toLowerCase();
  return /(subsidiar|companies|businesses|brands|divisions|operating companies|portfolio|our companies|group structure|corporate structure|organization|about|who-we-are)/.test(value);
}

function normalizeOrgName(value: string): string {
  return cleanText(value, 220)
    .toLowerCase()
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|holdings?|group)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function plausibleOrganizationName(value: string): boolean {
  const cleaned = cleanText(value, 220);
  if (cleaned.length < 2 || cleaned.length > 150) return false;
  if (!/[A-Za-z]/.test(cleaned)) return false;
  if (/^(subsidiaries|brands|divisions|our companies|our businesses|business units|portfolio|corporate structure|company overview)$/i.test(cleaned)) return false;
  if (/^(learn more|read more|view all|contact us|careers|privacy|terms|home)$/i.test(cleaned)) return false;
  const words = cleaned.split(/\s+/);
  return words.length <= 12;
}

function relationshipFromText(value: string): Relationship {
  const text = value.toLowerCase();
  if (/d\/?b\/?a|doing business as/.test(text)) return "dba";
  if (/brand/.test(text)) return "brand";
  if (/division|business unit|segment|operating unit/.test(text)) return "division";
  if (/affiliate|joint venture|associate company/.test(text)) return "affiliate";
  if (/subsidiar|wholly owned|controlled entity/.test(text)) return "subsidiary";
  return "unknown";
}

function confidenceRank(value: Confidence): number {
  return value === "confirmed" ? 3 : value === "probable" ? 2 : 1;
}

function relationshipRank(value: Relationship): number {
  const order: Relationship[] = ["parent", "subsidiary", "division", "brand", "dba", "affiliate", "unknown"];
  return order.indexOf(value);
}

function entityId(name: string, relationship: Relationship): string {
  const slug = `${relationship}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  return slug || `entity-${Math.random().toString(36).slice(2, 10)}`;
}

function extractJsonLd(html: string): ExtractedEntity[] {
  const output: ExtractedEntity[] = [];
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  function visit(value: unknown, context = ""): void {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, context));
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const typeValue = Array.isArray(record["@type"]) ? record["@type"].join(" ") : cleanText(record["@type"], 100);
    const name = cleanText(record.name, 220);
    const contextText = `${context} ${typeValue}`;
    const relationship = relationshipFromText(contextText);
    if (name && plausibleOrganizationName(name) && /organization|corporation|brand|company|business/i.test(typeValue)) {
      output.push({
        name,
        relationship: relationship === "unknown" ? "affiliate" : relationship,
        confidence: "probable",
        description: cleanText(record.description, 500) || undefined,
        jurisdiction: cleanText(record.addressCountry ?? record.location, 120) || undefined,
        snippet: cleanText(`${typeValue}: ${name}`, 500),
      });
    }
    for (const [key, child] of Object.entries(record)) {
      if (["subOrganization", "department", "brand", "parentOrganization", "memberOf"].includes(key)) visit(child, key);
      else if (typeof child === "object") visit(child, context);
    }
  }

  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      visit(JSON.parse(body) as unknown);
    } catch {
      // Ignore invalid structured data.
    }
  }
  return output;
}

function extractTableRows(html: string, defaultRelationship: Relationship): ExtractedEntity[] {
  const output: ExtractedEntity[] = [];
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => cleanText(match[1], 300)).filter(Boolean);
    if (cells.length === 0) continue;
    const name = cells[0];
    if (!plausibleOrganizationName(name)) continue;
    const joined = cells.join(" | ");
    const relationship = relationshipFromText(joined);
    output.push({
      name,
      relationship: relationship === "unknown" ? defaultRelationship : relationship,
      jurisdiction: cells.slice(1).find((cell) => /[A-Za-z]/.test(cell) && cell.length < 100),
      description: cells.slice(1).join(" · ") || undefined,
      confidence: "probable",
      snippet: joined,
    });
  }
  return output;
}

function extractLists(html: string, pageContext: string): ExtractedEntity[] {
  const output: ExtractedEntity[] = [];
  const contextRelationship = relationshipFromText(pageContext);
  const items = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
  for (const item of items) {
    const text = cleanText(item, 500);
    if (!text || text.length > 320) continue;
    const relationship = relationshipFromText(text);
    const effectiveRelationship = relationship === "unknown" ? contextRelationship : relationship;
    if (effectiveRelationship === "unknown") continue;
    const name = text
      .replace(/^(subsidiary|division|brand|affiliate|doing business as|d\/?b\/?a)\s*[:–—-]?\s*/i, "")
      .split(/\s+[–—|:]\s+/)[0]
      .trim();
    if (!plausibleOrganizationName(name)) continue;
    output.push({
      name,
      relationship: effectiveRelationship,
      confidence: "inferred",
      description: text === name ? undefined : text,
      snippet: text,
    });
  }
  return output;
}

function extractNamedRelationshipSentences(html: string): ExtractedEntity[] {
  const output: ExtractedEntity[] = [];
  const text = cleanText(html, 500_000);
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => /(subsidiar|division|brand|affiliate|doing business as|d\/?b\/?a)/i.test(sentence));
  const nameExpression = /\b([A-Z][A-Za-z0-9&'’.()-]+(?:\s+[A-Z][A-Za-z0-9&'’.()-]+){0,8})\b/g;
  for (const sentence of sentences.slice(0, 150)) {
    const relationship = relationshipFromText(sentence);
    if (relationship === "unknown") continue;
    const candidates = [...sentence.matchAll(nameExpression)].map((match) => cleanText(match[1], 180));
    for (const name of candidates) {
      if (!plausibleOrganizationName(name)) continue;
      if (/^(The|This|Our|Company|Subsidiary|Division|Brand|Affiliate)$/i.test(name)) continue;
      output.push({
        name,
        relationship,
        confidence: "inferred",
        description: sentence,
        snippet: sentence,
      });
    }
  }
  return output;
}

function extractFromPage(page: PageResult): ExtractedEntity[] {
  const pageContext = `${page.label} ${page.url.pathname}`;
  const defaultRelationship = relationshipFromText(pageContext) === "unknown" ? "subsidiary" : relationshipFromText(pageContext);
  return [
    ...extractJsonLd(page.html),
    ...extractTableRows(page.html, defaultRelationship),
    ...extractLists(page.html, pageContext),
    ...extractNamedRelationshipSentences(page.html),
  ];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanText(item, 300)) : [];
}

function normalizeCik(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 10) return null;
  return digits.padStart(10, "0");
}

function normalizeCompanyName(value: string): string {
  return value.toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|holdings?)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function secUserAgent(): string | null {
  return process.env["SEC_USER_AGENT"]?.trim() || null;
}

async function fetchSecJson(url: string): Promise<unknown> {
  const userAgent = secUserAgent();
  if (!userAgent) throw new Error("SEC_USER_AGENT is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`SEC returned HTTP ${response.status}.`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSecText(url: string): Promise<string> {
  const userAgent = secUserAgent();
  if (!userAgent) throw new Error("SEC_USER_AGENT is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml" }, signal: controller.signal });
    if (!response.ok) throw new Error(`SEC returned HTTP ${response.status}.`);
    return await readLimitedText(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadIssuerDirectory(): Promise<SecIssuer[]> {
  if (secDirectoryCache && secDirectoryCache.expiresAt > Date.now()) return secDirectoryCache.issuers;
  const payload = await fetchSecJson(SEC_DIRECTORY_URL) as DirectoryPayload;
  const fields = asStringArray(payload.fields);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const cikIndex = fields.indexOf("cik");
  const nameIndex = fields.indexOf("name");
  const tickerIndex = fields.indexOf("ticker");
  const exchangeIndex = fields.indexOf("exchange");
  if (cikIndex < 0 || nameIndex < 0) throw new Error("SEC issuer directory returned an unexpected structure.");
  const issuers = rows.flatMap((row): SecIssuer[] => {
    if (!Array.isArray(row)) return [];
    const cik = normalizeCik(row[cikIndex]);
    const name = cleanText(row[nameIndex], 220);
    if (!cik || !name) return [];
    return [{
      cik,
      name,
      ticker: tickerIndex >= 0 ? cleanText(row[tickerIndex], 30) || undefined : undefined,
      exchange: exchangeIndex >= 0 ? cleanText(row[exchangeIndex], 80) || undefined : undefined,
    }];
  });
  secDirectoryCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, issuers };
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
  return 0;
}

async function resolveIssuer(companyName: string, tickerOrCik?: string): Promise<SecIssuer | null> {
  const directCik = normalizeCik(tickerOrCik);
  const issuers = await loadIssuerDirectory();
  if (directCik) return issuers.find((issuer) => issuer.cik === directCik) ?? { cik: directCik, name: companyName };
  const query = cleanText(tickerOrCik, 100) || companyName;
  return issuers.map((issuer) => ({ issuer, score: issuerScore(query, issuer) })).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.issuer ?? null;
}

function recentFiling(payload: unknown): { accessionNumber: string; primaryDocument?: string; form: string; filingDate?: string } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const filings = root.filings && typeof root.filings === "object" && !Array.isArray(root.filings) ? root.filings as Record<string, unknown> : null;
  const recent = filings?.recent && typeof filings.recent === "object" && !Array.isArray(filings.recent) ? filings.recent as Record<string, unknown> : null;
  if (!recent) return null;
  const accessions = asStringArray(recent.accessionNumber);
  const forms = asStringArray(recent.form);
  const primaryDocuments = asStringArray(recent.primaryDocument);
  const filingDates = asStringArray(recent.filingDate);
  for (let index = 0; index < accessions.length; index += 1) {
    if (!["10-K", "20-F", "40-F"].includes(forms[index])) continue;
    if (!accessions[index]) continue;
    return { accessionNumber: accessions[index], primaryDocument: primaryDocuments[index] || undefined, form: forms[index], filingDate: filingDates[index] || undefined };
  }
  return null;
}

function findExhibitDocument(indexPayload: unknown): { name: string; description?: string } | null {
  if (!indexPayload || typeof indexPayload !== "object" || Array.isArray(indexPayload)) return null;
  const directory = (indexPayload as Record<string, unknown>).directory;
  if (!directory || typeof directory !== "object" || Array.isArray(directory)) return null;
  const items = Array.isArray((directory as Record<string, unknown>).item) ? (directory as Record<string, unknown>).item as unknown[] : [];
  const candidates = items.flatMap((item): Array<{ name: string; description?: string }> => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const name = cleanText(record.name, 300);
    const description = cleanText(record.description, 500) || undefined;
    return name ? [{ name, description }] : [];
  });
  return candidates.find((item) => /ex(?:hibit)?[-_ ]?21|subsidiar/i.test(`${item.name} ${item.description ?? ""}`)) ?? null;
}

function extractSecSubsidiaries(html: string): ExtractedEntity[] {
  const tableEntities = extractTableRows(html, "subsidiary").map((entity) => ({ ...entity, confidence: "confirmed" as const }));
  if (tableEntities.length > 0) return tableEntities;
  const lines = cleanText(html, 500_000).split(/\s{2,}|[\r\n]+/).map((line) => line.trim()).filter(Boolean);
  return lines.flatMap((line): ExtractedEntity[] => {
    if (line.length > 220 || !plausibleOrganizationName(line)) return [];
    return [{ name: line, relationship: "subsidiary", confidence: "confirmed", snippet: line }];
  }).slice(0, MAX_ENTITIES);
}

async function analyzeSec(companyName: string, tickerOrCik: string | undefined, entities: CorporateEntity[], sources: SourceRecord[], warnings: string[]): Promise<void> {
  if (!secUserAgent()) {
    warnings.push("SEC enrichment was skipped because SEC_USER_AGENT is not configured.");
    return;
  }
  try {
    const issuer = await resolveIssuer(companyName, tickerOrCik);
    if (!issuer) {
      warnings.push("No SEC issuer match was found for this company.");
      return;
    }
    const submissions = await fetchSecJson(`${SEC_SUBMISSIONS_BASE}/CIK${issuer.cik}.json`);
    const filing = recentFiling(submissions);
    if (!filing) {
      warnings.push(`No recent 10-K, 20-F, or 40-F was available for ${issuer.name}.`);
      return;
    }
    const cikPath = String(Number(issuer.cik));
    const accessionPath = filing.accessionNumber.replace(/-/g, "");
    const archiveBase = `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}`;
    const indexUrl = `${archiveBase}/index.json`;
    const indexPayload = await fetchSecJson(indexUrl);
    const exhibit = findExhibitDocument(indexPayload);
    if (!exhibit) {
      sources.push({ url: indexUrl, label: `${issuer.name} ${filing.form} filing index`, sourceType: "sec", status: "analyzed", note: "No Exhibit 21 or subsidiary attachment was identified." });
      warnings.push("The latest annual filing did not expose a recognizable Exhibit 21 subsidiary attachment.");
      return;
    }
    const exhibitUrl = `${archiveBase}/${encodeURIComponent(exhibit.name)}`;
    const html = await fetchSecText(exhibitUrl);
    const extracted = extractSecSubsidiaries(html);
    const fetchedAt = new Date().toISOString();
    for (const item of extracted) {
      const normalized = normalizeOrgName(item.name);
      if (!normalized || normalized === normalizeOrgName(companyName)) continue;
      const existing = entities.find((entity) => normalizeOrgName(entity.name) === normalized);
      const evidence: Evidence = { url: exhibitUrl, label: exhibit.description || "SEC Exhibit 21", sourceType: "sec", snippet: item.snippet, fetchedAt };
      if (existing) {
        existing.relationship = "subsidiary";
        existing.confidence = "confirmed";
        if (!existing.sourceUrls.includes(exhibitUrl)) existing.sourceUrls.push(exhibitUrl);
        existing.evidence.push(evidence);
      } else {
        entities.push({ id: entityId(item.name, "subsidiary"), name: item.name, relationship: "subsidiary", jurisdiction: item.jurisdiction, description: item.description, confidence: "confirmed", sourceUrls: [exhibitUrl], evidence: [evidence] });
      }
      if (entities.length >= MAX_ENTITIES) break;
    }
    sources.push({ url: exhibitUrl, label: exhibit.description || `${issuer.name} Exhibit 21`, sourceType: "sec", status: "analyzed", note: `${extracted.length} subsidiary candidates extracted from the latest annual filing.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEC enrichment failed.";
    warnings.push(`SEC enrichment failed: ${message}`);
  }
}

async function analyzeWebSources(primaryUrl: string | undefined, supportingUrls: string[], companyName: string, entities: CorporateEntity[], sources: SourceRecord[], warnings: string[]): Promise<void> {
  const seeds = [primaryUrl, ...supportingUrls].filter((value): value is string => Boolean(cleanText(value, 2_000)));
  if (seeds.length === 0) return;
  const parsedSeeds = seeds.map(safeUrl);
  const officialHosts = new Set(parsedSeeds.map((url) => url.hostname));
  const queue = [...parsedSeeds];
  const visited = new Set<string>();
  const pages: PageResult[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const next = queue.shift();
    if (!next) break;
    const key = next.toString();
    if (visited.has(key)) continue;
    visited.add(key);
    try {
      const { response, finalUrl } = await fetchPublic(next);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await readLimitedText(response);
      const sourceType: SourceType = officialHosts.has(finalUrl.hostname) ? "official" : "public-web";
      const page: PageResult = { url: finalUrl, html, label: pageLabel(html, finalUrl), sourceType };
      pages.push(page);
      sources.push({ url: finalUrl.toString(), label: page.label, sourceType, status: "analyzed", note: "Public page analyzed for named subsidiaries, divisions, brands, DBAs, and affiliates." });
      if (officialHosts.has(finalUrl.hostname)) {
        for (const link of extractLinks(html, finalUrl).filter(isStructureLink)) {
          if (officialHosts.has(link.href.hostname) && !visited.has(link.href.toString()) && queue.length + pages.length < MAX_PAGES * 2) queue.push(link.href);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      sources.push({ url: next.toString(), label: next.hostname, sourceType: officialHosts.has(next.hostname) ? "official" : "public-web", status: "failed", note: message });
      warnings.push(`${next.hostname} could not be analyzed: ${message}`);
    }
  }

  const fetchedAt = new Date().toISOString();
  for (const page of pages) {
    for (const item of extractFromPage(page)) {
      const normalized = normalizeOrgName(item.name);
      if (!normalized || normalized === normalizeOrgName(companyName)) continue;
      const relationship = item.relationship === "unknown" ? "affiliate" : item.relationship;
      const evidence: Evidence = { url: page.url.toString(), label: page.label, sourceType: page.sourceType, snippet: item.snippet, fetchedAt };
      const existing = entities.find((entity) => normalizeOrgName(entity.name) === normalized);
      if (existing) {
        if (confidenceRank(item.confidence) > confidenceRank(existing.confidence)) existing.confidence = item.confidence;
        if (relationshipRank(relationship) < relationshipRank(existing.relationship)) existing.relationship = relationship;
        if (!existing.jurisdiction && item.jurisdiction) existing.jurisdiction = item.jurisdiction;
        if (!existing.description && item.description) existing.description = item.description;
        if (!existing.sourceUrls.includes(page.url.toString())) existing.sourceUrls.push(page.url.toString());
        existing.evidence.push(evidence);
      } else {
        entities.push({ id: entityId(item.name, relationship), name: item.name, relationship, jurisdiction: item.jurisdiction, description: item.description, confidence: item.confidence, sourceUrls: [page.url.toString()], evidence: [evidence] });
      }
      if (entities.length >= MAX_ENTITIES) break;
    }
    if (entities.length >= MAX_ENTITIES) break;
  }
}

router.post("/corporate-structure/analyze", async (req: Request, res: Response) => {
  const companyName = cleanText(req.body?.companyName, 220);
  const primaryUrl = cleanText(req.body?.primaryUrl, 2_000) || undefined;
  const tickerOrCik = cleanText(req.body?.tickerOrCik, 100) || undefined;
  const supportingUrls = Array.isArray(req.body?.supportingUrls)
    ? req.body.supportingUrls.map((value: unknown) => cleanText(value, 2_000)).filter(Boolean).slice(0, 10)
    : [];

  if (companyName.length < 2) {
    res.status(400).json({ error: "Enter a company name before analyzing corporate structure." });
    return;
  }

  const startedAt = new Date().toISOString();
  const entities: CorporateEntity[] = [{
    id: entityId(companyName, "parent"),
    name: companyName,
    relationship: "parent",
    confidence: "confirmed",
    sourceUrls: [],
    evidence: [],
  }];
  const sources: SourceRecord[] = [];
  const warnings: string[] = [];

  try {
    await Promise.all([
      analyzeWebSources(primaryUrl, supportingUrls, companyName, entities, sources, warnings),
      analyzeSec(companyName, tickerOrCik, entities, sources, warnings),
    ]);

    const filtered = entities
      .filter((entity, index, array) => array.findIndex((candidate) => normalizeOrgName(candidate.name) === normalizeOrgName(entity.name)) === index)
      .slice(0, MAX_ENTITIES)
      .sort((a, b) => relationshipRank(a.relationship) - relationshipRank(b.relationship) || confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.name.localeCompare(b.name));

    const relationshipCounts = filtered.reduce<Record<string, number>>((counts, entity) => {
      counts[entity.relationship] = (counts[entity.relationship] ?? 0) + 1;
      return counts;
    }, {});
    const confidenceCounts = filtered.reduce<Record<string, number>>((counts, entity) => {
      counts[entity.confidence] = (counts[entity.confidence] ?? 0) + 1;
      return counts;
    }, {});
    const jurisdictions = new Set(filtered.map((entity) => entity.jurisdiction).filter(Boolean));
    const gaps = [
      relationshipCounts.subsidiary ? "" : "No confirmed subsidiary list was located.",
      relationshipCounts.brand ? "" : "No public brand relationships were identified.",
      relationshipCounts.dba ? "" : "No public DBA relationships were identified.",
      jurisdictions.size > 0 ? "" : "Jurisdiction details were not consistently available.",
    ].filter(Boolean);

    res.json({
      companyName,
      startedAt,
      completedAt: new Date().toISOString(),
      entities: filtered,
      sources,
      warnings,
      gaps,
      summary: {
        totalEntities: Math.max(filtered.length - 1, 0),
        relationshipCounts,
        confidenceCounts,
        jurisdictions: jurisdictions.size,
        analyzedSources: sources.filter((source) => source.status === "analyzed").length,
        failedSources: sources.filter((source) => source.status === "failed").length,
      },
      limitation: "This tool maps public-source corporate relationships. It does not prove complete legal ownership, ownership percentage, control, reporting lines, current operating status, or affiliation unless the cited source states those facts. Inferred relationships require human review.",
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Corporate structure analysis could not be completed." });
  }
});

export default router;
