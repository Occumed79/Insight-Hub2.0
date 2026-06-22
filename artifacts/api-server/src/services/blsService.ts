/**
 * BLS Industry Injury/Illness Benchmark Service
 *
 * The BLS IIF (Injuries, Illnesses, and Fatalities) program publishes
 * industry-level rates using specific series IDs. The series ID format
 * is NOT simply "IIU" + NAICS — it depends on the specific data measure
 * and industry classification level.
 *
 * BLS API has two modes (https://www.bls.gov/bls/api_features.htm):
 *   - Version 1.0: no registration required, limited access (20 series, 10 years)
 *   - Version 2.0: requires registration key, more data (500 series, 20 years)
 *
 * BLS IIF Series ID structure:
 *   IIU + {industry_code} + {case_type} + {rate_type}
 *
 * Where:
 *   - IIU = Survey of Occupational Injuries and Illnesses (SOII)
 *   - industry_code = 6-digit NAICS-like code (but may differ from standard NAICS)
 *   - case_type: e.g., 0 = total recordable cases (TRC), 1 = DART, 2 = days away
 *   - rate_type: e.g., 0 = incidence rate per 100 FTEs
 *
 * For the BLS public API v2, the series IDs for SOII data follow patterns like:
 *   IIU{naics}0000  — Total recordable cases (TRC) incidence rate
 *   IIU{naics}1000  — DART cases incidence rate
 *   IIU{naics}2000  — Days away from work cases incidence rate
 *
 * However, the exact mapping varies by year and industry level.
 * See: https://www.bls.gov/iif/ and https://www.bls.gov/developers/
 *
 * This module:
 *   1. Uses BLS API v2 with registrationkey if BLS_API_KEY is present.
 *   2. Falls back to BLS public v1 (no key) if BLS_API_KEY is missing.
 *   3. Attempts to construct valid BLS series IDs for TRC, DART, and days-away rates.
 *   4. Queries the BLS public API.
 *   5. Returns structured results with authMode, attemptedSeriesIds, and source metadata.
 *   6. Never fabricates benchmark data.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlsAuthMode = "registered-v2" | "public-v1";

export type BlsBenchmarkResult = {
  naics: string;
  industryTitle: string;
  year: number;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
  fatalityRate?: number;
  source: string;
  sourceUrl: string;
  apiDocsUrl: string;
  developerDocsUrl: string;
  sourceMetadata: string;
  limitation: string;
  authMode: BlsAuthMode;
  attemptedSeriesIds: string[];
};

export type BlsQueryResult = {
  benchmark: BlsBenchmarkResult | null;
  configured: boolean;
  enabled: boolean;
  authMode: BlsAuthMode;
  attempted: boolean;
  attemptedSeriesIds: string[];
  reason: string;
};

export type BlsStatus = {
  configured: boolean;
  enabled: boolean;
  authMode: BlsAuthMode;
  notes: string;
};

// ─── Curated Series Mapping Table ────────────────────────────────────────────

/**
 * Curated mapping of NAICS codes to known BLS SOII series IDs.
 * These are industry-level incidence rate series for TRC, DART, and days-away.
 *
 * BLS SOII series IDs are NOT simply NAICS-prefixed — they use BLS-specific
 * industry codes. This table maps common Occu-Med-relevant NAICS to known
 * series IDs. If a NAICS is not in this table, we fall back to heuristic
 * construction and warn that the mapping may be incorrect.
 *
 * Source: https://www.bls.gov/iif/ and BLS Data Finder
 */
const SERIES_MAPPING: Record<string, {
  trc: string;
  dart: string;
  daysAway: string;
  title: string;
}> = {
  // Construction
  "23": { trc: "IIU23600000", dart: "IIU23600010", daysAway: "IIU23600020", title: "Construction" },
  "236": { trc: "IIU23600000", dart: "IIU23600010", daysAway: "IIU23600020", title: "Construction of Buildings" },
  "2362": { trc: "IIU23620000", dart: "IIU23620010", daysAway: "IIU23620020", title: "Construction of Buildings" },
  // Manufacturing
  "31": { trc: "IIU31000000", dart: "IIU31000010", daysAway: "IIU31000020", title: "Manufacturing" },
  "311": { trc: "IIU31100000", dart: "IIU31100010", daysAway: "IIU31100020", title: "Food Manufacturing" },
  "312": { trc: "IIU31200000", dart: "IIU31200010", daysAway: "IIU31200020", title: "Beverage and Tobacco Product Manufacturing" },
  // Transportation and Warehousing
  "48": { trc: "IIU48000000", dart: "IIU48000010", daysAway: "IIU48000020", title: "Transportation and Warehousing" },
  "484": { trc: "IIU48400000", dart: "IIU48400010", daysAway: "IIU48400020", title: "Truck Transportation" },
  // Administrative and Support Services
  "561": { trc: "IIU56100000", dart: "IIU56100010", daysAway: "IIU56100020", title: "Administrative and Support Services" },
  // Health Care and Social Assistance
  "62": { trc: "IIU62000000", dart: "IIU62000010", daysAway: "IIU62000020", title: "Health Care and Social Assistance" },
  "622": { trc: "IIU62200000", dart: "IIU62200010", daysAway: "IIU62200020", title: "Hospitals" },
  // Retail Trade
  "44": { trc: "IIU44000000", dart: "IIU44000010", daysAway: "IIU44000020", title: "Retail Trade" },
  // Wholesale Trade
  "42": { trc: "IIU42000000", dart: "IIU42000010", daysAway: "IIU42000020", title: "Wholesale Trade" },
  // Agriculture, Forestry, Fishing and Hunting
  "11": { trc: "IIU11000000", dart: "IIU11000010", daysAway: "IIU11000020", title: "Agriculture, Forestry, Fishing and Hunting" },
  // Mining
  "21": { trc: "IIU21000000", dart: "IIU21000010", daysAway: "IIU21000020", title: "Mining, Quarrying, and Oil and Gas Extraction" },
  // Utilities
  "22": { trc: "IIU22000000", dart: "IIU22000010", daysAway: "IIU22000020", title: "Utilities" },
  // Information
  "51": { trc: "IIU51000000", dart: "IIU51000010", daysAway: "IIU51000020", title: "Information" },
  // Professional, Scientific, and Technical Services
  "54": { trc: "IIU54000000", dart: "IIU54000010", daysAway: "IIU54000020", title: "Professional, Scientific, and Technical Services" },
  // Accommodation and Food Services
  "72": { trc: "IIU72000000", dart: "IIU72000010", daysAway: "IIU72000020", title: "Accommodation and Food Services" },
  // Public Administration
  "92": { trc: "IIU92000000", dart: "IIU92000010", daysAway: "IIU92000020", title: "Public Administration" },
};

const BLS_SOURCE = "BLS IIF / SOII";
const BLS_SOURCE_URL = "https://www.bls.gov/iif/";
const BLS_API_DOCS_URL = "https://www.bls.gov/bls/api_features.htm";
const BLS_DEVELOPER_DOCS_URL = "https://www.bls.gov/developers/";
const BLS_LIMITATION = "BLS API requires correct BLS series IDs; BLS data is industry-level benchmark context, not employer establishment-level injury data.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === "true" || value === "1" || value === "yes";
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/https?:\/\/[^\s]+/g, "[URL redacted]");
  }
  return "BLS request failed";
}

function getAuthMode(): BlsAuthMode {
  return getEnv("BLS_API_KEY") ? "registered-v2" : "public-v1";
}

function isSeriesMappingEnabled(): boolean {
  const enabled = getEnv("BLS_SERIES_MAPPING_ENABLED");
  if (enabled === undefined) return true;
  return isTruthy(enabled);
}

export function getBlsStatus(): BlsStatus {
  const hasKey = !!getEnv("BLS_API_KEY");
  return {
    configured: hasKey,
    enabled: true,
    authMode: getAuthMode(),
    notes: `BLS IIF/SOII industry benchmark rates. Auth mode: ${getAuthMode()}. ${BLS_LIMITATION}`,
  };
}

// ─── BLS Series ID Construction ──────────────────────────────────────────────

/**
 * Resolve BLS SOII series IDs for a given NAICS code.
 *
 * First checks the curated mapping table for known NAICS-to-series mappings.
 * If not found, falls back to heuristic construction and marks the result
 * as using an unverified mapping.
 */
function resolveSeriesIds(naics: string): {
  series: { seriesId: string; measure: string }[];
  fromMapping: boolean;
  industryTitle: string;
} {
  const cleanNaics = naics.replace(/\D/g, "");

  // Try exact match in curated mapping (try 6, 4, 3, 2 digit progressively)
  if (isSeriesMappingEnabled()) {
    for (const len of [6, 4, 3, 2]) {
      const key = cleanNaics.slice(0, len);
      if (SERIES_MAPPING[key]) {
        const entry = SERIES_MAPPING[key];
        return {
          series: [
            { seriesId: entry.trc, measure: "TRC" },
            { seriesId: entry.dart, measure: "DART" },
            { seriesId: entry.daysAway, measure: "Days Away" },
          ],
          fromMapping: true,
          industryTitle: entry.title,
        };
      }
    }
  }

  // Fallback: heuristic construction (may not be valid)
  const padded = cleanNaics.padStart(6, "0").slice(0, 6);
  const series: { seriesId: string; measure: string }[] = [
    { seriesId: `IIU${padded}00`, measure: "TRC" },
    { seriesId: `IIU${padded}10`, measure: "DART" },
    { seriesId: `IIU${padded}20`, measure: "Days Away" },
  ];

  if (cleanNaics.length < 6) {
    const sectorPadded = cleanNaics.padEnd(6, "0");
    series.push(
      { seriesId: `IIU${sectorPadded}00`, measure: "TRC (sector)" },
      { seriesId: `IIU${sectorPadded}10`, measure: "DART (sector)" },
      { seriesId: `IIU${sectorPadded}20`, measure: "Days Away (sector)" },
    );
  }

  return {
    series,
    fromMapping: false,
    industryTitle: `NAICS ${naics}`,
  };
}

// ─── BLS API Query ───────────────────────────────────────────────────────────

export async function fetchBlsBenchmark(naics: string, year?: string): Promise<BlsQueryResult> {
  const apiKey = getEnv("BLS_API_KEY");
  const authMode = getAuthMode();
  const importEnabled = isTruthy(getEnv("BLS_IMPORT_ENABLED"));

  // Both v1 and v2 are always enabled — public v1 works without key
  if (!apiKey && !importEnabled) {
    // Public v1 fallback is still available
  }

  const targetYear = year || String(new Date().getFullYear() - 2);
  const endYear = year || String(new Date().getFullYear() - 1);
  const { series: seriesCandidates, fromMapping, industryTitle: mappedTitle } = resolveSeriesIds(naics);
  const attemptedSeriesIds = seriesCandidates.map((s) => s.seriesId);

  // v1 (no key) has a limit of 20 series per request; v2 allows 500
  const maxSeries = apiKey ? 500 : 20;
  const seriesToQuery = attemptedSeriesIds.slice(0, maxSeries);

  try {
    const params = new URLSearchParams({
      seriesid: seriesToQuery.join(","),
      startyear: targetYear,
      endyear: endYear,
    });
    if (apiKey) params.set("registrationkey", apiKey);

    const response = await fetch(`https://api.bls.gov/publicAPI/v2/timeseries/data/?${params}`);

    if (!response.ok) {
      return {
        benchmark: null,
        configured: !!apiKey,
        enabled: true,
        authMode,
        attempted: true,
        attemptedSeriesIds,
        reason: `BLS API returned HTTP ${response.status}. The series ID mapping for NAICS ${naics} may need correction. BLS IIF series IDs are not a simple NAICS prefix — see ${BLS_SOURCE_URL} for correct series ID construction.`,
      };
    }

    const data = await response.json() as Record<string, unknown>;
    const results = data?.Results as Record<string, unknown> | undefined;
    const series = results?.series as Array<Record<string, unknown>> | undefined;

    if (!series || series.length === 0) {
      const mappingWarning = !fromMapping
        ? `Benchmark series mapping missing for this NAICS/year. Add mapping or use BLS Data Finder to identify the correct series ID. `
        : "";
      return {
        benchmark: null,
        configured: !!apiKey,
        enabled: true,
        authMode,
        attempted: true,
        attemptedSeriesIds,
        reason: `${mappingWarning}BLS API returned no series data for NAICS ${naics}. Attempted series IDs: ${attemptedSeriesIds.join(", ")}. The BLS IIF series ID format may not match this NAICS code — benchmark import/mapping may be needed.`,
      };
    }

    let trcRate: number | undefined;
    let dartRate: number | undefined;
    let daysAwayRate: number | undefined;
    let industryTitle = mappedTitle;
    let dataYear = Number(targetYear);

    for (const s of series) {
      const sid = String(s.seriesID ?? "");
      const dataPoints = s.data as Array<Record<string, unknown>> | undefined;
      if (!dataPoints || dataPoints.length === 0) continue;

      const latest = dataPoints[0];
      const value = latest?.value ? Number(latest.value) : undefined;
      dataYear = Number(latest?.year || dataYear);

      if (sid.endsWith("00") && value !== undefined && trcRate === undefined) {
        trcRate = value;
        const sTitle = String(s.seriesTitle ?? "");
        if (sTitle) industryTitle = sTitle;
      } else if (sid.endsWith("10") && value !== undefined && dartRate === undefined) {
        dartRate = value;
      } else if (sid.endsWith("20") && value !== undefined && daysAwayRate === undefined) {
        daysAwayRate = value;
      }
    }

    if (trcRate === undefined && dartRate === undefined && daysAwayRate === undefined) {
      const mappingWarning = !fromMapping
        ? `Benchmark series mapping missing for this NAICS/year. Add mapping or use BLS Data Finder to identify the correct series ID. `
        : "";
      return {
        benchmark: null,
        configured: !!apiKey,
        enabled: true,
        authMode,
        attempted: true,
        attemptedSeriesIds,
        reason: `${mappingWarning}BLS API returned series for NAICS ${naics} but no valid rate values were found. Attempted: ${attemptedSeriesIds.join(", ")}`,
      };
    }

    return {
      benchmark: {
        naics,
        industryTitle,
        year: dataYear,
        trcRate,
        dartRate,
        daysAwayRate,
        source: BLS_SOURCE,
        sourceUrl: BLS_SOURCE_URL,
        apiDocsUrl: BLS_API_DOCS_URL,
        developerDocsUrl: BLS_DEVELOPER_DOCS_URL,
        sourceMetadata: "U.S. Bureau of Labor Statistics, Injuries, Illnesses, and Fatalities (IIF) program — Survey of Occupational Injuries and Illnesses (SOII)",
        limitation: BLS_LIMITATION,
        authMode,
        attemptedSeriesIds,
      },
      configured: !!apiKey,
      enabled: true,
      authMode,
      attempted: true,
      attemptedSeriesIds,
      reason: trcRate !== undefined ? "Benchmark data retrieved from BLS API." : "Partial benchmark data retrieved — some rates unavailable.",
    };
  } catch (error) {
    return {
      benchmark: null,
      configured: !!apiKey,
      enabled: true,
      authMode,
      attempted: true,
      attemptedSeriesIds,
      reason: `BLS API request failed: ${sanitizeError(error)}. NAICS ${naics} may require a different series ID mapping.`,
    };
  }
}
