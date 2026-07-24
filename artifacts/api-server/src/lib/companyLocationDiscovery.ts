import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type DiscoveryConfidence = "exact" | "place" | "city" | "unknown";

export type CompanyLocationCandidate = {
  id: string;
  companyName: string;
  placeName: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  region?: string;
  facilityType?: string;
  activity?: string;
  notes?: string;
  coordinates: [number, number];
  geocodeSource: "osm" | "photon";
  geocodeConfidence: DiscoveryConfidence;
  sourceType: string;
  sourceClass: string;
  sourceId: string;
  reviewStatus: "candidate" | "needs-review";
  sourceUrl?: string;
  sourceTitle?: string;
  evidenceSnippet?: string;
  discoveredBy: "official-site" | "openstreetmap" | "photon";
};

export type DiscoveryDiagnostic = {
  source: "wikidata" | "web-search" | "official-site" | "openstreetmap" | "photon";
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type CompanyLocationDiscoveryResult = {
  enteredName: string;
  canonicalName: string;
  aliases: string[];
  wikidataId?: string;
  officialWebsite?: string;
  officialWebsiteSource?: "wikidata" | "web-search";
  locations: CompanyLocationCandidate[];
  diagnostics: DiscoveryDiagnostic[];
  officialPagesScanned: number;
  officialAddressesExtracted: number;
  warnings: string[];
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
};

type WikidataSearchResult = {
  id: string;
  label?: string;
  description?: string;
  aliases?: string[];
};

type NominatimResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  display_name: string;
  name?: string;
  address?: Record<string, string>;
};

type PhotonFeature = {
  properties: Record<string, string | number | undefined>;
  geometry: { coordinates: [number, number] };
};

type OfficialAddressEvidence = {
  name?: string;
  address: string;
  sourceUrl: string;
  sourceTitle?: string;
  facilityType?: string;
  evidenceSnippet?: string;
};

const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || process.env.SEC_USER_AGENT
  || "Occu-Med Insight Hub/2.0 company-location-discovery";
const MAX_SEARCH_RESULTS = 24;
const MAX_OFFICIAL_PAGES = 24;
const MAX_SITEMAP_URLS = 240;
const MAX_OFFICIAL_ADDRESSES = 30;
const MAX_RESPONSE_BYTES = 2_000_000;
const LOCATION_PATH_PATTERN = /location|office|branch|facility|facilities|site|sites|campus|contact|global|where-we-operate|our-presence|store|plant|warehouse|distribution|service-center|operations/i;
const BLOCKED_DOMAIN_PATTERN = /(^|\.)(facebook|instagram|linkedin|x|twitter|youtube|wikipedia|bloomberg|zoominfo|crunchbase|mapquest|yelp|glassdoor|indeed)\./i;
const ADDRESS_TYPE_PATTERN = /Organization|Corporation|LocalBusiness|Place|Office|Store|MedicalOrganization|GovernmentOffice|ProfessionalService|PostalAddress/i;
const geocodeCache = new Map<string, CompanyLocationCandidate | null>();
let lastNominatimRequestAt = 0;

function cleanText(value: unknown, max = 500): string | undefined {
  const cleaned = decodeHtml(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeKey(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function deterministicId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 18)}`;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

function safePublicUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return null;
    if (isIP(hostname) && (isPrivateIpv4(hostname) || hostname === "::1")) return null;
    if (BLOCKED_DOMAIN_PATTERN.test(hostname)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function sameCompanyHost(candidate: URL, official: URL): boolean {
  const left = candidate.hostname.toLowerCase().replace(/^www\./, "");
  const right = official.hostname.toLowerCase().replace(/^www\./, "");
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

async function fetchText(url: URL, timeoutMs = 9_000): Promise<{ text: string; finalUrl: URL; contentType: string }> {
  let current = url;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml,text/xml,application/json;q=0.9,*/*;q=0.6",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Redirect without location from ${current.hostname}`);
        const next = safePublicUrl(new URL(location, current).toString());
        if (!next) throw new Error("Unsafe redirect blocked");
        current = next;
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_RESPONSE_BYTES) throw new Error("Response exceeded size limit");
      const text = (await response.text()).slice(0, MAX_RESPONSE_BYTES);
      return { text, finalUrl: current, contentType: response.headers.get("content-type") || "" };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Too many redirects");
}

async function searchSerper(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!response.ok) throw new Error(`Serper HTTP ${response.status}`);
  const data = await response.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic || []).map((item) => ({ title: String(item.title || ""), url: String(item.link || ""), snippet: String(item.snippet || ""), provider: "serper" }));
}

async function searchExa(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, numResults: 10, type: "auto", contents: { text: { maxCharacters: 1200 } } }),
  });
  if (!response.ok) throw new Error(`Exa HTTP ${response.status}`);
  const data = await response.json() as { results?: Array<{ title?: string; url?: string; text?: string }> };
  return (data.results || []).map((item) => ({ title: String(item.title || ""), url: String(item.url || ""), snippet: String(item.text || ""), provider: "exa" }));
}

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: 10, include_answer: false, search_depth: "advanced" }),
  });
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
  const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results || []).map((item) => ({ title: String(item.title || ""), url: String(item.url || ""), snippet: String(item.content || ""), provider: "tavily" }));
}

async function runSearchQuery(query: string): Promise<{ results: SearchResult[]; provider?: string; error?: string }> {
  const providers: Array<{ name: string; key?: string; run: (query: string, key: string) => Promise<SearchResult[]> }> = [
    { name: "serper", key: process.env.SERPER_API_KEY, run: searchSerper },
    { name: "exa", key: process.env.EXA_API_KEY, run: searchExa },
    { name: "tavily", key: process.env.TAVILY_API_KEY, run: searchTavily },
  ];
  const configured = providers.filter((provider) => provider.key);
  if (configured.length === 0) return { results: [] };
  const errors: string[] = [];
  for (const provider of configured) {
    try {
      const results = await provider.run(query, provider.key!);
      if (results.length > 0) return { results, provider: provider.name };
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  return { results: [], error: errors.join("; ") };
}

function wikidataClaimString(entity: any, property: string): string | undefined {
  const claims = entity?.claims?.[property];
  if (!Array.isArray(claims)) return undefined;
  for (const claim of claims) {
    const value = claim?.mainsnak?.datavalue?.value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

async function resolveFromWikidata(companyName: string): Promise<{
  canonicalName: string;
  aliases: string[];
  wikidataId?: string;
  officialWebsite?: string;
  diagnostic: DiscoveryDiagnostic;
}> {
  try {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("search", companyName);
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("uselang", "en");
    searchUrl.searchParams.set("type", "item");
    searchUrl.searchParams.set("limit", "8");
    searchUrl.searchParams.set("format", "json");
    const response = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { search?: WikidataSearchResult[] };
    const normalizedCompany = normalizeKey(companyName);
    const ranked = (payload.search || []).map((item) => {
      const label = normalizeKey(item.label);
      const aliases = (item.aliases || []).map(normalizeKey);
      const description = normalizeKey(item.description);
      let score = label === normalizedCompany ? 100 : aliases.includes(normalizedCompany) ? 94 : 0;
      if (label.includes(normalizedCompany) || normalizedCompany.includes(label)) score += 35;
      if (/company|corporation|business|manufacturer|organization|enterprise|contractor|retailer|bank|airline|technology/.test(description)) score += 22;
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    const selected = ranked[0]?.score >= 22 ? ranked[0].item : undefined;
    if (!selected) {
      return {
        canonicalName: companyName,
        aliases: [],
        diagnostic: { source: "wikidata", status: "no-results", resultsFound: 0, message: "No confident Wikidata company match was found." },
      };
    }
    const entityUrl = new URL("https://www.wikidata.org/w/api.php");
    entityUrl.searchParams.set("action", "wbgetentities");
    entityUrl.searchParams.set("ids", selected.id);
    entityUrl.searchParams.set("props", "labels|aliases|descriptions|claims");
    entityUrl.searchParams.set("languages", "en");
    entityUrl.searchParams.set("format", "json");
    const entityResponse = await fetch(entityUrl, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
    if (!entityResponse.ok) throw new Error(`Entity HTTP ${entityResponse.status}`);
    const entityPayload = await entityResponse.json() as { entities?: Record<string, any> };
    const entity = entityPayload.entities?.[selected.id];
    const canonicalName = cleanText(entity?.labels?.en?.value, 160) || selected.label || companyName;
    const aliases = Array.from(new Set([
      ...(selected.aliases || []),
      ...((entity?.aliases?.en || []) as Array<{ value?: string }>).map((alias) => alias.value || ""),
    ].map((alias) => cleanText(alias, 160)).filter((alias): alias is string => Boolean(alias)))).slice(0, 12);
    const officialWebsite = wikidataClaimString(entity, "P856");
    return {
      canonicalName,
      aliases,
      wikidataId: selected.id,
      officialWebsite: safePublicUrl(officialWebsite || "")?.toString(),
      diagnostic: {
        source: "wikidata",
        status: "success",
        resultsFound: 1,
        message: officialWebsite
          ? `Resolved ${canonicalName} and its official website from Wikidata.`
          : `Resolved ${canonicalName}; Wikidata did not provide an official website.`,
      },
    };
  } catch (error) {
    return {
      canonicalName: companyName,
      aliases: [],
      diagnostic: { source: "wikidata", status: "error", resultsFound: 0, message: "Wikidata resolution failed.", error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

function companyTokens(companyName: string): string[] {
  return normalizeKey(companyName).split(" ").filter((token) => token.length > 2 && !["inc", "llc", "ltd", "corp", "corporation", "company", "group", "holdings"].includes(token));
}

function inferOfficialWebsite(companyName: string, results: SearchResult[]): string | undefined {
  const tokens = companyTokens(companyName);
  const scored = results.map((result) => {
    const url = safePublicUrl(result.url);
    if (!url) return { result, url, score: -1 };
    const haystack = normalizeKey(`${result.title} ${result.snippet} ${url.hostname}`);
    const matched = tokens.filter((token) => haystack.includes(token)).length;
    let score = matched * 18;
    if (/official|home|company website/.test(normalizeKey(`${result.title} ${result.snippet}`))) score += 25;
    if (url.pathname === "/" || url.pathname === "") score += 8;
    if (BLOCKED_DOMAIN_PATTERN.test(url.hostname)) score -= 100;
    return { result, url, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.url && scored[0].score >= 30 ? `${scored[0].url.origin}/` : undefined;
}

async function resolveOfficialWebsite(companyName: string, wikidataWebsite?: string): Promise<{
  officialWebsite?: string;
  source?: "wikidata" | "web-search";
  searchResults: SearchResult[];
  diagnostic: DiscoveryDiagnostic;
}> {
  const query = `"${companyName}" official website locations offices facilities branches`;
  const search = await runSearchQuery(query);
  if (wikidataWebsite) {
    return {
      officialWebsite: wikidataWebsite,
      source: "wikidata",
      searchResults: search.results,
      diagnostic: {
        source: "web-search",
        status: search.results.length > 0 ? "success" : search.error ? "error" : "not-configured",
        resultsFound: search.results.length,
        message: search.results.length > 0
          ? `${search.results.length} supporting web results were collected using ${search.provider}.`
          : search.error || "No web-search provider is configured; official-site discovery will use Wikidata and the company sitemap.",
        error: search.error,
      },
    };
  }
  const inferred = inferOfficialWebsite(companyName, search.results);
  return {
    officialWebsite: inferred,
    source: inferred ? "web-search" : undefined,
    searchResults: search.results,
    diagnostic: {
      source: "web-search",
      status: inferred ? "success" : search.results.length > 0 ? "partial" : search.error ? "error" : "not-configured",
      resultsFound: search.results.length,
      message: inferred
        ? `A probable official website was resolved using ${search.provider}.`
        : search.results.length > 0
          ? "Search results were found, but none were confident enough to treat as the official website."
          : search.error || "No web-search provider is configured.",
      error: search.error,
    },
  };
}

function parseRobots(text: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") applies = value === "*" || /insight hub/i.test(value);
    else if (key === "disallow" && applies && value) disallow.push(value);
    else if (key === "sitemap" && value) sitemaps.push(value);
  }
  return { disallow, sitemaps };
}

function isAllowedByRobots(url: URL, disallow: string[]): boolean {
  return !disallow.some((path) => path !== "/" && url.pathname.startsWith(path));
}

function extractXmlLocations(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi))
    .map((match) => cleanText(match[1], 2000))
    .filter((value): value is string => Boolean(value));
}

function extractPageTitle(html: string): string | undefined {
  return cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240);
}

function extractLinks(html: string, baseUrl: URL): URL[] {
  const urls: URL[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    try {
      const resolved = safePublicUrl(new URL(decodeHtml(match[1]), baseUrl).toString());
      if (resolved) urls.push(resolved);
    } catch {
      // ignore malformed links
    }
  }
  return urls;
}

function addressObjectToString(address: any): string | undefined {
  if (!address) return undefined;
  if (typeof address === "string") return cleanText(address, 500);
  if (typeof address !== "object") return undefined;
  const country = typeof address.addressCountry === "object" ? address.addressCountry?.name : address.addressCountry;
  return cleanText([
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
    country,
  ].filter(Boolean).join(", "), 500);
}

function walkJsonLd(value: unknown, sourceUrl: string, sourceTitle: string | undefined, output: OfficialAddressEvidence[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonLd(item, sourceUrl, sourceTitle, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, any>;
  const types = Array.isArray(node["@type"]) ? node["@type"].join(" ") : String(node["@type"] || "");
  const address = addressObjectToString(node.address || (ADDRESS_TYPE_PATTERN.test(types) ? node : undefined));
  if (address && address.length >= 8) {
    output.push({
      name: cleanText(node.name || node.legalName, 180),
      address,
      sourceUrl,
      sourceTitle,
      facilityType: cleanText(types, 120),
      evidenceSnippet: cleanText(`${node.name || ""} ${address}`, 500),
    });
  }
  Object.values(node).forEach((child) => {
    if (child && typeof child === "object") walkJsonLd(child, sourceUrl, sourceTitle, output);
  });
}

function extractOfficialAddresses(html: string, sourceUrl: string): OfficialAddressEvidence[] {
  const title = extractPageTitle(html);
  const evidence: OfficialAddressEvidence[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = decodeHtml(match[1]).trim();
    try {
      walkJsonLd(JSON.parse(raw), sourceUrl, title, evidence);
    } catch {
      // invalid JSON-LD is ignored; address elements are still checked below
    }
  }
  for (const match of html.matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/gi)) {
    const address = cleanText(match[1], 500);
    if (address && address.length >= 12) evidence.push({ address, sourceUrl, sourceTitle: title, evidenceSnippet: address });
  }
  for (const match of html.matchAll(/<[^>]+itemprop\s*=\s*["']address["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)) {
    const address = cleanText(match[1], 500);
    if (address && address.length >= 12) evidence.push({ address, sourceUrl, sourceTitle: title, evidenceSnippet: address });
  }
  const unique = new Map<string, OfficialAddressEvidence>();
  for (const item of evidence) {
    const key = normalizeKey(item.address);
    if (key.length >= 8 && !unique.has(key)) unique.set(key, item);
  }
  return Array.from(unique.values());
}

async function collectSitemapUrls(official: URL, declaredSitemaps: string[]): Promise<URL[]> {
  const queue = Array.from(new Set([...declaredSitemaps, new URL("/sitemap.xml", official).toString()]));
  const collected: URL[] = [];
  const visited = new Set<string>();
  while (queue.length > 0 && visited.size < 5 && collected.length < MAX_SITEMAP_URLS) {
    const nextValue = queue.shift()!;
    const next = safePublicUrl(nextValue);
    if (!next || !sameCompanyHost(next, official) || visited.has(next.toString())) continue;
    visited.add(next.toString());
    try {
      const { text } = await fetchText(next, 8_000);
      const urls = extractXmlLocations(text);
      const isIndex = /<sitemapindex/i.test(text);
      for (const value of urls) {
        const parsed = safePublicUrl(value);
        if (!parsed || !sameCompanyHost(parsed, official)) continue;
        if (isIndex && queue.length < 10) queue.push(parsed.toString());
        else if (collected.length < MAX_SITEMAP_URLS) collected.push(parsed);
      }
    } catch {
      // sitemap failures are non-fatal
    }
  }
  return collected;
}

async function crawlOfficialLocationPages(officialWebsite: string, searchResults: SearchResult[]): Promise<{
  evidence: OfficialAddressEvidence[];
  pagesScanned: number;
  diagnostic: DiscoveryDiagnostic;
}> {
  const official = safePublicUrl(officialWebsite);
  if (!official) {
    return { evidence: [], pagesScanned: 0, diagnostic: { source: "official-site", status: "no-results", resultsFound: 0, message: "No safe official website was available to crawl." } };
  }
  let disallow: string[] = [];
  let sitemaps: string[] = [];
  try {
    const robots = await fetchText(new URL("/robots.txt", official), 6_000);
    ({ disallow, sitemaps } = parseRobots(robots.text));
  } catch {
    // missing robots.txt is treated as no declared restrictions
  }
  const sitemapUrls = await collectSitemapUrls(official, sitemaps);
  const candidates = new Map<string, URL>();
  const addCandidate = (url: URL | null) => {
    if (!url || !sameCompanyHost(url, official) || !isAllowedByRobots(url, disallow)) return;
    url.hash = "";
    candidates.set(url.toString(), url);
  };
  addCandidate(official);
  ["/locations", "/offices", "/contact", "/contact-us", "/global-locations", "/where-we-operate", "/our-locations", "/facilities"].forEach((path) => addCandidate(safePublicUrl(new URL(path, official).toString())));
  sitemapUrls.filter((url) => LOCATION_PATH_PATTERN.test(url.pathname)).slice(0, 160).forEach(addCandidate);
  searchResults.map((result) => safePublicUrl(result.url)).filter((url): url is URL => Boolean(url && sameCompanyHost(url, official) && LOCATION_PATH_PATTERN.test(url.pathname))).forEach(addCandidate);

  const evidence: OfficialAddressEvidence[] = [];
  const scanned = new Set<string>();
  const queue = Array.from(candidates.values()).slice(0, MAX_OFFICIAL_PAGES);
  while (queue.length > 0 && scanned.size < MAX_OFFICIAL_PAGES) {
    const page = queue.shift()!;
    if (scanned.has(page.toString())) continue;
    scanned.add(page.toString());
    try {
      const response = await fetchText(page);
      if (!/html|xhtml/i.test(response.contentType) && !/<html/i.test(response.text)) continue;
      evidence.push(...extractOfficialAddresses(response.text, response.finalUrl.toString()));
      for (const link of extractLinks(response.text, response.finalUrl)) {
        if (scanned.size + queue.length >= MAX_OFFICIAL_PAGES) break;
        if (sameCompanyHost(link, official) && LOCATION_PATH_PATTERN.test(link.pathname) && isAllowedByRobots(link, disallow) && !scanned.has(link.toString())) queue.push(link);
      }
    } catch {
      // individual page failures remain visible through partial diagnostics
    }
  }
  const unique = new Map<string, OfficialAddressEvidence>();
  for (const item of evidence) {
    const key = normalizeKey(item.address);
    if (key && !unique.has(key)) unique.set(key, item);
  }
  const output = Array.from(unique.values()).slice(0, MAX_OFFICIAL_ADDRESSES);
  return {
    evidence: output,
    pagesScanned: scanned.size,
    diagnostic: {
      source: "official-site",
      status: output.length > 0 ? "success" : scanned.size > 0 ? "partial" : "no-results",
      resultsFound: output.length,
      message: output.length > 0
        ? `${output.length} unique address records were extracted from ${scanned.size} official-site pages.`
        : `${scanned.size} official-site pages were scanned, but no structured addresses were extracted.`,
    },
  };
}

function cityFrom(address: Record<string, string> | undefined): string | undefined {
  return address?.city || address?.town || address?.village || address?.municipality || address?.county;
}

function stateFrom(address: Record<string, string> | undefined): string | undefined {
  return address?.state || address?.region || address?.province;
}

function countryFrom(address: Record<string, string> | undefined, displayName: string): string {
  return address?.country || displayName.split(",").map((part) => part.trim()).filter(Boolean).at(-1) || "Unknown";
}

function confidenceForPlace(sourceClass: string, sourceType: string, address?: Record<string, string>): DiscoveryConfidence {
  const text = `${sourceClass}:${sourceType}`.toLowerCase();
  if (/office|company|industrial|commercial|aeroway|amenity|building|shop|healthcare/.test(text)) return "place";
  if (address?.road && (address?.house_number || address?.postcode)) return "exact";
  if (cityFrom(address)) return "city";
  return "unknown";
}

async function waitForNominatimSlot(): Promise<void> {
  const delay = Math.max(0, 1_050 - (Date.now() - lastNominatimRequestAt));
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  lastNominatimRequestAt = Date.now();
}

async function queryNominatim(query: string, limit = 40): Promise<NominatimResult[]> {
  await waitForNominatimSlot();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  return response.json() as Promise<NominatimResult[]>;
}

async function queryPhoton(query: string, limit = 40): Promise<PhotonFeature[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
  if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
  const payload = await response.json() as { features?: PhotonFeature[] };
  return payload.features || [];
}

function fromNominatim(companyName: string, result: NominatimResult): CompanyLocationCandidate | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const formattedAddress = result.display_name;
  const confidence = confidenceForPlace(result.class, result.type, result.address);
  return {
    id: `osm-${result.osm_type}-${result.osm_id}`,
    companyName,
    placeName: result.name || formattedAddress.split(",")[0] || companyName,
    formattedAddress,
    city: cityFrom(result.address),
    state: stateFrom(result.address),
    postalCode: result.address?.postcode,
    country: countryFrom(result.address, formattedAddress),
    region: stateFrom(result.address) || countryFrom(result.address, formattedAddress),
    facilityType: result.type,
    coordinates: [lon, lat],
    geocodeSource: "osm",
    geocodeConfidence: confidence,
    sourceType: result.type,
    sourceClass: result.class,
    sourceId: `${result.osm_type}/${result.osm_id}`,
    reviewStatus: confidence === "unknown" ? "needs-review" : "candidate",
    discoveredBy: "openstreetmap",
  };
}

function fromPhoton(companyName: string, feature: PhotonFeature, discoveredBy: CompanyLocationCandidate["discoveredBy"] = "photon"): CompanyLocationCandidate | null {
  const [lon, lat] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const props = feature.properties || {};
  const address = Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value ?? "")])) as Record<string, string>;
  const name = String(props.name || companyName);
  const city = cityFrom(address);
  const country = address.country || "Unknown";
  const formattedAddress = cleanText(props.formatted, 500) || [name, address.street, address.housenumber, city, address.state, address.postcode, country].filter(Boolean).join(", ");
  const sourceType = String(props.osm_key || "unknown");
  const sourceClass = String(props.osm_value || "unknown");
  const confidence = confidenceForPlace(sourceClass, sourceType, address);
  const osmId = String(props.osm_id || deterministicId("photon", `${formattedAddress}|${lon}|${lat}`));
  return {
    id: `photon-${osmId}`,
    companyName,
    placeName: name,
    formattedAddress,
    city,
    state: stateFrom(address),
    postalCode: address.postcode,
    country,
    region: stateFrom(address) || country,
    facilityType: sourceClass !== "unknown" ? sourceClass : sourceType,
    coordinates: [lon, lat],
    geocodeSource: "photon",
    geocodeConfidence: confidence,
    sourceType,
    sourceClass,
    sourceId: `photon/${osmId}`,
    reviewStatus: confidence === "unknown" ? "needs-review" : "candidate",
    discoveredBy,
  };
}

async function geocodeOfficialEvidence(companyName: string, evidence: OfficialAddressEvidence): Promise<CompanyLocationCandidate | null> {
  const cacheKey = normalizeKey(evidence.address);
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey);
    return cached ? { ...cached, companyName, sourceUrl: evidence.sourceUrl, sourceTitle: evidence.sourceTitle, evidenceSnippet: evidence.evidenceSnippet, discoveredBy: "official-site" } : null;
  }
  let candidate: CompanyLocationCandidate | null = null;
  try {
    const photon = await queryPhoton(evidence.address, 3);
    candidate = photon.map((feature) => fromPhoton(companyName, feature, "official-site")).find((item): item is CompanyLocationCandidate => Boolean(item)) || null;
  } catch {
    // Nominatim fallback below
  }
  if (!candidate) {
    try {
      const nominatim = await queryNominatim(evidence.address, 2);
      candidate = nominatim.map((item) => fromNominatim(companyName, item)).find((item): item is CompanyLocationCandidate => Boolean(item)) || null;
    } catch {
      candidate = null;
    }
  }
  if (candidate) {
    candidate = {
      ...candidate,
      id: deterministicId("official", `${evidence.sourceUrl}|${evidence.address}`),
      placeName: evidence.name || candidate.placeName || companyName,
      formattedAddress: evidence.address,
      facilityType: evidence.facilityType || candidate.facilityType || "Official company location",
      activity: "Company location identified from an official public webpage",
      notes: "Address extracted from the company’s official public website and geocoded for map placement.",
      sourceType: "official-address",
      sourceClass: "official-site",
      sourceId: deterministicId("official", evidence.sourceUrl),
      sourceUrl: evidence.sourceUrl,
      sourceTitle: evidence.sourceTitle,
      evidenceSnippet: evidence.evidenceSnippet,
      discoveredBy: "official-site",
      geocodeConfidence: /\d/.test(evidence.address) && /\b\d{4,6}(?:-\d{3,4})?\b/.test(evidence.address) ? "exact" : candidate.geocodeConfidence,
    };
  }
  geocodeCache.set(cacheKey, candidate);
  return candidate;
}

function candidateIdentity(candidate: CompanyLocationCandidate): string {
  const [lon, lat] = candidate.coordinates;
  const coordinate = Number.isFinite(lon) && Number.isFinite(lat) ? `${lon.toFixed(4)}|${lat.toFixed(4)}` : "missing";
  return `${coordinate}|${normalizeKey(candidate.formattedAddress || candidate.placeName)}`;
}

function mergeCandidates(candidates: CompanyLocationCandidate[]): CompanyLocationCandidate[] {
  const merged = new Map<string, CompanyLocationCandidate>();
  for (const candidate of candidates) {
    const key = candidateIdentity(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      continue;
    }
    const preferCandidate = candidate.discoveredBy === "official-site" && existing.discoveredBy !== "official-site";
    const primary = preferCandidate ? candidate : existing;
    const secondary = preferCandidate ? existing : candidate;
    merged.set(key, {
      ...secondary,
      ...primary,
      sourceUrl: primary.sourceUrl || secondary.sourceUrl,
      sourceTitle: primary.sourceTitle || secondary.sourceTitle,
      evidenceSnippet: primary.evidenceSnippet || secondary.evidenceSnippet,
      notes: primary.notes || secondary.notes,
      activity: primary.activity || secondary.activity,
      geocodeConfidence: primary.geocodeConfidence === "unknown" ? secondary.geocodeConfidence : primary.geocodeConfidence,
    });
  }
  return Array.from(merged.values());
}

export async function discoverCompanyLocations(enteredName: string): Promise<CompanyLocationDiscoveryResult> {
  const diagnostics: DiscoveryDiagnostic[] = [];
  const warnings: string[] = [];
  const wikidata = await resolveFromWikidata(enteredName);
  diagnostics.push(wikidata.diagnostic);
  const resolution = await resolveOfficialWebsite(wikidata.canonicalName, wikidata.officialWebsite);
  diagnostics.push(resolution.diagnostic);
  const canonicalName = wikidata.canonicalName || enteredName;
  const aliases = Array.from(new Set([enteredName, canonicalName, ...wikidata.aliases].map((value) => cleanText(value, 160)).filter((value): value is string => Boolean(value)))).slice(0, 8);

  const officialCrawl = resolution.officialWebsite
    ? await crawlOfficialLocationPages(resolution.officialWebsite, resolution.searchResults)
    : { evidence: [], pagesScanned: 0, diagnostic: { source: "official-site", status: "no-results", resultsFound: 0, message: "No official website could be resolved, so official-site discovery was skipped." } as DiscoveryDiagnostic };
  diagnostics.push(officialCrawl.diagnostic);

  const officialLocations: CompanyLocationCandidate[] = [];
  for (const evidence of officialCrawl.evidence.slice(0, MAX_OFFICIAL_ADDRESSES)) {
    const geocoded = await geocodeOfficialEvidence(canonicalName, evidence);
    if (geocoded) officialLocations.push(geocoded);
  }

  const osmLocations: CompanyLocationCandidate[] = [];
  try {
    const results = await queryNominatim(canonicalName, 50);
    osmLocations.push(...results.map((result) => fromNominatim(canonicalName, result)).filter((item): item is CompanyLocationCandidate => Boolean(item)));
    diagnostics.push({ source: "openstreetmap", status: osmLocations.length > 0 ? "success" : "no-results", resultsFound: osmLocations.length, message: `${osmLocations.length} OpenStreetMap company-name candidates were returned.` });
  } catch (error) {
    diagnostics.push({ source: "openstreetmap", status: "error", resultsFound: 0, message: "OpenStreetMap lookup failed.", error: error instanceof Error ? error.message : "Unknown error" });
  }

  const photonLocations: CompanyLocationCandidate[] = [];
  try {
    const queryNames = aliases.slice(0, 3);
    for (const alias of queryNames) {
      const results = await queryPhoton(alias, 40);
      photonLocations.push(...results.map((feature) => fromPhoton(canonicalName, feature)).filter((item): item is CompanyLocationCandidate => Boolean(item)));
    }
    diagnostics.push({ source: "photon", status: photonLocations.length > 0 ? "success" : "no-results", resultsFound: photonLocations.length, message: `${photonLocations.length} Photon candidates were returned across ${queryNames.length} company-name queries.` });
  } catch (error) {
    diagnostics.push({ source: "photon", status: "error", resultsFound: 0, message: "Photon lookup failed.", error: error instanceof Error ? error.message : "Unknown error" });
  }

  if (!resolution.officialWebsite) warnings.push("The official company website could not be resolved automatically. Map coverage is limited to public geocoding sources until an official domain can be identified.");
  if (officialCrawl.evidence.length > officialLocations.length) warnings.push(`${officialCrawl.evidence.length - officialLocations.length} official-site addresses could not be geocoded confidently enough to place on the map.`);
  warnings.push("Public-source discovery cannot guarantee every active branch or site. Results remain candidates until reviewed and saved.");

  const locations = mergeCandidates([...officialLocations, ...osmLocations, ...photonLocations]).slice(0, 220);
  return {
    enteredName,
    canonicalName,
    aliases,
    wikidataId: wikidata.wikidataId,
    officialWebsite: resolution.officialWebsite,
    officialWebsiteSource: resolution.source,
    locations,
    diagnostics,
    officialPagesScanned: officialCrawl.pagesScanned,
    officialAddressesExtracted: officialCrawl.evidence.length,
    warnings,
  };
}
