/**
 * BLS Survey of Occupational Injuries and Illnesses (SOII) benchmark service.
 *
 * Current industry-level SOII series (2014-forward) use the BLS "IS" family.
 * The service builds documented IS series IDs and submits them to the BLS
 * timeseries API with POST JSON. It never treats an HTTP method failure as a
 * NAICS-mapping failure and it never fabricates a benchmark.
 */

export type BlsAuthMode = "registered-v2" | "public-v2";

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

type Measure = "TRC" | "DART" | "Days Away";

type SeriesDefinition = {
  seriesId: string;
  measure: Measure;
  group: string;
  industryTitle: string;
  specificity: "exact" | "sector";
  ownership: string;
};

type SectorDefinition = {
  supersector: string;
  industry: string;
  title: string;
};

const SECTOR_SERIES: Record<string, SectorDefinition> = {
  "11": { supersector: "NRM", industry: "GP2AFH", title: "Agriculture, forestry, fishing and hunting" },
  "21": { supersector: "NRM", industry: "GP2MIN", title: "Mining, quarrying, and oil and gas extraction" },
  "22": { supersector: "TTU", industry: "SP2UTL", title: "Utilities" },
  "23": { supersector: "CON", industry: "GP2CON", title: "Construction" },
  "31": { supersector: "MFG", industry: "GP2MFG", title: "Manufacturing" },
  "32": { supersector: "MFG", industry: "GP2MFG", title: "Manufacturing" },
  "33": { supersector: "MFG", industry: "GP2MFG", title: "Manufacturing" },
  "42": { supersector: "TTU", industry: "SP2WHT", title: "Wholesale trade" },
  "44": { supersector: "TTU", industry: "SP2RET", title: "Retail trade" },
  "45": { supersector: "TTU", industry: "SP2RET", title: "Retail trade" },
  "48": { supersector: "TTU", industry: "SP2TRW", title: "Transportation and warehousing" },
  "49": { supersector: "TTU", industry: "SP2TRW", title: "Transportation and warehousing" },
  "51": { supersector: "INF", industry: "SP2INF", title: "Information" },
  "52": { supersector: "FIA", industry: "SP2FIN", title: "Finance and insurance" },
  "53": { supersector: "FIA", industry: "SP2RRL", title: "Real estate and rental and leasing" },
  "54": { supersector: "PBS", industry: "SP2PST", title: "Professional, scientific, and technical services" },
  "55": { supersector: "PBS", industry: "SP2MCE", title: "Management of companies and enterprises" },
  "56": { supersector: "PBS", industry: "SP2ADW", title: "Administrative and support and waste management and remediation services" },
  "61": { supersector: "EHS", industry: "SP2EDS", title: "Educational services" },
  "62": { supersector: "EHS", industry: "SP2HSA", title: "Health care and social assistance" },
  "71": { supersector: "LEH", industry: "SP2AER", title: "Arts, entertainment, and recreation" },
  "72": { supersector: "LEH", industry: "SP2AFS", title: "Accommodation and food services" },
  "81": { supersector: "OTS", industry: "SP2OTS", title: "Other services (except public administration)" },
  "92": { supersector: "PAD", industry: "SP2PAD", title: "Public administration" },
};

const BLS_SOURCE = "BLS IIF / SOII";
const BLS_SOURCE_URL = "https://www.bls.gov/iif/";
const BLS_API_DOCS_URL = "https://www.bls.gov/bls/api_features.htm";
const BLS_DEVELOPER_DOCS_URL = "https://www.bls.gov/developers/";
const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const PRIVATE_US_AREA = "100";
const RATE_DATA_TYPE = "3";
const CASE_TYPES: Array<{ code: string; measure: Measure }> = [
  { code: "1", measure: "TRC" },
  { code: "2", measure: "DART" },
  { code: "3", measure: "Days Away" },
];
const BLS_LIMITATION =
  "BLS SOII rates are aggregate industry benchmarks per 100 full-time workers. They are not establishment-level injury data and should not be interpreted as an employer-specific finding.";

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function getAuthMode(): BlsAuthMode {
  return getEnv("BLS_API_KEY") ? "registered-v2" : "public-v2";
}

function sanitizeError(error: unknown): string {
  if (!(error instanceof Error)) return "BLS request failed";
  return error.message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/registrationkey[=:][^&\s]+/gi, "registrationkey=[redacted]")
    .slice(0, 500);
}

export function getBlsStatus(): BlsStatus {
  const hasKey = !!getEnv("BLS_API_KEY");
  return {
    configured: hasKey,
    enabled: true,
    authMode: getAuthMode(),
    notes: `BLS SOII industry benchmark rates using current IS-series IDs and POST timeseries queries. Auth mode: ${getAuthMode()}. ${BLS_LIMITATION}`,
  };
}

function normalizeNaics(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

function makeSeriesId(
  supersector: string,
  industry: string,
  caseType: string,
  area = PRIVATE_US_AREA,
): string {
  return `ISU${supersector}${industry}${RATE_DATA_TYPE}${caseType}${area}`;
}

function buildGroup(
  group: string,
  supersector: string,
  industry: string,
  title: string,
  specificity: "exact" | "sector",
  area = PRIVATE_US_AREA,
  ownership = "Private industry, All U.S.",
): SeriesDefinition[] {
  return CASE_TYPES.map(({ code, measure }) => ({
    seriesId: makeSeriesId(supersector, industry, code, area),
    measure,
    group,
    industryTitle: title,
    specificity,
    ownership,
  }));
}

function resolveSeries(naicsInput: string): {
  definitions: SeriesDefinition[];
  unsupportedReason?: string;
} {
  const naics = normalizeNaics(naicsInput);
  if (naics.length < 2) {
    return { definitions: [], unsupportedReason: "Enter a 2- to 6-digit NAICS code." };
  }

  const sectorCode = naics.slice(0, 2);
  const sector = SECTOR_SERIES[sectorCode];
  if (!sector) {
    return {
      definitions: [],
      unsupportedReason: `No current SOII sector mapping is configured for NAICS ${naics}.`,
    };
  }

  if (sectorCode === "92") {
    return {
      definitions: [],
      unsupportedReason:
        "Public Administration SOII rates are published by government ownership (for example state or local government). Selectable ownership is not yet exposed in this tool, so no single rate is returned instead of silently substituting one.",
    };
  }

  const definitions: SeriesDefinition[] = [];

  if (naics.length >= 3) {
    const exactIndustry = naics.padEnd(6, "0");
    definitions.push(
      ...buildGroup(
        `exact:${exactIndustry}`,
        sector.supersector,
        exactIndustry,
        `NAICS ${naics}`,
        "exact",
      ),
    );
  }

  definitions.push(
    ...buildGroup(
      `sector:${sectorCode}`,
      sector.supersector,
      sector.industry,
      sector.title,
      "sector",
    ),
  );

  return {
    definitions: definitions.filter(
      (definition, index, items) =>
        items.findIndex((candidate) => candidate.seriesId === definition.seriesId) === index,
    ),
  };
}

type BlsApiSeries = {
  seriesID?: string;
  data?: Array<{ year?: string; period?: string; value?: string | number }>;
};

type BlsApiPayload = {
  status?: string;
  message?: string[];
  Results?: { series?: BlsApiSeries[] };
};

function numericRate(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickAnnualPoint(
  series: BlsApiSeries | undefined,
  requestedYear?: string,
): { year: number; value: number } | null {
  const points = series?.data ?? [];
  const annual = points
    .filter((point) => !point.period || point.period === "A01")
    .map((point) => ({
      year: Number(point.year),
      value: numericRate(point.value),
    }))
    .filter(
      (point): point is { year: number; value: number } =>
        Number.isFinite(point.year) && point.value !== undefined,
    )
    .sort((a, b) => b.year - a.year);

  if (requestedYear) {
    const exact = annual.find((point) => point.year === Number(requestedYear));
    return exact ?? null;
  }
  return annual[0] ?? null;
}

export async function fetchBlsBenchmark(
  naicsInput: string,
  year?: string,
): Promise<BlsQueryResult> {
  const apiKey = getEnv("BLS_API_KEY");
  const authMode = getAuthMode();
  const naics = normalizeNaics(naicsInput);
  const resolved = resolveSeries(naics);
  const attemptedSeriesIds = resolved.definitions.map((definition) => definition.seriesId);

  if (resolved.unsupportedReason) {
    return {
      benchmark: null,
      configured: !!apiKey,
      enabled: true,
      authMode,
      attempted: false,
      attemptedSeriesIds,
      reason: resolved.unsupportedReason,
    };
  }

  const now = new Date();
  const latestLikelyYear = now.getUTCFullYear() - 2;
  const requestedYear = year?.trim() || undefined;
  const startyear = requestedYear || String(latestLikelyYear - 1);
  const endyear = requestedYear || String(latestLikelyYear + 1);

  try {
    const body: Record<string, unknown> = {
      seriesid: attemptedSeriesIds,
      startyear,
      endyear,
    };
    if (apiKey) body.registrationkey = apiKey;

    const response = await fetch(BLS_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Occu-Med-Insight-Hub/2.0",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        benchmark: null,
        configured: !!apiKey,
        enabled: true,
        authMode,
        attempted: true,
        attemptedSeriesIds,
        reason: `BLS API request failed with HTTP ${response.status}. This is an upstream/API response error; it is not being mislabeled as a NAICS mapping error.`,
      };
    }

    const payload = (await response.json()) as BlsApiPayload;
    if (payload.status && payload.status !== "REQUEST_SUCCEEDED") {
      const detail = (payload.message ?? []).filter(Boolean).join(" ");
      return {
        benchmark: null,
        configured: !!apiKey,
        enabled: true,
        authMode,
        attempted: true,
        attemptedSeriesIds,
        reason: detail || `BLS API returned status ${payload.status}.`,
      };
    }

    const returnedSeries = payload.Results?.series ?? [];
    const byId = new Map(returnedSeries.map((series) => [series.seriesID || "", series]));
    const groups = new Map<string, SeriesDefinition[]>();
    for (const definition of resolved.definitions) {
      const current = groups.get(definition.group) ?? [];
      current.push(definition);
      groups.set(definition.group, current);
    }

    const evaluated = Array.from(groups.entries()).map(([group, definitions]) => {
      const values = definitions.map((definition) => ({
        definition,
        point: pickAnnualPoint(byId.get(definition.seriesId), requestedYear),
      }));
      const available = values.filter((entry) => entry.point !== null);
      const specificity = definitions[0]?.specificity ?? "sector";
      return { group, definitions, values, available, specificity };
    });

    const selected = evaluated
      .filter((candidate) => candidate.available.length > 0)
      .sort((a, b) => {
        const specificityRank = (value: "exact" | "sector") => (value === "exact" ? 1 : 0);
        const aExact = specificityRank(a.specificity);
        const bExact = specificityRank(b.specificity);
        if (aExact !== bExact) return bExact - aExact;
        return b.available.length - a.available.length;
      })[0];

    if (!selected) {
      return {
        benchmark: null,
        configured: !!apiKey,
        enabled: true,
        authMode,
        attempted: true,
        attemptedSeriesIds,
        reason: requestedYear
          ? `BLS returned no annual SOII rate values for NAICS ${naics} in ${requestedYear}. No substitute values were generated.`
          : `BLS returned no annual SOII rate values for NAICS ${naics} in the queried current-year window. No substitute values were generated.`,
      };
    }

    let trcRate: number | undefined;
    let dartRate: number | undefined;
    let daysAwayRate: number | undefined;
    let dataYear = 0;

    for (const entry of selected.values) {
      if (!entry.point) continue;
      dataYear = Math.max(dataYear, entry.point.year);
      if (entry.definition.measure === "TRC") trcRate = entry.point.value;
      else if (entry.definition.measure === "DART") dartRate = entry.point.value;
      else if (entry.definition.measure === "Days Away") daysAwayRate = entry.point.value;
    }

    const first = selected.definitions[0];
    const fellBackToSector = first.specificity === "sector" && naics.length >= 3;
    const title = fellBackToSector
      ? `${first.industryTitle} (sector benchmark for NAICS ${naics})`
      : first.industryTitle;

    return {
      benchmark: {
        naics,
        industryTitle: title,
        year: dataYear,
        trcRate,
        dartRate,
        daysAwayRate,
        source: BLS_SOURCE,
        sourceUrl: BLS_SOURCE_URL,
        apiDocsUrl: BLS_API_DOCS_URL,
        developerDocsUrl: BLS_DEVELOPER_DOCS_URL,
        sourceMetadata: `U.S. Bureau of Labor Statistics, Survey of Occupational Injuries and Illnesses (SOII), current IS-series industry benchmark; ${first.ownership}.`,
        limitation: fellBackToSector
          ? `${BLS_LIMITATION} A more specific NAICS series was not available in the queried window, so the broader ${first.industryTitle} sector benchmark is shown and labeled as such.`
          : BLS_LIMITATION,
        authMode,
        attemptedSeriesIds,
      },
      configured: !!apiKey,
      enabled: true,
      authMode,
      attempted: true,
      attemptedSeriesIds,
      reason: fellBackToSector
        ? "BLS returned a broader sector benchmark after the more specific NAICS series had no usable annual values."
        : "Benchmark data retrieved from the BLS SOII API.",
    };
  } catch (error) {
    return {
      benchmark: null,
      configured: !!apiKey,
      enabled: true,
      authMode,
      attempted: true,
      attemptedSeriesIds,
      reason: `BLS API request failed: ${sanitizeError(error)}.`,
    };
  }
}
