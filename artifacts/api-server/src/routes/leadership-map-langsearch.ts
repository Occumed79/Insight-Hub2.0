import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Router, type Request, type Response } from "express";
import { db, entitiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();
const SNAPSHOT_KEY = "organizationalChart";
const SNAPSHOT_VERSION = 3;
const MAX_SEARCH_RESULTS = 40;
const MAX_PAGES = 14;
const MAX_PAGE_BYTES = 1_500_000;
const MAX_PAGE_TEXT = 24_000;
const MAX_PEOPLE = 220;
const SEARCH_TIMEOUT_MS = 22_000;
const PAGE_TIMEOUT_MS = 12_000;
const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || "Occu-Med Insight Hub/2.0 LangSearch organizational-chart discovery";
const LEADERSHIP_PATTERN = /leadership|management|executive|board|director|governance|our-team|our-people|people|officers|company|about-us|who-we-are|president|vice-president|biograph/i;
const BLOCKED_DOMAIN_PATTERN = /(^|\.)(facebook|instagram|linkedin|x|twitter|youtube|wikipedia|bloomberg|zoominfo|crunchbase|rocketreach|theorg|glassdoor|indeed|sec)\.(com|org|gov)$/i;

type Confidence = "confirmed" | "probable" | "inferred";
type LeadershipLevel = "board" | "executive" | "senior-leadership" | "director" | "manager" | "individual-contributor" | "unknown";
type SourceType = "official" | "public-web";
type ProviderStatus = "success" | "partial" | "no-results" | "not-configured" | "error";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
};

type PageDocument = {
  title: string;
  url: string;
  text: string;
  sourceType: SourceType;
};

type Evidence = {
  url: string;
  label: string;
  sourceType: SourceType;
  snippet: string;
  fetchedAt: string;
};

type Person = {
  id: string;
  name: string;
  title: string;
  level: LeadershipLevel;
  department?: string;
  location?: string;
  bio?: string;
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

type ProviderDiagnostic = {
  source: "langsearch" | "cloudflare" | "gemini" | "cerebras";
  status: ProviderStatus;
  resultsFound: number;
  message: string;
  error?: string;
};

type LeadershipResult = {
  companyName: string;
  startedAt: string;
  completedAt: string;
  people: Person[];
  edges: Array<{
    fromId: string;
    toId: string;
    relationship: "explicit-reporting-line" | "inferred-title-hierarchy";
    confidence: Confidence;
    note: string;
  }>;
  gaps: Array<{ level: LeadershipLevel; label: string; reason: string }>;
  sources: SourceRecord[];
  warnings: string[];
  summary: {
    people: number;
    confirmed: number;
    probable: number;
    inferred: number;
    levels: number;
    sourcesAnalyzed: number;
    gaps: number;
  };
  methodology: string;
  providerDiagnostics: ProviderDiagnostic[];
  cacheHit: boolean;
  entityId: number;
  savedAt: string;
  savedToDatabase: boolean;
  pagesConsidered: number;
  aiPagesRead: number;
};

type SavedSnapshot = {
  version: number;
  savedAt: string;
  result: LeadershipResult;
  sourceInputs?: {
    primaryUrl?: string;
    supportingUrls?: string[];
  };
};

type ExtractedPerson = {
  name: string;
  title: string;
  department?: string;
  location?: string;
  bio?: string;
  sourceUrl: string;
  evidenceSnippet: string;
  confidence: "high" | "medium" | "low";
};

type LangSearchKey = {
  name: string;
  value: string;
  dedicated: boolean;
};

function cleanText(value: unknown, max = 500): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeKey(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const lowered = address.toLowerCase();
  return lowered === "::1" || lowered === "::" || lowered.startsWith("fc") || lowered.startsWith("fd")
    || lowered.startsWith("fe8") || lowered.startsWith("fe9") || lowered.startsWith("fea") || lowered.startsWith("feb");
}

function safePublicUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return null;
    if (isIP(hostname) && isPrivateAddress(hostname)) return null;
    if (BLOCKED_DOMAIN_PATTERN.test(hostname) || hostname === "sec.gov" || hostname.endsWith(".sec.gov")) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

async function assertPublicDestination(url: URL): Promise<void> {
  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("Private network destination blocked.");
    return;
  }
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Private network destination blocked.");
  }
}

function sameHost(leftValue: string, rightValue: string): boolean {
  const left = safePublicUrl(leftValue);
  const right = safePublicUrl(rightValue);
  if (!left || !right) return false;
  const leftHost = left.hostname.toLowerCase().replace(/^www\./, "");
  const rightHost = right.hostname.toLowerCase().replace(/^www\./, "");
  return leftHost === rightHost || leftHost.endsWith(`.${rightHost}`) || rightHost.endsWith(`.${leftHost}`);
}

function companyTokens(companyName: string): string[] {
  const ignored = new Set(["group", "global", "company", "companies", "corporation", "corp", "inc", "llc", "ltd", "plc", "holdings", "services"]);
  return normalizeKey(companyName).split(" ").filter((token) => token.length >= 3 && !ignored.has(token));
}

function looksOfficial(urlValue: string, companyName: string): boolean {
  const url = safePublicUrl(urlValue);
  if (!url) return false;
  const compactHost = url.hostname.toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9]/g, "");
  return companyTokens(companyName).some((token) => compactHost.includes(token.replace(/[^a-z0-9]/g, "")));
}

function resultKey(result: SearchResult): string {
  return safePublicUrl(result.url)?.toString() || normalizeKey(`${result.title}|${result.snippet}`);
}

function leadershipLevel(title: string): LeadershipLevel {
  const value = title.toLowerCase();
  if (/board|chairman|chairwoman|chairperson|non-executive director|independent director/.test(value)) return "board";
  if (/chief\s|\bceo\b|\bcfo\b|\bcoo\b|\bcio\b|\bcto\b|\bcmo\b|\bchro\b|president|founder|managing director|general counsel/.test(value)) return "executive";
  if (/executive vice president|senior vice president|vice president|\bsvp\b|\bevp\b|head of|country manager|general manager/.test(value)) return "senior-leadership";
  if (/director|controller|treasurer|secretary/.test(value)) return "director";
  if (/manager|supervisor|\blead\b/.test(value)) return "manager";
  if (/analyst|specialist|engineer|consultant|coordinator|associate|advisor|officer/.test(value)) return "individual-contributor";
  return "unknown";
}

function departmentFor(title: string): string | undefined {
  const value = title.toLowerCase();
  const rows: Array<[RegExp, string]> = [
    [/finance|financial|accounting|controller|treasurer/, "Finance"],
    [/human resources|people|talent|workforce|chro/, "People & HR"],
    [/operations|operating|delivery|program/, "Operations"],
    [/technology|information|digital|cyber|engineering|cto|cio/, "Technology"],
    [/legal|counsel|compliance|secretary/, "Legal & Compliance"],
    [/sales|revenue|business development|growth|commercial/, "Growth & Commercial"],
    [/marketing|communications|brand|public affairs/, "Marketing & Communications"],
    [/medical|clinical|health|safety|environment/, "Health, Safety & Clinical"],
    [/strategy|transformation|corporate development/, "Strategy"],
  ];
  return rows.find(([pattern]) => pattern.test(value))?.[1];
}

function personId(name: string): string {
  return `person-${normalizeKey(name).replace(/\s+/g, "-")}`;
}

function langSearchKeys(): LangSearchKey[] {
  const candidates: Array<LangSearchKey | null> = [
    process.env.LANGSEARCH_API_KEY_3?.trim() ? { name: "LANGSEARCH_API_KEY_3", value: process.env.LANGSEARCH_API_KEY_3.trim(), dedicated: true } : null,
    process.env.LANGSEARCH_API_KEY_4?.trim() ? { name: "LANGSEARCH_API_KEY_4", value: process.env.LANGSEARCH_API_KEY_4.trim(), dedicated: true } : null,
    process.env.LANGSEARCH_API_KEY?.trim() ? { name: "LANGSEARCH_API_KEY", value: process.env.LANGSEARCH_API_KEY.trim(), dedicated: false } : null,
    process.env.LANGSEARCH_API_KEY_2?.trim() ? { name: "LANGSEARCH_API_KEY_2", value: process.env.LANGSEARCH_API_KEY_2.trim(), dedicated: false } : null,
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate): candidate is LangSearchKey => {
    if (!candidate || seen.has(candidate.value)) return false;
    seen.add(candidate.value);
    return true;
  });
}

async function runLangSearchQuery(query: string, queryIndex: number, keys: LangSearchKey[]): Promise<{ results: SearchResult[]; errors: string[] }> {
  const dedicated = keys.filter((key) => key.dedicated);
  const fallback = keys.filter((key) => !key.dedicated);
  const rotate = (rows: LangSearchKey[]) => rows.length === 0 ? [] : rows.map((_, index) => rows[(queryIndex + index) % rows.length]);
  const ordered = [...rotate(dedicated), ...rotate(fallback)];
  const errors: string[] = [];

  for (const key of ordered) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.langsearch.com/v1/web-search", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${key.value}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, freshness: "noLimit", summary: true, count: 10 }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as any;
      if (payload?.code && payload.code !== 200) throw new Error(payload.msg || `API code ${payload.code}`);
      const rows: any[] = payload?.data?.webPages?.value ?? [];
      const results = rows.flatMap((row): SearchResult[] => {
        const url = safePublicUrl(String(row?.url || ""));
        if (!url) return [];
        return [{
          title: cleanText(row?.name, 240) || url.hostname,
          url: url.toString(),
          snippet: cleanText(row?.summary || row?.snippet, 1_800),
        }];
      });
      if (results.length > 0) return { results, errors };
      errors.push(`${key.name}: no usable results`);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? `timed out after ${Math.round(SEARCH_TIMEOUT_MS / 1_000)}s`
        : error instanceof Error ? error.message : "request failed";
      errors.push(`${key.name}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { results: [], errors };
}

async function langSearchLeadership(companyName: string): Promise<{ results: SearchResult[]; diagnostic: ProviderDiagnostic }> {
  const keys = langSearchKeys();
  if (keys.length === 0) {
    return {
      results: [],
      diagnostic: { source: "langsearch", status: "not-configured", resultsFound: 0, message: "No LangSearch API keys are configured for organizational-chart discovery." },
    };
  }

  const queries = [
    `"${companyName}" official leadership executive team board governance named leaders biographies`,
    `"${companyName}" management team vice presidents directors business unit regional leadership`,
    `"${companyName}" appointed president executive director chief officer biography leadership`,
    `"${companyName}" organizational structure organization chart leadership names titles`,
  ];
  const responses = await Promise.all(queries.map((query, index) => runLangSearchQuery(query, index, keys)));
  const unique = new Map<string, SearchResult>();
  for (const response of responses) {
    for (const result of response.results) unique.set(resultKey(result), result);
  }
  const results = Array.from(unique.values())
    .map((result) => {
      const officialBoost = looksOfficial(result.url, companyName) ? 30 : 0;
      const relevanceBoost = LEADERSHIP_PATTERN.test(`${result.title} ${result.url} ${result.snippet}`) ? 20 : 0;
      return { ...result, score: officialBoost + relevanceBoost };
    })
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, MAX_SEARCH_RESULTS);
  const errors = responses.flatMap((response) => response.errors);
  const dedicatedCount = keys.filter((key) => key.dedicated).length;
  const status: ProviderStatus = results.length > 0 ? (errors.length > 0 ? "partial" : "success") : errors.length > 0 ? "error" : "no-results";
  return {
    results,
    diagnostic: {
      source: "langsearch",
      status,
      resultsFound: results.length,
      message: results.length > 0
        ? `LangSearch found ${results.length} organizational-structure leads using ${dedicatedCount} dedicated key(s) with failover.`
        : "LangSearch returned no usable organizational-structure pages.",
      error: errors.length > 0 ? errors.slice(0, 8).join("; ") : undefined,
    },
  };
}

async function cloudflareRerank(companyName: string, results: SearchResult[]): Promise<{ results: SearchResult[]; diagnostic: ProviderDiagnostic }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN;
  if (!accountId || !token) return { results, diagnostic: { source: "cloudflare", status: "not-configured", resultsFound: 0, message: "Cloudflare semantic reranking is not configured." } };
  if (results.length === 0) return { results, diagnostic: { source: "cloudflare", status: "no-results", resultsFound: 0, message: "No LangSearch leadership results were available to rerank." } };
  const model = process.env.CLOUDFLARE_RERANK_MODEL || "@cf/baai/bge-reranker-base";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${companyName} official current executive leadership management board directors business unit leaders biographies`,
        top_k: Math.min(results.length, MAX_SEARCH_RESULTS),
        contexts: results.map((result) => ({ text: `${result.title}\n${result.url}\n${result.snippet}`.slice(0, 4_000) })),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const ranked: any[] = payload?.result?.response || payload?.result || [];
    if (!Array.isArray(ranked) || ranked.length === 0) {
      return { results, diagnostic: { source: "cloudflare", status: "partial", resultsFound: 0, message: "Cloudflare returned no usable ranking rows; LangSearch ordering was retained." } };
    }
    const ordered: SearchResult[] = [];
    const used = new Set<number>();
    for (const row of ranked) {
      const index = Number(row?.id ?? row?.index);
      if (!Number.isInteger(index) || index < 0 || index >= results.length || used.has(index)) continue;
      used.add(index);
      ordered.push({ ...results[index], score: Number.isFinite(Number(row?.score)) ? Number(row.score) : results[index].score });
    }
    results.forEach((result, index) => { if (!used.has(index)) ordered.push(result); });
    return { results: ordered, diagnostic: { source: "cloudflare", status: "success", resultsFound: used.size, message: `Cloudflare semantically reranked ${used.size} LangSearch leadership candidates.` } };
  } catch (error) {
    return { results, diagnostic: { source: "cloudflare", status: "error", resultsFound: 0, message: "Cloudflare reranking failed; LangSearch ordering was retained.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

function officialSeeds(primaryUrl?: string): SearchResult[] {
  const official = primaryUrl ? safePublicUrl(primaryUrl) : null;
  if (!official) return [];
  return ["/", "/leadership", "/management", "/executive-team", "/our-team", "/board-of-directors", "/governance", "/about-us"].map((path) => ({
    title: `${official.hostname} ${path === "/" ? "home" : path.slice(1).replace(/-/g, " ")}`,
    url: new URL(path, official).toString(),
    snippet: "Official company-domain organizational-structure discovery seed.",
  }));
}

async function fetchPage(urlValue: string, officialWebsite?: string): Promise<PageDocument | null> {
  let current = safePublicUrl(urlValue);
  if (!current) return null;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    await assertPublicDestination(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.4" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        current = location ? safePublicUrl(new URL(location, current).toString()) : null;
        if (!current) return null;
        continue;
      }
      if (!response.ok || Number(response.headers.get("content-length") || 0) > MAX_PAGE_BYTES) return null;
      const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
      const text = cleanText(html, MAX_PAGE_TEXT);
      if (text.length < 100) return null;
      return {
        title: cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240) || current.hostname,
        url: current.toString(),
        text,
        sourceType: officialWebsite && sameHost(current.toString(), officialWebsite) ? "official" : "public-web",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function readPages(results: SearchResult[], officialWebsite?: string): Promise<{ pages: PageDocument[]; sources: SourceRecord[] }> {
  const pages: PageDocument[] = [];
  const sources: SourceRecord[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (pages.length >= MAX_PAGES) break;
    const parsed = safePublicUrl(result.url);
    if (!parsed || seen.has(parsed.toString())) continue;
    if (!LEADERSHIP_PATTERN.test(`${parsed.pathname} ${result.title} ${result.snippet}`) && !(officialWebsite && sameHost(parsed.toString(), officialWebsite))) continue;
    seen.add(parsed.toString());
    try {
      const page = await fetchPage(parsed.toString(), officialWebsite);
      if (!page) {
        sources.push({ url: parsed.toString(), label: result.title || parsed.hostname, sourceType: officialWebsite && sameHost(parsed.toString(), officialWebsite) ? "official" : "public-web", status: "failed", note: "Page could not be read by the organizational-structure extraction layer." });
        continue;
      }
      pages.push(page);
      sources.push({ url: page.url, label: page.title, sourceType: page.sourceType, status: "analyzed", note: "LangSearch-discovered page analyzed for named leaders and current titles." });
    } catch (error) {
      sources.push({ url: parsed.toString(), label: result.title || parsed.hostname, sourceType: officialWebsite && sameHost(parsed.toString(), officialWebsite) ? "official" : "public-web", status: "failed", note: error instanceof Error ? error.message : "Page could not be read." });
    }
  }
  return { pages, sources };
}

function extractionSchema() {
  return {
    type: "object",
    properties: {
      people: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            department: { type: "string" },
            location: { type: "string" },
            bio: { type: "string" },
            sourceUrl: { type: "string" },
            evidenceSnippet: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["name", "title", "sourceUrl", "evidenceSnippet", "confidence"],
        },
      },
    },
    required: ["people"],
  };
}

function extractionPrompt(companyName: string, pages: PageDocument[]): string {
  const sources = pages.map((page, index) => `SOURCE ${index + 1}\nURL: ${page.url}\nTITLE: ${page.title}\nTEXT: ${page.text}`).join("\n\n---\n\n");
  return `Build the current organizational structure of "${companyName}" from these LangSearch-discovered public webpages. Extract only named people whose current leadership, governance, executive, vice-president, director, manager, or publicly identified specialist role is supported by the supplied page. Never invent a person, title, department, reporting relationship, or URL. Exclude former leaders unless the page clearly says they still serve. Exclude authors, customers, speakers, unrelated people, organizations, committees, headings, and document fragments. Return each supplied source URL exactly and include a short evidence excerpt supporting both the person and current role. Do not use or infer from SEC filings.\n\n${sources}`;
}

function parsePeople(value: unknown, pages: PageDocument[]): ExtractedPerson[] {
  const rows = Array.isArray((value as any)?.people) ? (value as any).people : [];
  const pageByUrl = new Map(pages.map((page) => [page.url, page]));
  const unique = new Map<string, ExtractedPerson>();
  for (const row of rows) {
    const name = cleanText(row?.name, 140);
    const title = cleanText(row?.title, 240);
    const sourceUrl = safePublicUrl(String(row?.sourceUrl || ""))?.toString() || "";
    const evidenceSnippet = cleanText(row?.evidenceSnippet, 700);
    const page = pageByUrl.get(sourceUrl);
    if (!name || name.split(/\s+/).length < 2 || !title || !sourceUrl || !page || !evidenceSnippet) continue;
    const normalizedPage = normalizeKey(page.text);
    const nameTokens = normalizeKey(name).split(" ").filter((token) => token.length > 1);
    if (nameTokens.length < 2 || !nameTokens.every((token) => normalizedPage.includes(token))) continue;
    const confidence = ["high", "medium", "low"].includes(String(row?.confidence)) ? row.confidence as ExtractedPerson["confidence"] : "medium";
    unique.set(normalizeKey(name), {
      name,
      title,
      department: cleanText(row?.department, 160) || undefined,
      location: cleanText(row?.location, 160) || undefined,
      bio: cleanText(row?.bio, 900) || undefined,
      sourceUrl,
      evidenceSnippet,
      confidence,
    });
  }
  return Array.from(unique.values()).slice(0, MAX_PEOPLE);
}

async function geminiExtract(companyName: string, pages: PageDocument[]): Promise<{ people: ExtractedPerson[]; diagnostic: ProviderDiagnostic }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { people: [], diagnostic: { source: "gemini", status: "not-configured", resultsFound: 0, message: "GEMINI_API_KEY is not configured." } };
  if (pages.length === 0) return { people: [], diagnostic: { source: "gemini", status: "no-results", resultsFound: 0, message: "No LangSearch-discovered leadership pages were available for Gemini extraction." } };
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: extractionPrompt(companyName, pages) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 12_000, responseMimeType: "application/json", responseJsonSchema: extractionSchema() },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => String(part?.text || "")).join("") || "{}";
    const people = parsePeople(JSON.parse(text), pages);
    return { people, diagnostic: { source: "gemini", status: people.length > 0 ? "success" : "no-results", resultsFound: people.length, message: `Gemini extracted ${people.length} source-supported people from ${pages.length} LangSearch-discovered pages.` } };
  } catch (error) {
    return { people: [], diagnostic: { source: "gemini", status: "error", resultsFound: 0, message: "Gemini organizational-structure extraction failed.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

function toPerson(person: ExtractedPerson, pages: PageDocument[]): Person {
  const page = pages.find((candidate) => candidate.url === person.sourceUrl)!;
  const exactTitle = normalizeKey(page.text).includes(normalizeKey(person.title));
  const confidence: Confidence = person.confidence === "high" && exactTitle && page.sourceType === "official"
    ? "confirmed"
    : person.confidence === "low" ? "inferred" : "probable";
  return {
    id: personId(person.name),
    name: person.name,
    title: person.title,
    level: leadershipLevel(person.title),
    department: person.department || departmentFor(person.title),
    location: person.location,
    bio: person.bio,
    confidence,
    sourceUrls: [person.sourceUrl],
    evidence: [{
      url: person.sourceUrl,
      label: page.title,
      sourceType: page.sourceType,
      snippet: person.evidenceSnippet,
      fetchedAt: new Date().toISOString(),
    }],
  };
}

function buildGaps(people: Person[]): LeadershipResult["gaps"] {
  const has = (level: LeadershipLevel) => people.some((person) => person.level === level);
  const gaps: LeadershipResult["gaps"] = [];
  if (!has("board")) gaps.push({ level: "board", label: "Board or governing body", reason: "No source-supported board-level people were identified by the public-web search." });
  if (!people.some((person) => /chief executive|\bceo\b|president/i.test(person.title))) gaps.push({ level: "executive", label: "Chief executive", reason: "A source-supported chief executive or president was not identified." });
  if (!has("senior-leadership")) gaps.push({ level: "senior-leadership", label: "Vice presidents / business-unit leaders", reason: "No source-supported vice-president or comparable layer was identified." });
  if (!has("director")) gaps.push({ level: "director", label: "Director layer", reason: "No source-supported director-level people were identified." });
  if (!has("manager")) gaps.push({ level: "manager", label: "Management layer", reason: "Public pages may not expose the complete manager layer." });
  return gaps;
}

function snapshotFromMetadata(metadata: Record<string, unknown>): SavedSnapshot | null {
  const value = metadata[SNAPSHOT_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<SavedSnapshot>;
  if (!snapshot.result || typeof snapshot.result !== "object" || !snapshot.savedAt) return null;
  return snapshot as SavedSnapshot;
}

async function findEntity(companyName: string) {
  const [entity] = await db.select().from(entitiesTable).where(sql`
    lower(${entitiesTable.name}) = lower(${companyName})
    OR lower(${entitiesTable.displayName}) = lower(${companyName})
    OR lower(coalesce(${entitiesTable.metadata}->>'enteredName', '')) = lower(${companyName})
    OR lower(coalesce(${entitiesTable.metadata}->>'canonicalName', '')) = lower(${companyName})
  `).limit(1);
  return entity;
}

async function getOrCreateEntity(companyName: string) {
  const existing = await findEntity(companyName);
  if (existing) return existing;
  const [created] = await db.insert(entitiesTable).values({
    name: companyName,
    displayName: companyName,
    type: "company",
    status: "candidate",
    source: "organizational-chart-builder",
    metadata: { enteredName: companyName },
  }).returning();
  return created;
}

async function saveSnapshot(entityId: number, result: LeadershipResult, sourceInputs: SavedSnapshot["sourceInputs"]): Promise<void> {
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
  if (!entity) throw new Error("The company record no longer exists in Neon.");
  const savedAt = result.savedAt;
  await db.update(entitiesTable).set({
    displayName: result.companyName || entity.displayName,
    metadata: {
      ...objectMetadata(entity.metadata),
      [SNAPSHOT_KEY]: { version: SNAPSHOT_VERSION, savedAt, result, sourceInputs } satisfies SavedSnapshot,
    },
    updatedAt: new Date(),
  }).where(eq(entitiesTable.id, entityId));
}

function cachedResponse(entityId: number, snapshot: SavedSnapshot): LeadershipResult {
  return {
    ...snapshot.result,
    cacheHit: true,
    entityId,
    savedAt: snapshot.savedAt,
    savedToDatabase: true,
    warnings: Array.from(new Set([
      "Loaded the saved organizational chart from Neon without calling LangSearch, Cloudflare, Gemini, or Cerebras again.",
      ...(snapshot.result.warnings || []),
    ])),
  };
}

router.post("/leadership-map/analyze", async (req: Request, res: Response) => {
  const companyName = cleanText(req.body?.companyName, 180);
  const refresh = req.body?.refresh === true || req.body?.forceRefresh === true;
  if (!companyName) {
    res.status(400).json({ error: "Company name is required." });
    return;
  }

  try {
    const existing = await findEntity(companyName);
    const existingSnapshot = existing ? snapshotFromMetadata(objectMetadata(existing.metadata)) : null;
    if (existing && existingSnapshot && !refresh) {
      res.setHeader("X-Insight-Hub-Leadership-Cache", "HIT");
      res.json(cachedResponse(existing.id, existingSnapshot));
      return;
    }

    const startedAt = new Date().toISOString();
    const entity = existing || await getOrCreateEntity(companyName);
    const primaryUrl = cleanText(req.body?.primaryUrl, 2_000) || undefined;
    const supportingUrls: string[] = Array.isArray(req.body?.supportingUrls)
      ? req.body.supportingUrls.map((value: unknown) => cleanText(value, 2_000)).filter(Boolean).slice(0, 12)
      : [];

    const langSearch = await langSearchLeadership(companyName);
    const provided = [primaryUrl, ...supportingUrls].filter((value): value is string => Boolean(value)).flatMap((value) => {
      const url = safePublicUrl(value);
      return url ? [{ title: url.hostname, url: url.toString(), snippet: "User-provided public organizational-structure source." }] : [];
    });
    const discoveredOfficial = primaryUrl || langSearch.results.find((result) => looksOfficial(result.url, companyName))?.url;
    const unique = new Map<string, SearchResult>();
    for (const result of [...provided, ...officialSeeds(discoveredOfficial), ...langSearch.results]) unique.set(resultKey(result), result);
    const candidates = Array.from(unique.values()).slice(0, MAX_SEARCH_RESULTS);

    const reranked = await cloudflareRerank(companyName, candidates);
    const read = await readPages(reranked.results, discoveredOfficial);
    const gemini = await geminiExtract(companyName, read.pages);
    const people = gemini.people.map((person) => toPerson(person, read.pages));
    const gaps = buildGaps(people);
    const warnings: string[] = [];
    if (read.pages.length === 0) warnings.push("No LangSearch-discovered organizational-structure pages could be read.");
    if (people.length === 0) warnings.push("No source-supported current leaders were extracted from the public pages.");

    const savedAt = new Date().toISOString();
    const result: LeadershipResult = {
      companyName,
      startedAt,
      completedAt: savedAt,
      people,
      edges: [],
      gaps,
      sources: read.sources,
      warnings,
      summary: {
        people: people.length,
        confirmed: people.filter((person) => person.confidence === "confirmed").length,
        probable: people.filter((person) => person.confidence === "probable").length,
        inferred: people.filter((person) => person.confidence === "inferred").length,
        levels: new Set(people.map((person) => person.level)).size,
        sourcesAnalyzed: read.sources.filter((source) => source.status === "analyzed").length,
        gaps: gaps.length,
      },
      methodology: "The organizational chart uses LangSearch as the primary public-web discovery engine, with LANGSEARCH_API_KEY_3 and LANGSEARCH_API_KEY_4 dedicated first and the original LangSearch keys available only as failover. Cloudflare may semantically rerank the discovered pages, Gemini extracts source-supported named people and current roles, and Cerebras Version 2 performs final validation before the response is persisted. SEC filings are not queried, fetched, parsed, or used for organizational-structure extraction.",
      providerDiagnostics: [langSearch.diagnostic, reranked.diagnostic, gemini.diagnostic],
      cacheHit: false,
      entityId: entity.id,
      savedAt,
      savedToDatabase: true,
      pagesConsidered: candidates.length,
      aiPagesRead: read.pages.length,
    };

    await saveSnapshot(entity.id, result, { primaryUrl, supportingUrls });
    res.setHeader("X-Insight-Hub-Leadership-Discovery", "LANGSEARCH");
    res.json(result);
  } catch (error) {
    console.error("LangSearch organizational-chart build failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Organizational chart analysis failed." });
  }
});

export default router;
