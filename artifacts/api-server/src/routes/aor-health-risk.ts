import { Router } from "express";
import * as XLSX from "xlsx";

const router = Router();

const HISTORY_URL = "https://raw.githubusercontent.com/jatorresmunguia/disease_outbreak_news/refs/heads/main/Last%20update/outbreaks_14082026.csv";
const OUTBREAK_TRACKER_URL = "https://outbreaktracker.live/";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cached: { expiresAt: number; payload: unknown } | null = null;

type CsvRow = Record<string, unknown>;
type CountryRef = { name: string; iso2: string; iso3: string };

const TRACKER_NAMES: Record<string, string> = {
  "covid-19": "COVID-19",
  cyclosporiasis: "Cyclosporiasis",
  legionnaires: "Legionnaires' Disease",
  ebola: "Ebola",
  "lassa-fever": "Lassa Fever",
  mpox: "Mpox",
  chikungunya: "Chikungunya",
  chandipura: "Chandipura Virus",
  salmonella: "Salmonella",
  "e-coli": "E. coli",
  "infant-botulism": "Infant Botulism",
  listeria: "Listeria",
  norovirus: "Norovirus",
  measles: "Measles",
  vibrio: "Vibrio",
  "c-auris": "Candida auris",
};

// Published 99% LISA classifications described in Torres Munguía et al. (2022),
// based on the paper's 1996–2021 exploratory spatial analysis. These are NOT
// recalculated against the 2026 history refresh.
const PUBLISHED_LISA: Array<{ iso2: string; classification: "High-High" | "Low-High" }> = [
  { iso2: "CA", classification: "High-High" },
  { iso2: "US", classification: "High-High" },
  { iso2: "HK", classification: "High-High" },
  { iso2: "AO", classification: "High-High" },
  { iso2: "BJ", classification: "High-High" },
  { iso2: "BF", classification: "High-High" },
  { iso2: "BI", classification: "High-High" },
  { iso2: "CM", classification: "High-High" },
  { iso2: "CF", classification: "High-High" },
  { iso2: "TD", classification: "High-High" },
  { iso2: "CG", classification: "High-High" },
  { iso2: "CD", classification: "High-High" },
  { iso2: "CI", classification: "High-High" },
  { iso2: "GH", classification: "High-High" },
  { iso2: "KE", classification: "High-High" },
  { iso2: "ML", classification: "High-High" },
  { iso2: "NE", classification: "High-High" },
  { iso2: "NG", classification: "High-High" },
  { iso2: "RW", classification: "High-High" },
  { iso2: "SS", classification: "High-High" },
  { iso2: "TZ", classification: "High-High" },
  { iso2: "TG", classification: "High-High" },
  { iso2: "UG", classification: "High-High" },
  { iso2: "ZM", classification: "High-High" },
  { iso2: "BT", classification: "Low-High" },
  { iso2: "NP", classification: "Low-High" },
  { iso2: "MO", classification: "Low-High" },
  { iso2: "MM", classification: "Low-High" },
  { iso2: "LY", classification: "Low-High" },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function yearNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleText(html: string) {
  return decodeHtml(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseCsv(csv: string): CsvRow[] {
  const workbook = XLSX.read(csv, { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<CsvRow>(sheet, { defval: "", raw: true });
}

async function fetchText(url: string, accept: string) {
  const response = await fetch(url, {
    headers: { Accept: accept, "User-Agent": "Occu-Med Insight Hub 2.0 AOR health-risk mirror" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status}) for ${url}`);
  return response.text();
}

function aggregateHistory(rows: CsvRow[]) {
  const countries = new Map<string, {
    name: string;
    iso2: string;
    iso3: string;
    outbreaks: number;
    firstYear: number;
    lastYear: number;
    diseases: Map<string, number>;
  }>();

  for (const row of rows) {
    const iso2 = clean(row.iso2).toUpperCase();
    const iso3 = clean(row.iso3).toUpperCase();
    const name = clean(row.Country);
    const year = yearNumber(row.Year);
    const disease = clean(row.Disease) || clean(row.icd104n) || clean(row.icd103n) || "Unspecified disease";
    if (!iso2 || !name || !year) continue;
    const current = countries.get(iso2) ?? { name, iso2, iso3, outbreaks: 0, firstYear: year, lastYear: year, diseases: new Map<string, number>() };
    current.outbreaks += 1;
    current.firstYear = Math.min(current.firstYear, year);
    current.lastYear = Math.max(current.lastYear, year);
    current.diseases.set(disease, (current.diseases.get(disease) ?? 0) + 1);
    countries.set(iso2, current);
  }

  return [...countries.values()].map((country) => ({
    country: country.name,
    iso2: country.iso2,
    iso3: country.iso3,
    outbreaks: country.outbreaks,
    uniqueDiseases: country.diseases.size,
    firstYear: country.firstYear,
    lastYear: country.lastYear,
    topDiseases: [...country.diseases.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([disease, outbreaks]) => ({ disease, outbreaks })),
  })).sort((a, b) => b.outbreaks - a.outbreaks);
}

function buildCountryMatchers(history: ReturnType<typeof aggregateHistory>) {
  const canonical: Array<{ phrase: string; ref: CountryRef }> = history.map((row) => ({
    phrase: normalize(row.country),
    ref: { name: row.country, iso2: row.iso2, iso3: row.iso3 },
  })).filter((item) => item.phrase.length >= 4);
  const byIso = new Map(history.map((row) => [row.iso2, { name: row.country, iso2: row.iso2, iso3: row.iso3 }]));
  const aliases: Array<{ phrase: string; iso2: string }> = [
    { phrase: "democratic republic of congo", iso2: "CD" },
    { phrase: "democratic republic of the congo", iso2: "CD" },
    { phrase: "dr congo", iso2: "CD" },
    { phrase: "drc", iso2: "CD" },
    { phrase: "united states", iso2: "US" },
    { phrase: "united kingdom", iso2: "GB" },
    { phrase: "south korea", iso2: "KR" },
    { phrase: "north korea", iso2: "KP" },
    { phrase: "cote d ivoire", iso2: "CI" },
    { phrase: "ivory coast", iso2: "CI" },
  ];
  for (const alias of aliases) {
    const ref = byIso.get(alias.iso2);
    if (ref) canonical.push({ phrase: normalize(alias.phrase), ref });
  }
  return canonical.sort((a, b) => b.phrase.length - a.phrase.length);
}

function extractCurrentTrackers(html: string, history: ReturnType<typeof aggregateHistory>) {
  const best = new Map<string, string>();
  const anchor = /<a\b[^>]*href=["']\/([^"'#?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const slug = clean(match[1]).replace(/^\/+|\/+$/g, "");
    if (!TRACKER_NAMES[slug]) continue;
    const text = visibleText(match[2]);
    if (text.length > (best.get(slug)?.length ?? 0)) best.set(slug, text);
  }

  const matchers = buildCountryMatchers(history);
  return [...best.entries()].flatMap(([slug, summary]) => {
    // Navigation links contain only the tracker name. Keep the richer outbreak card only.
    if (summary.length <= TRACKER_NAMES[slug].length + 6) return [];
    const normalizedSummary = ` ${normalize(summary)} `;
    const countries = new Map<string, CountryRef>();
    for (const matcher of matchers) {
      if (!matcher.phrase || !normalizedSummary.includes(` ${matcher.phrase} `)) continue;
      countries.set(matcher.ref.iso2, matcher.ref);
    }
    const statusMatch = summary.match(/\b(Active(?:\s+Outbreak)?|Ongoing|Seasonal|Rising(?:\s+Again)?|Emerging Threat|Multiple Outbreaks|Seasonal Surge)\b/i);
    return [{
      slug,
      name: TRACKER_NAMES[slug],
      status: statusMatch?.[0] || "Tracked",
      summary,
      url: `${OUTBREAK_TRACKER_URL}${slug}`,
      countries: [...countries.values()],
    }];
  });
}

async function buildPayload(force: boolean) {
  if (!force && cached && cached.expiresAt > Date.now()) return cached.payload;
  const [historyCsv, trackerHtml] = await Promise.all([
    fetchText(HISTORY_URL, "text/csv,text/plain;q=0.9,*/*;q=0.7"),
    fetchText(OUTBREAK_TRACKER_URL, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.7"),
  ]);
  const history = aggregateHistory(parseCsv(historyCsv));
  const currentTrackers = extractCurrentTrackers(trackerHtml, history);
  const currentCountryCounts = new Map<string, { name: string; iso2: string; iso3: string; trackers: string[] }>();
  for (const tracker of currentTrackers) for (const country of tracker.countries) {
    const current = currentCountryCounts.get(country.iso2) ?? { ...country, trackers: [] };
    if (!current.trackers.includes(tracker.name)) current.trackers.push(tracker.name);
    currentCountryCounts.set(country.iso2, current);
  }
  const maxHistory = history.reduce((max, row) => Math.max(max, row.outbreaks), 0);
  const payload = {
    ok: true,
    fetchedAt: new Date().toISOString(),
    current: {
      source: "OutbreakTracker.live",
      sourceUrl: OUTBREAK_TRACKER_URL,
      note: "Aggregator layer for situational awareness. Confirm material decisions against the official sources cited by each tracker.",
      trackers: currentTrackers,
      countries: [...currentCountryCounts.values()].sort((a, b) => b.trackers.length - a.trackers.length),
    },
    historical: {
      source: "Torres Munguía et al. global WHO DON dataset — refreshed by the authors' public pipeline",
      sourceUrl: HISTORY_URL,
      sourceUpdatedAt: "2026-08-14",
      maxOutbreaks: maxHistory,
      countries: history,
      definition: "One observation is the occurrence of a disease in a country during a calendar year. Frequency is occurrence/recurrence, not case count, deaths, or severity.",
    },
    lisa: {
      source: "Torres Munguía et al. (Scientific Data, 2022)",
      doi: "10.1038/s41597-022-01797-2",
      period: "1996–2021",
      confidence: "99% significance classification described in the paper",
      globalMoransI: 0.336,
      pValue: "<0.001",
      note: "Published LISA classifications are preserved as the paper's 1996–2021 analysis and are not represented as a 2026 recalculation.",
      countries: PUBLISHED_LISA,
    },
  };
  cached = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

router.get("/aor-health-risk", async (req, res) => {
  try {
    const force = String(req.query.refresh || "") === "1";
    res.json(await buildPayload(force));
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "AOR health-risk intelligence could not be loaded." });
  }
});

export default router;
