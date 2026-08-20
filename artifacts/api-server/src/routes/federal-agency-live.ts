import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const SAM_OPPORTUNITIES_URL = "https://api.sam.gov/opportunities/v2/search";
const SAM_HIERARCHY_URL = "https://api.sam.gov/prod/federalorganizations/v1/orgs";
const PLUM_PAGE_URL = "https://www.opm.gov/about-us/open-government/plum-reporting/plum-data/";
const PLUM_CERTIFICATION_URL = "https://www.opm.gov/about-us/open-government/plum-reporting/agency-certification/";
const PLUM_DATA_AS_OF = "2026-06-15";
const MAX_RESPONSE_BYTES = 5_000_000;
const CACHE_TTL_MS = 30 * 60_000;
const DIRECTORY_CACHE_TTL_MS = 12 * 60 * 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

function samApiKey(): string | null {
  return process.env.SAM_API_KEY?.trim() || process.env.SAM_GOV_API_KEY?.trim() || null;
}

function langSearchKeys(): string[] {
  return [
    process.env.LANGSEARCH_API_KEY_3,
    process.env.LANGSEARCH_API_KEY_4,
    process.env.LANGSEARCH_API_KEY,
    process.env.LANGSEARCH_API_KEY_2,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function clean(value: unknown, max = 2_000): string {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/api_key=[^&\s]+/gi, "api_key=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .slice(0, 360);
}

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttl = CACHE_TTL_MS): T {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > 180) cache.delete(cache.keys().next().value as string);
  return value;
}

async function fetchLimited(url: URL | string, init: RequestInit = {}, timeoutMs = 22_000): Promise<{ response: globalThis.Response; body: Uint8Array }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/csv,application/xml,text/xml,text/html;q=0.8,*/*;q=0.5",
        "User-Agent": "Occu-Med Insight Hub/2.0 federal intelligence",
        ...(init.headers ?? {}),
      },
    });
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error("Official-source response exceeded safety limit.");
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new Error("Official-source response exceeded safety limit.");
    return { response, body: buffer };
  } finally {
    clearTimeout(timer);
  }
}

function decode(body: Uint8Array): string {
  return new TextDecoder().decode(body);
}

async function fetchJson(url: URL | string, init: RequestInit = {}): Promise<any> {
  const { response, body } = await fetchLimited(url, init);
  const text = decode(body);
  if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}: ${clean(text, 240)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Official source returned invalid JSON.");
  }
}

function mmddyyyy(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function canonicalAgency(value: unknown): string {
  const name = clean(value, 180);
  if (/state department|department of state|state, department of/i.test(name)) return "Department of State";
  if (/defense/i.test(name)) return "Department of Defense";
  if (/veterans affairs/i.test(name)) return "Department of Veterans Affairs";
  if (/health and human services/i.test(name)) return "Department of Health and Human Services";
  if (/homeland security/i.test(name)) return "Department of Homeland Security";
  if (/energy/i.test(name)) return "Department of Energy";
  if (/justice/i.test(name)) return "Department of Justice";
  if (/agriculture/i.test(name)) return "Department of Agriculture";
  if (/interior/i.test(name)) return "Department of the Interior";
  if (/transportation/i.test(name)) return "Department of Transportation";
  if (/labor/i.test(name)) return "Department of Labor";
  if (/commerce/i.test(name)) return "Department of Commerce";
  if (/treasury/i.test(name)) return "Department of the Treasury";
  return name || "Agency not reported";
}

function tokenScore(left: string, right: string): number {
  const stop = new Set(["department", "office", "agency", "administration", "united", "states", "the", "of", "and", "for"]);
  const words = (value: string) => new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2 && !stop.has(word)));
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const word of a) if (b.has(word)) overlap += 1;
  return overlap / Math.max(a.size, b.size);
}

function safeOfficialUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (!(host.endsWith(".gov") || host === "gov" || host.endsWith(".mil") || host === "mil")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeHierarchyRow(row: any) {
  return {
    id: clean(row?.fhorgid || row?.id, 120),
    name: clean(row?.fhorgname || row?.name, 240),
    type: clean(row?.fhorgtype || row?.type, 120) || null,
    status: clean(row?.status, 80) || null,
    agencyCode: clean(row?.agencycode || row?.agencyCode, 80) || null,
    department: clean(row?.fhagencyorgname || row?.agencyName, 240) || null,
    parentPath: clean(row?.parentpath || row?.parentPath || row?.fhorgpath, 700) || null,
    cgacCodes: Array.isArray(row?.cgaclist) ? row.cgaclist.map((value: unknown) => clean(value, 60)).filter(Boolean) : [],
  };
}

function hierarchyRows(payload: any): any[] {
  const candidates = [payload?.orgs, payload?.organizations, payload?.results, payload?.data, payload?._embedded?.orgs];
  return candidates.find(Array.isArray) ?? [];
}

async function loadDirectory() {
  const cached = cacheGet<any>("sam-hierarchy-directory");
  if (cached) return { ...cached, cacheState: "fresh" };
  const key = samApiKey();
  if (!key) return { configured: false, organizations: [], source: "SAM.gov Federal Hierarchy Public API", cacheState: "unavailable", retrievedAt: new Date().toISOString(), limitation: "SAM_API_KEY is not configured." };

  const organizations: ReturnType<typeof normalizeHierarchyRow>[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let pages = 0;
  while (pages < 6) {
    const url = new URL(SAM_HIERARCHY_URL);
    url.searchParams.set("api_key", key);
    url.searchParams.set("status", "Active");
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    const payload = await fetchJson(url);
    const rows = hierarchyRows(payload);
    for (const row of rows) {
      const org = normalizeHierarchyRow(row);
      const dedupe = org.id || `${org.name}|${org.agencyCode}|${org.type}`;
      if (!org.name || seen.has(dedupe)) continue;
      seen.add(dedupe);
      organizations.push(org);
    }
    pages += 1;
    if (rows.length < 100) break;
    offset += 100;
  }

  const topLevel = organizations.filter((org) => /department|ind\.?\s*agency|independent/i.test(org.type || "") || !org.parentPath);
  const value = {
    configured: true,
    organizations: topLevel.length >= 10 ? topLevel : organizations,
    allOrganizationCount: organizations.length,
    source: "SAM.gov Federal Hierarchy Public API",
    sourceUrl: "https://sam.gov/content/fh",
    retrievedAt: new Date().toISOString(),
    limitation: "Directory and hierarchy are returned from SAM.gov. Agency naming may differ from USAspending or OPM and is normalized in the UI.",
  };
  cacheSet("sam-hierarchy-directory", value, DIRECTORY_CACHE_TTL_MS);
  return { ...value, cacheState: "refreshed" };
}

const OCCU_MED_PATTERNS: Array<[RegExp, string, number]> = [
  [/occupational\s+(health|medicine|medical)/i, "Occupational health", 4],
  [/pre[- ]?(employment|placement)|post[- ]?offer/i, "Pre-employment exams", 4],
  [/physical\s+exam|medical\s+exam|medical\s+evaluation/i, "Medical examinations", 3],
  [/fitness[- ]?for[- ]?duty|fit[- ]?for[- ]?duty/i, "Fitness for duty", 4],
  [/drug\s+(test|screen)|alcohol\s+(test|screen)/i, "Drug/alcohol testing", 3],
  [/respirator|respiratory\s+protection|fit\s*test/i, "Respirator / fit testing", 4],
  [/audiometr|hearing\s+(test|conservation)|noise\s+surveillance/i, "Audiometry / hearing", 4],
  [/medical\s+surveillance|health\s+surveillance/i, "Medical surveillance", 4],
  [/vaccin|immuniz/i, "Vaccination / immunization", 3],
  [/laboratory|clinical\s+lab|specimen\s+collection/i, "Laboratory services", 2],
  [/workers.?\s*comp|return[- ]?to[- ]?work/i, "Workers' compensation / RTW", 3],
  [/ergonomic/i, "Ergonomics", 2],
  [/travel\s+medicine|deployment\s+medical|overseas\s+medical/i, "Deployment / travel medicine", 4],
];

function occuMedSignals(text: string) {
  const tags: string[] = [];
  let score = 0;
  for (const [pattern, tag, weight] of OCCU_MED_PATTERNS) {
    if (!pattern.test(text)) continue;
    tags.push(tag);
    score += weight;
  }
  return { relevant: score >= 3, score, tags: [...new Set(tags)] };
}

function normalizeOpportunity(row: any) {
  const pocRows = Array.isArray(row?.pointOfContact) ? row.pointOfContact : row?.pointOfContact ? [row.pointOfContact] : [];
  const pointsOfContact = pocRows.map((poc: any) => ({
    name: clean(poc?.fullName || poc?.name, 180) || null,
    title: clean(poc?.title, 180) || null,
    email: clean(poc?.email, 240) || null,
    phone: clean(poc?.phone, 100) || null,
    type: clean(poc?.type, 80) || null,
  })).filter((poc: any) => poc.name || poc.email || poc.phone);
  const office = row?.officeAddress || {};
  const place = row?.placeOfPerformance || {};
  const award = row?.award || {};
  const title = clean(row?.title, 600);
  const synopsis = clean(row?.description || row?.additionalInfoLink || row?.type, 2_000);
  const signals = occuMedSignals(`${title} ${synopsis}`);
  return {
    noticeId: clean(row?.noticeId, 120),
    title: title || "Untitled SAM.gov opportunity",
    solicitationNumber: clean(row?.solicitationNumber, 180) || null,
    organization: clean(row?.fullParentPathName || row?.organizationName, 500) || null,
    organizationCode: clean(row?.fullParentPathCode, 300) || null,
    postedDate: clean(row?.postedDate, 100) || null,
    type: clean(row?.type || row?.baseType, 180) || null,
    baseType: clean(row?.baseType, 180) || null,
    responseDeadline: clean(row?.responseDeadLine || row?.responseDeadline, 100) || null,
    naicsCode: clean(row?.naicsCode, 40) || null,
    classificationCode: clean(row?.classificationCode, 80) || null,
    active: row?.active === true || /yes|true|active/i.test(String(row?.active ?? "")),
    setAside: clean(row?.typeOfSetAsideDescription || row?.typeOfSetAside, 240) || null,
    award: award && typeof award === "object" ? {
      amount: Number.isFinite(Number(award?.amount)) ? Number(award.amount) : null,
      awardee: clean(award?.awardee?.name || award?.awardee, 240) || null,
      date: clean(award?.date, 100) || null,
      number: clean(award?.number, 160) || null,
    } : null,
    officeAddress: {
      city: clean(office?.city, 120) || null,
      state: clean(office?.state, 100) || null,
      zip: clean(office?.zipcode || office?.zip, 40) || null,
      country: clean(office?.countryCode || office?.country, 80) || null,
    },
    placeOfPerformance: {
      city: clean(place?.city?.name || place?.city, 120) || null,
      state: clean(place?.state?.name || place?.state, 120) || null,
      country: clean(place?.country?.name || place?.country, 120) || null,
      zip: clean(place?.zip || place?.zipCode, 40) || null,
    },
    pointsOfContact,
    sourceUrl: clean(row?.uiLink, 800) || (row?.noticeId ? `https://sam.gov/opp/${encodeURIComponent(String(row.noticeId))}/view` : "https://sam.gov/content/opportunities"),
    descriptionUrl: clean(row?.description, 800).startsWith("http") ? clean(row.description, 800) : null,
    resourceLinks: Array.isArray(row?.resourceLinks) ? row.resourceLinks.map((value: unknown) => clean(value, 800)).filter((value: string) => /^https?:\/\//i.test(value)).slice(0, 12) : [],
    occuMedRelevant: signals.relevant,
    occuMedScore: signals.score,
    occuMedTags: signals.tags,
  };
}

async function loadOpportunities(agency: string, days: number) {
  const key = samApiKey();
  const normalizedDays = Math.max(14, Math.min(365, Math.round(days || 180)));
  const cacheKey = `sam-opportunities|${agency.toLowerCase()}|${normalizedDays}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return { ...cached, cacheState: "fresh" };
  if (!key) return { configured: false, opportunities: [], source: "SAM.gov Get Opportunities Public API", cacheState: "unavailable", retrievedAt: new Date().toISOString(), limitation: "SAM_API_KEY is not configured." };

  const postedTo = new Date();
  const postedFrom = new Date(postedTo.getTime() - normalizedDays * 86_400_000);
  const url = new URL(SAM_OPPORTUNITIES_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("postedFrom", mmddyyyy(postedFrom));
  url.searchParams.set("postedTo", mmddyyyy(postedTo));
  url.searchParams.set("organizationName", agency);
  url.searchParams.set("limit", "100");
  const rows: any[] = [];
  let totalRecords = 0;
  for (let offset = 0; offset < 500; offset += 100) {
    url.searchParams.set("offset", String(offset));
    const payload = await fetchJson(url);
    const page: any[] = Array.isArray(payload?.opportunitiesData) ? payload.opportunitiesData : Array.isArray(payload?.results) ? payload.results : [];
    rows.push(...page);
    totalRecords = Number(payload?.totalRecords ?? rows.length);
    if (page.length < 100 || rows.length >= totalRecords) break;
  }
  const opportunities = rows.map(normalizeOpportunity).sort((left, right) => String(right.postedDate || "").localeCompare(String(left.postedDate || "")));
  const value = {
    configured: true,
    agency,
    days: normalizedDays,
    opportunities,
    returned: opportunities.length,
    totalRecords: totalRecords || opportunities.length,
    occuMedRelevant: opportunities.filter((row) => row.occuMedRelevant).length,
    source: "SAM.gov Get Opportunities Public API",
    sourceUrl: "https://sam.gov/content/opportunities",
    retrievedAt: new Date().toISOString(),
    limitation: "Opportunity notices are live SAM.gov records. Relevance tags are keyword triage for Occu-Med workflow review, not an assertion that a procurement is in scope.",
  };
  cacheSet(cacheKey, value);
  return { ...value, cacheState: "refreshed" };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
      if (char === '"') { quoted = false; continue; }
      cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(cell.trim()); cell = ""; continue; }
    if (char === '\n') { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; continue; }
    if (char !== '\r') cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function valueByHeader(headers: string[], row: string[], patterns: RegExp[]): string {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  return index >= 0 ? clean(row[index], 500) : "";
}

function parsePlumCsv(text: string, agency: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  if (!headers.some((header) => /agency/.test(header)) || !headers.some((header) => /incumbent|name/.test(header)) || !headers.some((header) => /position|title/.test(header))) return [];
  const leaders = [] as any[];
  for (const row of rows.slice(1)) {
    const rowAgency = valueByHeader(headers, row, [/^agency$/, /agency name/]);
    if (!rowAgency || Math.max(tokenScore(rowAgency, agency), tokenScore(canonicalAgency(rowAgency), canonicalAgency(agency))) < 0.45) continue;
    const name = valueByHeader(headers, row, [/name of incumbent/, /^incumbent$/, /^name$/]);
    const positionTitle = valueByHeader(headers, row, [/position title/, /^position$/, /^title$/]);
    if (!positionTitle) continue;
    leaders.push({
      id: valueByHeader(headers, row, [/unique identifier/, /^id$/]) || `${rowAgency}|${positionTitle}|${name}`,
      agency: rowAgency,
      component: valueByHeader(headers, row, [/component/]) || null,
      positionTitle,
      name: name || "Vacant",
      location: valueByHeader(headers, row, [/location/]) || null,
      appointmentType: valueByHeader(headers, row, [/type of appointment/, /appt type/, /appointment type/]) || null,
      payPlan: valueByHeader(headers, row, [/pay plan/]) || null,
      levelGradePay: valueByHeader(headers, row, [/level.*grade.*pay/, /level or grade/, /grade.*pay/]) || null,
      tenure: valueByHeader(headers, row, [/tenure/]) || null,
      expiration: valueByHeader(headers, row, [/expir/]) || null,
      sourceUrl: PLUM_PAGE_URL,
      source: "OPM PLUM Reporting",
      confidence: "agency-reported",
    });
  }
  return leaders.slice(0, 400);
}

function extractCandidateUrls(scriptText: string, base: URL): string[] {
  const candidates = new Set<string>();
  const regexes = [
    /["'`](https?:\/\/[^"'`\s]{1,400})["'`]/gi,
    /["'`](\/[^"'`\s]{1,300})["'`]/gi,
  ];
  for (const regex of regexes) {
    for (const match of scriptText.matchAll(regex)) {
      const raw = match[1];
      if (!/(plum|incumb|position|agency|escs|download|export)/i.test(raw)) continue;
      if (!/(api|csv|xml|json|export|download)/i.test(raw)) continue;
      try {
        const url = new URL(raw, base);
        if (!url.hostname.toLowerCase().endsWith("opm.gov")) continue;
        candidates.add(url.toString());
      } catch { /* ignore malformed candidate */ }
    }
  }
  return [...candidates];
}

async function discoverPlumCsv(agency: string): Promise<{ leaders: any[]; exportUrl: string | null; diagnostic: string }> {
  const discoveryCacheKey = "opm-plum-export-candidates";
  let candidates = cacheGet<string[]>(discoveryCacheKey);
  if (!candidates) {
    candidates = [];
    try {
      const pageResult = await fetchLimited(PLUM_PAGE_URL, {}, 18_000);
      const html = decode(pageResult.body);
      const pageUrl = new URL(PLUM_PAGE_URL);
      const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)]
        .map((match) => {
          try { return new URL(match[1], pageUrl).toString(); } catch { return null; }
        })
        .filter((value): value is string => Boolean(value))
        .filter((value) => {
          try { return new URL(value).hostname.toLowerCase().endsWith("opm.gov"); } catch { return false; }
        })
        .slice(0, 18);
      const found = new Set<string>();
      for (const scriptUrl of scripts) {
        try {
          const scriptResult = await fetchLimited(scriptUrl, {}, 12_000);
          const scriptText = decode(scriptResult.body);
          for (const candidate of extractCandidateUrls(scriptText, new URL(scriptUrl))) found.add(candidate);
        } catch { /* continue through OPM assets */ }
      }
      candidates = [...found].slice(0, 30);
      cacheSet(discoveryCacheKey, candidates, 24 * 60 * 60_000);
    } catch {
      candidates = [];
    }
  }

  for (const candidate of candidates) {
    try {
      const { response, body } = await fetchLimited(candidate, {}, 16_000);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      const text = decode(body);
      if (/text\/html/i.test(contentType) || /^\s*</.test(text) && !/^\s*<\?xml/i.test(text)) continue;
      const leaders = parsePlumCsv(text, agency);
      if (leaders.length) return { leaders, exportUrl: candidate, diagnostic: "OPM PLUM export discovered and parsed." };
    } catch { /* try the next discovered OPM export candidate */ }
  }
  return { leaders: [], exportUrl: null, diagnostic: "OPM PLUM is authoritative, but its client-side bulk export endpoint was not discoverable as a stable public GET endpoint at request time." };
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const TITLE_PATTERN = "(?:Acting\\s+)?(?:Secretary|Deputy Secretary|Under Secretary(?: for [A-Za-z &/-]{2,80})?|Assistant Secretary(?: for [A-Za-z &/-]{2,80})?|Principal Deputy Assistant Secretary(?: for [A-Za-z &/-]{2,80})?|Administrator|Deputy Administrator|Assistant Administrator|Director|Deputy Director|Commissioner|Deputy Commissioner|Chief of Staff|Deputy Chief of Staff|General Counsel|Inspector General|Chief Human Capital Officer|Chief Financial Officer|Chief Information Officer|Chief Medical Officer|Surgeon General)";
const NAME_PATTERN = "[A-Z][A-Za-z'’.-]+(?:\\s+(?:[A-Z]\\.|[A-Z][A-Za-z'’.-]+)){1,4}";

function validPersonName(name: string): boolean {
  if (!name || name.length > 90) return false;
  if (/(Department|United States|Office|Agency|Administration|Federal|Government|Leadership|Secretary of|Director of)/i.test(name)) return false;
  return name.split(/\s+/).length >= 2;
}

function extractOfficialLeaders(text: string, sourceUrl: string, sourceLabel: string) {
  const leaders: any[] = [];
  const seen = new Set<string>();
  const snippets = text.split(/\n|\s{3,}/).map((value) => value.trim()).filter((value) => value.length >= 6 && value.length <= 500);
  const patterns = [
    new RegExp(`\\b(${NAME_PATTERN})\\s*(?:,|—|–|-|is|serves as|serving as)\\s*(${TITLE_PATTERN})\\b`, "gi"),
    new RegExp(`\\b(${TITLE_PATTERN})\\s*(?::|—|–|-|,)\\s*(${NAME_PATTERN})\\b`, "gi"),
    new RegExp(`\\b(${TITLE_PATTERN})\\s+(${NAME_PATTERN})\\b`, "gi"),
  ];
  for (const snippet of snippets) {
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
      const pattern = patterns[patternIndex];
      for (const match of snippet.matchAll(pattern)) {
        const name = clean(patternIndex === 0 ? match[1] : match[2], 120);
        const title = clean(patternIndex === 0 ? match[2] : match[1], 240);
        if (!validPersonName(name) || !title) continue;
        const key = `${name.toLowerCase()}|${title.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        leaders.push({
          id: key.replace(/[^a-z0-9]+/g, "-").slice(0, 160),
          agency: null,
          component: null,
          positionTitle: title,
          name,
          location: null,
          appointmentType: null,
          payPlan: null,
          levelGradePay: null,
          tenure: null,
          expiration: null,
          sourceUrl,
          source: sourceLabel,
          confidence: "official-page",
        });
      }
    }
  }
  return leaders.slice(0, 80);
}

async function langSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const keys = langSearchKeys();
  for (const key of keys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch("https://api.langsearch.com/v1/web-search", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, freshness: "noLimit", summary: true, count: 10 }),
      });
      if (!response.ok) continue;
      const payload = await response.json() as any;
      const rows: any[] = payload?.data?.webPages?.value ?? [];
      const normalized = rows.flatMap((row): Array<{ title: string; url: string; snippet: string }> => {
        const url = safeOfficialUrl(row?.url);
        if (!url) return [];
        return [{ title: clean(row?.name, 300), url, snippet: clean(row?.summary || row?.snippet, 1_400) }];
      });
      if (normalized.length) return normalized;
    } catch { /* rotate key */ }
    finally { clearTimeout(timer); }
  }
  return [];
}

async function discoverOfficialLeadership(agency: string) {
  const queries = [
    `"${agency}" leadership secretary deputy secretary under secretary assistant secretary official`,
    `"${agency}" leadership director administrator commissioner chief of staff official`,
    `"${agency}" organization leadership site:.gov`,
  ];
  const resultMap = new Map<string, { title: string; url: string; snippet: string }>();
  for (const query of queries) {
    for (const result of await langSearch(query)) {
      if (Math.max(tokenScore(`${result.title} ${result.snippet}`, agency), tokenScore(canonicalAgency(`${result.title} ${result.snippet}`), canonicalAgency(agency))) < 0.15) continue;
      resultMap.set(result.url, result);
    }
  }
  const pages = [...resultMap.values()].slice(0, 10);
  const leaders: any[] = [];
  const seen = new Set<string>();
  const analyzedPages: Array<{ title: string; url: string; status: string }> = [];
  for (const page of pages) {
    try {
      const { response, body } = await fetchLimited(page.url, {}, 12_000);
      if (!response.ok) { analyzedPages.push({ title: page.title, url: page.url, status: `HTTP ${response.status}` }); continue; }
      const text = stripHtml(decode(body)).slice(0, 120_000);
      const extracted = extractOfficialLeaders(text, page.url, page.title || new URL(page.url).hostname);
      analyzedPages.push({ title: page.title, url: page.url, status: `${extracted.length} leadership records` });
      for (const leader of extracted) {
        const key = `${leader.name.toLowerCase()}|${leader.positionTitle.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        leaders.push({ ...leader, agency });
      }
    } catch (error) {
      analyzedPages.push({ title: page.title, url: page.url, status: safeError(error) });
    }
  }
  return { leaders: leaders.slice(0, 120), analyzedPages };
}

async function loadLeadership(agency: string) {
  const cacheKey = `federal-leadership|${agency.toLowerCase()}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return { ...cached, cacheState: "fresh" };

  const plum = await discoverPlumCsv(agency);
  if (plum.leaders.length) {
    const value = {
      agency,
      leaders: plum.leaders,
      returned: plum.leaders.length,
      sourceMode: "opm-plum",
      source: "OPM PLUM Reporting",
      sourceUrl: PLUM_PAGE_URL,
      exportUrl: plum.exportUrl,
      certificationUrl: PLUM_CERTIFICATION_URL,
      dataAsOf: PLUM_DATA_AS_OF,
      retrievedAt: new Date().toISOString(),
      diagnostic: plum.diagnostic,
      analyzedPages: [],
      limitation: "PLUM records are agency-reported policy and supporting positions. They do not represent every manager or employee in an agency.",
    };
    cacheSet(cacheKey, value, 6 * 60 * 60_000);
    return { ...value, cacheState: "refreshed" };
  }

  const fallback = await discoverOfficialLeadership(agency);
  const value = {
    agency,
    leaders: fallback.leaders,
    returned: fallback.leaders.length,
    sourceMode: "official-site-fallback",
    source: "Official .gov/.mil agency pages; OPM PLUM retained as authoritative reference",
    sourceUrl: PLUM_PAGE_URL,
    exportUrl: null,
    certificationUrl: PLUM_CERTIFICATION_URL,
    dataAsOf: PLUM_DATA_AS_OF,
    retrievedAt: new Date().toISOString(),
    diagnostic: plum.diagnostic,
    analyzedPages: fallback.analyzedPages,
    limitation: "Named fallback records are extracted only from official .gov/.mil pages and should be checked against OPM PLUM for appointment status. PLUM remains the authoritative leadership dataset when its export is machine-readable.",
  };
  cacheSet(cacheKey, value, 2 * 60 * 60_000);
  return { ...value, cacheState: "refreshed" };
}

async function loadStructure(agency: string) {
  const cacheKey = `federal-structure|${agency.toLowerCase()}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return { ...cached, cacheState: "fresh" };
  const key = samApiKey();
  if (!key) return { configured: false, agency, organizations: [], source: "SAM.gov Federal Hierarchy Public API", cacheState: "unavailable", retrievedAt: new Date().toISOString() };

  const directory = await loadDirectory();
  const best = (directory.organizations ?? []).map((org: any) => ({ org, score: Math.max(tokenScore(org.name, agency), tokenScore(canonicalAgency(org.name), canonicalAgency(agency))) })).sort((a: any, b: any) => b.score - a.score)[0];
  const url = new URL(SAM_HIERARCHY_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("status", "Active");
  url.searchParams.set("limit", "100");
  if (best?.org?.agencyCode) url.searchParams.set("agencycode", best.org.agencyCode);
  else url.searchParams.set("fhorgname", agency);
  const payload = await fetchJson(url);
  const organizations = hierarchyRows(payload).map(normalizeHierarchyRow).filter((org) => org.name);
  const value = {
    configured: true,
    agency,
    agencyCode: best?.org?.agencyCode ?? null,
    organizations,
    returned: organizations.length,
    source: "SAM.gov Federal Hierarchy Public API",
    sourceUrl: "https://sam.gov/content/fh",
    retrievedAt: new Date().toISOString(),
  };
  cacheSet(cacheKey, value, DIRECTORY_CACHE_TTL_MS);
  return { ...value, cacheState: "refreshed" };
}

router.get("/core-intelligence/federal-live/status", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    ok: true,
    samConfigured: Boolean(samApiKey()),
    leadershipDiscoveryConfigured: langSearchKeys().length > 0,
    sources: ["SAM.gov Get Opportunities Public API", "SAM.gov Federal Hierarchy Public API", "OPM PLUM Reporting", "official .gov/.mil agency pages"],
    opmPlumDataAsOf: PLUM_DATA_AS_OF,
  });
});

router.get("/core-intelligence/federal-live/directory", async (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  try { return res.json({ ok: true, ...(await loadDirectory()) }); }
  catch (error) { return res.status(502).json({ ok: false, configured: Boolean(samApiKey()), organizations: [], source: "SAM.gov Federal Hierarchy Public API", error: safeError(error) }); }
});

router.get("/core-intelligence/federal-live/opportunities", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const agency = clean(req.query.agency, 220);
  const days = Number(req.query.days ?? 180);
  if (agency.length < 2) return res.status(400).json({ ok: false, opportunities: [], error: "agency is required" });
  try { return res.json({ ok: true, ...(await loadOpportunities(agency, days)) }); }
  catch (error) { return res.status(502).json({ ok: false, configured: Boolean(samApiKey()), agency, opportunities: [], source: "SAM.gov Get Opportunities Public API", error: safeError(error) }); }
});

router.get("/core-intelligence/federal-live/structure", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const agency = clean(req.query.agency, 220);
  if (agency.length < 2) return res.status(400).json({ ok: false, organizations: [], error: "agency is required" });
  try { return res.json({ ok: true, ...(await loadStructure(agency)) }); }
  catch (error) { return res.status(502).json({ ok: false, configured: Boolean(samApiKey()), agency, organizations: [], source: "SAM.gov Federal Hierarchy Public API", error: safeError(error) }); }
});

router.get("/core-intelligence/federal-live/leadership", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const agency = clean(req.query.agency, 220);
  if (agency.length < 2) return res.status(400).json({ ok: false, leaders: [], error: "agency is required" });
  try { return res.json({ ok: true, ...(await loadLeadership(agency)) }); }
  catch (error) { return res.status(502).json({ ok: false, agency, leaders: [], source: "OPM PLUM Reporting", sourceUrl: PLUM_PAGE_URL, dataAsOf: PLUM_DATA_AS_OF, error: safeError(error) }); }
});

export default router;
