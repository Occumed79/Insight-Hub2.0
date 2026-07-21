import { Router, type IRouter, type Request, type Response } from "express";
import * as XLSX from "xlsx";

const router: IRouter = Router();

const REPORT_PERIOD = "September 1, 2001 through September 30, 2024";
const CASE_REPORTS_PAGE = "https://www.dol.gov/agencies/owcp/dlhwc/lsdbareports";
const CASE_REPORT_ABOUT = "https://www.dol.gov/agencies/owcp/dlhwc/lsaboutdbareports";
const PERFORMANCE_URL = "https://www.dol.gov/agencies/owcp/dlhwc/IndustryDBAPerformanceResults";
const WAIVERS_URL = "https://www.dol.gov/agencies/owcp/dlhwc/dbawaivers/dbawaivers";
const JURISDICTIONS_URL = "https://www.dol.gov/agencies/owcp/dlhwc/dbajurisdictions";
const DBA_OVERVIEW_URL = "https://www.dol.gov/agencies/owcp/dlhwc/lsdba";
const DBA_FAQ_URL = "https://www.dol.gov/agencies/owcp/dlhwc/FAQ/DBAFaqs";
const OALJ_URL = "https://www.dol.gov/agencies/oalj";
const OALJ_DBA_CASELIST_URL = "https://www.dol.gov/agencies/oalj/PUBLIC/DBA_SCA/REFERENCES/CASELISTS/DBALIST0";

const CASE_REPORT_URLS = {
  employer: "https://www.dol.gov/sites/dolgov/files/OWCP/dlhwc/dbadata/employer_data_cumulative2001-2024_redacted.xlsx",
  carrier: "https://www.dol.gov/sites/dolgov/files/OWCP/dlhwc/dbadata/carrier_data_cumulative2001-2024_redacted.xlsx",
  country: "https://www.dol.gov/sites/dolgov/files/OWCP/dlhwc/dbadata/country_data_cumulative2001-2024_redacted.xlsx",
} as const;

type CaseReportCategory = keyof typeof CASE_REPORT_URLS;
type SourceState = "success" | "empty" | "partial" | "disabled" | "error";

type CaseCounts = {
  nlt: number | null;
  lt03: number | null;
  lt4: number | null;
  dea: number | null;
  cop: number | null;
  oth: number | null;
  total: number | null;
};

type DbaCaseRecord = {
  id: string;
  category: CaseReportCategory;
  name: string;
  normalizedName: string;
  counts: CaseCounts;
  suppressed: boolean;
  reportPeriod: string;
  sourceUrl: string;
};

type PerformanceRecord = {
  id: string;
  fiscalYear: number;
  metric: "first-report" | "first-payment";
  carrier: string;
  firstThresholdDays: number;
  firstThresholdPercent: number;
  sixtyDayPercent: number;
  ninetyDayPercent: number;
  sourceUrl: string;
};

type WaiverRecord = {
  id: string;
  status: "active" | "archived";
  location: string;
  waiverType: string;
  waiverNumber: string;
  issuedDate?: string;
  expirationDate?: string;
  renewalNote?: string;
  sourceUrl: string;
};

type SourceStatus = {
  source: string;
  state: SourceState;
  attempted: boolean;
  latencyMs: number;
  recordCount: number;
  sourceUrl: string;
  freshness: string;
  limitation: string;
  error?: string;
};

const REQUIRED_WARNING = "The OWCP DBA Case Summary Reports are compiled from claims-management data for administrative and workload purposes. A case count represents a case created in the OWCP system and does not necessarily equal a unique injury, death, casualty, accepted claim, compensable event, employer fault, legal liability, or official casualty statistic. Public reports may be delayed, incomplete, suppressed, changed, or unavailable. Results require human review and must not be used to determine claim validity, negligence, compliance, employer safety, carrier misconduct, legal responsibility, or medical necessity.";

const JURISDICTIONS = [
  {
    office: "Boston Suboffice (01)",
    boundary: "East of the 75th degree west longitude, Newfoundland, and Greenland.",
    location: "Boston, Massachusetts",
    phone: "(202) 513-6809",
    sourceUrl: JURISDICTIONS_URL,
  },
  {
    office: "New York Suboffice (02)",
    boundary: "Mexico, Central and South America including coastal islands; areas east of the Americas to 60 degrees east longitude, including Iran, Iraq, and Afghanistan; and other locations not assigned elsewhere.",
    location: "New York, New York",
    phone: "(202) 513-6809",
    sourceUrl: JURISDICTIONS_URL,
  },
  {
    office: "Houston Suboffice (08)",
    boundary: "Canada west of 75 degrees and east of 110 degrees west longitude.",
    location: "Houston, Texas",
    phone: "(202) 513-6809",
    sourceUrl: JURISDICTIONS_URL,
  },
  {
    office: "San Francisco Suboffice (13)",
    boundary: "Areas west of the continents of North and South America, excluding coastal islands, to 60 degrees east longitude, excluding Iran, Iraq, and Afghanistan.",
    location: "San Francisco, California",
    phone: "(202) 513-6809",
    sourceUrl: JURISDICTIONS_URL,
  },
  {
    office: "Seattle Suboffice (14)",
    boundary: "Canada west of 110 degrees west longitude and Pacific Ocean areas north of 45 degrees north latitude.",
    location: "Seattle, Washington",
    phone: "(202) 513-6809",
    sourceUrl: JURISDICTIONS_URL,
  },
];

const LEGAL_REFERENCES = [
  {
    title: "Defense Base Act overview",
    type: "program-guidance",
    source: "U.S. Department of Labor — OWCP/DLHWC",
    sourceUrl: DBA_OVERVIEW_URL,
    note: "Official overview of DBA coverage, insurance, waivers, benefits, claims, and legal reference materials.",
  },
  {
    title: "Defense Base Act FAQ",
    type: "program-guidance",
    source: "U.S. Department of Labor — OWCP/DLHWC",
    sourceUrl: DBA_FAQ_URL,
    note: "Official answers concerning coverage, insurance, claims, waivers, and administration.",
  },
  {
    title: "OALJ research and case-status search",
    type: "public-decision-search",
    source: "U.S. Department of Labor — Office of Administrative Law Judges",
    sourceUrl: OALJ_URL,
    note: "Public research entry point for DOL decisions and case-status tools. References do not establish liability or predict outcomes.",
  },
  {
    title: "Public DBA/SCA case list",
    type: "public-decision-index",
    source: "U.S. Department of Labor — OALJ",
    sourceUrl: OALJ_DBA_CASELIST_URL,
    note: "Public index of selected DBA/SCA decisions and references. Private claim files and personal medical information are excluded.",
  },
];

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
      .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
      .replace(/[A-Za-z0-9_-]{24,}/g, "[value redacted]");
  }
  return "Source request failed";
}

async function fetchWithTimeout(url: string, responseType: "text" | "arrayBuffer", timeoutMs = 20_000): Promise<string | ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Occu-Med Insight Hub DBA research workspace (public DOL sources)",
        Accept: responseType === "text" ? "text/html,application/xhtml+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream",
      },
    });
    if (!response.ok) throw new Error(`DOL source returned HTTP ${response.status}`);
    return responseType === "text" ? await response.text() : await response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\b(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LIMITED|LTD|LLC|L L C|PLC|LP)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(left: string, right: string): number {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(0.93, Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.18);
  const leftTokens = new Set(a.split(" ").filter(Boolean));
  const rightTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowValue(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const target = headerKey(alias);
    const exact = entries.find(([key]) => headerKey(key) === target);
    if (exact) return exact[1];
  }
  for (const alias of aliases) {
    const target = headerKey(alias);
    const partial = entries.find(([key]) => headerKey(key).includes(target) || target.includes(headerKey(key)));
    if (partial) return partial[1];
  }
  return undefined;
}

function parseCount(value: unknown): { value: number | null; suppressed: boolean } {
  if (typeof value === "number" && Number.isFinite(value)) return { value, suppressed: false };
  const text = normalizeText(value);
  if (!text) return { value: null, suppressed: false };
  const cleaned = text.replace(/,/g, "");
  const numeric = Number(cleaned);
  if (Number.isFinite(numeric)) return { value: numeric, suppressed: false };
  const suppressed = /<|\*|suppressed|redact|rule of/i.test(text);
  return { value: null, suppressed };
}

function findName(row: Record<string, unknown>, category: CaseReportCategory): string {
  const aliases = category === "employer"
    ? ["Employer", "Employer Name", "Name"]
    : category === "carrier"
      ? ["Carrier", "Insurance Carrier", "Carrier Name", "Name"]
      : ["Nation", "Country", "Location", "Name"];
  return normalizeText(rowValue(row, aliases));
}

function parseCaseWorkbook(buffer: ArrayBuffer, category: CaseReportCategory, sourceUrl: string): DbaCaseRecord[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });
  const records: DbaCaseRecord[] = [];

  rows.forEach((row, index) => {
    const name = findName(row, category);
    if (!name || /^(total|grand total|employer|carrier|nation|country)$/i.test(name)) return;

    const nlt = parseCount(rowValue(row, ["NLT", "No Lost Time"]));
    const lt03 = parseCount(rowValue(row, ["LT0", "LT03", "LTO", "Lost Time 3 Days or Less"]));
    const lt4 = parseCount(rowValue(row, ["LT4", "LT04", "Lost Time 4 Days or More"]));
    const dea = parseCount(rowValue(row, ["DEA", "Death"]));
    const cop = parseCount(rowValue(row, ["COP", "Salary Continuation"]));
    const oth = parseCount(rowValue(row, ["OTH", "Other", "Unknown"]));
    const totalCell = parseCount(rowValue(row, ["Total", "Cases", "Total Cases"]));
    const knownCounts = [nlt.value, lt03.value, lt4.value, dea.value, cop.value, oth.value].filter((value): value is number => value !== null);
    const total = totalCell.value ?? (knownCounts.length ? knownCounts.reduce((sum, value) => sum + value, 0) : null);
    const suppressed = [nlt, lt03, lt4, dea, cop, oth, totalCell].some((cell) => cell.suppressed);

    records.push({
      id: `${category}-${normalizeName(name).replace(/\s+/g, "-").toLowerCase()}-${index}`,
      category,
      name,
      normalizedName: normalizeName(name),
      counts: { nlt: nlt.value, lt03: lt03.value, lt4: lt4.value, dea: dea.value, cop: cop.value, oth: oth.value, total },
      suppressed,
      reportPeriod: REPORT_PERIOD,
      sourceUrl,
    });
  });

  return records.sort((a, b) => (b.counts.total ?? -1) - (a.counts.total ?? -1));
}

function stripHtml(value: string): string {
  return normalizeText(value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function extractTables(html: string): Array<{ start: number; rows: string[][] }> {
  const tables: Array<{ start: number; rows: string[][] }> = [];
  const tableRegex = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
  for (const tableMatch of html.matchAll(tableRegex)) {
    const tableHtml = tableMatch[0];
    const rows: string[][] = [];
    const rowRegex = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
    for (const rowMatch of tableHtml.matchAll(rowRegex)) {
      const cells: string[] = [];
      const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      for (const cellMatch of rowMatch[0].matchAll(cellRegex)) cells.push(stripHtml(cellMatch[1]));
      if (cells.some(Boolean)) rows.push(cells);
    }
    tables.push({ start: tableMatch.index ?? 0, rows });
  }
  return tables;
}

function parsePercent(value: string): number | null {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function parsePerformance(html: string): PerformanceRecord[] {
  const records: PerformanceRecord[] = [];
  const tables = extractTables(html);
  tables.forEach((table, tableIndex) => {
    const context = stripHtml(html.slice(Math.max(0, table.start - 700), table.start));
    const years = [...context.matchAll(/FY\s*(20\d{2})/gi)];
    const fiscalYear = years.length ? Number(years[years.length - 1][1]) : null;
    if (!fiscalYear || !/timeliness/i.test(context)) return;
    const metric: PerformanceRecord["metric"] = /first payments?/i.test(context) ? "first-payment" : "first-report";
    const thresholdMatch = context.match(/(?:in|within)\s*(20|28|30)\s*days?/i);
    const firstThresholdDays = thresholdMatch ? Number(thresholdMatch[1]) : metric === "first-payment" ? 30 : fiscalYear >= 2020 ? 20 : 30;

    table.rows.forEach((cells, rowIndex) => {
      const percents = cells.map(parsePercent).filter((value): value is number => value !== null);
      if (percents.length < 3) return;
      const carrier = cells.find((cell) => cell && !/%|carrier|cases|payment|reported/i.test(cell)) ?? cells[0];
      if (!carrier || /carrier/i.test(carrier)) return;
      records.push({
        id: `${metric}-${fiscalYear}-${normalizeName(carrier).replace(/\s+/g, "-").toLowerCase()}-${tableIndex}-${rowIndex}`,
        fiscalYear,
        metric,
        carrier,
        firstThresholdDays,
        firstThresholdPercent: percents[0],
        sixtyDayPercent: percents[1],
        ninetyDayPercent: percents[2],
        sourceUrl: PERFORMANCE_URL,
      });
    });
  });
  return records.sort((a, b) => b.fiscalYear - a.fiscalYear || a.carrier.localeCompare(b.carrier));
}

function parseIsoDate(value: string): string | undefined {
  const match = value.match(/(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseActiveWaivers(html: string): WaiverRecord[] {
  const records: WaiverRecord[] = [];
  const tables = extractTables(html);
  const waiverTable = tables.find((table) => {
    const header = table.rows.slice(0, 2).flat().join(" ");
    return /expiration date/i.test(header) && /location/i.test(header) && /number/i.test(header);
  });
  if (!waiverTable) return records;

  waiverTable.rows.forEach((cells, index) => {
    if (cells.length < 4 || /expiration date/i.test(cells.join(" "))) return;
    const expirationDate = parseIsoDate(cells[0]);
    const location = normalizeText(cells[1]);
    const waiverType = normalizeText(cells[2]);
    const waiverNumber = normalizeText(cells[3]);
    const issuedDate = parseIsoDate(cells[4] ?? "");
    if (!location || !waiverNumber) return;
    const renewalNote = /renew|request|amend/i.test(cells[0]) ? cells[0].replace(expirationDate ?? "", "").trim() : undefined;
    records.push({
      id: `active-${waiverNumber}-${index}`,
      status: "active",
      location,
      waiverType,
      waiverNumber,
      issuedDate,
      expirationDate,
      renewalNote,
      sourceUrl: WAIVERS_URL,
    });
  });
  return records;
}

function extractArchivedWaiverUrl(html: string): string | null {
  const links = [...html.matchAll(/href=["']([^"']+\.xlsx(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const archived = links.find((match) => /archiv/i.test(stripHtml(match[2])) || /archiv/i.test(match[1]));
  if (!archived) return null;
  try {
    return new URL(archived[1], WAIVERS_URL).toString();
  } catch {
    return null;
  }
}

function parseArchivedWaivers(buffer: ArrayBuffer, sourceUrl: string): WaiverRecord[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const records: WaiverRecord[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: null, raw: false });
    rows.forEach((row, index) => {
      const location = normalizeText(rowValue(row, ["Location", "Country", "Nation"]));
      const waiverNumber = normalizeText(rowValue(row, ["Number", "Waiver Number", "Waiver No"]));
      if (!location || !waiverNumber) return;
      records.push({
        id: `archived-${waiverNumber}-${sheetName}-${index}`,
        status: "archived",
        location,
        waiverType: normalizeText(rowValue(row, ["Type", "Waiver Type"])),
        waiverNumber,
        issuedDate: parseIsoDate(normalizeText(rowValue(row, ["Issued Date", "Issue Date"]))),
        expirationDate: parseIsoDate(normalizeText(rowValue(row, ["Expiration Date", "Expired Date"]))),
        sourceUrl,
      });
    });
  });
  return records;
}

async function runSource<T>(input: {
  source: string;
  sourceUrl: string;
  freshness: string;
  limitation: string;
  runner: () => Promise<T[]>;
}): Promise<{ records: T[]; status: SourceStatus }> {
  const started = Date.now();
  try {
    const records = await input.runner();
    return {
      records,
      status: {
        source: input.source,
        state: records.length ? "success" : "empty",
        attempted: true,
        latencyMs: Date.now() - started,
        recordCount: records.length,
        sourceUrl: input.sourceUrl,
        freshness: input.freshness,
        limitation: input.limitation,
      },
    };
  } catch (error) {
    return {
      records: [],
      status: {
        source: input.source,
        state: "error",
        attempted: true,
        latencyMs: Date.now() - started,
        recordCount: 0,
        sourceUrl: input.sourceUrl,
        freshness: input.freshness,
        limitation: input.limitation,
        error: sanitizeError(error),
      },
    };
  }
}

router.post("/dba/intelligence", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const query = normalizeText(req.body?.query);
  const enabled = String(process.env.DBA_INTELLIGENCE_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return res.json({
      ok: true,
      enabled: false,
      manualRun: true,
      executedAt: new Date().toISOString(),
      query,
      sources: [],
      warning: REQUIRED_WARNING,
      message: "DBA Intelligence is disabled by DBA_INTELLIGENCE_ENABLED=false.",
    });
  }

  const [employersResult, carriersResult, countriesResult, performanceResult, waiversPageResult] = await Promise.all([
    runSource<DbaCaseRecord>({
      source: "OWCP DBA cumulative employer case summary",
      sourceUrl: CASE_REPORT_URLS.employer,
      freshness: `Cumulative snapshot through FY2024 (${REPORT_PERIOD})`,
      limitation: "Employer names may contain DBAs, divisions, punctuation differences, typographical differences, pending names, and privacy suppression under the DOL Rule of 7/11.",
      runner: async () => parseCaseWorkbook(await fetchWithTimeout(CASE_REPORT_URLS.employer, "arrayBuffer") as ArrayBuffer, "employer", CASE_REPORT_URLS.employer),
    }),
    runSource<DbaCaseRecord>({
      source: "OWCP DBA cumulative carrier case summary",
      sourceUrl: CASE_REPORT_URLS.carrier,
      freshness: `Cumulative snapshot through FY2024 (${REPORT_PERIOD})`,
      limitation: "Carriers may be shown under policy-issuing subsidiaries rather than a single corporate parent; counts are public case-system records, not findings about carrier conduct.",
      runner: async () => parseCaseWorkbook(await fetchWithTimeout(CASE_REPORT_URLS.carrier, "arrayBuffer") as ArrayBuffer, "carrier", CASE_REPORT_URLS.carrier),
    }),
    runSource<DbaCaseRecord>({
      source: "OWCP DBA cumulative nation case summary",
      sourceUrl: CASE_REPORT_URLS.country,
      freshness: `Cumulative snapshot through FY2024 (${REPORT_PERIOD})`,
      limitation: "Nation indicates where the reported injury or death occurred, not worker nationality. Missing or pending geography is not a zero.",
      runner: async () => parseCaseWorkbook(await fetchWithTimeout(CASE_REPORT_URLS.country, "arrayBuffer") as ArrayBuffer, "country", CASE_REPORT_URLS.country),
    }),
    runSource<PerformanceRecord>({
      source: "DOL DBA Industry Report Card",
      sourceUrl: PERFORMANCE_URL,
      freshness: "Live manual read of the current DOL performance page",
      limitation: "Performance tables are carrier-aggregated and only include carriers meeting DOL reporting thresholds for the stated period. They do not establish misconduct, liability, or claim outcome.",
      runner: async () => parsePerformance(await fetchWithTimeout(PERFORMANCE_URL, "text") as string),
    }),
    runSource<WaiverRecord>({
      source: "DOL active DBA waivers",
      sourceUrl: WAIVERS_URL,
      freshness: "Live manual read of the current DOL active-waiver page",
      limitation: "Waiver applicability depends on the contract, work location, employee class, citizenship/residency, hiring location, and availability of alternative local workers’ compensation benefits.",
      runner: async () => parseActiveWaivers(await fetchWithTimeout(WAIVERS_URL, "text") as string),
    }),
  ]);

  let archivedWaivers: WaiverRecord[] = [];
  let archivedStatus: SourceStatus;
  const waiverHtml = waiversPageResult.status.state === "success" || waiversPageResult.status.state === "empty"
    ? await fetchWithTimeout(WAIVERS_URL, "text").catch(() => "") as string
    : "";
  const archivedUrl = waiverHtml ? extractArchivedWaiverUrl(waiverHtml) : null;
  if (archivedUrl) {
    const archivedResult = await runSource<WaiverRecord>({
      source: "DOL archived DBA waivers",
      sourceUrl: archivedUrl,
      freshness: "Manual read of the archived-waiver workbook linked by DOL",
      limitation: "DOL states the archived list may not be comprehensive.",
      runner: async () => parseArchivedWaivers(await fetchWithTimeout(archivedUrl, "arrayBuffer") as ArrayBuffer, archivedUrl),
    });
    archivedWaivers = archivedResult.records;
    archivedStatus = archivedResult.status;
  } else {
    archivedStatus = {
      source: "DOL archived DBA waivers",
      state: "empty",
      attempted: true,
      latencyMs: 0,
      recordCount: 0,
      sourceUrl: WAIVERS_URL,
      freshness: "Archived workbook link was not resolved during this manual run",
      limitation: "DOL states the archived list may not be comprehensive; use the official waiver page for manual follow-up.",
    };
  }

  const employers = employersResult.records;
  const carriers = carriersResult.records;
  const countries = countriesResult.records;
  const queryMatches = query
    ? employers
      .map((record) => ({ ...record, matchScore: Number(similarity(query, record.name).toFixed(3)) }))
      .filter((record) => record.matchScore >= 0.2)
      .sort((a, b) => b.matchScore - a.matchScore || (b.counts.total ?? -1) - (a.counts.total ?? -1))
      .slice(0, 60)
    : [];

  const allWaivers = [...waiversPageResult.records, ...archivedWaivers];
  const caseTotal = (records: DbaCaseRecord[]) => records.reduce((sum, record) => sum + (record.counts.total ?? 0), 0);
  const deathTotal = countries.reduce((sum, record) => sum + (record.counts.dea ?? 0), 0);
  const sources = [employersResult.status, carriersResult.status, countriesResult.status, performanceResult.status, waiversPageResult.status, archivedStatus];
  const failedSources = sources.filter((source) => source.state === "error").length;
  const warnings = [
    REQUIRED_WARNING,
    "DOL applies privacy suppression to small employer case-type cells: fewer than seven cases before FY2024 and fewer than eleven beginning in FY2024. Suppressed cells must never be interpreted as zero.",
    "Employer and carrier names can appear under DBAs, subsidiaries, divisions, policy-issuing entities, punctuation variants, or typographical variants. Entity matches are research suggestions requiring manual confirmation.",
    "A country record identifies the reported place of injury or death, not a worker’s nationality, residence, or citizenship.",
  ];
  if (failedSources) warnings.push(`${failedSources} public DOL source${failedSources === 1 ? "" : "s"} failed during this manual run; successful source results remain available.`);

  return res.json({
    ok: true,
    enabled: true,
    manualRun: true,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    runId: `dba-${Date.now().toString(36)}`,
    query,
    reportPeriod: REPORT_PERIOD,
    summary: {
      employerRecords: employers.length,
      carrierRecords: carriers.length,
      countryRecords: countries.length,
      employerCaseCount: caseTotal(employers),
      carrierCaseCount: caseTotal(carriers),
      countryCaseCount: caseTotal(countries),
      countryDeathCaseCount: deathTotal,
      activeWaivers: waiversPageResult.records.length,
      archivedWaivers: archivedWaivers.length,
      performanceRecords: performanceResult.records.length,
      successfulSources: sources.filter((source) => source.state === "success").length,
      failedSources,
    },
    caseReports: {
      employers: employers.slice(0, 1500),
      carriers: carriers.slice(0, 500),
      countries: countries.slice(0, 500),
      queryMatches,
      sourcePage: CASE_REPORTS_PAGE,
      methodologyPage: CASE_REPORT_ABOUT,
    },
    performance: performanceResult.records,
    waivers: allWaivers,
    jurisdictions: JURISDICTIONS,
    legalReferences: LEGAL_REFERENCES,
    sources,
    warnings,
    limitation: REQUIRED_WARNING,
  });
});

export default router;
