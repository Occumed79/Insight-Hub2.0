import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LeadershipAiConfidence = "confirmed" | "probable" | "inferred";
export type LeadershipAiLevel = "board" | "executive" | "senior-leadership" | "director" | "manager" | "individual-contributor" | "unknown";

export type LeadershipAiEvidence = {
  url: string;
  label: string;
  sourceType: "official" | "public-web";
  snippet: string;
  fetchedAt: string;
};

export type LeadershipAiPerson = {
  id: string;
  name: string;
  title: string;
  level: LeadershipAiLevel;
  department?: string;
  location?: string;
  bio?: string;
  confidence: LeadershipAiConfidence;
  sourceUrls: string[];
  evidence: LeadershipAiEvidence[];
};

export type LeadershipProviderDiagnostic = {
  source: "groq" | "cloudflare" | "gemini" | "cerebras";
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type LeadershipAiSource = {
  url: string;
  label: string;
  sourceType: "official" | "public-web";
  status: "analyzed" | "failed" | "skipped";
  note: string;
};

export type LeadershipAiResult = {
  people: LeadershipAiPerson[];
  discoveredUrls: string[];
  sources: LeadershipAiSource[];
  diagnostics: LeadershipProviderDiagnostic[];
  warnings: string[];
  pagesConsidered: number;
  pagesRead: number;
};

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
  sourceType: "official" | "public-web";
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

const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || process.env.SEC_USER_AGENT
  || "Occu-Med Insight Hub/2.0 organizational-chart-discovery";
const MAX_SEARCH_RESULTS = 32;
const MAX_PAGES = 12;
const MAX_PAGE_BYTES = 1_500_000;
const MAX_PAGE_TEXT = 22_000;
const MAX_PEOPLE = 220;
const LEADERSHIP_PATTERN = /leadership|management|executive|board|director|governance|our-team|our-people|people|officers|company|about-us|who-we-are/i;
const BLOCKED_DOMAIN_PATTERN = /(^|\.)(facebook|instagram|linkedin|x|twitter|youtube|wikipedia|bloomberg|zoominfo|crunchbase|rocketreach|theorg|glassdoor|indeed)\./i;

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

function personId(name: string): string {
  return `person-${normalizeKey(name).replace(/\s+/g, "-")}`;
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
    if (BLOCKED_DOMAIN_PATTERN.test(hostname)) return null;
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

function sameCompanyHost(leftValue: string, rightValue: string): boolean {
  const left = safePublicUrl(leftValue);
  const right = safePublicUrl(rightValue);
  if (!left || !right) return false;
  const leftHost = left.hostname.toLowerCase().replace(/^www\./, "");
  const rightHost = right.hostname.toLowerCase().replace(/^www\./, "");
  return leftHost === rightHost || leftHost.endsWith(`.${rightHost}`) || rightHost.endsWith(`.${leftHost}`);
}

function resultKey(result: SearchResult): string {
  return safePublicUrl(result.url)?.toString() || normalizeKey(`${result.title}|${result.snippet}`);
}

function levelFor(title: string): LeadershipAiLevel {
  const value = title.toLowerCase();
  if (/board|chairman|chairwoman|chairperson|non-executive director/.test(value)) return "board";
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

async function groqSearch(companyName: string): Promise<{ results: SearchResult[]; diagnostic: LeadershipProviderDiagnostic }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { results: [], diagnostic: { source: "groq", status: "not-configured", resultsFound: 0, message: "GROQ_API_KEY is not configured." } };
  const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.GROQ_SEARCH_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const prompt = `Find official public pages for the organizational structure and named leadership of "${companyName}". Prioritize the official company domain, executive leadership pages, board and governance pages, management team pages, business-unit leadership pages, and official biographies. Exclude social networks, people-search sites, directories, aggregators, and scraped org-chart websites.`;
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
        temperature: 0.1,
        max_completion_tokens: 2600,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const executed = Array.isArray(payload?.choices?.[0]?.message?.executed_tools) ? payload.choices[0].message.executed_tools : [];
    const unique = new Map<string, SearchResult>();
    for (const tool of executed) {
      const rows = tool?.search_results?.results || tool?.search_results || tool?.results || [];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const url = safePublicUrl(String(row?.url || row?.link || ""));
        if (!url) continue;
        const result: SearchResult = {
          title: cleanText(row?.title, 240) || url.hostname,
          url: url.toString(),
          snippet: cleanText(row?.content || row?.snippet || row?.text, 1600),
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
        message: results.length > 0 ? `Groq browser search found ${results.length} public leadership-page leads.` : "Groq browser search returned no usable leadership pages.",
      },
    };
  } catch (error) {
    return { results: [], diagnostic: { source: "groq", status: "error", resultsFound: 0, message: "Groq leadership-page search failed.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function cloudflareRerank(companyName: string, results: SearchResult[]): Promise<{ results: SearchResult[]; diagnostic: LeadershipProviderDiagnostic }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN;
  if (!accountId || !token) return { results, diagnostic: { source: "cloudflare", status: "not-configured", resultsFound: 0, message: "Cloudflare Workers AI credentials are not configured." } };
  if (results.length === 0) return { results, diagnostic: { source: "cloudflare", status: "no-results", resultsFound: 0, message: "No leadership pages were available for semantic reranking." } };
  const model = process.env.CLOUDFLARE_RERANK_MODEL || "@cf/baai/bge-reranker-base";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${companyName} official executive leadership management board directors governance organization chart named leaders biographies`,
        top_k: Math.min(results.length, MAX_SEARCH_RESULTS),
        contexts: results.map((result) => ({ text: `${result.title}\n${result.url}\n${result.snippet}`.slice(0, 4000) })),
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const ranked = payload?.result?.response || payload?.result || [];
    if (!Array.isArray(ranked) || ranked.length === 0) return { results, diagnostic: { source: "cloudflare", status: "partial", resultsFound: 0, message: "Cloudflare returned no usable ranking rows; original ordering was retained." } };
    const ordered: SearchResult[] = [];
    const used = new Set<number>();
    for (const row of ranked) {
      const index = Number(row?.id ?? row?.index);
      if (!Number.isInteger(index) || index < 0 || index >= results.length || used.has(index)) continue;
      used.add(index);
      ordered.push({ ...results[index], score: Number.isFinite(Number(row?.score)) ? Number(row.score) : results[index].score });
    }
    results.forEach((result, index) => { if (!used.has(index)) ordered.push(result); });
    return { results: ordered, diagnostic: { source: "cloudflare", status: "success", resultsFound: used.size, message: `Cloudflare semantically reranked ${used.size} leadership-page candidates.` } };
  } catch (error) {
    return { results, diagnostic: { source: "cloudflare", status: "error", resultsFound: 0, message: "Cloudflare reranking failed; original ordering was retained.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function fetchPage(urlValue: string, officialWebsite?: string): Promise<PageDocument | null> {
  let current = safePublicUrl(urlValue);
  if (!current) return null;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    await assertPublicDestination(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
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
        sourceType: officialWebsite && sameCompanyHost(current.toString(), officialWebsite) ? "official" : "public-web",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

function officialSeeds(primaryUrl?: string): SearchResult[] {
  const official = primaryUrl ? safePublicUrl(primaryUrl) : null;
  if (!official) return [];
  return ["/", "/leadership", "/management", "/executive-team", "/our-team", "/board-of-directors", "/governance", "/about-us"].map((path) => ({
    title: `${official.hostname} ${path === "/" ? "home" : path.slice(1).replace(/-/g, " ")}`,
    url: new URL(path, official).toString(),
    snippet: "Official company-domain organizational-chart discovery seed.",
  }));
}

async function readPages(results: SearchResult[], officialWebsite?: string): Promise<{ pages: PageDocument[]; sources: LeadershipAiSource[] }> {
  const pages: PageDocument[] = [];
  const sources: LeadershipAiSource[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (pages.length >= MAX_PAGES) break;
    const parsed = safePublicUrl(result.url);
    if (!parsed || seen.has(parsed.toString())) continue;
    if (!LEADERSHIP_PATTERN.test(`${parsed.pathname} ${result.title} ${result.snippet}`) && !(officialWebsite && sameCompanyHost(parsed.toString(), officialWebsite))) continue;
    seen.add(parsed.toString());
    try {
      const page = await fetchPage(parsed.toString(), officialWebsite);
      if (!page) {
        sources.push({ url: parsed.toString(), label: result.title || parsed.hostname, sourceType: officialWebsite && sameCompanyHost(parsed.toString(), officialWebsite) ? "official" : "public-web", status: "failed", note: "Page could not be read by the AI extraction layer." });
        continue;
      }
      pages.push(page);
      sources.push({ url: page.url, label: page.title, sourceType: page.sourceType, status: "analyzed", note: "Page semantically analyzed for named leaders and titles." });
    } catch (error) {
      sources.push({ url: parsed.toString(), label: result.title || parsed.hostname, sourceType: officialWebsite && sameCompanyHost(parsed.toString(), officialWebsite) ? "official" : "public-web", status: "failed", note: error instanceof Error ? error.message : "Page could not be read." });
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
  return `Extract named people who currently appear to hold leadership, governance, management, director, manager, or publicly identified specialist roles at "${companyName}" from the supplied public webpages. Never invent a person, title, department, reporting line, or source URL. Exclude former leaders unless the page explicitly presents them as current. Exclude customers, authors, unrelated speakers, and quoted third parties. Return the supplied source URL exactly and include a short supporting excerpt.\n\n${sources}`;
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
    const normalizedName = normalizeKey(name);
    const nameTokens = normalizedName.split(" ").filter((token) => token.length > 1);
    if (nameTokens.length < 2 || !nameTokens.every((token) => normalizedPage.includes(token))) continue;
    const confidence = ["high", "medium", "low"].includes(String(row?.confidence)) ? row.confidence as ExtractedPerson["confidence"] : "medium";
    const person: ExtractedPerson = {
      name,
      title,
      department: cleanText(row?.department, 160) || undefined,
      location: cleanText(row?.location, 160) || undefined,
      bio: cleanText(row?.bio, 900) || undefined,
      sourceUrl,
      evidenceSnippet,
      confidence,
    };
    unique.set(normalizeKey(name), person);
  }
  return Array.from(unique.values()).slice(0, MAX_PEOPLE);
}

async function geminiExtract(companyName: string, pages: PageDocument[]): Promise<{ people: ExtractedPerson[]; diagnostic: LeadershipProviderDiagnostic }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { people: [], diagnostic: { source: "gemini", status: "not-configured", resultsFound: 0, message: "GEMINI_API_KEY is not configured." } };
  if (pages.length === 0) return { people: [], diagnostic: { source: "gemini", status: "no-results", resultsFound: 0, message: "No public leadership pages were available for Gemini extraction." } };
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: extractionPrompt(companyName, pages) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 12000, responseMimeType: "application/json", responseJsonSchema: extractionSchema() },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => String(part?.text || "")).join("") || "{}";
    const people = parsePeople(JSON.parse(text), pages);
    return { people, diagnostic: { source: "gemini", status: people.length > 0 ? "success" : "no-results", resultsFound: people.length, message: `Gemini extracted ${people.length} source-supported people from ${pages.length} pages.` } };
  } catch (error) {
    return { people: [], diagnostic: { source: "gemini", status: "error", resultsFound: 0, message: "Gemini organizational-chart extraction failed.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

async function cerebrasReview(companyName: string, pages: PageDocument[], initial: ExtractedPerson[]): Promise<{ people: ExtractedPerson[]; diagnostic: LeadershipProviderDiagnostic }> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) return { people: initial, diagnostic: { source: "cerebras", status: "not-configured", resultsFound: 0, message: "CEREBRAS_API_KEY is not configured." } };
  if (pages.length === 0) return { people: initial, diagnostic: { source: "cerebras", status: "no-results", resultsFound: 0, message: "No pages were available for Cerebras validation." } };
  const baseUrl = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/$/, "");
  const model = process.env.CEREBRAS_MODEL || "gpt-oss-120b";
  const proposed = initial.length > 0 ? `\n\nValidate, correct, deduplicate, or remove these proposed records:\n${JSON.stringify(initial)}` : "";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Cerebras-Version-Patch": "2" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Validate organizational-chart evidence. Return only schema-compliant JSON. Never invent a person, current role, relationship, or URL." },
          { role: "user", content: `${extractionPrompt(companyName, pages)}${proposed}` },
        ],
        reasoning_effort: "low",
        temperature: 0.1,
        max_completion_tokens: 12000,
        response_format: { type: "json_schema", json_schema: { name: "organizational_chart_people", strict: true, schema: extractionSchema() } },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as any;
    const people = parsePeople(JSON.parse(payload?.choices?.[0]?.message?.content || "{}"), pages);
    return {
      people: people.length > 0 ? people : initial,
      diagnostic: {
        source: "cerebras",
        status: people.length > 0 ? "success" : initial.length > 0 ? "partial" : "no-results",
        resultsFound: people.length,
        message: people.length > 0 ? `Cerebras validated and normalized ${people.length} people.` : initial.length > 0 ? "Cerebras returned no replacement records; Gemini records were retained." : "Cerebras found no supported people.",
      },
    };
  } catch (error) {
    return { people: initial, diagnostic: { source: "cerebras", status: "error", resultsFound: 0, message: "Cerebras validation failed; prior extraction was retained.", error: error instanceof Error ? error.message : "Unknown error" } };
  }
}

function toLeadershipPerson(person: ExtractedPerson, pages: PageDocument[]): LeadershipAiPerson {
  const page = pages.find((candidate) => candidate.url === person.sourceUrl)!;
  const exactTitle = normalizeKey(page.text).includes(normalizeKey(person.title));
  const confidence: LeadershipAiConfidence = person.confidence === "high" && exactTitle && page.sourceType === "official" ? "confirmed" : person.confidence === "low" ? "inferred" : "probable";
  return {
    id: personId(person.name),
    name: person.name,
    title: person.title,
    level: levelFor(person.title),
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

export async function discoverLeadershipWithAi(input: {
  companyName: string;
  primaryUrl?: string;
  supportingUrls?: string[];
}): Promise<LeadershipAiResult> {
  const diagnostics: LeadershipProviderDiagnostic[] = [];
  const warnings: string[] = [];
  const groq = await groqSearch(input.companyName);
  diagnostics.push(groq.diagnostic);

  const provided = [input.primaryUrl, ...(input.supportingUrls || [])].filter((value): value is string => Boolean(value)).flatMap((value) => {
    const url = safePublicUrl(value);
    return url ? [{ title: url.hostname, url: url.toString(), snippet: "User-provided public leadership source." }] : [];
  });
  const unique = new Map<string, SearchResult>();
  for (const result of [...provided, ...officialSeeds(input.primaryUrl), ...groq.results]) unique.set(resultKey(result), result);
  const candidates = Array.from(unique.values()).slice(0, MAX_SEARCH_RESULTS);

  const reranked = await cloudflareRerank(input.companyName, candidates);
  diagnostics.push(reranked.diagnostic);
  const officialWebsite = input.primaryUrl || provided[0]?.url;
  const read = await readPages(reranked.results, officialWebsite);

  const gemini = await geminiExtract(input.companyName, read.pages);
  diagnostics.push(gemini.diagnostic);
  const cerebras = await cerebrasReview(input.companyName, read.pages, gemini.people);
  diagnostics.push(cerebras.diagnostic);
  const people = cerebras.people.map((person) => toLeadershipPerson(person, read.pages));

  if (read.pages.length === 0) warnings.push("No leadership pages could be read by the AI discovery layer.");
  if (people.length === 0) warnings.push("The AI layer did not produce any source-supported leadership records.");

  return {
    people,
    discoveredUrls: read.pages.map((page) => page.url),
    sources: read.sources,
    diagnostics,
    warnings,
    pagesConsidered: candidates.length,
    pagesRead: read.pages.length,
  };
}
