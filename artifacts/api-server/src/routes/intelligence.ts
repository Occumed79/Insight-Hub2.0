import { Router, type IRouter } from "express";
import { db, intelligenceFactsTable, intelligenceRunsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

type IntelligenceCategory =
  | "contractAwards"
  | "opportunities"
  | "secFilings"
  | "jobSignals"
  | "sourceFacts"
  | "sourceConfidence"
  | "timelineEvents"
  | "locationExposure"
  | "medicalNetworkGaps"
  | "competitorSignals"
  | "renewalOrExpirationEvents";

type IntelligenceSourceType =
  | "usaspending"
  | "sec"
  | "sam"
  | "official"
  | "careers"
  | "manual"
  | "news"
  | "web";

type IntelligenceConfidence = "high" | "medium" | "low" | "link-only";

type FactRow = {
  companyId: string;
  title: string;
  category: IntelligenceCategory;
  date: string;
  value?: number;
  valueUnit?: "usd" | "count" | "percent" | "score";
  sourceUrl?: string;
  sourceName: string;
  sourceType: IntelligenceSourceType;
  confidence: IntelligenceConfidence;
  rawSnippet?: string;
  summary: string;
  metadata: Record<string, unknown>;
};

type SourceDiagnostic = {
  source: string;
  status: "success" | "no-results" | "error" | "not-applicable" | "needs-key";
  factsFound: number;
  aliasesQueried: string[];
  message: string;
  error?: string;
};

type IngestDiagnostics = {
  sources: SourceDiagnostic[];
  liveFactsInserted: number;
  sourceLeadsInserted: number;
  totalInserted: number;
  aliasesUsed: string[];
};

const COMPANY_ALIASES: Record<string, string[]> = {
  "v2x-global-footprint-intelligence": [
    "V2X", "V2X Inc", "Vectrus", "Vectrus Systems Corporation",
    "Vertex Aerospace", "The Vertex Company", "Vectrus Mission Solutions", "Vectrus Services",
  ],
  caci: ["CACI", "CACI International", "CACI Inc"],
  fluor: ["Fluor", "Fluor Corporation", "Fluor Corp"],
  gdit: ["GDIT", "General Dynamics Information Technology", "General Dynamics IT"],
  "freeport-mcmoran": ["Freeport-McMoRan", "Freeport McMoRan", "Freeport", "FCX"],
  "dynamic-aviation": ["Dynamic Aviation", "Dynamic Aviation Group"],
  "ids-international": ["IDS International", "IDS International Solutions"],
  constellis: ["Constellis", "Constellis Holdings"],
  "asrc-federal": ["ASRC Federal", "ASRC Federal Holding"],
  ecc: ["ECC", "ECC International"],
  iap: ["IAP", "IAP Worldwide Services"],
  amentum: ["Amentum", "Amentum Services"],
};

function getAliases(companyId: string, companyName: string, requestAliases: string[]): string[] {
  const configAliases = COMPANY_ALIASES[companyId] ?? [];
  const all = [companyName, ...requestAliases, ...configAliases];
  return [...new Set(all.map((a) => a.trim()).filter(Boolean))];
}

type USASpendingAward = {
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number;
  "Start Date"?: string;
  "End Date"?: string;
  "Awarding Agency"?: string;
  "Awarding Sub Agency"?: string;
  "Contract Award Type"?: string;
  "Award Type"?: string;
  recipient_id?: string;
  generated_internal_id?: string;
};

type USASpendingResponse = {
  results: USASpendingAward[];
  page_metadata?: { total?: number; page?: number };
};

async function fetchUSASpendingAwards(
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostic: SourceDiagnostic }> {
  const seenAwardIds = new Set<string>();
  const facts: FactRow[] = [];
  const aliasesQueried: string[] = [];

  for (const alias of aliases) {
    aliasesQueried.push(alias);
    const body = {
      filters: {
        award_type_codes: ["A", "B", "C", "D"],
        keywords: [alias],
        time_period: [{ start_date: "2022-01-01", end_date: "2026-12-31" }],
      },
      fields: [
        "Award ID", "Recipient Name", "Award Amount", "Start Date", "End Date",
        "Awarding Agency", "Awarding Sub Agency", "Contract Award Type", "Award Type",
      ],
      page: 1,
      limit: 25,
      sort: "Award Amount",
      order: "desc",
    };

    try {
      const response = await fetch("https://api.usaspending.gov/api/v1/search/spending_by_award/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Occu-Med Insight Hub intelligence ingestion" },
        body: JSON.stringify(body),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as USASpendingResponse;
      const awards = data.results ?? [];

      for (const award of awards) {
        const awardId = award["Award ID"] || award.generated_internal_id || "";
        if (!awardId || seenAwardIds.has(awardId)) continue;
        seenAwardIds.add(awardId);

        const recipientName = award["Recipient Name"] || alias;
        const amount = typeof award["Award Amount"] === "number" ? award["Award Amount"] : undefined;
        const startDate = award["Start Date"] || "";
        const awardingAgency = award["Awarding Agency"] || "Federal agency";

        const recipientLower = recipientName.toLowerCase();
        const isExactMatch = aliases.some((a) => recipientLower.includes(a.toLowerCase()));
        const confidence: IntelligenceConfidence = isExactMatch ? "high" : "medium";

        facts.push({
          companyId,
          title: `${awardingAgency} contract award — ${recipientName}`,
          category: "contractAwards",
          date: startDate,
          value: amount,
          valueUnit: "usd",
          sourceUrl: `https://www.usaspending.gov/award/${awardId}`,
          sourceName: "USASpending.gov",
          sourceType: "usaspending",
          confidence,
          rawSnippet: `${recipientName} — ${award["Contract Award Type"] || "Contract"} — $${(amount ?? 0).toLocaleString()} — ${awardingAgency}`,
          summary: `Federal contract award of $${(amount ?? 0).toLocaleString()} from ${awardingAgency} to ${recipientName}, starting ${startDate || "unknown date"}.`,
          metadata: {
            awardId, recipientName, awardingAgency,
            awardingSubAgency: award["Awarding Sub Agency"],
            endDate: award["End Date"],
            awardType: award["Award Type"],
            matchedAlias: alias,
          },
        });
      }
    } catch {
      // continue to next alias
    }
  }

  return {
    facts,
    diagnostic: {
      source: "usaspending",
      status: facts.length > 0 ? "success" : "no-results",
      factsFound: facts.length,
      aliasesQueried,
      message: facts.length > 0
        ? `${facts.length} contract awards found across ${aliasesQueried.length} alias queries.`
        : `No awards found for any of ${aliasesQueried.length} aliases: ${aliasesQueried.join(", ")}.`,
    },
  };
}

async function fetchSECFilings(
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostic: SourceDiagnostic }> {
  const facts: FactRow[] = [];
  const aliasesQueried: string[] = [];

  for (const alias of aliases) {
    aliasesQueried.push(alias);
    const url = new URL("https://api.sec.gov/cgi-bin/browse-edgar");
    url.searchParams.set("action", "getcompany");
    url.searchParams.set("company", alias);
    url.searchParams.set("type", "10-K");
    url.searchParams.set("dateb", "");
    url.searchParams.set("owner", "include");
    url.searchParams.set("count", "5");
    url.searchParams.set("output", "atom");

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Occu-Med Insight Hub research/research@occumed.example.com",
          "Accept": "application/json",
        },
      });
      if (!response.ok) continue;

      const text = await response.text();
      const entryMatches = text.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
      if (entryMatches.length === 0) continue;

      for (const entryXml of entryMatches.slice(0, 5)) {
        const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
        const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
        const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
        const title = titleMatch ? titleMatch[1].trim() : "SEC Filing";
        const filedDate = updatedMatch ? updatedMatch[1].split("T")[0] : "";
        const link = idMatch ? idMatch[1].trim() : undefined;

        facts.push({
          companyId,
          title: title,
          category: "secFilings",
          date: filedDate,
          sourceUrl: link,
          sourceName: "SEC EDGAR",
          sourceType: "sec",
          confidence: "high",
          summary: `SEC 10-K filing: ${title} filed on ${filedDate}.`,
          metadata: { filingLink: link, matchedAlias: alias },
        });
      }
      break;
    } catch {
      // continue to next alias
    }
  }

  const status: SourceDiagnostic["status"] = facts.length > 0 ? "success" : "no-results";
  const message = facts.length > 0
    ? `${facts.length} SEC filings found.`
    : `No SEC filings found for any of ${aliasesQueried.length} aliases. Company may be private or not a SEC registrant.`;

  return {
    facts,
    diagnostic: {
      source: "sec",
      status,
      factsFound: facts.length,
      aliasesQueried,
      message,
    },
  };
}

// ─── SAM.gov Opportunities API ──────────────────────────────────────────────

type SAMOpportunity = {
  noticeId?: string;
  title?: string;
  solNumber?: string;
  agency?: string;
  office?: string;
  postedDate?: string;
  responseDeadLine?: string;
  type?: string;
  baseType?: string;
  awardAmount?: number;
  naicsCode?: string;
  classificationCode?: string;
  active?: string;
  pointOfContact?: { email?: string }[];
  description?: string;
  organizationType?: string;
};

async function fetchSAMOpportunities(
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostic: SourceDiagnostic }> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    return {
      facts: [],
      diagnostic: {
        source: "sam",
        status: "needs-key",
        factsFound: 0,
        aliasesQueried: aliases,
        message: "SAM.gov API key not configured.",
      },
    };
  }

  const facts: FactRow[] = [];
  const seenNoticeIds = new Set<string>();
  const aliasesQueried: string[] = [];

  for (const alias of aliases.slice(0, 5)) {
    aliasesQueried.push(alias);
    try {
      const params = new URLSearchParams({
        "api_key": apiKey,
        "keyword": alias,
        "limit": "25",
        "index": "opp",
        "mode": "2",
      });
      const response = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`, {
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            facts: [],
            diagnostic: {
              source: "sam",
              status: "error",
              factsFound: 0,
              aliasesQueried,
              message: `SAM.gov API authentication failed (HTTP ${response.status}).`,
              error: `HTTP ${response.status}`,
            },
          };
        }
        continue;
      }
      const data = await response.json() as any;
      const opportunities: SAMOpportunity[] = data.opportunitiesData ?? [];

      for (const opp of opportunities) {
        const noticeId = opp.noticeId || "";
        if (!noticeId || seenNoticeIds.has(noticeId)) continue;
        seenNoticeIds.add(noticeId);

        const title = opp.title || "SAM.gov opportunity";
        const agency = opp.agency || "Federal agency";
        const postedDate = opp.postedDate || "";
        const deadline = opp.responseDeadLine || "";
        const award = typeof opp.awardAmount === "number" ? opp.awardAmount : undefined;
        const oppType = opp.type || opp.baseType || "Opportunity";

        facts.push({
          companyId,
          title: `${agency}: ${title}`,
          category: "opportunities",
          date: postedDate,
          value: award,
          valueUnit: award !== undefined ? "usd" : undefined,
          sourceUrl: `https://sam.gov/opp/${noticeId}/view`,
          sourceName: "SAM.gov",
          sourceType: "sam",
          confidence: "high",
          rawSnippet: `${oppType} — ${agency} — ${opp.solNumber || noticeId}${deadline ? ` — Response deadline: ${deadline}` : ""}`,
          summary: `SAM.gov ${oppType}: ${title} from ${agency}. Posted ${postedDate || "unknown"}.${deadline ? ` Response deadline: ${deadline}.` : ""}${award ? ` Award amount: $${award.toLocaleString()}.` : ""}`,
          metadata: {
            noticeId,
            solNumber: opp.solNumber,
            agency,
            office: opp.office,
            oppType,
            naicsCode: opp.naicsCode,
            classificationCode: opp.classificationCode,
            deadline,
            matchedAlias: alias,
            recordType: "liveFact",
            provider: "sam",
          },
        });
      }
    } catch {
      // continue to next alias
    }
  }

  return {
    facts,
    diagnostic: {
      source: "sam",
      status: facts.length > 0 ? "success" : "no-results",
      factsFound: facts.length,
      aliasesQueried,
      message: facts.length > 0
        ? `${facts.length} SAM.gov opportunities found across ${aliasesQueried.length} alias queries.`
        : `No SAM.gov opportunities found for ${aliasesQueried.length} aliases.`,
    },
  };
}

// ─── USA Jobs API ────────────────────────────────────────────────────────────

type USAJobPosting = {
  PositionTitle?: string;
  PositionURI?: string;
  PositionLocation?: { LocationName?: string }[];
  OrganizationName?: string;
  DepartmentName?: string;
  JobCategory?: { Name?: string }[];
  PublicationStartDate?: string;
  ApplicationCloseDate?: string;
  PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
  JobGrade?: { Code?: string }[];
  PositionSchedule?: { Name?: string }[];
  PositionOfferingType?: { Name?: string }[];
  PositionFormattedDescription?: { ContentFormatted?: string }[];
};

async function fetchUSAJobs(
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostic: SourceDiagnostic }> {
  const apiKey = process.env.USA_JOBS_API_KEY;
  if (!apiKey) {
    return {
      facts: [],
      diagnostic: {
        source: "usajobs",
        status: "needs-key",
        factsFound: 0,
        aliasesQueried: aliases,
        message: "USA Jobs API key not configured.",
      },
    };
  }

  const facts: FactRow[] = [];
  const seenUris = new Set<string>();
  const aliasesQueried: string[] = [];

  for (const alias of aliases.slice(0, 5)) {
    aliasesQueried.push(alias);
    try {
      const response = await fetch("https://data.usajobs.gov/api/Search", {
        headers: {
          "Host": "data.usajobs.gov",
          "User-Agent": process.env.USA_JOBS_USER_AGENT || "occumed@occumed.example.com",
          "Authorization-Key": apiKey,
        },
      });
      if (!response.ok) continue;
      const data = await response.json() as any;
      const jobs: any[] = data?.SearchResult?.SearchResultItems ?? [];

      for (const jobItem of jobs.slice(0, 15)) {
        const job: USAJobPosting = jobItem.MatchedObjectDescriptor || {};
        const uri = job.PositionURI || "";
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);

        const title = job.PositionTitle || "Federal job posting";
        const org = job.OrganizationName || job.DepartmentName || "Federal agency";
        const locations = (job.PositionLocation || []).map((l) => l.LocationName).filter(Boolean).join(", ");
        const postedDate = job.PublicationStartDate || "";
        const closeDate = job.ApplicationCloseDate || "";
        const salary = job.PositionRemuneration?.[0];
        const salaryText = salary ? `$${salary.MinimumRange || "?"}–$${salary.MaximumRange || "?"} ${salary.RateIntervalCode || ""}` : undefined;
        const schedule = job.PositionSchedule?.[0]?.Name || "";
        const offeringType = job.PositionOfferingType?.[0]?.Name || "";

        // Filter: only include if the alias appears in title or org
        const searchText = `${title} ${org}`.toLowerCase();
        if (!aliases.some((a) => searchText.includes(a.toLowerCase()))) continue;

        facts.push({
          companyId,
          title: `${org}: ${title}`,
          category: "jobSignals",
          date: postedDate,
          sourceUrl: uri,
          sourceName: "USA Jobs",
          sourceType: "careers",
          confidence: "high",
          rawSnippet: `${title} at ${org}${locations ? ` — Location: ${locations}` : ""}${salaryText ? ` — Salary: ${salaryText}` : ""}${schedule ? ` — ${schedule}` : ""}${closeDate ? ` — Closes: ${closeDate}` : ""}`,
          summary: `Federal job posting: ${title} at ${org}.${locations ? ` Location(s): ${locations}.` : ""}${salaryText ? ` Salary: ${salaryText}.` : ""}${closeDate ? ` Application closes: ${closeDate}.` : ""}`,
          metadata: {
            positionUri: uri,
            org,
            department: job.DepartmentName,
            locations,
            postedDate,
            closeDate,
            salary: salaryText,
            schedule,
            offeringType,
            jobCategories: job.JobCategory?.map((c) => c.Name).filter(Boolean) ?? [],
            matchedAlias: alias,
            recordType: "liveFact",
            provider: "usajobs",
          },
        });
      }
    } catch {
      // continue to next alias
    }
  }

  return {
    facts,
    diagnostic: {
      source: "usajobs",
      status: facts.length > 0 ? "success" : "no-results",
      factsFound: facts.length,
      aliasesQueried,
      message: facts.length > 0
        ? `${facts.length} USA Jobs postings found across ${aliasesQueried.length} alias queries.`
        : `No USA Jobs postings found for ${aliasesQueried.length} aliases.`,
    },
  };
}

function buildSourceLeads(companyName: string, companyId: string): { leads: FactRow[]; diagnostic: SourceDiagnostic } {
  const encoded = encodeURIComponent(companyName);
  const quoted = encodeURIComponent(`"${companyName}"`);
  const today = new Date().toISOString().split("T")[0];

  const leads: FactRow[] = [
    {
      companyId,
      title: `SAM.gov opportunities search for ${companyName}`,
      category: "opportunities",
      date: today,
      sourceUrl: `https://sam.gov/search/?index=opp&keywords=${encoded}`,
      sourceName: "SAM.gov",
      sourceType: "sam",
      confidence: "link-only",
      summary: `SAM.gov opportunity search link for "${companyName}". API key required for automated fetch.`,
      metadata: { needsKey: true, recordType: "sourceLead", reason: "SAM.gov API requires an API key not currently configured." },
    },
    {
      companyId,
      title: `Official company website search for ${companyName}`,
      category: "sourceFacts",
      date: today,
      sourceUrl: `https://www.google.com/search?q=${quoted}+official+website`,
      sourceName: "Web search",
      sourceType: "official",
      confidence: "link-only",
      summary: `Official website search link for "${companyName}". Use to verify corporate footprint and leadership.`,
      metadata: { needsReview: true, recordType: "sourceLead", reason: "Manual review link — no automated fetch configured." },
    },
    {
      companyId,
      title: `Career portal search for ${companyName}`,
      category: "jobSignals",
      date: today,
      sourceUrl: `https://www.google.com/search?q=${quoted}+careers+jobs+locations`,
      sourceName: "Web search",
      sourceType: "careers",
      confidence: "link-only",
      summary: `Career portal search link for "${companyName}". Job postings signal growth and location expansion.`,
      metadata: { needsReview: true, recordType: "sourceLead", reason: "Manual review link — no automated fetch configured." },
    },
  ];

  return {
    leads,
    diagnostic: {
      source: "sam/official/careers",
      status: "needs-key",
      factsFound: 0,
      aliasesQueried: [companyName],
      message: "3 source leads stored for manual review. SAM.gov requires API key; official/careers are web search links.",
    },
  };
}

// ─── Live Web Provider Integration ───────────────────────────────────────────

type ProviderDiagnostic = SourceDiagnostic & {
  keyConfigured: boolean;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

const SEARCH_QUERIES = (alias: string) => [
  { q: `"${alias}" government contract awards`, category: "contractAwards" as IntelligenceCategory },
  { q: `"${alias}" occupational health locations`, category: "locationExposure" as IntelligenceCategory },
  { q: `"${alias}" careers jobs locations`, category: "jobSignals" as IntelligenceCategory },
  { q: `"${alias}" federal contract award`, category: "contractAwards" as IntelligenceCategory },
  { q: `"${alias}" SEC 10-K filing`, category: "secFilings" as IntelligenceCategory },
  { q: `"${alias}" press release contract award`, category: "sourceFacts" as IntelligenceCategory },
  { q: `"${alias}" SAM.gov opportunities`, category: "opportunities" as IntelligenceCategory },
];

function classifyResult(
  title: string,
  snippet: string,
  url: string,
  defaultCategory: IntelligenceCategory
): IntelligenceCategory {
  const text = `${title} ${snippet} ${url}`.toLowerCase();
  if (/sec\.gov|10-k|10-q|8-k|edgar|filing/.test(text)) return "secFilings";
  if (/usaspending|contract award|award amount|federal contract|procurement/.test(text)) return "contractAwards";
  if (/sam\.gov|opportunit|solicitation|rfp|rfq/.test(text)) return "opportunities";
  if (/career|job|hiring|employment|workforce/.test(text)) return "jobSignals";
  if (/location|region|state|city|facility|office/.test(text)) return "locationExposure";
  if (/clinic|medical|health|network|coverage/.test(text)) return "medicalNetworkGaps";
  return defaultCategory;
}

function confidenceForResult(url: string, snippet: string): IntelligenceConfidence {
  const u = url.toLowerCase();
  if (/usaspending\.gov|sec\.gov|sam\.gov|\.mil|\.gov/.test(u)) return "high";
  if (snippet && snippet.length > 100) return "medium";
  return "low";
}

function dedupKey(f: { sourceUrl?: string; title: string; category: string }): string {
  return `${f.sourceUrl ?? f.title}__${f.category}`;
}

async function searchSerper(
  query: string,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!response.ok) throw new Error(`Serper HTTP ${response.status}`);
  const data = await response.json() as any;
  const organic: any[] = data.organic ?? [];
  return organic.map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.link ?? ""),
    snippet: String(r.snippet ?? ""),
    source: "serper",
  }));
}

async function searchExa(
  query: string,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, numResults: 10, type: "neural" }),
  });
  if (!response.ok) throw new Error(`Exa HTTP ${response.status}`);
  const data = await response.json() as any;
  const results: any[] = data.results ?? [];
  return results.map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.text ?? r.summary ?? ""),
    source: "exa",
  }));
}

async function searchTavily(
  query: string,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, max_results: 10, include_answer: false }),
  });
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
  const data = await response.json() as any;
  const results: any[] = data.results ?? [];
  return results.map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.content ?? ""),
    source: "tavily",
  }));
}

async function extractWithJina(url: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "text/plain",
      },
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, 2000);
  } catch {
    return null;
  }
}

async function extractWithFirecrawl(url: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return null;
    const data = await response.json() as any;
    const content = data?.data?.markdown ?? data?.data?.content ?? "";
    return content ? String(content).slice(0, 2000) : null;
  } catch {
    return null;
  }
}

async function runLiveWebProviders(
  companyName: string,
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostics: ProviderDiagnostic[]; sourcesQueried: string[] }> {
  const hasSerper = Boolean(process.env.SERPER_API_KEY);
  const hasExa = Boolean(process.env.EXA_API_KEY);
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY);
  const hasJina = Boolean(process.env.JINA_API_KEY);

  const facts: FactRow[] = [];
  const diagnostics: ProviderDiagnostic[] = [];
  const sourcesQueried: string[] = [];
  const seenKeys = new Set<string>();
  const today = new Date().toISOString().split("T")[0];

  // Collect all search results across providers and aliases
  const allResults: { result: SearchResult; alias: string; query: string; category: IntelligenceCategory; provider: string }[] = [];

  // Track which aliases were queried per provider
  const aliasesByProvider: Record<string, string[]> = {};

  for (const alias of aliases.slice(0, 5)) {
    const queries = SEARCH_QUERIES(alias);

    if (hasSerper) {
      aliasesByProvider["serper"] ??= [];
      if (!aliasesByProvider["serper"].includes(alias)) aliasesByProvider["serper"].push(alias);
      for (const { q, category } of queries) {
        try {
          const results = await searchSerper(q, process.env.SERPER_API_KEY!);
          for (const result of results) {
            allResults.push({ result, alias, query: q, category, provider: "serper" });
          }
        } catch { /* continue */ }
      }
    }

    if (hasExa) {
      aliasesByProvider["exa"] ??= [];
      if (!aliasesByProvider["exa"].includes(alias)) aliasesByProvider["exa"].push(alias);
      for (const { q, category } of queries) {
        try {
          const results = await searchExa(q, process.env.EXA_API_KEY!);
          for (const result of results) {
            allResults.push({ result, alias, query: q, category, provider: "exa" });
          }
        } catch { /* continue */ }
      }
    }

    if (hasTavily) {
      aliasesByProvider["tavily"] ??= [];
      if (!aliasesByProvider["tavily"].includes(alias)) aliasesByProvider["tavily"].push(alias);
      for (const { q, category } of queries) {
        try {
          const results = await searchTavily(q, process.env.TAVILY_API_KEY!);
          for (const result of results) {
            allResults.push({ result, alias, query: q, category, provider: "tavily" });
          }
        } catch { /* continue */ }
      }
    }
  }

  // Deduplicate search results by URL
  const seenUrls = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    if (!r.result.url || seenUrls.has(r.result.url)) return false;
    seenUrls.add(r.result.url);
    return true;
  });

  // Extract content for top URLs using Firecrawl or Jina (limit to avoid rate limits)
  const extractionCount = Math.min(uniqueResults.length, 15);
  for (let i = 0; i < extractionCount; i++) {
    const item = uniqueResults[i];
    let extractedText: string | null = null;

    if (hasFirecrawl) {
      extractedText = await extractWithFirecrawl(item.result.url, process.env.FIRECRAWL_API_KEY!);
    }
    if (!extractedText && hasJina) {
      extractedText = await extractWithJina(item.result.url, process.env.JINA_API_KEY!);
    }

    if (extractedText) {
      item.result.snippet = extractedText.slice(0, 500);
    }
  }

  // Convert search results into facts
  for (const { result, alias, query, category: defaultCat, provider } of uniqueResults) {
    if (!result.url || !result.title) continue;

    const category = classifyResult(result.title, result.snippet, result.url, defaultCat);
    const confidence = confidenceForResult(result.url, result.snippet);
    const key = dedupKey({ sourceUrl: result.url, title: result.title, category });

    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    facts.push({
      companyId,
      title: result.title.slice(0, 200),
      category,
      date: today,
      sourceUrl: result.url,
      sourceName: provider === "serper" ? "Google (Serper)" : provider === "exa" ? "Exa" : "Tavily",
      sourceType: "web",
      confidence,
      rawSnippet: result.snippet?.slice(0, 500) || undefined,
      summary: result.snippet?.slice(0, 300) || result.title,
      metadata: {
        provider,
        matchedAlias: alias,
        query,
        recordType: "liveFact",
        extracted: result.snippet?.length > 200 ? true : false,
      },
    });
  }

  // Build per-provider diagnostics
  const providers = [
    { name: "serper", has: hasSerper, label: "Serper (Google Search)" },
    { name: "exa", has: hasExa, label: "Exa (Neural Search)" },
    { name: "tavily", has: hasTavily, label: "Tavily (Research Search)" },
    { name: "firecrawl", has: hasFirecrawl, label: "Firecrawl (Page Extraction)" },
    { name: "jina", has: hasJina, label: "Jina (Page Extraction)" },
  ];

  for (const prov of providers) {
    if (!prov.has) {
      diagnostics.push({
        source: prov.name,
        status: "needs-key",
        factsFound: 0,
        aliasesQueried: [],
        message: `${prov.label} not configured — no API key in environment.`,
        keyConfigured: false,
      });
      continue;
    }

    const provFacts = facts.filter((f) => f.metadata?.provider === prov.name);
    const provAliases = aliasesByProvider[prov.name] ?? aliases;

    if (prov.name === "firecrawl" || prov.name === "jina") {
      const extractedCount = facts.filter((f) => f.metadata?.extracted === true).length;
      diagnostics.push({
        source: prov.name,
        status: extractedCount > 0 ? "success" : "no-results",
        factsFound: extractedCount,
        aliasesQueried: provAliases,
        message: extractedCount > 0
          ? `${prov.label}: extracted content from ${extractedCount} URL(s).`
          : `${prov.label}: no content extracted.`,
        keyConfigured: true,
      });
    } else {
      diagnostics.push({
        source: prov.name,
        status: provFacts.length > 0 ? "success" : "no-results",
        factsFound: provFacts.length,
        aliasesQueried: provAliases,
        message: provFacts.length > 0
          ? `${prov.label}: ${provFacts.length} live fact(s) from ${provAliases.length} alias queries.`
          : `${prov.label}: no results from ${provAliases.length} alias queries.`,
        keyConfigured: true,
      });
    }

    if (!sourcesQueried.includes(prov.name)) {
      sourcesQueried.push(prov.name);
    }
  }

  return { facts, diagnostics, sourcesQueried };
}

function buildChartReady(facts: FactRow[]) {
  const liveFacts = facts.filter((f) => f.confidence !== "link-only");

  const awardValueTimeline = liveFacts
    .filter((f) => f.category === "contractAwards" && f.value !== undefined && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({ date: f.date, value: f.value ?? 0, title: f.title, sourceName: f.sourceName }));

  const opportunitiesByStage = liveFacts
    .filter((f) => f.category === "opportunities")
    .reduce<Record<string, string | number>[]>((acc, f) => {
      const stage = (f.metadata?.stage as string) || "identified";
      const existing = acc.find((item) => item.stage === stage);
      if (existing) {
        existing.count = (existing.count as number) + 1;
      } else {
        acc.push({ stage, count: 1, label: f.title });
      }
      return acc;
    }, []);

  const sourceConfidenceOverTime = liveFacts
    .filter((f) => f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({
      date: f.date,
      confidence: f.confidence === "high" ? 3 : f.confidence === "medium" ? 2 : 1,
      sourceName: f.sourceName,
      category: f.category,
    }));

  const jobSignalTrend = liveFacts
    .filter((f) => f.category === "jobSignals" && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({ date: f.date, value: f.value ?? 1, title: f.title, sourceName: f.sourceName }));

  const eventTimeline = liveFacts
    .filter((f) => f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({
      date: f.date,
      category: f.category,
      title: f.title,
      sourceName: f.sourceName,
      confidence: f.confidence,
      value: f.value ?? 0,
    }));

  const locationExposureByRegion = liveFacts
    .filter((f) => f.category === "locationExposure")
    .reduce<Record<string, string | number>[]>((acc, f) => {
      const region = (f.metadata?.region as string) || "Unknown";
      const existing = acc.find((item) => item.region === region);
      if (existing) {
        existing.count = (existing.count as number) + 1;
        existing.value = ((existing.value as number) || 0) + (f.value || 0);
      } else {
        acc.push({ region, count: 1, value: f.value ?? 0 });
      }
      return acc;
    }, []);

  const networkGapScoreByRegion = liveFacts
    .filter((f) => f.category === "medicalNetworkGaps")
    .map((f) => ({
      region: (f.metadata?.region as string) || "Unknown",
      gapScore: f.value ?? 0,
      title: f.title,
      sourceName: f.sourceName,
    }));

  return {
    awardValueTimeline,
    opportunitiesByStage,
    sourceConfidenceOverTime,
    jobSignalTrend,
    eventTimeline,
    locationExposureByRegion,
    networkGapScoreByRegion,
  };
}

router.get("/intelligence/health", async (_req, res) => {
  try {
    await db.select().from(intelligenceFactsTable).limit(1);
    res.json({ ok: true, status: "available" });
  } catch (error) {
    console.error("Intelligence health error:", error);
    res.status(503).json({ ok: false, status: "unavailable", error: error instanceof Error ? error.message : "Database unavailable" });
  }
});

router.get("/intelligence/company/:companyId", async (req, res) => {
  try {
    const companyId = String(req.params.companyId || "").trim();
    if (!companyId) {
      res.status(400).json({ ok: false, error: "companyId is required" });
      return;
    }
    const facts = await db.select().from(intelligenceFactsTable).where(eq(intelligenceFactsTable.companyId, companyId)).orderBy(desc(intelligenceFactsTable.discoveredAt));
    const runs = await db.select().from(intelligenceRunsTable).where(eq(intelligenceRunsTable.companyId, companyId)).orderBy(desc(intelligenceRunsTable.startedAt));

    const mappedFacts = facts.map((f) => ({
      id: String(f.id),
      companyId: f.companyId,
      title: f.title,
      category: f.category as IntelligenceCategory,
      date: f.factDate || "",
      discoveredAt: f.discoveredAt.toISOString(),
      value: f.value ? Number(f.value) : undefined,
      valueUnit: (f.valueUnit as "usd" | "count" | "percent" | "score") || undefined,
      sourceUrl: f.sourceUrl || undefined,
      sourceName: f.sourceName,
      sourceType: f.sourceType as IntelligenceSourceType,
      confidence: f.confidence as IntelligenceConfidence,
      rawSnippet: f.rawSnippet || undefined,
      summary: f.summary,
      metadata: (f.metadata as Record<string, unknown>) || {},
    }));

    const mappedRuns = runs.map((r) => ({
      id: String(r.id),
      companyId: r.companyId,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() || "",
      sourcesQueried: (r.sourcesQueried as string[]) || [],
      factsCollected: r.factsCollected,
      status: r.status as "completed" | "partial" | "failed",
      error: r.error || undefined,
    }));

    const chartReady = buildChartReady(mappedFacts);

    const liveFacts = mappedFacts.filter((f) => f.confidence !== "link-only");
    const sourceLeads = mappedFacts.filter((f) => f.confidence === "link-only");

    res.json({
      ok: true,
      companyId,
      facts: mappedFacts,
      runs: mappedRuns,
      chartReady,
      diagnostics: {
        liveFacts: liveFacts.length,
        sourceLeads: sourceLeads.length,
        total: mappedFacts.length,
      },
    });
  } catch (error) {
    console.error("Get intelligence error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get intelligence" });
  }
});

router.post("/intelligence/ingest/company", async (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "").trim();
    const companyName = String(req.body?.companyName || "").trim();
    const requestAliases: string[] = Array.isArray(req.body?.aliases) ? req.body.aliases : [];
    if (!companyId || !companyName) {
      res.status(400).json({ ok: false, error: "companyId and companyName are required" });
      return;
    }

    const aliases = getAliases(companyId, companyName, requestAliases);

    const [run] = await db.insert(intelligenceRunsTable).values({
      companyId,
      startedAt: new Date(),
      status: "running",
      sourcesQueried: [],
    }).returning();

    const sourcesQueried: string[] = [];
    const allFacts: FactRow[] = [];
    const diagnostics: SourceDiagnostic[] = [];
    const errors: string[] = [];

    // USASpending — free, no key required
    sourcesQueried.push("usaspending");
    try {
      const { facts: usaFacts, diagnostic: usaDiag } = await fetchUSASpendingAwards(aliases, companyId);
      allFacts.push(...usaFacts);
      diagnostics.push(usaDiag);
      if (usaFacts.length === 0) {
        errors.push(`USASpending: no awards found for ${aliases.length} aliases`);
      }
    } catch (err) {
      const msg = `USASpending: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "usaspending", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // SEC EDGAR — free, no key required
    sourcesQueried.push("sec");
    try {
      const { facts: secFacts, diagnostic: secDiag } = await fetchSECFilings(aliases, companyId);
      allFacts.push(...secFacts);
      diagnostics.push(secDiag);
      if (secFacts.length === 0) {
        errors.push(`SEC: no filings found — company may be private`);
      }
    } catch (err) {
      const msg = `SEC: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "sec", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // Live web providers — Serper, Exa, Tavily, Firecrawl, Jina (uses configured API keys)
    try {
      const { facts: webFacts, diagnostics: webDiags, sourcesQueried: webSources } = await runLiveWebProviders(companyName, aliases, companyId);
      allFacts.push(...webFacts);
      diagnostics.push(...webDiags);
      sourcesQueried.push(...webSources);
      if (webFacts.length === 0) {
        errors.push(`Web providers: no live facts from any configured provider`);
      }
    } catch (err) {
      const msg = `Web providers: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "web-providers", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // SAM.gov Opportunities — uses SAM_GOV_API_KEY
    sourcesQueried.push("sam");
    try {
      const { facts: samFacts, diagnostic: samDiag } = await fetchSAMOpportunities(aliases, companyId);
      allFacts.push(...samFacts);
      diagnostics.push(samDiag);
      if (samFacts.length === 0 && samDiag.status !== "needs-key") {
        errors.push(`SAM.gov: no opportunities found for ${aliases.length} aliases`);
      }
    } catch (err) {
      const msg = `SAM.gov: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "sam", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // USA Jobs — uses USA_JOBS_API_KEY
    sourcesQueried.push("usajobs");
    try {
      const { facts: jobsFacts, diagnostic: jobsDiag } = await fetchUSAJobs(aliases, companyId);
      allFacts.push(...jobsFacts);
      diagnostics.push(jobsDiag);
      if (jobsFacts.length === 0 && jobsDiag.status !== "needs-key") {
        errors.push(`USA Jobs: no postings found for ${aliases.length} aliases`);
      }
    } catch (err) {
      const msg = `USA Jobs: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "usajobs", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // Link-only fallback — only if no live facts from any source
    const liveFactsSoFar = allFacts.filter((f) => f.confidence !== "link-only");
    if (liveFactsSoFar.length === 0) {
      sourcesQueried.push("sam", "official", "careers");
      const { leads, diagnostic: leadDiag } = buildSourceLeads(companyName, companyId);
      diagnostics.push(leadDiag);
      allFacts.push(...leads);
    }

    // Insert facts into DB
    const insertedFacts: typeof intelligenceFactsTable.$inferSelect[] = allFacts.length > 0
      ? await db.insert(intelligenceFactsTable).values(
          allFacts.map((f) => ({
            companyId: f.companyId,
            title: f.title,
            category: f.category,
            factDate: f.date || null,
            value: f.value !== undefined ? String(f.value) : null,
            valueUnit: f.valueUnit || null,
            sourceUrl: f.sourceUrl || null,
            sourceName: f.sourceName,
            sourceType: f.sourceType,
            confidence: f.confidence,
            rawSnippet: f.rawSnippet || null,
            summary: f.summary,
            metadata: f.metadata,
            runId: run.id,
          }))
        ).returning()
      : [];

    const liveFactsInserted = insertedFacts.filter((f) => f.confidence !== "link-only").length;
    const sourceLeadsInserted = insertedFacts.filter((f) => f.confidence === "link-only").length;

    // Update run status
    const runStatus = liveFactsInserted > 0 ? (errors.length > 0 ? "partial" : "completed") : (insertedFacts.length > 0 ? "partial" : "failed");
    await db.update(intelligenceRunsTable).set({
      completedAt: new Date(),
      sourcesQueried,
      factsCollected: insertedFacts.length,
      status: runStatus,
      error: errors.length > 0 ? errors.join("; ") : null,
    }).where(eq(intelligenceRunsTable.id, run.id));

    const mappedFacts = insertedFacts.map((f) => ({
      id: String(f.id),
      companyId: f.companyId,
      title: f.title,
      category: f.category as IntelligenceCategory,
      date: f.factDate || "",
      discoveredAt: f.discoveredAt.toISOString(),
      value: f.value ? Number(f.value) : undefined,
      valueUnit: (f.valueUnit as "usd" | "count" | "percent" | "score") || undefined,
      sourceUrl: f.sourceUrl || undefined,
      sourceName: f.sourceName,
      sourceType: f.sourceType as IntelligenceSourceType,
      confidence: f.confidence as IntelligenceConfidence,
      rawSnippet: f.rawSnippet || undefined,
      summary: f.summary,
      metadata: (f.metadata as Record<string, unknown>) || {},
    }));

    const chartReady = buildChartReady(mappedFacts);

    const ingestDiagnostics: IngestDiagnostics = {
      sources: diagnostics,
      liveFactsInserted,
      sourceLeadsInserted,
      totalInserted: insertedFacts.length,
      aliasesUsed: aliases,
    };

    res.json({
      ok: true,
      runId: run.id,
      companyId,
      companyName,
      sourcesQueried,
      factsCollected: insertedFacts.length,
      liveFactsInserted,
      sourceLeadsInserted,
      status: runStatus,
      errors: errors.length > 0 ? errors : undefined,
      diagnostics: ingestDiagnostics,
      facts: mappedFacts,
      chartReady,
    });
  } catch (error) {
    console.error("Intelligence ingestion error:", error);
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : "Ingestion failed" });
  }
});

export default router;
