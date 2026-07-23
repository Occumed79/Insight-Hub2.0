import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_JOBS = 1_000;
const MAX_GENERIC_LINKS = 45;
const REQUEST_TIMEOUT_MS = 25_000;
const USER_AGENT = "Occu-Med Insight Hub hiring intelligence (manual public careers-page analysis)";

type AdapterName = "greenhouse" | "lever" | "workday" | "ashby" | "smartrecruiters" | "json-ld" | "generic-html";
type RemoteType = "remote" | "hybrid" | "onsite" | "unknown";

type HiringJob = {
  id: string;
  title: string;
  url: string;
  companyName?: string;
  locationText: string;
  city?: string;
  region?: string;
  country?: string;
  department?: string;
  jobFamily: string;
  seniority: string;
  employmentType?: string;
  remoteType: RemoteType;
  postedAt?: string;
  description?: string;
  source: string;
  adapter: AdapterName;
};

type AdapterResult = {
  adapter: AdapterName;
  companyName?: string;
  jobs: HiringJob[];
  complete: boolean;
  analyzedPages: number;
  warnings: string[];
  note: string;
};

type LinkCandidate = { href: string; text: string };

type AtsDetection = {
  adapter: Exclude<AdapterName, "json-ld" | "generic-html">;
  token: string;
  host?: string;
  site?: string;
};

type CountItem = { label: string; count: number };

type HiringSummary = {
  totalJobs: number;
  uniqueLocations: number;
  countries: number;
  remoteJobs: number;
  topLocations: CountItem[];
  jobFamilies: CountItem[];
  seniority: CountItem[];
  employmentTypes: CountItem[];
  remoteMix: CountItem[];
};

function normalizeText(value: unknown, max = 2_000): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return decodeEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, max);
}

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

function safeUrl(value: unknown): URL {
  const input = normalizeText(value, 2_000);
  const parsed = new URL(input);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Careers URL must use http or https.");
  if (parsed.username || parsed.password) throw new Error("Careers URL cannot contain embedded credentials.");
  return parsed;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const lowered = address.toLowerCase();
  return lowered === "::1"
    || lowered === "::"
    || lowered.startsWith("fc")
    || lowered.startsWith("fd")
    || lowered.startsWith("fe8")
    || lowered.startsWith("fe9")
    || lowered.startsWith("fea")
    || lowered.startsWith("feb")
    || lowered.startsWith("::ffff:127.")
    || lowered.startsWith("::ffff:10.")
    || lowered.startsWith("::ffff:192.168.");
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

async function fetchPublic(
  input: string | URL,
  init: RequestInit = {},
  redirectsRemaining = 4,
): Promise<{ response: globalThis.Response; finalUrl: URL }> {
  const url = input instanceof URL ? input : safeUrl(input);
  await assertPublicDestination(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.6",
        ...init.headers,
      },
      signal: controller.signal,
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectsRemaining <= 0) throw new Error("Careers page redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Careers page returned a redirect without a destination.");
      const redirected = new URL(location, url);
      const nextInit: RequestInit = response.status === 303 ? { method: "GET" } : init;
      return fetchPublic(redirected, nextInit, redirectsRemaining - 1);
    }
    return { response, finalUrl: url };
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response: globalThis.Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Careers response is too large to analyze safely.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_SOURCE_BYTES) throw new Error("Careers response is too large to analyze safely.");
  return new TextDecoder().decode(buffer);
}

async function readJson(response: globalThis.Response): Promise<unknown> {
  const text = await readLimitedText(response);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The careers platform returned invalid JSON.");
  }
}

function extractLinks(html: string, baseUrl: URL): LinkCandidate[] {
  const links: LinkCandidate[] = [];
  const expression = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html)) !== null) {
    try {
      const href = new URL(decodeEntities(match[1]), baseUrl).toString();
      const text = normalizeText(match[2], 500);
      links.push({ href, text });
    } catch {
      // Ignore malformed links.
    }
  }
  return links;
}

function titleFromHtml(html: string): string | undefined {
  const og = html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og?.[1]) return normalizeText(og[1], 300);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? normalizeText(title, 300) : undefined;
}

function inferCompanyName(url: URL, html: string, fallback?: string): string {
  if (fallback) return normalizeText(fallback, 200);
  const title = titleFromHtml(html);
  if (title) {
    const cleaned = title
      .replace(/\s*[|–—-]\s*(careers|jobs|job search|open positions).*$/i, "")
      .replace(/^(careers|jobs|open positions)\s*(at|with)?\s*/i, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 120) return cleaned;
  }
  const firstLabel = url.hostname.split(".")[0] || "Company";
  return firstLabel.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function findAtsDetection(sourceUrl: URL, html: string, links: LinkCandidate[]): AtsDetection | null {
  const candidates = [sourceUrl.toString(), ...links.map((link) => link.href), html];
  for (const candidate of candidates) {
    const greenhouse = candidate.match(/https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i);
    if (greenhouse?.[1]) return { adapter: "greenhouse", token: greenhouse[1] };
    const lever = candidate.match(/https?:\/\/jobs\.lever\.co\/([a-z0-9_-]+)/i);
    if (lever?.[1]) return { adapter: "lever", token: lever[1] };
    const ashby = candidate.match(/https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i);
    if (ashby?.[1]) return { adapter: "ashby", token: ashby[1] };
    const smart = candidate.match(/https?:\/\/careers\.smartrecruiters\.com\/([a-z0-9_-]+)/i);
    if (smart?.[1]) return { adapter: "smartrecruiters", token: smart[1] };
  }

  const workdayCandidates = [sourceUrl.toString(), ...links.map((link) => link.href)];
  for (const candidate of workdayCandidates) {
    try {
      const url = new URL(candidate);
      const match = url.hostname.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i);
      if (!match) continue;
      const segments = url.pathname.split("/").filter(Boolean);
      const site = segments.find((segment) => !/^[a-z]{2}-[A-Z]{2}$/.test(segment));
      if (site) return { adapter: "workday", token: match[1], host: url.hostname, site };
    } catch {
      // Ignore malformed candidates.
    }
  }
  return null;
}

function locationParts(value: unknown): { locationText: string; city?: string; region?: string; country?: string } {
  if (!value) return { locationText: "Location not stated" };
  if (typeof value === "string") return { locationText: normalizeText(value, 300) || "Location not stated" };
  if (Array.isArray(value)) {
    const parts = value.map((item) => locationParts(item).locationText).filter(Boolean);
    return { locationText: Array.from(new Set(parts)).join("; ") || "Location not stated" };
  }
  if (typeof value !== "object") return { locationText: normalizeText(value, 300) || "Location not stated" };
  const record = value as Record<string, unknown>;
  const address = record.address && typeof record.address === "object" ? record.address as Record<string, unknown> : record;
  const city = normalizeText(address.addressLocality ?? address.city, 120) || undefined;
  const region = normalizeText(address.addressRegion ?? address.region ?? address.state, 120) || undefined;
  const countryValue = address.addressCountry ?? address.country;
  const country = typeof countryValue === "object" && countryValue
    ? normalizeText((countryValue as Record<string, unknown>).name, 120) || undefined
    : normalizeText(countryValue, 120) || undefined;
  const street = normalizeText(address.streetAddress, 180) || undefined;
  const locationText = [street, city, region, country].filter(Boolean).join(", ") || "Location not stated";
  return { locationText, city, region, country };
}

function remoteTypeFor(text: string): RemoteType {
  const lowered = text.toLowerCase();
  if (lowered.includes("hybrid")) return "hybrid";
  if (lowered.includes("remote") || lowered.includes("work from home") || lowered.includes("telecommut")) return "remote";
  if (lowered.includes("onsite") || lowered.includes("on-site") || lowered.includes("in office")) return "onsite";
  return "unknown";
}

function classifyJobFamily(title: string, department?: string): string {
  const text = `${title} ${department || ""}`.toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ["Engineering & IT", /engineer|developer|software|data scientist|cyber|information technology|\bit\b|systems|network|cloud|architect/],
    ["Operations", /operations|operator|field service|site lead|mission support|production|manufactur/],
    ["Skilled Trades & Maintenance", /technician|mechanic|electrician|maintenance|welder|machinist|plumber|hvac|craft/],
    ["Program & Project Management", /program manager|project manager|project coordinator|scrum|product manager|portfolio manager/],
    ["Supply Chain & Logistics", /supply chain|logistics|warehouse|inventory|procurement|buyer|purchasing|transportation|material/],
    ["Safety & Quality", /safety|ehs|hse|quality|compliance|environmental|industrial hygiene/],
    ["Healthcare", /nurse|physician|medical|clinical|health|therapist|pharmac|dental/],
    ["Security", /security|guard|protective|intelligence analyst|investigator/],
    ["Finance & Accounting", /finance|financial|accountant|accounting|payroll|audit|controller|treasury/],
    ["Human Resources", /human resources|\bhr\b|recruiter|talent|people partner|benefits|compensation/],
    ["Legal & Contracts", /legal|counsel|attorney|contracts?|subcontracts?|paralegal/],
    ["Sales & Business Development", /sales|business development|account executive|capture manager|proposal/],
    ["Marketing & Communications", /marketing|communications|public relations|content|brand/],
    ["Administration", /administrative|coordinator|assistant|office manager|reception|clerical/],
  ];
  return rules.find(([, expression]) => expression.test(text))?.[0] ?? "Other";
}

function classifySeniority(title: string): string {
  const text = title.toLowerCase();
  if (/chief|\bceo\b|\bcfo\b|\bcoo\b|\bcto\b|president|executive/.test(text)) return "Executive";
  if (/vice president|\bvp\b/.test(text)) return "Vice President";
  if (/director|head of/.test(text)) return "Director";
  if (/manager|supervisor|team lead|foreman/.test(text)) return "Manager / Lead";
  if (/principal|staff|senior|\bsr\b|expert/.test(text)) return "Senior / Principal";
  if (/intern|co-op|apprentice|trainee/.test(text)) return "Intern / Trainee";
  if (/junior|\bjr\b|entry level|entry-level|associate/.test(text)) return "Entry / Associate";
  return "Individual Contributor";
}

function createJob(input: {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  companyName?: unknown;
  location?: unknown;
  city?: unknown;
  region?: unknown;
  country?: unknown;
  department?: unknown;
  employmentType?: unknown;
  postedAt?: unknown;
  description?: unknown;
  source: string;
  adapter: AdapterName;
}): HiringJob | null {
  const title = normalizeText(input.title, 300);
  const url = normalizeText(input.url, 2_000);
  if (!title || !url) return null;
  const parsedLocation = locationParts(input.location);
  const city = normalizeText(input.city, 120) || parsedLocation.city;
  const region = normalizeText(input.region, 120) || parsedLocation.region;
  const country = normalizeText(input.country, 120) || parsedLocation.country;
  const department = normalizeText(input.department, 200) || undefined;
  const employmentType = normalizeText(input.employmentType, 120) || undefined;
  const description = normalizeText(input.description, 4_000) || undefined;
  const locationText = parsedLocation.locationText;
  const remoteType = remoteTypeFor(`${locationText} ${description || ""}`);
  return {
    id: normalizeText(input.id, 300) || `${input.adapter}:${url}`,
    title,
    url,
    companyName: normalizeText(input.companyName, 200) || undefined,
    locationText,
    city,
    region,
    country,
    department,
    jobFamily: classifyJobFamily(title, department),
    seniority: classifySeniority(title),
    employmentType,
    remoteType,
    postedAt: normalizeText(input.postedAt, 100) || undefined,
    description,
    source: input.source,
    adapter: input.adapter,
  };
}

function collectJsonLdJobs(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdJobs(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type || "")];
  if (types.some((item) => item.toLowerCase() === "jobposting")) output.push(record);
  Object.values(record).forEach((item) => collectJsonLdJobs(item, output));
}

function parseJsonLdJobs(html: string, pageUrl: URL): HiringJob[] {
  const jobs: HiringJob[] = [];
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const raw = decodeEntities(match[1]).trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const records: Record<string, unknown>[] = [];
      collectJsonLdJobs(parsed, records);
      records.forEach((record) => {
        const organization = record.hiringOrganization && typeof record.hiringOrganization === "object"
          ? record.hiringOrganization as Record<string, unknown>
          : null;
        const jobLocation = record.jobLocation ?? record.applicantLocationRequirements;
        const directApply = normalizeText(record.url, 2_000) || pageUrl.toString();
        const job = createJob({
          id: record.identifier && typeof record.identifier === "object"
            ? (record.identifier as Record<string, unknown>).value
            : record.identifier,
          title: record.title,
          url: directApply,
          companyName: organization?.name,
          location: jobLocation,
          employmentType: record.employmentType,
          postedAt: record.datePosted,
          description: record.description,
          source: pageUrl.toString(),
          adapter: "json-ld",
        });
        if (job) jobs.push(job);
      });
    } catch {
      // Ignore malformed JSON-LD blocks and continue with other evidence.
    }
  }
  return jobs;
}

function deduplicateJobs(jobs: HiringJob[]): HiringJob[] {
  const seen = new Set<string>();
  const result: HiringJob[] = [];
  for (const job of jobs) {
    const key = `${job.url.toLowerCase()}|${job.title.toLowerCase()}|${job.locationText.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(job);
    if (result.length >= MAX_JOBS) break;
  }
  return result;
}

async function analyzeGreenhouse(token: string): Promise<AdapterResult> {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  const { response } = await fetchPublic(apiUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Greenhouse returned HTTP ${response.status}.`);
  const payload = await readJson(response) as Record<string, unknown>;
  const rawJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const jobs = rawJobs.flatMap((value): HiringJob[] => {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    const location = record.location && typeof record.location === "object"
      ? (record.location as Record<string, unknown>).name
      : record.location;
    const departments = Array.isArray(record.departments)
      ? record.departments.map((item) => item && typeof item === "object" ? normalizeText((item as Record<string, unknown>).name, 120) : "").filter(Boolean)
      : [];
    const job = createJob({
      id: record.id,
      title: record.title,
      url: record.absolute_url,
      location,
      department: departments.join(" / "),
      postedAt: record.updated_at,
      description: record.content,
      source: apiUrl,
      adapter: "greenhouse",
    });
    return job ? [job] : [];
  });
  return { adapter: "greenhouse", jobs, complete: true, analyzedPages: 1, warnings: [], note: "Retrieved from the public Greenhouse job-board API." };
}

async function analyzeLever(token: string): Promise<AdapterResult> {
  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
  const { response } = await fetchPublic(apiUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Lever returned HTTP ${response.status}.`);
  const payload = await readJson(response);
  const rawJobs = Array.isArray(payload) ? payload : [];
  const jobs = rawJobs.flatMap((value): HiringJob[] => {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    const categories = record.categories && typeof record.categories === "object" ? record.categories as Record<string, unknown> : {};
    const job = createJob({
      id: record.id,
      title: record.text,
      url: record.hostedUrl ?? record.applyUrl,
      location: categories.location,
      department: categories.department ?? categories.team,
      employmentType: categories.commitment,
      postedAt: record.createdAt,
      description: record.descriptionPlain ?? record.description,
      source: apiUrl,
      adapter: "lever",
    });
    return job ? [job] : [];
  });
  return { adapter: "lever", jobs, complete: true, analyzedPages: 1, warnings: [], note: "Retrieved from the public Lever postings API." };
}

async function analyzeAshby(token: string): Promise<AdapterResult> {
  const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`;
  const { response } = await fetchPublic(apiUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Ashby returned HTTP ${response.status}.`);
  const payload = await readJson(response) as Record<string, unknown>;
  const rawJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const jobs = rawJobs.flatMap((value): HiringJob[] => {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    const job = createJob({
      id: record.id,
      title: record.title,
      url: record.jobUrl ?? record.applyUrl,
      location: record.location,
      department: record.department ?? record.team,
      employmentType: record.employmentType,
      postedAt: record.publishedAt,
      description: record.descriptionPlain ?? record.descriptionHtml,
      source: apiUrl,
      adapter: "ashby",
    });
    if (job && record.isRemote === true) job.remoteType = "remote";
    return job ? [job] : [];
  });
  return { adapter: "ashby", jobs, complete: true, analyzedPages: 1, warnings: [], note: "Retrieved from the public Ashby job-board API." };
}

async function analyzeSmartRecruiters(token: string): Promise<AdapterResult> {
  const jobs: HiringJob[] = [];
  let offset = 0;
  let totalFound = Number.POSITIVE_INFINITY;
  let analyzedPages = 0;
  while (offset < totalFound && jobs.length < MAX_JOBS && analyzedPages < 20) {
    const apiUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=100&offset=${offset}`;
    const { response } = await fetchPublic(apiUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`SmartRecruiters returned HTTP ${response.status}.`);
    const payload = await readJson(response) as Record<string, unknown>;
    const content = Array.isArray(payload.content) ? payload.content : [];
    totalFound = Number(payload.totalFound ?? content.length);
    content.forEach((value) => {
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      const location = record.location && typeof record.location === "object" ? record.location as Record<string, unknown> : {};
      const department = record.department && typeof record.department === "object"
        ? (record.department as Record<string, unknown>).label
        : record.department;
      const employment = record.typeOfEmployment && typeof record.typeOfEmployment === "object"
        ? (record.typeOfEmployment as Record<string, unknown>).label
        : record.typeOfEmployment;
      const job = createJob({
        id: record.id,
        title: record.name,
        url: record.ref ?? `https://jobs.smartrecruiters.com/${token}/${normalizeText(record.id, 200)}`,
        location,
        city: location.city,
        region: location.region,
        country: location.country,
        department,
        employmentType: employment,
        postedAt: record.releasedDate,
        source: apiUrl,
        adapter: "smartrecruiters",
      });
      if (job && location.remote === true) job.remoteType = "remote";
      if (job) jobs.push(job);
    });
    analyzedPages += 1;
    if (content.length === 0) break;
    offset += content.length;
  }
  const complete = jobs.length >= totalFound || offset >= totalFound;
  return {
    adapter: "smartrecruiters",
    jobs,
    complete,
    analyzedPages,
    warnings: complete ? [] : [`SmartRecruiters reported ${totalFound} postings; analysis stopped at the ${MAX_JOBS}-job safety limit.`],
    note: "Retrieved from the public SmartRecruiters postings API.",
  };
}

async function analyzeWorkday(detection: AtsDetection): Promise<AdapterResult> {
  if (!detection.host || !detection.site) throw new Error("Workday tenant or career-site identifier could not be resolved.");
  const endpoint = `https://${detection.host}/wday/cxs/${encodeURIComponent(detection.token)}/${encodeURIComponent(detection.site)}/jobs`;
  const jobs: HiringJob[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  let analyzedPages = 0;
  while (offset < total && jobs.length < MAX_JOBS && analyzedPages < 50) {
    const { response } = await fetchPublic(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: "" }),
    });
    if (!response.ok) throw new Error(`Workday returned HTTP ${response.status}.`);
    const payload = await readJson(response) as Record<string, unknown>;
    const postings = Array.isArray(payload.jobPostings) ? payload.jobPostings : [];
    total = Number(payload.total ?? postings.length);
    postings.forEach((value) => {
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      const externalPath = normalizeText(record.externalPath, 1_000);
      const jobUrl = externalPath ? new URL(externalPath, `https://${detection.host}`).toString() : "";
      const bulletFields = Array.isArray(record.bulletFields) ? record.bulletFields.map((item) => normalizeText(item, 200)).filter(Boolean) : [];
      const job = createJob({
        id: record.bulletFields ?? record.externalPath,
        title: record.title,
        url: jobUrl,
        location: record.locationsText,
        employmentType: bulletFields.find((item) => /full.?time|part.?time|temporary|contract|intern/i.test(item)),
        postedAt: record.postedOn,
        source: endpoint,
        adapter: "workday",
      });
      if (job) jobs.push(job);
    });
    analyzedPages += 1;
    if (postings.length === 0) break;
    offset += postings.length;
  }
  const complete = jobs.length >= total || offset >= total;
  return {
    adapter: "workday",
    jobs,
    complete,
    analyzedPages,
    warnings: complete ? [] : [`Workday reported ${total} postings; analysis stopped at the ${MAX_JOBS}-job safety limit.`],
    note: "Retrieved from the public Workday career-site endpoint.",
  };
}

function likelyJobLink(link: LinkCandidate, sourceUrl: URL): boolean {
  try {
    const url = new URL(link.href);
    const sameHost = url.hostname === sourceUrl.hostname;
    const knownAts = /greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|icims\.com|taleo\.net|successfactors\./i.test(url.hostname);
    const clue = `${url.pathname} ${url.search} ${link.text}`.toLowerCase();
    return (sameHost || knownAts) && /job|career|position|opening|vacanc|requisition|apply/.test(clue);
  } catch {
    return false;
  }
}

async function analyzeGeneric(sourceUrl: URL, sourceHtml: string, sourceLinks: LinkCandidate[]): Promise<AdapterResult> {
  const warnings: string[] = [];
  const jobs = parseJsonLdJobs(sourceHtml, sourceUrl);
  let analyzedPages = 1;
  const candidates = Array.from(new Set(sourceLinks.filter((link) => likelyJobLink(link, sourceUrl)).map((link) => link.href)))
    .filter((href) => href !== sourceUrl.toString())
    .slice(0, MAX_GENERIC_LINKS);

  for (const href of candidates) {
    if (jobs.length >= MAX_JOBS) break;
    try {
      const { response, finalUrl } = await fetchPublic(href);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("html") && !contentType.includes("json")) continue;
      const html = await readLimitedText(response);
      jobs.push(...parseJsonLdJobs(html, finalUrl));
      analyzedPages += 1;
    } catch {
      // One inaccessible job-detail page should not fail the complete manual run.
    }
  }

  if (candidates.length >= MAX_GENERIC_LINKS) warnings.push(`Generic discovery inspected the first ${MAX_GENERIC_LINKS} job-like links. A dedicated adapter may be required for complete coverage.`);
  if (jobs.length === 0) warnings.push("No structured JobPosting records were found. The careers site may require a dedicated adapter or block server-side access.");
  const adapter: AdapterName = jobs.some((job) => job.adapter === "json-ld") ? "json-ld" : "generic-html";
  return {
    adapter,
    jobs,
    complete: candidates.length < MAX_GENERIC_LINKS,
    analyzedPages,
    warnings,
    note: "Inspected public HTML and structured JobPosting metadata. Dynamic sites may expose only partial results without a dedicated adapter.",
  };
}

function countBy(values: Array<string | undefined>, limit = 12): CountItem[] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = normalizeText(value, 160) || "Not stated";
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function summarize(jobs: HiringJob[]): HiringSummary {
  const locations = jobs.map((job) => job.locationText || "Location not stated");
  const countries = new Set(jobs.map((job) => job.country).filter(Boolean));
  const remoteJobs = jobs.filter((job) => job.remoteType === "remote" || job.remoteType === "hybrid").length;
  return {
    totalJobs: jobs.length,
    uniqueLocations: new Set(locations.map((value) => value.toLowerCase())).size,
    countries: countries.size,
    remoteJobs,
    topLocations: countBy(locations),
    jobFamilies: countBy(jobs.map((job) => job.jobFamily)),
    seniority: countBy(jobs.map((job) => job.seniority)),
    employmentTypes: countBy(jobs.map((job) => job.employmentType)),
    remoteMix: countBy(jobs.map((job) => job.remoteType)),
  };
}

async function runAdapter(detection: AtsDetection): Promise<AdapterResult> {
  if (detection.adapter === "greenhouse") return analyzeGreenhouse(detection.token);
  if (detection.adapter === "lever") return analyzeLever(detection.token);
  if (detection.adapter === "ashby") return analyzeAshby(detection.token);
  if (detection.adapter === "smartrecruiters") return analyzeSmartRecruiters(detection.token);
  return analyzeWorkday(detection);
}

router.post("/hiring-intelligence/analyze", async (req: Request, res: Response) => {
  const startedAt = new Date().toISOString();
  try {
    const requestedUrl = safeUrl(req.body?.url);
    const { response, finalUrl } = await fetchPublic(requestedUrl);
    if (!response.ok) {
      res.status(502).json({ error: `Careers page returned HTTP ${response.status}.` });
      return;
    }
    const sourceHtml = await readLimitedText(response);
    const links = extractLinks(sourceHtml, finalUrl);
    const detection = findAtsDetection(finalUrl, sourceHtml, links);
    const result = detection ? await runAdapter(detection) : await analyzeGeneric(finalUrl, sourceHtml, links);
    const jobs = deduplicateJobs(result.jobs).map((job) => ({ ...job, companyName: job.companyName || inferCompanyName(finalUrl, sourceHtml, result.companyName) }));
    const companyName = jobs.find((job) => job.companyName)?.companyName || inferCompanyName(finalUrl, sourceHtml, result.companyName);

    res.json({
      startedAt,
      completedAt: new Date().toISOString(),
      sourceUrl: finalUrl.toString(),
      companyName,
      platform: result.adapter,
      coverage: {
        complete: result.complete,
        analyzedPages: result.analyzedPages,
        totalDiscovered: jobs.length,
        note: result.note,
      },
      warnings: result.warnings,
      summary: summarize(jobs),
      jobs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hiring intelligence analysis failed.";
    const status = /URL|http|Private|local network|credentials/i.test(message) ? 400 : 502;
    res.status(status).json({ error: message });
  }
});

export default router;
