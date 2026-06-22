/**
 * BLS Industry Injury/Illness Benchmark Service
 *
 * The BLS IIF (Injuries, Illnesses, and Fatalities) program publishes
 * industry-level rates using specific series IDs. The series ID format
 * is NOT simply "IIU" + NAICS — it depends on the specific data measure
 * and industry classification level.
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
 *   1. Attempts to construct valid BLS series IDs for TRC, DART, and days-away rates.
 *   2. Queries the BLS public API v2.
 *   3. Returns structured results with clear status if data is unavailable.
 *   4. Never fabricates benchmark data.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlsBenchmarkResult = {
  naics: string;
  industryTitle: string;
  year: number;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
  fatalityRate?: number;
  sourceUrl: string;
  sourceMetadata: string;
  attemptedSeriesIds: string[];
};

export type BlsQueryResult = {
  benchmark: BlsBenchmarkResult | null;
  configured: boolean;
  attempted: boolean;
  reason: string;
};

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

// ─── BLS Series ID Construction ──────────────────────────────────────────────

/**
 * Construct candidate BLS SOII series IDs for a given NAICS code.
 *
 * BLS SOII series IDs for incidence rates follow the pattern:
 *   IIU{naics6}{caseType}{rateType}
 *
 * Common case/rate type suffixes:
 *   - TRC (total recordable cases):     suffix "00"
 *   - DART (days away/restricted/job transfer): suffix "10"
 *   - Days away from work only:          suffix "20"
 *
 * The industry code in BLS SOII may not always be the standard 6-digit NAICS.
 * For sector-level (2-digit) and sub-sector (3-4 digit) queries, BLS uses
 * its own industry codes. We attempt multiple constructions.
 */
function buildSeriesIds(naics: string): { seriesId: string; measure: string }[] {
  const padded = naics.replace(/\D/g, "").padStart(6, "0").slice(0, 6);

  const series: { seriesId: string; measure: string }[] = [
    { seriesId: `IIU${padded}00`, measure: "TRC" },
    { seriesId: `IIU${padded}10`, measure: "DART" },
    { seriesId: `IIU${padded}20`, measure: "Days Away" },
  ];

  if (naics.length < 6) {
    const sectorPadded = naics.replace(/\D/g, "").padEnd(6, "0");
    series.push(
      { seriesId: `IIU${sectorPadded}00`, measure: "TRC (sector)" },
      { seriesId: `IIU${sectorPadded}10`, measure: "DART (sector)" },
      { seriesId: `IIU${sectorPadded}20`, measure: "Days Away (sector)" },
    );
  }

  return series;
}

// ─── BLS API Query ───────────────────────────────────────────────────────────

export async function fetchBlsBenchmark(naics: string, year?: string): Promise<BlsQueryResult> {
  const apiKey = getEnv("BLS_API_KEY");
  const importEnabled = isTruthy(getEnv("BLS_IMPORT_ENABLED"));

  if (!apiKey && !importEnabled) {
    return {
      benchmark: null,
      configured: false,
      attempted: false,
      reason: "BLS API key not configured and import not enabled. Set BLS_API_KEY or enable BLS_IMPORT_ENABLED on the server.",
    };
  }

  const targetYear = year || String(new Date().getFullYear() - 2);
  const endYear = year || String(new Date().getFullYear() - 1);
  const seriesCandidates = buildSeriesIds(naics);
  const attemptedSeriesIds = seriesCandidates.map((s) => s.seriesId);

  try {
    const params = new URLSearchParams({
      seriesid: attemptedSeriesIds.join(","),
      startyear: targetYear,
      endyear: endYear,
    });
    if (apiKey) params.set("registrationkey", apiKey);

    const response = await fetch(`https://api.bls.gov/publicAPI/v2/timeseries/data/?${params}`);

    if (!response.ok) {
      return {
        benchmark: null,
        configured: true,
        attempted: true,
        reason: `BLS API returned HTTP ${response.status}. The series ID mapping for NAICS ${naics} may need correction. BLS IIF series IDs are not a simple NAICS prefix — see https://www.bls.gov/iif/ for correct series ID construction.`,
      };
    }

    const data = await response.json() as Record<string, unknown>;
    const results = data?.Results as Record<string, unknown> | undefined;
    const series = results?.series as Array<Record<string, unknown>> | undefined;

    if (!series || series.length === 0) {
      return {
        benchmark: null,
        configured: true,
        attempted: true,
        reason: `BLS API returned no series data for NAICS ${naics}. Attempted series IDs: ${attemptedSeriesIds.join(", ")}. The BLS IIF series ID format may not match this NAICS code — benchmark import/mapping may be needed.`,
      };
    }

    let trcRate: number | undefined;
    let dartRate: number | undefined;
    let daysAwayRate: number | undefined;
    let industryTitle = `NAICS ${naics}`;
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
        industryTitle = String(s.seriesTitle ?? industryTitle);
      } else if (sid.endsWith("10") && value !== undefined && dartRate === undefined) {
        dartRate = value;
      } else if (sid.endsWith("20") && value !== undefined && daysAwayRate === undefined) {
        daysAwayRate = value;
      }
    }

    if (trcRate === undefined && dartRate === undefined && daysAwayRate === undefined) {
      return {
        benchmark: null,
        configured: true,
        attempted: true,
        reason: `BLS API returned series for NAICS ${naics} but no valid rate values were found. The series ID mapping may need correction. Attempted: ${attemptedSeriesIds.join(", ")}`,
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
        sourceUrl: "https://www.bls.gov/iif/",
        sourceMetadata: "U.S. Bureau of Labor Statistics, Injuries, Illnesses, and Fatalities (IIF) program — Survey of Occupational Injuries and Illnesses (SOII)",
        attemptedSeriesIds,
      },
      configured: true,
      attempted: true,
      reason: trcRate !== undefined ? "Benchmark data retrieved from BLS API." : "Partial benchmark data retrieved — some rates unavailable.",
    };
  } catch (error) {
    return {
      benchmark: null,
      configured: true,
      attempted: true,
      reason: `BLS API request failed: ${sanitizeError(error)}. NAICS ${naics} may require a different series ID mapping.`,
    };
  }
}
