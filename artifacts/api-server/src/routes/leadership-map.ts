import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 18;
const MAX_PEOPLE = 240;
const REQUEST_TIMEOUT_MS = 22_000;
const USER_AGENT = "Occu-Med Insight Hub leadership map (manual public-source analysis)";
const SEC_DIRECTORY_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";

type Confidence = "confirmed" | "probable" | "inferred";
type LeadershipLevel = "board" | "executive" | "senior-leadership" | "director" | "manager" | "individual-contributor" | "unknown";
type SourceType = "official" | "sec" | "press" | "public-web";

type Evidence = {
  url: string;
  label: string;
  sourceType: SourceType;
  snippet: string;
  fetchedAt: string;
};

type LeadershipPerson = {
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

type LeadershipEdge = {
  fromId: string;
  toId: string;
  relationship: "explicit-reporting-line" | "inferred-title-hierarchy";
  confidence: Confidence;
  note: string;
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

type PageResult = {
  url: URL;
  html: string;
  label: string;
  sourceType: SourceType;
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
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Leadership source URLs must use http or https.");
  if (parsed.username || parsed.password) throw new Error("Leadership source URLs cannot contain embedded credentials.");
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
      if (redirectsRemaining <= 0) throw new Error("Leadership source redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Leadership source returned a redirect without a destination.");
      return fetchPublic(new URL(location, input), redirectsRemaining - 1);
    }
    return { response, finalUrl: input };
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response: globalThis.Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Leadership source is too large to analyze safely.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_SOURCE_BYTES) throw new Error("Leadership source is too large to analyze safely.");
  return new TextDecoder().decode(buffer);
}

function sourceTypeFor(url: URL, officialHosts: Set<string>): SourceType {
  if (url.hostname.endsWith("sec.gov")) return "sec";
  if (officialHosts.has(url.hostname)) return "official";
  if (/press|news|media|investor|governance/i.test(url.pathname)) return "press";
  return "public-web";
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

function isLeadershipLink(link: { href: URL; text: string }): boolean {
  const value = `${link.href.pathname} ${link.text}`.toLowerCase();
  return /(leadership|management|executive|board|directors|our-team|our-people|people|governance|who-we-are|about-us|company)/.test(value);
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function plausibleName(value: string): boolean {
  const clean = cleanText(value, 120);
  if (!/^[A-Z][A-Za-z'’.-]+(?:\s+(?:[A-Z]\.|[A-Z][A-Za-z'’.-]+)){1,4}$/.test(clean)) return false;
  if (/^(Board Of Directors|Executive Leadership|Leadership Team|Senior Leadership|Management Team|Chief Executive Officer|President And CEO)$/i.test(clean)) return false;
  return clean.split(/\s+/).every((part) => part.length > 1 || /^[A-Z]\.$/.test(part));
}

function titleLevel(title: string): LeadershipLevel {
  const value = title.toLowerCase();
  if (/board|chairman|chairwoman|chairperson|non-executive director/.test(value)) return "board";
  if (/chief\s|ceo|cfo|coo|cio|cto|cmo|chro|president|founder|managing director|general counsel/.test(value)) return "executive";
  if (/executive vice president|senior vice president|vice president|svp|evp|head of|country manager|general manager/.test(value)) return "senior-leadership";
  if (/director|controller|treasurer|secretary/.test(value)) return "director";
  if (/manager|supervisor|lead\b/.test(value)) return "manager";
  if (/analyst|specialist|engineer|consultant|coordinator|associate|advisor|officer/.test(value)) return "individual-contributor";
  return "unknown";
}

function departmentFor(title: string): string | undefined {
  const value = title.toLowerCase();
  const matches: Array<[RegExp, string]> = [
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
  return matches.find(([pattern]) => pattern.test(value))?.[1];
}

function titleLooksRelevant(value: string): boolean {
  return /(chief|ceo|cfo|coo|cio|cto|cmo|chro|president|founder|chair|board|director|vice president|svp|evp|head of|general manager|managing director|manager|supervisor|analyst|specialist|officer|counsel|controller|treasurer|secretary)/i.test(value);
}

function confidenceRank(value: Confidence): number {
  return value === "confirmed" ? 3 : value === "probable" ? 2 : 1;
}

function personId(name: string): string {
  return `person-${normalizeName(name)}`;
}

function upsertPerson(target: Map<string, LeadershipPerson>, person: LeadershipPerson): void {
  const key = normalizeName(person.name);
  if (!key || !plausibleName(person.name)) return;
  const existing = target.get(key);
  if (!existing) {
    target.set(key, person);
    return;
  }
  const stronger = confidenceRank(person.confidence) > confidenceRank(existing.confidence) ? person : existing;
  const weaker = stronger === person ? existing : person;
  target.set(key, {
    ...stronger,
    title: stronger.title.length >= weaker.title.length ? stronger.title : weaker.title,
    level: stronger.level !== "unknown" ? stronger.level : weaker.level,
    department: stronger.department || weaker.department,
    location: stronger.location || weaker.location,
    bio: stronger.bio || weaker.bio,
    sourceUrls: Array.from(new Set([...existing.sourceUrls, ...person.sourceUrls])),
    evidence: [...existing.evidence, ...person.evidence].filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url && candidate.snippet === item.snippet) === index).slice(0, 12),
  });
}

function jsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jsonLdObjects);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(jsonLdObjects)];
}

function extractJsonLdPeople(page: PageResult, target: Map<string, LeadershipPerson>): void {
  const scripts = page.html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      for (const object of jsonLdObjects(parsed)) {
        const rawType = object["@type"];
        const types = Array.isArray(rawType) ? rawType.map(String) : [String(rawType || "")];
        if (!types.some((type) => type.toLowerCase() === "person")) continue;
        const name = cleanText(object.name, 120);
        const title = cleanText(object.jobTitle || object.description, 220);
        if (!plausibleName(name) || !titleLooksRelevant(title)) continue;
        const evidence: Evidence = {
          url: page.url.toString(),
          label: page.label,
          sourceType: page.sourceType,
          snippet: `${name} — ${title}`,
          fetchedAt: new Date().toISOString(),
        };
        upsertPerson(target, {
          id: personId(name), name, title, level: titleLevel(title), department: departmentFor(title),
          bio: cleanText(object.description, 700) || undefined,
          confidence: page.sourceType === "official" || page.sourceType === "sec" ? "confirmed" : "probable",
          sourceUrls: [page.url.toString()], evidence: [evidence],
        });
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
}

function extractTextBlocks(html: string): string[] {
  const blocks: string[] = [];
  const expression = /<(h[1-6]|p|li|dt|dd|div|span)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html)) !== null) {
    const text = cleanText(match[2], 360);
    if (text.length >= 4 && text.length <= 360) blocks.push(text);
  }
  return blocks.filter((value, index, all) => all.indexOf(value) === index).slice(0, 4_000);
}

function titleFromCombined(combined: string, name: string): string {
  const withoutName = combined.replace(name, " ").replace(/^[\s|–—,:-]+|[\s|–—,:-]+$/g, "").replace(/\s+/g, " ");
  const title = withoutName.split(/(?:\s{2,}|\||•)/)[0]?.trim() || withoutName;
  return cleanText(title, 220);
}

function extractBlockPeople(page: PageResult, target: Map<string, LeadershipPerson>): void {
  const blocks = extractTextBlocks(page.html);
  const namePattern = /\b([A-Z][A-Za-z'’.-]+(?:\s+(?:[A-Z]\.|[A-Z][A-Za-z'’.-]+)){1,4})\b/g;
  const seenPairs = new Set<string>();
  const candidates: Array<{ name: string; title: string; snippet: string }> = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const current = blocks[index];
    const next = blocks[index + 1] || "";
    const previous = blocks[index - 1] || "";
    const combinations = [current, `${current} | ${next}`, `${previous} | ${current}`];
    for (const combined of combinations) {
      if (!titleLooksRelevant(combined)) continue;
      const names = Array.from(combined.matchAll(namePattern)).map((match) => cleanText(match[1], 120)).filter(plausibleName);
      for (const name of names.slice(0, 3)) {
        const title = titleFromCombined(combined, name);
        if (!titleLooksRelevant(title) || title.length < 3 || title.length > 220) continue;
        const key = `${normalizeName(name)}|${title.toLowerCase()}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        candidates.push({ name, title, snippet: cleanText(combined, 500) });
      }
    }
  }

  for (const candidate of candidates.slice(0, MAX_PEOPLE)) {
    const evidence: Evidence = {
      url: page.url.toString(), label: page.label, sourceType: page.sourceType,
      snippet: candidate.snippet, fetchedAt: new Date().toISOString(),
    };
    upsertPerson(target, {
      id: personId(candidate.name), name: candidate.name, title: candidate.title,
      level: titleLevel(candidate.title), department: departmentFor(candidate.title),
      confidence: page.sourceType === "official" || page.sourceType === "sec" ? "probable" : "inferred",
      sourceUrls: [page.url.toString()], evidence: [evidence],
    });
  }
}

async function analyzePage(url: URL, officialHosts: Set<string>): Promise<PageResult> {
  const { response, finalUrl } = await fetchPublic(url);
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  const html = await readLimitedText(response);
  return { url: finalUrl, html, label: pageLabel(html, finalUrl), sourceType: sourceTypeFor(finalUrl, officialHosts) };
}

async function crawlSources(seedUrls: URL[]): Promise<{ pages: PageResult[]; sources: SourceRecord[]; warnings: string[] }> {
  const officialHosts = new Set(seedUrls.map((url) => url.hostname));
  const queue = [...seedUrls];
  const visited = new Set<string>();
  const pages: PageResult[] = [];
  const sources: SourceRecord[] = [];
  const warnings: string[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const next = queue.shift();
    if (!next) break;
    const normalized = next.toString().replace(/#.*$/, "");
    if (visited.has(normalized)) continue;
    visited.add(normalized);
    try {
      const page = await analyzePage(new URL(normalized), officialHosts);
      pages.push(page);
      sources.push({ url: page.url.toString(), label: page.label, sourceType: page.sourceType, status: "analyzed", note: "Public page analyzed during this manual run." });
      for (const link of extractLinks(page.html, page.url)) {
        if (queue.length + pages.length >= MAX_PAGES * 3) break;
        if (!officialHosts.has(link.href.hostname) || !isLeadershipLink(link)) continue;
        const clean = link.href.toString().replace(/#.*$/, "");
        if (!visited.has(clean)) queue.push(new URL(clean));
      }
    } catch (error) {
      const note = error instanceof Error ? error.message : "Source could not be analyzed.";
      sources.push({ url: normalized, label: new URL(normalized).hostname, sourceType: sourceTypeFor(new URL(normalized), officialHosts), status: "failed", note });
      warnings.push(`${new URL(normalized).hostname}: ${note}`);
    }
  }

  return { pages, sources, warnings };
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
    const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json", "Accept-Encoding": "gzip, deflate" }, signal: controller.signal });
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
    if (!response.ok) throw new Error(`SEC document returned HTTP ${response.status}.`);
    return await readLimitedText(response);
  } finally {
    clearTimeout(timeout);
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanText(item, 500)) : [];
}

function normalizeCompany(value: string): string {
  return value.toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|holdings?)\b/g, "").replace(/[^a-z0-9]/g, "");
}

async function loadSecDirectory(): Promise<SecIssuer[]> {
  if (secDirectoryCache && secDirectoryCache.expiresAt > Date.now()) return secDirectoryCache.issuers;
  const payload = await fetchSecJson(SEC_DIRECTORY_URL) as DirectoryPayload;
  const fields = stringArray(payload.fields);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const cikIndex = fields.indexOf("cik");
  const nameIndex = fields.indexOf("name");
  const tickerIndex = fields.indexOf("ticker");
  const exchangeIndex = fields.indexOf("exchange");
  if (cikIndex < 0 || nameIndex < 0 || tickerIndex < 0) throw new Error("SEC issuer directory returned an unexpected structure.");
  const issuers = rows.flatMap((row): SecIssuer[] => {
    if (!Array.isArray(row)) return [];
    const digits = String(row[cikIndex] ?? "").replace(/\D/g, "");
    const name = cleanText(row[nameIndex], 220);
    if (!digits || !name) return [];
    return [{ cik: digits.padStart(10, "0"), name, ticker: cleanText(row[tickerIndex], 30) || undefined, exchange: exchangeIndex >= 0 ? cleanText(row[exchangeIndex], 80) || undefined : undefined }];
  });
  secDirectoryCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, issuers };
  return issuers;
}

function issuerScore(query: string, issuer: SecIssuer): number {
  const normalizedQuery = normalizeCompany(query);
  const normalizedName = normalizeCompany(issuer.name);
  const ticker = issuer.ticker?.toLowerCase() || "";
  const lowered = query.trim().toLowerCase();
  if (ticker && ticker === lowered) return 100;
  if (normalizedName === normalizedQuery) return 96;
  if (ticker && ticker.startsWith(lowered)) return 90;
  if (normalizedName.startsWith(normalizedQuery)) return 82;
  if (normalizedName.includes(normalizedQuery)) return 68;
  return 0;
}

async function loadSecLeadershipPage(query: string): Promise<{ page?: PageResult; source?: SourceRecord; warning?: string; issuer?: SecIssuer }> {
  if (!secUserAgent()) return { warning: "SEC enrichment skipped because SEC_USER_AGENT is not configured." };
  try {
    const issuers = await loadSecDirectory();
    const match = issuers.map((issuer) => ({ issuer, score: issuerScore(query, issuer) })).filter((entry) => entry.score >= 68).sort((a, b) => b.score - a.score)[0]?.issuer;
    if (!match) return { warning: "No sufficiently confident SEC issuer match was found." };
    const payload = await fetchSecJson(`${SEC_SUBMISSIONS_BASE}/CIK${match.cik}.json`);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { warning: "SEC submissions returned an unexpected structure.", issuer: match };
    const recent = ((payload as Record<string, unknown>).filings as Record<string, unknown> | undefined)?.recent as Record<string, unknown> | undefined;
    if (!recent) return { warning: "No recent SEC filings were available for leadership enrichment.", issuer: match };
    const forms = stringArray(recent.form);
    const accessionNumbers = stringArray(recent.accessionNumber);
    const primaryDocuments = stringArray(recent.primaryDocument);
    const preferred = ["DEF 14A", "10-K", "20-F", "8-K"];
    let selectedIndex = -1;
    for (const form of preferred) {
      selectedIndex = forms.findIndex((value) => value === form && Boolean(accessionNumbers[forms.indexOf(value)]));
      if (selectedIndex >= 0) break;
    }
    if (selectedIndex < 0) return { warning: "No proxy or annual filing was available for leadership enrichment.", issuer: match };
    const accession = accessionNumbers[selectedIndex];
    const primaryDocument = primaryDocuments[selectedIndex];
    if (!accession || !primaryDocument) return { warning: "The selected SEC filing did not expose a primary document.", issuer: match };
    const archiveUrl = `https://www.sec.gov/Archives/edgar/data/${Number(match.cik)}/${accession.replace(/-/g, "")}/${primaryDocument}`;
    const html = await fetchSecText(archiveUrl);
    const page: PageResult = { url: new URL(archiveUrl), html, label: `${match.name} ${forms[selectedIndex]}`, sourceType: "sec" };
    return { page, source: { url: archiveUrl, label: page.label, sourceType: "sec", status: "analyzed", note: "Latest available proxy or annual filing analyzed for named officers and directors." }, issuer: match };
  } catch (error) {
    return { warning: error instanceof Error ? error.message : "SEC enrichment failed." };
  }
}

function levelRank(level: LeadershipLevel): number {
  return ({ board: 0, executive: 1, "senior-leadership": 2, director: 3, manager: 4, "individual-contributor": 5, unknown: 6 })[level];
}

function buildEdges(people: LeadershipPerson[]): LeadershipEdge[] {
  const sorted = [...people].sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.name.localeCompare(b.name));
  const edges: LeadershipEdge[] = [];
  for (const person of sorted) {
    const personRank = levelRank(person.level);
    if (personRank <= 0 || person.level === "unknown") continue;
    const possibleParents = sorted.filter((candidate) => levelRank(candidate.level) < personRank && candidate.id !== person.id);
    if (possibleParents.length === 0) continue;
    const sameDepartment = possibleParents.filter((candidate) => candidate.department && candidate.department === person.department);
    const pool = sameDepartment.length > 0 ? sameDepartment : possibleParents;
    const parent = pool.sort((a, b) => levelRank(b.level) - levelRank(a.level) || a.name.localeCompare(b.name))[0];
    if (!parent) continue;
    edges.push({ fromId: parent.id, toId: person.id, relationship: "inferred-title-hierarchy", confidence: "inferred", note: "Placement is inferred from public titles and department signals; it is not a confirmed reporting line." });
  }
  return edges.slice(0, 400);
}

function buildGaps(people: LeadershipPerson[]): Array<{ level: LeadershipLevel; label: string; reason: string }> {
  const gaps: Array<{ level: LeadershipLevel; label: string; reason: string }> = [];
  const has = (level: LeadershipLevel) => people.some((person) => person.level === level);
  if (!has("board")) gaps.push({ level: "board", label: "Board or governing body", reason: "No board-level people were identified in the analyzed public sources." });
  if (!people.some((person) => /chief executive|\bceo\b|president/i.test(person.title))) gaps.push({ level: "executive", label: "Chief executive", reason: "A chief executive or president was not confidently identified." });
  if (!has("senior-leadership")) gaps.push({ level: "senior-leadership", label: "Vice presidents / business-unit leaders", reason: "No vice-president or comparable layer was identified." });
  if (!has("director")) gaps.push({ level: "director", label: "Director layer", reason: "No director-level people were identified." });
  if (!has("manager")) gaps.push({ level: "manager", label: "Management layer", reason: "Public sources rarely expose the full manager layer." });
  if (!has("individual-contributor")) gaps.push({ level: "individual-contributor", label: "Analysts and individual contributors", reason: "Public sources usually do not expose a complete individual-contributor roster." });
  return gaps;
}

router.post("/leadership-map/analyze", async (req: Request, res: Response) => {
  const companyName = cleanText(req.body?.companyName, 180);
  const primaryUrlText = cleanText(req.body?.primaryUrl, 2_000);
  const supportingRaw = Array.isArray(req.body?.supportingUrls)
    ? req.body.supportingUrls
    : cleanText(req.body?.supportingUrls, 8_000).split(/[\n,]+/);
  const supportingTexts = supportingRaw.map((value: unknown) => cleanText(value, 2_000)).filter(Boolean).slice(0, 8);
  const secQuery = cleanText(req.body?.secQuery, 180) || companyName;

  if (!companyName) {
    res.status(400).json({ error: "Company name is required." });
    return;
  }
  if (!primaryUrlText && supportingTexts.length === 0) {
    res.status(400).json({ error: "Add at least one public leadership, company, governance, or team page URL." });
    return;
  }

  let seedUrls: URL[];
  try {
    seedUrls = [primaryUrlText, ...supportingTexts].filter(Boolean).map(safeUrl);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "A source URL is invalid." });
    return;
  }

  const startedAt = new Date().toISOString();
  const peopleMap = new Map<string, LeadershipPerson>();
  const crawl = await crawlSources(seedUrls);
  for (const page of crawl.pages) {
    extractJsonLdPeople(page, peopleMap);
    extractBlockPeople(page, peopleMap);
  }

  const sec = await loadSecLeadershipPage(secQuery);
  if (sec.page) {
    extractJsonLdPeople(sec.page, peopleMap);
    extractBlockPeople(sec.page, peopleMap);
  }

  const people = Array.from(peopleMap.values())
    .filter((person) => titleLooksRelevant(person.title))
    .sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.name.localeCompare(b.name))
    .slice(0, MAX_PEOPLE);
  const edges = buildEdges(people);
  const gaps = buildGaps(people);
  const sources = [...crawl.sources, ...(sec.source ? [sec.source] : [])];
  const warnings = [...crawl.warnings, ...(sec.warning ? [sec.warning] : [])];
  if (people.length === 0) warnings.push("No leadership records were extracted. Add a more specific official team, leadership, governance, or executive page.");
  if (people.length > 0 && people.every((person) => person.confidence === "inferred")) warnings.push("All detected people require manual verification because none came from structured official or SEC records.");

  res.json({
    companyName,
    startedAt,
    completedAt: new Date().toISOString(),
    people,
    edges,
    gaps,
    sources,
    warnings,
    issuer: sec.issuer,
    summary: {
      people: people.length,
      confirmed: people.filter((person) => person.confidence === "confirmed").length,
      probable: people.filter((person) => person.confidence === "probable").length,
      inferred: people.filter((person) => person.confidence === "inferred").length,
      levels: new Set(people.map((person) => person.level)).size,
      sourcesAnalyzed: sources.filter((source) => source.status === "analyzed").length,
      gaps: gaps.length,
    },
    methodology: "The tool extracts named people and titles from user-supplied public pages, follows a limited set of same-domain leadership links, and optionally enriches public issuers with SEC proxy or annual filings. Any chart placement not explicitly stated by a source is labeled as inferred title hierarchy rather than a confirmed reporting line.",
  });
});

export default router;
