import { Router, type IRouter } from "express";

const router: IRouter = Router();
const CACHE_TTL = 30 * 60_000;
const DAY_TTL = 24 * 60 * 60_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type Row = Record<string, string>;
type JsonRow = Record<string, unknown>;

const ALLEN_DASHBOARD = "https://ma-allen.com/troops_dashboard/";
const ALLEN_RESEARCH = "https://www.ma-allen.com/military-deployments/";
const ALLEN_GEOCODED_CONSTRUCTION = "https://ma-allen.com/Documents/research/minerva/geocoded_expenditures.csv";
const FIGSHARE_ARTICLE = "https://api.figshare.com/v2/articles/17207183";
const OUTBREAK_TRACKER = "https://outbreaktracker.live/";

const PAPER_LISA: Record<string, "high-high" | "low-high"> = {
  CA: "high-high", US: "high-high", HK: "high-high",
  AO: "high-high", BJ: "high-high", BF: "high-high", BI: "high-high", CM: "high-high",
  CF: "high-high", TD: "high-high", CG: "high-high", CD: "high-high", CI: "high-high",
  GH: "high-high", KE: "high-high", ML: "high-high", NE: "high-high", NG: "high-high",
  RW: "high-high", SS: "high-high", TZ: "high-high", TG: "high-high", UG: "high-high", ZM: "high-high",
  BT: "low-high", NP: "low-high", MO: "low-high", MM: "low-high", LY: "low-high",
};

function text(value: unknown): string { return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""; }
function numberValue(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/[$,% ,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}
function absoluteUrl(base: string, value: string): string {
  try { return new URL(value, base).toString(); } catch { return ""; }
}
async function fetchText(url: string, ttl = CACHE_TTL): Promise<string> {
  const key = `text:${url}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as string;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/html,text/csv,text/plain,*/*", "User-Agent": "Occu-Med-Insight-Hub/2.0 map intelligence" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.text();
    cache.set(key, { expiresAt: Date.now() + ttl, value });
    return value;
  } finally { clearTimeout(timer); }
}
async function fetchJson(url: string, ttl = DAY_TTL): Promise<any> {
  const key = `json:${url}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 map intelligence" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json();
    cache.set(key, { expiresAt: Date.now() + ttl, value });
    return value;
  } finally { clearTimeout(timer); }
}

function parseCsv(input: string): Row[] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); records.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); records.push(row); }
  const header = (records.shift() ?? []).map((value) => value.trim().replace(/^\uFEFF/, ""));
  return records.filter((values) => values.some((value) => value.trim())).map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])) as Row);
}

function candidateDataUrls(base: string, body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (/\.(?:csv|json)(?:$|\?)/i.test(value)) found.add(absoluteUrl(base, value));
  }
  for (const match of body.matchAll(/["'`]([^"'`]+\.(?:csv|json)(?:\?[^"'`]*)?)["'`]/gi)) found.add(absoluteUrl(base, match[1]));
  return [...found].filter(Boolean);
}
function scriptUrls(base: string, body: string): string[] {
  return [...body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => absoluteUrl(base, match[1])).filter(Boolean);
}
function headerKeys(rows: Row[]) { return Object.keys(rows[0] ?? {}).map((key) => key.toLowerCase()); }
function firstField(row: Row, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (found?.[1]) return found[1];
  }
  return "";
}

async function allenDefensePresence() {
  const warnings: string[] = [];
  const pages = await Promise.allSettled([fetchText(ALLEN_DASHBOARD), fetchText(ALLEN_RESEARCH)]);
  const pageBodies = pages.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!pageBodies.length) warnings.push("Michael Allen pages were unreachable during this refresh.");
  const discovered = new Set<string>([ALLEN_GEOCODED_CONSTRUCTION]);
  pageBodies.forEach((body, index) => candidateDataUrls(index === 0 ? ALLEN_DASHBOARD : ALLEN_RESEARCH, body).forEach((url) => discovered.add(url)));

  // The dashboard's CSV is sometimes constructed by JavaScript. Inspect same-site scripts for data-file references rather than scraping rendered SVG/circles.
  if (pageBodies[0]) {
    const scripts = scriptUrls(ALLEN_DASHBOARD, pageBodies[0]).filter((url) => new URL(url).hostname.endsWith("ma-allen.com")).slice(0, 20);
    const scriptBodies = await Promise.allSettled(scripts.map((url) => fetchText(url)));
    scriptBodies.forEach((result) => { if (result.status === "fulfilled") candidateDataUrls(ALLEN_DASHBOARD, result.value).forEach((url) => discovered.add(url)); });
  }

  const dataFiles: Array<{ url: string; rows: Row[] }> = [];
  for (const url of [...discovered].slice(0, 30)) {
    try {
      const body = await fetchText(url, DAY_TTL);
      const rows = /\.json(?:\?|$)/i.test(url) ? (() => {
        try {
          const parsed = JSON.parse(body);
          const array = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed?.rows) ? parsed.rows : [];
          return array.filter((item: unknown) => item && typeof item === "object" && !Array.isArray(item)).map((item: JsonRow) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, text(value)])) as Row);
        } catch { return []; }
      })() : parseCsv(body);
      if (rows.length) dataFiles.push({ url, rows });
    } catch { /* a discovered decorative asset is not a fatal source failure */ }
  }

  const troopFile = dataFiles.find(({ rows }) => {
    const keys = headerKeys(rows);
    return keys.some((key) => /troops?_ad|personnel|troops/.test(key)) && keys.some((key) => /countryname|country|location/.test(key));
  });
  const constructionFile = dataFiles.find(({ rows }) => {
    const keys = headerKeys(rows);
    const hasLatitude = keys.some((key) => key === "lat" || key === "latitude");
    const hasLongitude = keys.some((key) => key === "log" || key === "lon" || key === "lng" || key === "longitude");
    const hasSpending = keys.some((key) => key === "toa.sum" || key === "toa.mean" || /cost|spend|amount|construction/.test(key));
    return hasLatitude && hasLongitude && hasSpending;
  });

  const troopRows = troopFile?.rows ?? [];
  const years = troopRows.map((row) => numberValue(firstField(row, "year"))).filter((value): value is number => value !== null);
  const latestYear = years.length ? Math.max(...years) : null;
  const current = troopRows.filter((row) => latestYear === null || numberValue(firstField(row, "year")) === latestYear).map((row) => ({
    country: firstField(row, "countryname", "country", "location"),
    iso3: firstField(row, "iso3c", "iso3"),
    year: numberValue(firstField(row, "year")),
    quarter: firstField(row, "quarter"),
    personnel: numberValue(firstField(row, "troops_ad", "troops", "personnel")),
    army: numberValue(firstField(row, "army_ad", "army")),
    navy: numberValue(firstField(row, "navy_ad", "navy")),
    airForce: numberValue(firstField(row, "air_force_ad", "air_force", "air force")),
    marines: numberValue(firstField(row, "marine_corps_ad", "marines", "marine_corps")),
    source: firstField(row, "source"),
  })).filter((row) => row.country && row.personnel !== null);

  const construction = (constructionFile?.rows ?? []).map((row) => ({
    location: firstField(row, "loc.name", "location", "base", "site", "facility", "countryname", "country"),
    country: firstField(row, "countryname", "country"),
    year: numberValue(firstField(row, "year")),
    latitude: numberValue(firstField(row, "latitude", "lat")),
    longitude: numberValue(firstField(row, "longitude", "lon", "lng", "log")),
    spending: numberValue(firstField(row, "toa.sum", "toa.mean", "spending", "amount", "cost", "total")),
  })).filter((row) => row.latitude !== null && row.longitude !== null);

  if (!troopFile) warnings.push("The Allen dashboard loaded, but its generated troop CSV/JSON export was not discoverable in this refresh. WarCosts layers remain available and no troop totals are fabricated.");
  if (!constructionFile) warnings.push("No geocoded Allen construction export was discoverable in this refresh.");

  return {
    ok: Boolean(troopFile || constructionFile),
    partial: !troopFile || !constructionFile,
    source: { name: "Michael Allen / troopdata", dashboard: ALLEN_DASHBOARD, research: ALLEN_RESEARCH, latestAdvertisedQuarter: "Q4 2025" },
    latestYear,
    current,
    construction,
    discoveredFiles: dataFiles.map((item) => item.url),
    warnings,
  };
}

async function epidemicHistory() {
  const metadata = await fetchJson(FIGSHARE_ARTICLE, DAY_TTL);
  const files = Array.isArray(metadata?.files) ? metadata.files : [];
  const outbreakFile = files.find((file: any) => String(file?.name || "").toLowerCase() === "outbreaks.csv") || files.find((file: any) => /outbreaks.*\.csv$/i.test(String(file?.name || "")));
  if (!outbreakFile?.download_url) throw new Error("Figshare metadata did not expose Outbreaks.csv.");
  const csv = await fetchText(outbreakFile.download_url, DAY_TTL);
  const records = parseCsv(csv);
  const countries = new Map<string, { country: string; iso2: string; iso3: string; outbreakCount: number; firstYear: number; lastYear: number; diseaseCounts: Map<string, number> }>();
  const diseases = new Set<string>();
  for (const row of records) {
    const iso2 = firstField(row, "iso2").toUpperCase();
    const iso3 = firstField(row, "iso3").toUpperCase();
    const country = firstField(row, "Country", "country");
    const disease = firstField(row, "Disease", "disease", "icd104n", "icd10n");
    const year = numberValue(firstField(row, "Year", "year"));
    if (!iso2 || !country || year === null) continue;
    if (disease) diseases.add(disease);
    const item = countries.get(iso2) ?? { country, iso2, iso3, outbreakCount: 0, firstYear: year, lastYear: year, diseaseCounts: new Map<string, number>() };
    item.outbreakCount += 1;
    item.firstYear = Math.min(item.firstYear, year);
    item.lastYear = Math.max(item.lastYear, year);
    if (disease) item.diseaseCounts.set(disease, (item.diseaseCounts.get(disease) ?? 0) + 1);
    countries.set(iso2, item);
  }
  const rows = [...countries.values()].map((item) => {
    const diseaseCounts = Object.fromEntries([...item.diseaseCounts.entries()].sort((a, b) => b[1] - a[1]));
    return {
      country: item.country,
      iso2: item.iso2,
      iso3: item.iso3,
      outbreakCount: item.outbreakCount,
      firstYear: item.firstYear,
      lastYear: item.lastYear,
      uniqueDiseases: item.diseaseCounts.size,
      diseaseCounts,
      topDiseases: Object.entries(diseaseCounts).slice(0, 6).map(([disease, count]) => ({ disease, count })),
      lisa: PAPER_LISA[item.iso2] ?? "not-significant",
      neighboringPressure: PAPER_LISA[item.iso2] === "high-high" ? "high-frequency country with high-frequency neighbors" : PAPER_LISA[item.iso2] === "low-high" ? "lower-frequency country adjacent to high-frequency neighbors" : "not significant in the published 99% LISA map",
    };
  }).sort((a, b) => b.outbreakCount - a.outbreakCount);
  return {
    ok: true,
    source: { name: "Torres Munguía et al. / WHO Disease Outbreak News", doi: "10.1038/s41597-022-01797-2", figshare: "10.6084/m9.figshare.17207183.v2" },
    methodology: {
      period: "1996–March 2022",
      unit: "one disease-country-year outbreak occurrence",
      globalMoransI: 0.336,
      pValue: "<0.001",
      lisa: "Published 99% Local Moran/LISA significant-cluster classification from the paper; this endpoint does not relabel the 2022 analysis as a current severity score.",
      limitation: "Occurrence/recurrence only: the historical dataset does not measure outbreak case counts, deaths, or subnational intensity.",
    },
    recordCount: records.length,
    countryCount: rows.length,
    diseases: [...diseases].sort((a, b) => a.localeCompare(b)),
    rows,
  };
}

function outbreakTrackerCards(html: string) {
  const cards: Array<{ disease: string; status: string; location: string; summary: string; url: string }> = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absoluteUrl(OUTBREAK_TRACKER, match[1]);
    const body = stripHtml(match[2]);
    if (!url || !/outbreaktracker\.live/i.test(url) || !/view tracker/i.test(body)) continue;
    const cleaned = body.replace(/View tracker\s*→?/i, "").trim();
    const disease = cleaned.split(/Active|Ongoing|Rising|Seasonal|Emerging|Global/i)[0]?.trim() || cleaned.split(" · ")[0]?.trim();
    if (!disease || seen.has(url)) continue;
    seen.add(url);
    const segments = cleaned.split(" · ").map((part) => part.trim()).filter(Boolean);
    cards.push({
      disease,
      status: segments[0]?.replace(disease, "").trim() || "Tracked",
      location: segments.slice(1, 3).join(" · "),
      summary: cleaned.slice(0, 420),
      url,
    });
  }
  return cards.slice(0, 30);
}

router.get("/war-costs/defense-presence", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await allenDefensePresence()); }
  catch (error) { res.status(502).json({ ok: false, partial: true, source: { name: "Michael Allen / troopdata", dashboard: ALLEN_DASHBOARD }, current: [], construction: [], warnings: [error instanceof Error ? error.message : "Allen defense-presence source failed."] }); }
});

router.get("/aor/epidemic-history", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await epidemicHistory()); }
  catch (error) {
    const fallbackRows = Object.entries(PAPER_LISA).map(([iso2, lisa]) => ({ iso2, lisa, outbreakCount: null, diseaseCounts: {}, topDiseases: [], neighboringPressure: lisa === "high-high" ? "high-frequency country with high-frequency neighbors" : "lower-frequency country adjacent to high-frequency neighbors" }));
    res.status(200).json({
      ok: false,
      partial: true,
      source: { name: "Torres Munguía et al. / WHO Disease Outbreak News", doi: "10.1038/s41597-022-01797-2", figshare: "10.6084/m9.figshare.17207183.v2" },
      methodology: { period: "1996–March 2022", globalMoransI: 0.336, pValue: "<0.001", limitation: "Figshare outbreak-frequency rows were unavailable; only the paper-published significant LISA classes are returned. No frequencies are invented." },
      rows: fallbackRows,
      diseases: [],
      error: error instanceof Error ? error.message : "Historical epidemic dataset failed.",
    });
  }
});

router.get("/aor/outbreak-tracker", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const html = await fetchText(OUTBREAK_TRACKER, 15 * 60_000);
    const trackers = outbreakTrackerCards(html);
    res.json({ ok: true, source: { name: "Outbreak Tracker", url: OUTBREAK_TRACKER, role: "awareness aggregator; confirm consequential decisions with WHO/CDC/local public health sources" }, trackers });
  } catch (error) {
    res.status(502).json({ ok: false, trackers: [], source: { name: "Outbreak Tracker", url: OUTBREAK_TRACKER }, error: error instanceof Error ? error.message : "Outbreak Tracker failed." });
  }
});

export default router;
