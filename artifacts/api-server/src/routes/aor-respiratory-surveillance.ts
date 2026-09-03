import { Router, type IRouter } from "express";

const router: IRouter = Router();
const CACHE_TTL = 45 * 60_000;

type CsvRow = Record<string, string>;
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
  const parsed = Number(String(input || "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function dateNumber(input: string) {
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchCsv(url: string, maxBytes = 18_000_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);
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

async function loadPayload() {
  const settled = await Promise.allSettled([
    fetchCsv(SOURCES.ari), fetchCsv(SOURCES.rt), fetchCsv(SOURCES.positivity),
    fetchCsv(SOURCES.wastewaterCovid), fetchCsv(SOURCES.wastewaterFlu), fetchCsv(SOURCES.wastewaterRsv),
  ]);
  const rows = (index: number) => settled[index].status === "fulfilled" ? settled[index].value : [];
  const sourceHealth = Object.keys(SOURCES).map((name, index) => ({
    source: name,
    ok: settled[index].status === "fulfilled",
    rows: rows(index).length,
    error: settled[index].status === "rejected" ? String((settled[index] as PromiseRejectedResult).reason?.message || (settled[index] as PromiseRejectedResult).reason).slice(0, 180) : undefined,
  }));

  const ariRows = latestBy(rows(0).map((row) => ({
    date: value(row, "week_end", "week end", "date"),
    location: value(row, "location", "state", "state territory"),
    stateAbbreviation: value(row, "state_abbreviation", "state abbrev", "abbreviation"),
    level: value(row, "respiratory illness level", "ari activity level", "activity level"),
  })).filter((row) => row.location && row.level), (row) => row.location, (row) => row.date);

  const rtRows = latestBy(rows(1).map((row) => ({
    date: value(row, "date", "week_end", "week end"),
    location: value(row, "location", "state"),
    stateAbbreviation: value(row, "state_abbreviation", "state abbreviation", "state_abbrev"),
    pathogen: value(row, "pathogen", "pathogen target"),
    epidemicTrend: value(row, "epidemic trend", "trend"),
    rtEstimate: value(row, "rt estimate", "rt", "estimate"),
    emergencyDepartmentVisitLevel: value(row, "emergency department visit level", "ed visit level"),
  })).filter((row) => row.location && row.pathogen), (row) => `${row.location}|${row.pathogen}`, (row) => row.date);

  const positivityRows: Array<{ date: string; pathogen: string; percentPositive: number | null }> = [];
  for (const row of rows(2)) {
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
  positivityRows.sort((a, b) => dateNumber(a.date) - dateNumber(b.date));

  const wastewaterRows: Array<{ week: string; location: string; stateAbbreviation: string; pathogen: string; activityLevel: string; activityValue: number | null; sitesReporting: number | null; coverage: string; updatedAt: string }> = [];
  const wastewaterSources = [
    { index: 3, pathogen: "COVID-19" }, { index: 4, pathogen: "Influenza A" }, { index: 5, pathogen: "RSV" },
  ];
  for (const source of wastewaterSources) for (const row of rows(source.index)) wastewaterRows.push({
    week: value(row, "week", "week_end", "week end"),
    location: value(row, "location", "state territory wval", "state territory"),
    stateAbbreviation: value(row, "state_abbrev", "state abbreviation", "state_abbreviation"),
    pathogen: value(row, "pathogen_target", "pathogen target", "pathogen") || source.pathogen,
    activityLevel: value(row, "activity level", "activity_level"),
    activityValue: numeric(value(row, "state territory wval", "wval", "wastewater viral activity level")),
    sitesReporting: numeric(value(row, "sites currently reporting", "sites reporting")),
    coverage: value(row, "coverage"),
    updatedAt: value(row, "date_updated", "date updated"),
  });
  const latestWastewater = latestBy(wastewaterRows.filter((row) => row.location), (row) => `${row.location}|${row.pathogen}`, (row) => row.week || row.updatedAt);

  return {
    ok: sourceHealth.some((source) => source.ok),
    partial: sourceHealth.some((source) => !source.ok),
    retrievedAt: new Date().toISOString(),
    sourceHealth,
    sources: SOURCES,
    ari: { rows: ariRows, latestDate: ariRows.map((row) => row.date).sort().at(-1) || null },
    rt: { rows: rtRows, latestDate: rtRows.map((row) => row.date).sort().at(-1) || null },
    positivity: { rows: positivityRows.slice(-900), latestDate: positivityRows.map((row) => row.date).sort().at(-1) || null },
    wastewater: { rows: latestWastewater, latestDate: latestWastewater.map((row) => row.week).sort().at(-1) || null },
    limitation: "CDC respiratory surveillance is provisional and source-specific. ARI activity, epidemic trend/Rt, laboratory test positivity, emergency-department activity and wastewater viral activity measure different signals and should not be treated as interchangeable case counts.",
  };
}

async function getPayload() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  if (!inFlight) inFlight = loadPayload();
  try {
    const value = await inFlight;
    cache = { expiresAt: Date.now() + CACHE_TTL, value };
    return value;
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
