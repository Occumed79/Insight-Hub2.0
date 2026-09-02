import { Router } from "express";
import * as XLSX from "xlsx";

const router = Router();

const SOURCE = {
  quarterly: "https://raw.githubusercontent.com/meflynn/troopdata/master/data-raw/troopdata-rebuild-country-year-quarter-format.csv",
  facilities: "https://raw.githubusercontent.com/meflynn/troopdata/master/data-raw/basedata.csv",
  construction: "https://raw.githubusercontent.com/meflynn/troopdata/master/data-raw/builddata.csv",
  dashboard: "https://ma-allen.com/troops_dashboard/",
} as const;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cached: { expiresAt: number; payload: unknown } | null = null;

type CsvRow = Record<string, unknown>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw || /^na$/i.test(raw)) return null;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(csv: string): CsvRow[] {
  const workbook = XLSX.read(csv, { type: "string", raw: true });
  const first = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<CsvRow>(first, { defval: "", raw: true });
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.7",
      "User-Agent": "Occu-Med Insight Hub 2.0 defense-presence mirror",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status}) for ${url}`);
  return response.text();
}

function latestPersonnel(rows: CsvRow[]) {
  const latest = new Map<string, { sortKey: number; row: CsvRow }>();
  for (const row of rows) {
    const country = text(row.countryname);
    if (!country) continue;
    const year = number(row.year);
    const quarter = number(row.quarter);
    const sortKey = year * 10 + quarter;
    const key = `${text(row.ccode) || country}|${country}`;
    const current = latest.get(key);
    if (!current || sortKey > current.sortKey) latest.set(key, { sortKey, row });
  }

  return [...latest.values()]
    .map(({ row }) => ({
      country: text(row.countryname),
      iso3: /^NA$/i.test(text(row.iso3c)) ? "" : text(row.iso3c).toUpperCase(),
      ccode: text(row.ccode),
      region: text(row.region),
      year: number(row.year),
      quarter: number(row.quarter),
      month: text(row.month),
      sourcePeriod: text(row.source) || text(row.year_quarter),
      activeDuty: number(row.troops_ad),
      totalPersonnel: number(row.troops_all) || number(row.troops_ad),
      army: number(row.army_ad),
      navy: number(row.navy_ad),
      airForce: number(row.air_force_ad),
      marines: number(row.marine_corps_ad),
      coastGuard: number(row.coast_guard_ad),
      spaceForce: number(row.space_force_ad),
      selectedReserve: number(row.total_selected_reserve),
      civilians: number(row.total_civilian),
    }))
    .filter((row) => row.activeDuty > 0 || row.totalPersonnel > 0 || row.civilians > 0)
    .sort((a, b) => b.activeDuty - a.activeDuty || b.totalPersonnel - a.totalPersonnel);
}

function facilityRows(rows: CsvRow[]) {
  return rows.flatMap((row) => {
    const latitude = nullableNumber(row.lat);
    const longitude = nullableNumber(row.lon);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    const base = number(row.base) === 1;
    const lilypad = number(row.lilypad) === 1;
    const fundedSite = number(row.fundedsite) === 1;
    return [{
      name: text(row.basename) || text(row.countryname) || "Defense facility",
      country: text(row.countryname),
      iso3: /^NA$/i.test(text(row.iso3c)) ? "" : text(row.iso3c).toUpperCase(),
      latitude,
      longitude,
      category: base ? "base" : lilypad ? "lilypad" : fundedSite ? "funded-site" : "facility",
      base,
      lilypad,
      fundedSite,
    }];
  });
}

function constructionRows(rows: CsvRow[]) {
  const grouped = new Map<string, {
    location: string;
    country: string;
    iso3: string;
    latitude: number;
    longitude: number;
    spendThousands: number;
    firstYear: number;
    lastYear: number;
    observations: number;
  }>();

  for (const row of rows) {
    const latitude = nullableNumber(row.lat);
    const longitude = nullableNumber(row.lon);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const country = text(row.countryname);
    const location = text(row.location) || country || "Military construction";
    const iso3 = /^NA$/i.test(text(row.iso3c)) ? "" : text(row.iso3c).toUpperCase();
    const year = number(row.year);
    const spendThousands = number(row.spend_construction);
    const key = `${country}|${location}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
    const current = grouped.get(key);
    if (current) {
      current.spendThousands += spendThousands;
      current.firstYear = Math.min(current.firstYear, year || current.firstYear);
      current.lastYear = Math.max(current.lastYear, year);
      current.observations += 1;
    } else {
      grouped.set(key, { location, country, iso3, latitude, longitude, spendThousands, firstYear: year, lastYear: year, observations: 1 });
    }
  }

  return [...grouped.values()]
    .map((row) => ({ ...row, spendUsd: row.spendThousands * 1_000 }))
    .sort((a, b) => b.spendUsd - a.spendUsd)
    .slice(0, 1_500);
}

async function buildPayload(force: boolean) {
  if (!force && cached && cached.expiresAt > Date.now()) return cached.payload;
  const [quarterlyCsv, facilitiesCsv, constructionCsv] = await Promise.all([
    fetchText(SOURCE.quarterly),
    fetchText(SOURCE.facilities),
    fetchText(SOURCE.construction),
  ]);
  const personnel = latestPersonnel(parseCsv(quarterlyCsv));
  const facilities = facilityRows(parseCsv(facilitiesCsv));
  const construction = constructionRows(parseCsv(constructionCsv));
  const latestYear = personnel.reduce((max, row) => Math.max(max, row.year), 0);
  const latestQuarter = personnel.filter((row) => row.year === latestYear).reduce((max, row) => Math.max(max, row.quarter), 0);
  const payload = {
    ok: true,
    fetchedAt: new Date().toISOString(),
    source: {
      name: "Michael Allen / troopdata",
      dashboard: SOURCE.dashboard,
      latestYear,
      latestQuarter,
      constructionUnit: "thousands of current US dollars",
      notes: "Personnel uses each country's latest available quarterly observation. Construction is grouped by geocoded location across 2008–2019 source observations.",
    },
    summary: {
      personnelCountries: personnel.length,
      facilities: facilities.length,
      constructionLocations: construction.length,
      activeDuty: personnel.reduce((sum, row) => sum + row.activeDuty, 0),
    },
    personnel,
    facilities,
    construction,
  };
  cached = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

router.get("/war-costs/defense-presence", async (req, res) => {
  try {
    const force = String(req.query.refresh || "") === "1";
    res.json(await buildPayload(force));
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Michael Allen defense-presence data could not be loaded." });
  }
});

export default router;
