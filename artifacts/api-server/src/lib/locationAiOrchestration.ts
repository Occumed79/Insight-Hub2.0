import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { CompanyLocationCandidate, DiscoveryDiagnostic } from "./companyLocationDiscovery";

export type LocationAiDiagnostic = Omit<DiscoveryDiagnostic, "source"> & {
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
  confidence: "high" | "medium" | "low";
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
const LOCATION_PATTERN = /location|office|branch|facility|facilities|site|sites|campus|contact|global|where-we-operate|our-presence|store|plant|warehouse|distribution|service-center|operations/i;
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

function resultKey(result: SearchResult): string {
  return safePublicUrl(result.url)?.toString() || normalizeKey(`${result.title}|${result.snippet}`);
}

async function groqSearch(companyName: string): Promise<{ results: SearchResult[]; diagnostic: LocationAiDiagnostic }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return {
    results: [],
    diagnostic: { source: "groq", status: "not-configured", resultsFound: 0, message: "GROQ_API_KEY is not configured." },
  };

  const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.GROQ_SEARCH_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const prompt = `Find the official website and public pages listing physical offices, branches, facilities, plants, warehouses, campuses, service centers, and operating sites for \"${companyName}\". Prefer official company domains. Exclude social networks, directories, aggregators, and people-search sites.`;

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
    const tools = Array.isArray(payload?.choices?.[0]?.message?.executed_tools)
      ? payload.choices[0].message.executed_tools
      : [];
    const unique = new Map<string, SearchResult>();
    for (const tool of tools) {
      const rows = tool?.search_results?.results || tool?.search_results || tool?.results || [];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const url = safePublicUrl(String(row?.url || row?.link || ""));
        if (!url) continue;
        const result: SearchResult = {
          title: cleanText(row?.title, 240) || url.hostname,
          url: url.toString(),
          snippet: cleanText(row?.content || row?.snippet || row?.text, 1600) || "",
          provider: "groq-browser-search",
          score: Number.isFinite(Number(row?.score)) ? Number(row.score) : undefined,
        };
        unique.set(resultKey(result), result);
      }
    }
    const results = Array.from(unique.values()).slice(0, MAX_SEARCH_RESULTS);
    return {
      results,
      diagnostic: {
        source: "groq",
        status: results.length > 0 ? "success" : "no-results",
        resultsFound: results.length,
        message: results.length > 0
          ? `Groq browser search returned ${results.length} public company and location-page leads.`
          : "Groq browser search completed without usable location-page leads.",
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
  if (!accountId || !token) return {
    results,
    diagnostic: { source: "cloudflare", status: "not-configured", resultsFound: 0, message: "Cloudflare Workers AI credentials are not configured." },
  };
  if (results.length === 0) return {
    results,
    diagnostic: { source: "cloudflare", status: "no-results", resultsFound: 0, message: "No candidate pages were available for semantic reranking." },
  };

  const model = process.env.CLOUDFLARE_RERANK_MODEL || "@cf/baai/bge-reranker-base";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${companyName} official company locations offices branches facilities plants warehouses campuses service centers operating sites addresses`,
        top_k: Math.min(results.length, MAX_SEARCH_RESULTS),
        contexts: results.map((result) => ({ text: `${result.title}\n${result.url}\n${result.snippet}`.slice(0, 4000) })),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const ranked = payload?.result?.response || payload?.result || [];
    if (!Array.isArray(ranked) || ranked.length === 0) return {
      results,
      diagnostic: { source: "cloudflare", status: "partial", resultsFound: 0, message: "Cloudflare responded without usable reranking rows; original ordering was retained." },
    };

    const ordered: SearchResult[] = [];
    const used = new Set<number>();
    for (const row of ranked) {
      const index = Number(row?.id ?? row?.index);
      if (!Number.isInteger(index) || index < 0 || index >= results.length || used.has(index)) continue;
      used.add(index);
      ordered.push({ ...results[index], score: Number.isFinite(Number(row?.score)) ? Number(row.score) : results[index].score });
    }
    results.forEach((result, index) => { if (!used.has(index)) ordered.push(result); });
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

function officialSeeds(officialWebsite?: string): SearchResult[] {
  const official = officialWebsite ? safePublicUrl(officialWebsite) : null;
  if (!official) return [];
  return ["/", "/locations", "/offices", "/contact", "/contact-us", "/global-locations", "/where-we-operate", "/our-locations", "/facilities"].map((path) => ({
    title: `${official.hostname} ${path === "/" ? "home" : path.slice(1).replace(/-/g, " ")}`,
    url: new URL(path, official).toString(),
    snippet: "Official company-domain location discovery seed.",
    provider: "official-seed",
  }));
}

async function fetchPage(urlValue: string): Promise<PageDocument | null> {
  const start = safePublicUrl(urlValue);
  if (!start) return null;
  let current = start;
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
        const next = response.headers.get("location");
        const parsed = next ? safePublicUrl(new URL(next, current).toString()) : null;
        if (!parsed) return null;
        current = parsed;
        continue;
      }
      if (!response.ok || Number(response.headers.get("content-length") || 0) > MAX_PAGE_BYTES) return null;
      const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
      const text = cleanText(html, MAX_PAGE_TEXT);
      if (!text || text.length < 80) return null;
      return {
        title: cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240) || current.hostname,
        url: current.toString(),
        text,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function readPages(results: SearchResult[], officialWebsite?: string): Promise<PageDocument[]> {
  const official = officialWebsite ? safePublicUrl(officialWebsite) : null;
  const eligible = results.filter((result) => {
    const url = safePublicUrl(result.url);
    if (!url) return false;
    if (official && !sameCompanyHost(url, official)) return false;
    return LOCATION_PATTERN.test(`${url.pathname} ${result.title} ${result.snippet}`) || Boolean(official && url.origin === official.origin);
  });
  const pages: PageDocument[] = [];
  for (const result of eligible.slice(0, MAX_PAGES_TO_READ)) {
    const page = await fetchPage(result.url);
    if (page) pages.push(page);
  }
  return pages;
}

function schema(): Record<string, unknown> {
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

function prompt(companyName: string, pages: PageDocument[]): string {
  const sourceText = pages.map((page, index) => `SOURCE ${index + 1}\nURL: ${page.url}\nTITLE: ${page.title}\nTEXT: ${page.text}`).join("\n\n---\n\n");
  return `Extract physical operating locations explicitly belonging to \"${companyName}\" from these official public webpages. Include offices, branches, facilities, plants, warehouses, campuses, service centers, and operating sites. Do not invent addresses. Exclude customer addresses, home addresses, partners, unrelated map results, and job cities without a company facility. Return each supplied source URL exactly.\n\n${sourceText}`;
}

function parseAddresses(value: unknown, pages: PageDocument[]): ExtractedAddress[] {
  const rows = Array.isArray((value as any)?.locations) ? (value as any).locations : [];
  const allowedUrls = new Set(pages.map((page) => page.url));
  const unique = new Map<string, ExtractedAddress>();
  for (const row of rows) {
    const address = cleanText(row?.address, 500);
    const sourceUrl = safePublicUrl(String(row?.sourceUrl || ""))?.toString();
    if (!address || address.length < 8 || !sourceUrl || !allowedUrls.has(sourceUrl)) continue;
    const confidence = ["high", "medium", "low"].includes(String(row?.confidence))
      ? row.confidence as ExtractedAddress["confidence"]
      : "medium";
    const record: ExtractedAddress = {
      name: cleanText(row?.name, 180),
      address,
      sourceUrl,
      sourceTitle: cleanText(row?.sourceTitle, 240),
      facilityType: cleanText(row?.facilityType, 160),
      evidenceSnippet: cleanText(row?.evidenceSnippet, 500),
      confidence,
    };
    unique.set(`${normalizeKey(address)}|${sourceUrl}`, record);
  }
  return Array.from(unique.values()).slice(0, MAX_AI_ADDRESSES);
}

async function geminiExtract(companyName: string, pages: PageDocument[]): Promise<{ addresses: ExtractedAddress[]; diagnostic: LocationAiDiagnostic }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { addresses: [], diagnostic: { source: "gemini", status: "not-configured", resultsFound: 0, message: "GEMINI_API_KEY is not configured." } };
  if (pages.length === 0) return { addresses: [], diagnostic: { source: "gemini", status: "no-results", resultsFound: 0, message: "No official pages were available for Gemini semantic extraction." } };
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(companyName, pages) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 10000, responseMimeType: "application/json", responseJsonSchema: schema() },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => String(part?.text || "")).join("") || "{}";
    const addresses = parseAddresses(JSON.parse(text), pages);
    return {
      addresses,
      diagnostic: { source: "gemini", status: addresses.length > 0 ? "success" : "no-results", resultsFound: addresses.length, message: `Gemini Flash-Lite extracted ${addresses.length} supported addresses from ${pages.length} official pages.` },
    };
  } catch (error) {
    return { addresses: [], diagnostic: { source: "gemini", status: "error", resultsFound: 0, message: "Gemini semantic extraction failed.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function cerebrasReview(companyName: string, pages: PageDocument[], initial: ExtractedAddress[]): Promise<{ addresses: ExtractedAddress[]; diagnostic: LocationAiDiagnostic }> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return { addresses: initial, diagnostic: { source: "cerebras", status: "not-configured", resultsFound: 0, message: "CEREBRAS_API_KEY is not configured." } };
  if (pages.length === 0) return { addresses: initial, diagnostic: { source: "cerebras", status: "no-results", resultsFound: 0, message: "No official pages were available for Cerebras validation." } };
  const baseUrl = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/$/, "");
  const model = process.env.CEREBRAS_MODEL || "gpt-oss-120b";
  const proposed = initial.length > 0 ? `\n\nA first extractor proposed these records. Verify, correct, deduplicate, or remove them:\n${JSON.stringify(initial)}` : "";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Cerebras-Version-Patch": "2" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Validate and normalize physical company-location evidence. Return only schema-compliant JSON. Never invent an address or source URL." },
          { role: "user", content: `${prompt(companyName, pages)}${proposed}` },
        ],
        reasoning_effort: "low",
        temperature: 0.1,
        max_completion_tokens: 10000,
        response_format: { type: "json_schema", json_schema: { name: "company_locations", strict: true, schema: schema() } },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const addresses = parseAddresses(JSON.parse(payload?.choices?.[0]?.message?.content || "{}"), pages);
    return {
      addresses: addresses.length > 0 ? addresses : initial,
      diagnostic: {
        source: "cerebras",
        status: addresses.length > 0 ? "success" : initial.length > 0 ? "partial" : "no-results",
        resultsFound: addresses.length,
        message: addresses.length > 0
          ? `Cerebras validated and normalized ${addresses.length} location records.`
          : initial.length > 0 ? "Cerebras returned no replacement records; Gemini results were retained." : "Cerebras found no supported locations.",
      },
    };
  } catch (error) {
    return { addresses: initial, diagnostic: { source: "cerebras", status: "error", resultsFound: 0, message: "Cerebras validation failed; prior extraction was retained.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function waitForNominatim(): Promise<void> {
  const delay = Math.max(0, 1_050 - (Date.now() - lastNominatimRequestAt));
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  lastNominatimRequestAt = Date.now();
}

async function geocode(companyName: string, evidence: ExtractedAddress): Promise<CompanyLocationCandidate | null> {
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
      const feature = ((await response.json()) as any)?.features?.[0];
      const raw = feature?.geometry?.coordinates;
      if (Array.isArray(raw) && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
        coordinates = [Number(raw[0]), Number(raw[1])];
        const props = feature?.properties || {};
        city = cleanText(props.city || props.town || props.village || props.county, 140);
        state = cleanText(props.state, 120);
        postalCode = cleanText(props.postcode, 40);
        country = cleanText(props.country, 120) || country;
      }
    }
  } catch {
    coordinates = null;
  }

  if (!coordinates) {
    try {
      await waitForNominatim();
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", evidence.address);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "2");
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (response.ok) {
        const row = ((await response.json()) as any[])?.[0];
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

  const unique = new Map<string, SearchResult>();
  for (const result of [...officialSeeds(officialWebsite), ...groq.results]) unique.set(resultKey(result), result);
  const candidates = Array.from(unique.values()).slice(0, MAX_SEARCH_RESULTS);

  const reranked = await cloudflareRerank(companyName, candidates);
  diagnostics.push(reranked.diagnostic);
  const pages = await readPages(reranked.results, officialWebsite);

  const gemini = await geminiExtract(companyName, pages);
  diagnostics.push(gemini.diagnostic);
  const cerebras = await cerebrasReview(companyName, pages, gemini.addresses);
  diagnostics.push(cerebras.diagnostic);

  const locations: CompanyLocationCandidate[] = [];
  for (const evidence of cerebras.addresses.slice(0, MAX_AI_ADDRESSES)) {
    const location = await geocode(companyName, evidence);
    if (location) locations.push(location);
  }

  if (pages.length === 0) warnings.push("No official pages could be read by the AI enrichment layer.");
  if (cerebras.addresses.length > locations.length) warnings.push(`${cerebras.addresses.length - locations.length} AI-extracted addresses could not be geocoded and were not mapped.`);

  return {
    locations,
    diagnostics,
    pagesConsidered: candidates.length,
    pagesRead: pages.length,
    addressesExtracted: cerebras.addresses.length,
    warnings,
  };
}
