import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { CompanyLocationCandidate, DiscoveryDiagnostic } from "./companyLocationDiscovery";

export type LocationAiDiagnostic = DiscoveryDiagnostic & {
  source: "groq" | "cloudflare" | "gemini" | "cerebras";
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  score?: number;
};

type PageDocument = {
  title: string;
  url: string;
  text: string;
};

type ExtractedAddress = {
  name?: string;
  address: string;
  sourceUrl: string;
  sourceTitle?: string;
  facilityType?: string;
  evidenceSnippet?: string;
  confidence?: "high" | "medium" | "low";
};

export type LocationAiResult = {
  locations: CompanyLocationCandidate[];
  diagnostics: LocationAiDiagnostic[];
  pagesConsidered: number;
  pagesRead: number;
  addressesExtracted: number;
  warnings: string[];
};

const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || process.env.SEC_USER_AGENT
  || "Occu-Med Insight Hub/2.0 location-ai-orchestration";
const MAX_SEARCH_RESULTS = 30;
const MAX_PAGES_TO_READ = 10;
const MAX_PAGE_BYTES = 1_200_000;
const MAX_PAGE_TEXT = 18_000;
const MAX_AI_ADDRESSES = 40;
const LOCATION_PATH_PATTERN = /location|office|branch|facility|facilities|site|sites|campus|contact|global|where-we-operate|our-presence|store|plant|warehouse|distribution|service-center|operations/i;
const BLOCKED_DOMAIN_PATTERN = /(^|\.)(facebook|instagram|linkedin|x|twitter|youtube|wikipedia|bloomberg|zoominfo|crunchbase|mapquest|yelp|glassdoor|indeed)\./i;
let lastNominatimRequestAt = 0;

function cleanText(value: unknown, max = 500): string | undefined {
  const text = String(value || "")
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
    .trim();
  return text ? text.slice(0, max) : undefined;
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
    if (!["http:", "https:"].includes(url.protocol)) return null;
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

function searchResultKey(result: SearchResult): string {
  return safePublicUrl(result.url)?.toString() || normalizeKey(`${result.title}|${result.snippet}`);
}

async function groqSearch(companyName: string): Promise<{ results: SearchResult[]; diagnostic: LocationAiDiagnostic }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      results: [],
      diagnostic: { source: "groq", status: "not-configured", resultsFound: 0, message: "GROQ_API_KEY is not configured." },
    };
  }

  const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.GROQ_SEARCH_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const prompt = [
    `Find the official website and public location pages for the company \"${companyName}\".`,
    "Search specifically for offices, branches, sites, facilities, plants, warehouses, campuses, service centers, contact pages, and where-we-operate pages.",
    "Prefer official company domains. Do not use social networks, directories, aggregators, or people-search sites.",
  ].join(" ");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "browser_search" }],
        tool_choice: "required",
        reasoning_effort: "low",
        temperature: 0.2,
        max_completion_tokens: 2500,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const message = payload?.choices?.[0]?.message || {};
    const executedTools = Array.isArray(message.executed_tools) ? message.executed_tools : [];
    const collected: SearchResult[] = [];
    for (const tool of executedTools) {
      const rawResults = tool?.search_results?.results || tool?.search_results || tool?.results || [];
      if (!Array.isArray(rawResults)) continue;
      for (const item of rawResults) {
        const url = safePublicUrl(String(item?.url || item?.link || ""));
        if (!url) continue;
        collected.push({
          title: cleanText(item?.title, 240) || url.hostname,
          url: url.toString(),
          snippet: cleanText(item?.content || item?.snippet || item?.text, 1600) || "",
          provider: "groq-browser-search",
          score: Number.isFinite(Number(item?.score)) ? Number(item.score) : undefined,
        });
      }
    }
    const unique = new Map<string, SearchResult>();
    for (const result of collected) unique.set(searchResultKey(result), result);
    const results = Array.from(unique.values()).slice(0, MAX_SEARCH_RESULTS);
    return {
      results,
      diagnostic: {
        source: "groq",
        status: results.length > 0 ? "success" : "no-results",
        resultsFound: results.length,
        message: results.length > 0
          ? `Groq browser search returned ${results.length} public company and location-page leads.`
          : "Groq browser search completed without usable public location-page leads.",
      },
    };
  } catch (error) {
    return {
      results: [],
      diagnostic: { source: "groq", status: "error", resultsFound: 0, message: "Groq browser search failed.", error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function cloudflareRerank(companyName: string, results: SearchResult[]): Promise<{ results: SearchResult[]; diagnostic: LocationAiDiagnostic }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN;
  if (!accountId || !token) {
    return {
      results,
      diagnostic: { source: "cloudflare", status: "not-configured", resultsFound: 0, message: "Cloudflare Workers AI credentials are not configured." },
    };
  }
  if (results.length === 0) {
    return {
      results,
      diagnostic: { source: "cloudflare", status: "no-results", resultsFound: 0, message: "No candidate pages were available for semantic reranking." },
    };
  }

  const model = process.env.CLOUDFLARE_RERANK_MODEL || "@cf/baai/bge-reranker-base";
  const query = `${companyName} official company locations offices branches facilities plants warehouses campuses service centers operating sites addresses`;
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: Math.min(results.length, MAX_SEARCH_RESULTS),
        contexts: results.map((result) => ({ text: `${result.title}\n${result.url}\n${result.snippet}`.slice(0, 4000) })),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const ranked = payload?.result?.response || payload?.result || [];
    if (!Array.isArray(ranked) || ranked.length === 0) {
      return {
        results,
        diagnostic: { source: "cloudflare", status: "partial", resultsFound: 0, message: "Cloudflare responded, but no reranking rows were returned." },
      };
    }
    const ordered: SearchResult[] = [];
    const used = new Set<number>();
    for (const row of ranked) {
      const index = Number(row?.id ?? row?.index);
      if (!Number.isInteger(index) || index < 0 || index >= results.length || used.has(index)) continue;
      used.add(index);
      ordered.push({ ...results[index], score: Number.isFinite(Number(row?.score)) ? Number(row.score) : results[index].score });
    }
    for (let index = 0; index < results.length; index += 1) if (!used.has(index)) ordered.push(results[index]);
    return {
      results: ordered,
      diagnostic: { source: "cloudflare", status: "success", resultsFound: used.size, message: `Cloudflare Workers AI semantically reranked ${used.size} candidate pages.` },
    };
  } catch (error) {
    return {
      results,
      diagnostic: { source: "cloudflare", status: "error", resultsFound: 0, message: "Cloudflare semantic reranking failed; original ordering was retained.", error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function fetchPage(urlValue: string): Promise<PageDocument | null> {
  const initial = safePublicUrl(urlValue);
  if (!initial) return null;
  let current = initial;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.4" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const next = location ? safePublicUrl(new URL(location, current).toString()) : null;
        if (!next) return null;
        current = next;
        continue;
      }
      if (!response.ok) return null;
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_PAGE_BYTES) return null;
      const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
      const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240) || current.hostname;
      const text = cleanText(html, MAX_PAGE_TEXT);
      if (!text || text.length < 80) return null;
      return { title, url: current.toString(), text };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function seedOfficialPages(officialWebsite?: string): SearchResult[] {
  const official = officialWebsite ? safePublicUrl(officialWebsite) : null;
  if (!official) return [];
  const paths = ["/", "/locations", "/offices", "/contact", "/contact-us", "/global-locations", "/where-we-operate", "/our-locations", "/facilities"];
  return paths.map((path) => ({
    title: `${official.hostname} ${path === "/" ? "home" : path.slice(1).replace(/-/g, " ")}`,
    url: new URL(path, official).toString(),
    snippet: "Official company-domain location discovery seed.",
    provider: "official-seed",
  }));
}

async function readCandidatePages(results: SearchResult[], officialWebsite?: string): Promise<PageDocument[]> {
  const official = officialWebsite ? safePublicUrl(officialWebsite) : null;
  const eligible = results.filter((result) => {
    const url = safePublicUrl(result.url);
    if (!url) return false;
    if (official && !sameCompanyHost(url, official)) return false;
    return LOCATION_PATH_PATTERN.test(`${url.pathname} ${result.title} ${result.snippet}`) || Boolean(official && url.origin === official.origin);
  });
  const pages: PageDocument[] = [];
  for (const result of eligible.slice(0, MAX_PAGES_TO_READ)) {
    const page = await fetchPage(result.url);
    if (page) pages.push(page);
  }
  return pages;
}

function addressSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      locations: {
        type: "array",
        maxItems: MAX_AI_ADDRESSES,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: ["string", "null"] },
            address: { type: "string" },
            sourceUrl: { type: "string" },
            sourceTitle: { type: ["string", "null"] },
            facilityType: { type: ["string", "null"] },
            evidenceSnippet: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["name", "address", "sourceUrl", "sourceTitle", "facilityType", "evidenceSnippet", "confidence"],
        },
      },
    },
    required: ["locations"],
  };
}

function extractionPrompt(companyName: string, pages: PageDocument[]): string {
  const sourceText = pages.map((page, index) => [
    `SOURCE ${index + 1}`,
    `URL: ${page.url}`,
    `TITLE: ${page.title}`,
    `TEXT: ${page.text}`,
  ].join("\n")).join("\n\n---\n\n");
  return [
    `Extract physical operating locations belonging to or explicitly identified as locations of \"${companyName}\" from the supplied official public webpages.`,
    "Include offices, branches, facilities, plants, warehouses, campuses, service centers, and operating sites only when the page supports the association.",
    "Do not invent addresses. Exclude customer addresses, employee home addresses, unrelated map results, partner locations, job locations without a company facility, and mailing addresses that are not presented as a company location.",
    "Return the source URL exactly as supplied for every record. Preserve complete street, city, region, postal code, and country information when available.",
    sourceText,
  ].join("\n\n");
}

function parseAddressPayload(value: unknown, allowedUrls: Set<string>): ExtractedAddress[] {
  const rows = Array.isArray((value as any)?.locations) ? (value as any).locations : [];
  const unique = new Map<string, ExtractedAddress>();
  for (const row of rows) {
    const address = cleanText(row?.address, 500);
    const sourceUrl = safePublicUrl(String(row?.sourceUrl || ""))?.toString();
    if (!address || address.length < 8 || !sourceUrl || !allowedUrls.has(sourceUrl)) continue;
    const record: ExtractedAddress = {
      name: cleanText(row?.name, 180),
      address,
      sourceUrl,
      sourceTitle: cleanText(row?.sourceTitle, 240),
      facilityType: cleanText(row?.facilityType, 160),
      evidenceSnippet: cleanText(row?.evidenceSnippet, 500),
      confidence: ["high", "medium", "low"].includes(String(row?.confidence)) ? row.confidence : "medium",
    };
    const key = `${normalizeKey(address)}|${sourceUrl}`;
    if (!unique.has(key)) unique.set(key, record);
  }
  return Array.from(unique.values()).slice(0, MAX_AI_ADDRESSES);
}

async function geminiExtract(companyName: string, pages: PageDocument[]): Promise<{ addresses: ExtractedAddress[]; diagnostic: LocationAiDiagnostic }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { addresses: [], diagnostic: { source: "gemini", status: "not-configured", resultsFound: 0, message: "GEMINI_API_KEY is not configured." } };
  }
  if (pages.length === 0) {
    return { addresses: [], diagnostic: { source: "gemini", status: "no-results", resultsFound: 0, message: "No official pages were available for Gemini semantic extraction." } };
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: extractionPrompt(companyName, pages) }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 10000,
          responseMimeType: "application/json",
          responseJsonSchema: addressSchema(),
        },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("") || "";
    const parsed = JSON.parse(text || "{}");
    const addresses = parseAddressPayload(parsed, new Set(pages.map((page) => page.url)));
    return {
      addresses,
      diagnostic: { source: "gemini", status: addresses.length > 0 ? "success" : "no-results", resultsFound: addresses.length, message: `Gemini Flash-Lite extracted ${addresses.length} supported company-location addresses from ${pages.length} official pages.` },
    };
  } catch (error) {
    return { addresses: [], diagnostic: { source: "gemini", status: "error", resultsFound: 0, message: "Gemini semantic extraction failed.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function cerebrasReview(companyName: string, pages: PageDocument[], initial: ExtractedAddress[]): Promise<{ addresses: ExtractedAddress[]; diagnostic: LocationAiDiagnostic }> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    return { addresses: initial, diagnostic: { source: "cerebras", status: "not-configured", resultsFound: 0, message: "CEREBRAS_API_KEY is not configured." } };
  }
  if (pages.length === 0) {
    return { addresses: initial, diagnostic: { source: "cerebras", status: "no-results", resultsFound: 0, message: "No official pages were available for Cerebras review." } };
  }
  const model = process.env.CEREBRAS_MODEL || "gpt-oss-120b";
  const baseUrl = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/$/, "");
  const initialText = initial.length > 0 ? `\n\nA first extractor proposed these records. Verify, correct, deduplicate, or remove them:\n${JSON.stringify(initial)}` : "";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Cerebras-Version-Patch": "2" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You validate and normalize physical company-location evidence. Return only schema-compliant JSON. Never invent an address or source URL." },
          { role: "user", content: `${extractionPrompt(companyName, pages)}${initialText}` },
        ],
        reasoning_effort: "low",
        temperature: 0.1,
        max_completion_tokens: 10000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "company_locations", strict: true, schema: addressSchema() },
        },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const text = payload?.choices?.[0]?.message?.content || "{}";
    const addresses = parseAddressPayload(JSON.parse(text), new Set(pages.map((page) => page.url)));
    return {
      addresses: addresses.length > 0 ? addresses : initial,
      diagnostic: {
        source: "cerebras",
        status: addresses.length > 0 ? "success" : initial.length > 0 ? "partial" : "no-results",
        resultsFound: addresses.length,
        message: addresses.length > 0
          ? `Cerebras validated and normalized ${addresses.length} company-location records.`
          : initial.length > 0
            ? "Cerebras returned no replacement records; the validated Gemini set was retained."
            : "Cerebras found no supported company-location addresses.",
      },
    };
  } catch (error) {
    return { addresses: initial, diagnostic: { source: "cerebras", status: "error", resultsFound: 0, message: "Cerebras validation failed; prior extraction results were retained.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function waitForNominatimSlot(): Promise<void> {
  const delay = Math.max(0, 1_050 - (Date.now() - lastNominatimRequestAt));
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  lastNominatimRequestAt = Date.now();
}

async function geocodeAddress(companyName: string, evidence: ExtractedAddress): Promise<CompanyLocationCandidate | null> {
  let coordinates: [number, number] | null = null;
  let geocodeSource: "photon" | "osm" = "photon";
  let city: string | undefined;
  let state: string | undefined;
  let postalCode: string | undefined;
  let country = "Unknown";
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", evidence.address);
    url.searchParams.set("limit", "3");
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json() as any;
      const feature = payload?.features?.[0];
      const rawCoordinates = feature?.geometry?.coordinates;
      if (Array.isArray(rawCoordinates) && Number.isFinite(Number(rawCoordinates[0])) && Number.isFinite(Number(rawCoordinates[1]))) {
        coordinates = [Number(rawCoordinates[0]), Number(rawCoordinates[1])];
        const props = feature?.properties || {};
        city = cleanText(props.city || props.town || props.village || props.county, 140);
        state = cleanText(props.state, 120);
        postalCode = cleanText(props.postcode, 40);
        country = cleanText(props.country, 120) || country;
      }
    }
  } catch {
    // Nominatim fallback below
  }
  if (!coordinates) {
    try {
      await waitForNominatimSlot();
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", evidence.address);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "2");
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (response.ok) {
        const rows = await response.json() as any[];
        const row = rows?.[0];
        if (row && Number.isFinite(Number(row.lon)) && Number.isFinite(Number(row.lat))) {
          coordinates = [Number(row.lon), Number(row.lat)];
          geocodeSource = "osm";
          city = cleanText(row.address?.city || row.address?.town || row.address?.village || row.address?.county, 140);
          state = cleanText(row.address?.state || row.address?.region, 120);
          postalCode = cleanText(row.address?.postcode, 40);
          country = cleanText(row.address?.country, 120) || country;
        }
      }
    } catch {
      coordinates = null;
    }
  }
  if (!coordinates) return null;
  const exact = /\d/.test(evidence.address) && /\b\d{4,6}(?:-\d{3,4})?\b/.test(evidence.address);
  return {
    id: deterministicId("ai-official", `${evidence.sourceUrl}|${evidence.address}`),
    companyName,
    placeName: evidence.name || companyName,
    formattedAddress: evidence.address,
    city,
    state,
    postalCode,
    country,
    region: state || country,
    facilityType: evidence.facilityType || "Official company location",
    activity: "Company location extracted and validated from an official public webpage",
    notes: "AI-assisted semantic extraction was limited to official public evidence and followed by independent geocoding.",
    coordinates,
    geocodeSource,
    geocodeConfidence: exact && evidence.confidence !== "low" ? "exact" : city ? "city" : "place",
    sourceType: "ai-official-address",
    sourceClass: "official-site-ai",
    sourceId: deterministicId("ai-source", evidence.sourceUrl),
    reviewStatus: evidence.confidence === "low" ? "needs-review" : "candidate",
    sourceUrl: evidence.sourceUrl,
    sourceTitle: evidence.sourceTitle,
    evidenceSnippet: evidence.evidenceSnippet,
    discoveredBy: "official-site",
  };
}

export async function enrichCompanyLocationsWithAi(companyName: string, officialWebsite?: string): Promise<LocationAiResult> {
  const diagnostics: LocationAiDiagnostic[] = [];
  const warnings: string[] = [];
  const groq = await groqSearch(companyName);
  diagnostics.push(groq.diagnostic);

  const seedResults = [...seedOfficialPages(officialWebsite), ...groq.results];
  const unique = new Map<string, SearchResult>();
  for (const result of seedResults) unique.set(searchResultKey(result), result);
  const candidates = Array.from(unique.values()).slice(0, MAX_SEARCH_RESULTS);

  const reranked = await cloudflareRerank(companyName, candidates);
  diagnostics.push(reranked.diagnostic);
  const pages = await readCandidatePages(reranked.results, officialWebsite);

  const gemini = await geminiExtract(companyName, pages);
  diagnostics.push(gemini.diagnostic);
  const cerebras = await cerebrasReview(companyName, pages, gemini.addresses);
  diagnostics.push(cerebras.diagnostic);

  const locations: CompanyLocationCandidate[] = [];
  for (const evidence of cerebras.addresses.slice(0, MAX_AI_ADDRESSES)) {
    const location = await geocodeAddress(companyName, evidence);
    if (location) locations.push(location);
  }

  if (pages.length === 0) warnings.push("No official pages could be read by the AI enrichment layer.");
  if (cerebras.addresses.length > locations.length) warnings.push(`${cerebras.addresses.length - locations.length} AI-extracted addresses could not be geocoded and were not mapped.`);
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN)) warnings.push("Cloudflare semantic reranking was unavailable for this scan.");

  return {
    locations,
    diagnostics,
    pagesConsidered: candidates.length,
    pagesRead: pages.length,
    addressesExtracted: cerebras.addresses.length,
    warnings,
  };
}
