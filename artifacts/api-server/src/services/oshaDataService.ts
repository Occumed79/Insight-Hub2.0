/**
 * OSHA ITA Establishment-Specific Injury & Illness Data Layer
 *
 * OSHA does not provide a key-based API for establishment-level data.
 * The data is published as downloadable CSV/XLSX files from:
 *   https://www.osha.gov/establishment-specific-injury-and-illness-data
 *
 * This module implements a file-based JSON cache layer:
 *   1. An operator downloads OSHA ITA CSV/XLSX files from the OSHA website.
 *   2. An import script (scripts/import-osha.ts) parses and converts them to JSON.
 *   3. The JSON files are placed in: data/osha-ita/ (or a path specified by OSHA_DATA_DIR).
 *   4. This module loads and queries those cached JSON files at runtime.
 *
 * If no dataset has been imported, the module returns an empty result with
 * a clear "not imported yet" message — it never fabricates records.
 *
 * TODO (production): Replace the JSON cache layer with proper database tables:
 *   - osha_establishments (one row per establishment-year)
 *   - osha_import_runs (metadata about each import batch)
 *   - osha_source_files (source file URLs, download dates, dataset years)
 *   - employer_aliases / entity_matches (cross-source entity resolution)
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OshaEstablishmentRecord = {
  establishmentName: string;
  companyName: string;
  dbaName?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naics: string;
  year: number;
  totalHoursWorked?: number;
  totalCases?: number;
  dartCases?: number;
  daysAwayCases?: number;
  jobTransferRestrictionCases?: number;
  caseCategories?: string[];
  sourceUrl: string;
  datasetName: string;
  datasetYear: number;
  sourceFileType: string;
  lastImportedDate: string;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
};

export type OshaImportRun = {
  datasetName: string;
  datasetYear: number;
  sourceUrl: string;
  sourceFileType: string;
  importedAt: string;
  recordCount: number;
};

export type OshaQueryResult = {
  records: OshaEstablishmentRecord[];
  count: number;
  importRuns: OshaImportRun[];
  dataSource: "cached-json" | "none";
  warning: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === "true" || value === "1" || value === "yes";
}

function calculateRate(cases: number, hours: number): number | undefined {
  if (!hours || hours === 0) return undefined;
  return Number(((cases * 200000) / hours).toFixed(2));
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[,.\s]+/g, " ").replace(/\b(inc|llc|corp|corporation|co|ltd|the)\b/g, "").trim();
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  const common = wordsA.filter((w) => wordsB.includes(w));
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  return Math.min(common.length / Math.max(wordsA.length, wordsB.length), 0.8);
}

// ─── Cache Layer ─────────────────────────────────────────────────────────────

function getOshaDataDir(): string {
  const envDir = getEnv("OSHA_DATA_DIR");
  if (envDir) return resolve(envDir);
  return resolve(process.cwd(), "data", "osha-ita");
}

type CachedDataset = {
  metadata: OshaImportRun;
  records: OshaEstablishmentRecord[];
};

let cachedDatasets: CachedDataset[] | null = null;
let cacheLoadTime = 0;

function loadCachedDatasets(): CachedDataset[] {
  if (cachedDatasets && cacheLoadTime > 0) {
    if (Date.now() - cacheLoadTime < 300_000) return cachedDatasets;
  }

  const dataDir = getOshaDataDir();
  if (!existsSync(dataDir)) {
    cachedDatasets = [];
    cacheLoadTime = Date.now();
    return cachedDatasets;
  }

  const datasets: CachedDataset[] = [];
  const entries = readdirSync(dataDir);

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const filePath = join(dataDir, entry);
    try {
      const stat = statSync(filePath);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as { metadata?: OshaImportRun; records?: OshaEstablishmentRecord[] };

      if (parsed.metadata && Array.isArray(parsed.records)) {
        for (const rec of parsed.records) {
          if (!rec.lastImportedDate) {
            rec.lastImportedDate = parsed.metadata.importedAt || stat.mtime.toISOString();
          }
          if (!rec.datasetName) rec.datasetName = parsed.metadata.datasetName;
          if (!rec.sourceUrl) rec.sourceUrl = parsed.metadata.sourceUrl;
          if (!rec.datasetYear) rec.datasetYear = parsed.metadata.datasetYear;
          if (!rec.sourceFileType) rec.sourceFileType = parsed.metadata.sourceFileType;
        }
        datasets.push({
          metadata: parsed.metadata,
          records: parsed.records,
        });
      }
    } catch {
      console.error(`[OSHA] Failed to parse: ${entry}`);
    }
  }

  cachedDatasets = datasets;
  cacheLoadTime = Date.now();
  return cachedDatasets;
}

export function reloadOshaCache(): void {
  cachedDatasets = null;
  cacheLoadTime = 0;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function queryOshaEstablishments(
  company?: string,
  state?: string,
  naics?: string,
  year?: string,
): OshaQueryResult {
  const importEnabled = isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED"));
  if (!importEnabled) {
    return {
      records: [],
      count: 0,
      importRuns: [],
      dataSource: "none",
      warning: "OSHA ITA import is not enabled. Set OSHA_ITA_IMPORT_ENABLED=true and import OSHA establishment data.",
    };
  }

  const datasets = loadCachedDatasets();

  if (datasets.length === 0) {
    return {
      records: [],
      count: 0,
      importRuns: [],
      dataSource: "none",
      warning: "OSHA ITA import is enabled, but no dataset has been imported yet. Download OSHA establishment-specific injury/illness CSV/XLSX files from https://www.osha.gov/establishment-specific-injury-and-illness-data and run the import script (scripts/import-osha.ts).",
    };
  }

  const importRuns = datasets.map((d) => d.metadata);
  let allRecords: OshaEstablishmentRecord[] = [];

  for (const ds of datasets) {
    let records = ds.records;

    if (year) {
      const yearNum = Number(year);
      records = records.filter((r) => r.year === yearNum || ds.metadata.datasetYear === yearNum);
    }

    if (state) {
      const stateUpper = state.toUpperCase().trim();
      records = records.filter((r) => r.state.toUpperCase() === stateUpper);
    }

    if (naics) {
      const naicsTrim = naics.trim();
      records = records.filter((r) => r.naics.startsWith(naicsTrim));
    }

    if (company) {
      const companyTrim = company.trim();
      records = records.filter((r) => {
        const simName = nameSimilarity(companyTrim, r.establishmentName);
        const simCompany = nameSimilarity(companyTrim, r.companyName);
        const simDba = r.dbaName ? nameSimilarity(companyTrim, r.dbaName) : 0;
        return Math.max(simName, simCompany, simDba) >= 0.5;
      });
    }

    allRecords.push(...records);
  }

  for (const rec of allRecords) {
    if (rec.trcRate === undefined && rec.totalCases !== undefined && rec.totalHoursWorked !== undefined) {
      rec.trcRate = calculateRate(rec.totalCases, rec.totalHoursWorked);
    }
    if (rec.dartRate === undefined && rec.dartCases !== undefined && rec.totalHoursWorked !== undefined) {
      rec.dartRate = calculateRate(rec.dartCases, rec.totalHoursWorked);
    }
    if (rec.daysAwayRate === undefined && rec.daysAwayCases !== undefined && rec.totalHoursWorked !== undefined) {
      rec.daysAwayRate = calculateRate(rec.daysAwayCases, rec.totalHoursWorked);
    }
  }

  return {
    records: allRecords,
    count: allRecords.length,
    importRuns,
    dataSource: "cached-json",
    warning: "OSHA/public injury data must not be used by the app to declare a company unsafe, negligent, dangerous, or noncompliant. The module should only surface service opportunity signals and data requiring human review.",
  };
}

export function getOshaImportInfo(): { importRuns: OshaImportRun[]; totalRecords: number; dataDir: string } {
  const datasets = loadCachedDatasets();
  return {
    importRuns: datasets.map((d) => d.metadata),
    totalRecords: datasets.reduce((sum, d) => sum + d.records.length, 0),
    dataDir: getOshaDataDir(),
  };
}

export function isOshaDataImported(): boolean {
  const datasets = loadCachedDatasets();
  return datasets.length > 0 && datasets.some((d) => d.records.length > 0);
}

export { calculateRate, normalizeName, nameSimilarity };
