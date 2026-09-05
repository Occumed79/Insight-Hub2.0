import { Router, type IRouter } from "express";

const router: IRouter = Router();
const CACHE_TTL = 45 * 60_000;

export type CsvRow = Record<string, string>;
type CachedPayload = { expiresAt: number; value: unknown };
let cache: CachedPayload | null = null;
let inFlight: Promise<unknown> | null = null;

const SOURCES = {
  ari: "https://data.cdc.gov/api/views/f3zz-zga5/rows.csv?accessType=DOWNLOAD",
  rt: "https://data.cdc.gov/api/views/5dqz-y4ea/rows.csv?accessType=DOWNLOAD",
  positivity: "https://data.cdc.gov/api/views/seuz-s2cv/rows.csv?accessType=DOWNLOAD",
  wastewaterCovid: "https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/SC2/nwsssc2stateactivitylevelDL.csv",
  wastewaterFlu: "https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/FluA/nwssfluastateactivitylevelDL.csv",
  wastewaterRsv: "https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/rsv/nwssrsvstateactivitylevel.csv",
} as const;

function normalizeKey(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\n") { row.push(field.replace(/\r$/, "")); records.push(row); row = []; field = ""; continue; }
    field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); records.push(row); }
  const headers = (records.shift() || []).map((value) => value.trim());
  return records.filter((record) => record.some((value) => value.trim())).map((record) => Object.fromEntries(headers.map((header, index) => [header, String(record[index] ?? "").trim()])));
}

function value(row: CsvRow, ...keys: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, cell]) => [normalizeKey(key), cell]));
  for (const key of keys) {
    const hit = normalized.get(normalizeKey(key));
    if (hit != null && hit !== "") return hit;
  }
  return "";
}

function numeric(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw || /^(?:na|n\/a|not estimated|not available|suppressed)$/i.test(raw)) return null;
  const cleaned = raw.replace(/[%,$]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRtComposite(input: string) {
  const raw = String(input || "").trim();
  const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)\s*\))?/);
  return {
    median: match?.[1] ? Number(match[1]) : null,
    lower: match?.[2] ? Number(match[2]) : null,
    upper: match?.[3] ? Number(match[3]) : null,
  };
}

function dateNumber(input: string) {
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchCsv(url: string, maxBytes = 24_000_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/csv,*/*;q=0.8", "User-Agent": "Occu-Med Insight Hub/2.0 AOR respiratory surveillance" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error("response exceeded safety limit");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error("response exceeded safety limit");
    return parseCsv(new TextDecoder().decode(buffer));
  } finally { clearTimeout(timer); }
}

function latestBy<T>(rows: T[], key: (row: T) => string, date: (row: T) => string) {
  const result = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const previous = result.get(id);
    if (!previous || dateNumber(date(row)) >= dateNumber(date(previous))) result.set(id, row);
  }
  return [...result.values()];
}

export type AriRecord = { date: string; location: string; stateAbbreviation: string; level: string };
export type RtRecord = { asOf: string; date: string; location: string; stateAbbreviation: string; pathogen: string; epidemicTrend: string; rtEstimate: number | null; rtLower: number | null; rtUpper: number | null; pGrowing: number | null; intervalWidth: number | null; emergencyDepartmentVisitLevel: string };
export type PositivityRecord = { date: string; pathogen: string; percentPositive: number | null };
export type WastewaterRecord = { week: string; location: string; stateAbbreviation: string; pathogen: string; activityLevel: string; activityValue: number | null; sitesReporting: number | null; coverage: string; dataCollectionPeriod: string; updatedAt: string };

export function normalizeAriRows(rows: CsvRow[]): AriRecord[] {
  return latestBy(rows.map((row) => ({
    date: value(row, "week_end", "week end", "date"),
    location: value(row, "geography", "location", "state", "state territory"),
    stateAbbreviation: value(row, "state_abbreviation", "state abbrev", "abbreviation"),
    level: value(row, "label", "respiratory illness level", "ari activity level", "activity level"),
  })).filter((row) => row.location && row.level), (row) => row.location, (row) => row.date);
}

export function normalizeRtRows(rows: CsvRow[]): RtRecord[] {
  const normalized = rows.map((row) => {
    const composite = parseRtComposite(value(row, "rt estimate", "rt", "estimate"));
    const median = numeric(value(row, "median")) ?? composite.median;
    const lower = numeric(value(row, "lower", "lower bound")) ?? composite.lower;
    const upper = numeric(value(row, "upper", "upper bound")) ?? composite.upper;
    const suppliedWidth = numeric(value(row, "interval_width", "interval width"));
    return {
      asOf: value(row, "as_of", "as of", "model run date"),
      date: value(row, "date", "week_end", "week end"),
      location: value(row, "state", "location"),
      stateAbbreviation: value(row, "state_abbreviation", "state abbreviation", "state abbrev"),
      pathogen: value(row, "disease", "pathogen", "pathogen target"),
      epidemicTrend: value(row, "category", "epidemic trend", "trend"),
      rtEstimate: median,
      rtLower: lower,
      rtUpper: upper,
      pGrowing: numeric(value(row, "p_growing", "p growing", "probability growing")),
      intervalWidth: suppliedWidth ?? (lower != null && upper != null ? upper - lower : null),
      emergencyDepartmentVisitLevel: value(row, "emergency department visit level", "ed visit level", "emergency department activity level"),
    };
  }).filter((row) => row.location && row.pathogen && row.date);
  const latestRun = normalized.reduce((max, row) => Math.max(max, dateNumber(row.asOf)), 0);
  const runRows = latestRun ? normalized.filter((row) => dateNumber(row.asOf) === latestRun) : normalized;
  return latestBy(runRows, (row) => `${row.location}|${row.pathogen}`, (row) => row.date);
}

export function normalizePositivityRows(rows: CsvRow[]): PositivityRecord[] {
  const positivityRows: PositivityRecord[] = [];
  for (const row of rows) {
    const date = value(row, "week_end", "week end", "date");
    const pathogen = value(row, "pathogen", "virus");
    const percentage = value(row, "percent_test_positivity", "percent test positivity", "percent positive", "percentage positive", "numeric value");
    if (date && pathogen && percentage) positivityRows.push({ date, pathogen, percentPositive: numeric(percentage) });
    else if (date) {
      for (const [label, aliases] of [["COVID-19", ["COVID-19", "COVID 19"]], ["Influenza", ["Influenza", "Flu"]], ["RSV", ["RSV"]]] as const) {
        const cell = value(row, ...aliases);
        if (cell) positivityRows.push({ date, pathogen: label, percentPositive: numeric(cell) });
      }
    }
  }
  return positivityRows.sort((a, b) => dateNumber(a.date) - dateNumber(b.date));
}

export function normalizeWastewaterRows(rows: CsvRow[], fallbackPathogen: string): WastewaterRecord[] {
  const wastewaterRows: WastewaterRecord[] = [];
  for (const row of rows) {
    const aggregation = value(row, "Data_Collection_Period", "Data Collection Period", "collection period");
    if (aggregation && normalizeKey(aggregation) !== "all results") continue;
    const location = value(row, "State/Territory", "state territory", "location");
    if (!location) continue;
    wastewaterRows.push({
      week: value(row, "Week_Ending_Date", "week ending date", "week_end", "week end", "week"),
      location,
      stateAbbreviation: value(row, "state_abbreviation", "state abbreviation", "state_abbrev"),
      pathogen: value(row, "Pathogen_Target", "pathogen target", "pathogen") || fallbackPathogen,
      activityLevel: value(row, "WVAL_Category", "wval category", "activity level", "activity_level"),
      activityValue: numeric(value(row, "State/Territory_WVAL", "state territory wval", "wval", "wastewater viral activity level")),
      sitesReporting: numeric(value(row, "Number of Sites", "number of sites", "Sites Currently Reporting", "sites currently reporting", "sites reporting")),
      coverage: value(row, "Coverage", "coverage"),
      dataCollectionPeriod: aggregation || value(row, "Time_Period", "time period"),
      updatedAt: value(row, "Date_Updated", "date updated"),
    });
  }
  return latestBy(wastewaterRows, (row) => `${row.location}|${row.pathogen}`, (row) => row.week || row.updatedAt);
}

async function loadPayload() {
  const settled = await Promise.allSettled([
    fetchCsv(SOURCES.ari), fetchCsv(SOURCES.rt, 36_000_000), fetchCsv(SOURCES.positivity),
    fetchCsv(SOURCES.wastewaterCovid), fetchCsv(SOURCES.wastewaterFlu), fetchCsv(SOURCES.wastewaterRsv),
  ]);
  const rows = (index: number): CsvRow[] => settled[index].status === "fulfilled" ? settled[index].value : [];

  const ariRows = normalizeAriRows(rows(0));
  const rtRows = normalizeRtRows(rows(1));
  const positivityRows = normalizePositivityRows(rows(2));
  const wastewaterCovid = normalizeWastewaterRows(rows(3), "COVID-19");
  const wastewaterFlu = normalizeWastewaterRows(rows(4), "Influenza A");
  const wastewaterRsv = normalizeWastewaterRows(rows(5), "RSV");
  const latestWastewater = [...wastewaterCovid, ...wastewaterFlu, ...wastewaterRsv];

  const normalizedCounts = [ariRows.length, rtRows.length, positivityRows.length, wastewaterCovid.length, wastewaterFlu.length, wastewaterRsv.length];
  const sourceNames = Object.keys(SOURCES);
  const sourceHealth = sourceNames.map((name, index) => {
    const fetched = settled[index].status === "fulfilled";
    const rawRows = rows(index).length;
    const normalizedRows = normalizedCounts[index] ?? 0;
    const schemaOk = !fetched || rawRows === 0 ? fetched : normalizedRows > 0;
    return {
      source: name,
      ok: fetched && schemaOk,
      fetched,
      rawRows,
      normalizedRows,
      error: settled[index].status === "rejected"
        ? String((settled[index] as PromiseRejectedResult).reason?.message || (settled[index] as PromiseRejectedResult).reason).slice(0, 180)
        : fetched && rawRows > 0 && normalizedRows === 0 ? "Source returned rows but none matched the expected CDC schema." : undefined,
    };
  });

  return {
    ok: sourceHealth.some((source) => source.ok),
    partial: sourceHealth.some((source) => !source.ok),
    retrievedAt: new Date().toISOString(),
    sourceHealth,
    sources: SOURCES,
    ari: { rows: ariRows, latestDate: ariRows.map((row) => row.date).sort().at(-1) || null },
    rt: { rows: rtRows, latestDate: rtRows.map((row) => row.date).sort().at(-1) || null, latestModelRun: rtRows.map((row) => row.asOf).filter(Boolean).sort().at(-1) || null },
    positivity: { rows: positivityRows.slice(-900), latestDate: positivityRows.map((row) => row.date).sort().at(-1) || null },
    wastewater: { rows: latestWastewater, latestDate: latestWastewater.map((row) => row.week).sort().at(-1) || null },
    rtMethodologyNotice: "CDC changed the Epidemic Trends and Rt modeling method on June 1, 2026; archived estimates spanning that change are not method-identical. This feed preserves the published median, credible interval, P(Rt > 1), epidemic-trend category, estimate date and model-run date. Emergency-department visit level is also preserved when the source schema supplies it.",
    seasonalRtNotice: "The CDC Epidemic Trends and Rt dataset documents estimates for COVID-19 and influenza. RSV remains available in the laboratory-positivity and wastewater panels, but a missing RSV Rt row is not treated as zero or inferred from another signal.",
    limitation: "CDC respiratory surveillance is provisional and source-specific. ARI is an all-acute-respiratory-illness activity measure; epidemic trend/Rt is pathogen-specific; laboratory positivity is national in this feed; wastewater is state/territory and pathogen-specific. These signals measure different concepts and are not interchangeable case counts or a synthetic respiratory-risk score.",
  };
}

async function getPayload() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  if (!inFlight) inFlight = loadPayload();
  try {
    const loaded = await inFlight;
    cache = { expiresAt: Date.now() + CACHE_TTL, value: loaded };
    return loaded;
  } finally { inFlight = null; }
}

router.get("/aor/respiratory-surveillance", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=900, stale-while-revalidate=3600");
  try { return res.json(await getPayload()); }
  catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "CDC respiratory surveillance failed." });
  }
});

export default router;
