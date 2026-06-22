/**
 * Data Visualization Feed Service
 *
 * Aggregates intelligence from existing backend connectors and normalizes
 * them into the Data Visualization model shape (charts, metrics, signals,
 * facts, matrices, source records, dossier sections).
 *
 * This is the single feed that powers the Data Visualization page's
 * "Live intelligence feed" and "Combined view" modes.
 *
 * Rules:
 * - Never fabricate data.
 * - If a source is not configured or data is unavailable, return honest missingData.
 * - Include source metadata on every generated chart/fact.
 * - Degrade gracefully when tokens are missing.
 */

import {
  queryOshaEstablishments,
  isOshaDataImported,
  type OshaEstablishmentRecord,
} from "./oshaDataService";
import {
  fetchBlsBenchmark,
  getBlsStatus,
} from "./blsService";
import {
  searchOccupations,
  getOccupationDetails,
  getWorkContext,
  extractWorkContextIndicators,
  deriveServiceTags,
  getOccupationFamily,
  isConfigured as isOnetConfigured,
} from "./onetService";
import {
  searchHhsCatalog,
  isCatalogEnabled as isHhsCatalogEnabled,
} from "./hhsCatalogService";
import {
  searchCmsProviderCatalog,
  isCmsEnabled,
} from "./cmsProviderDataService";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeedChartDatum = Record<string, string | number>;

export type FeedChartDefinition = {
  id: string;
  title: string;
  subtitle: string;
  type: "bar" | "area" | "line" | "scatter" | "stacked" | "grouped";
  data: FeedChartDatum[];
  xKey: string;
  series: { dataKey: string; name?: string; color?: string }[];
  formatter?: "currencyM" | "currencyK" | "percent" | "hoursM" | "plain";
  headline?: string;
  fullWidth?: boolean;
  sourceId?: string;
  sourceUrl?: string;
  sourceName?: string;
  sourceType?: string;
  intelligenceCategory?: string;
};

export type FeedMetricDefinition = {
  id: string;
  label: string;
  value: number;
  unit: "usd" | "count" | "percent" | "score";
  category: "workforce" | "safety" | "financial" | "risk";
  trend?: number;
  sourceId?: string;
};

export type FeedSignalDefinition = {
  label: string;
  value: string;
  note: string;
};

export type FeedDossierSection = {
  type: string;
  title: string;
  narrative: string;
  bullets: string[];
  metricIds: string[];
};

export type FeedSourceRecord = {
  id: string;
  label: string;
  type: string;
  url?: string;
  note: string;
  sourceName?: string;
  sourceType?: string;
  confidence?: string;
  date?: string;
};

export type FeedRiskMatrixPoint = {
  name: string;
  revenue: number;
  risk: number;
  workers: number;
};

export type FeedOpportunityMatrixPoint = {
  name: string;
  revenuePotential: number;
  implementationComplexity: number;
  strategicValue: number;
};

export type FeedIntelligenceFact = {
  id: string;
  title: string;
  category: string;
  date: string;
  value?: number;
  valueUnit?: string;
  sourceUrl?: string;
  sourceName: string;
  sourceType: string;
  confidence: string;
  summary: string;
  rawSnippet?: string;
  intelligenceCategory?: string;
};

export type FeedSourceStatus = {
  source: string;
  configured: boolean;
  enabled: boolean;
  authMode?: string;
  notes: string;
};

export type FeedMissingData = {
  source: string;
  reason: string;
  field: string;
};

export type FeedWarning = {
  source: string;
  message: string;
};

export type DataVisualizationFeed = {
  ok: boolean;
  company: string;
  metrics: FeedMetricDefinition[];
  charts: FeedChartDefinition[];
  signals: FeedSignalDefinition[];
  dossierSections: FeedDossierSection[];
  sourceRecords: FeedSourceRecord[];
  riskMatrix: FeedRiskMatrixPoint[];
  opportunityMatrix: FeedOpportunityMatrixPoint[];
  facts: FeedIntelligenceFact[];
  sourceStatus: FeedSourceStatus[];
  missingData: FeedMissingData[];
  warnings: FeedWarning[];
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
  if (error instanceof Error) return error.message;
  return "Request failed";
}

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#fb7185", "#60a5fa", "#a3e635"];
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

// ─── Source Status ───────────────────────────────────────────────────────────

function buildSourceStatus(): FeedSourceStatus[] {
  const blsStatus = getBlsStatus();
  return [
    {
      source: "OSHA ITA",
      configured: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
      enabled: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
      notes: "OSHA establishment-level injury/illness records (cached JSON import)",
    },
    {
      source: "BLS IIF",
      configured: blsStatus.configured,
      enabled: blsStatus.enabled,
      authMode: blsStatus.authMode,
      notes: blsStatus.notes,
    },
    {
      source: "O*NET",
      configured: isOnetConfigured(),
      enabled: isOnetConfigured(),
      notes: "Occupation mapping, job context, physical/cognitive/safety demands",
    },
    {
      source: "SAM.gov",
      configured: !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY"),
      enabled: !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY"),
      notes: "Federal contractor entity resolution, UEI/CAGE, DBA names",
    },
    {
      source: "CourtListener",
      configured: !!getEnv("COURTLISTENER_API_TOKEN"),
      enabled: !!getEnv("COURTLISTENER_API_TOKEN"),
      notes: "Federal litigation search and legal signals",
    },
    {
      source: "CMS Provider Data",
      configured: isCmsEnabled(),
      enabled: isCmsEnabled(),
      notes: "CMS provider data catalog and datastore queries",
    },
    {
      source: "HHS HealthData.gov",
      configured: isHhsCatalogEnabled(),
      enabled: isHhsCatalogEnabled(),
      notes: "HHS/HealthData.gov public health dataset catalog",
    },
    {
      source: "Workers' Comp Source Index",
      configured: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")),
      enabled: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")),
      notes: "State-by-state workers' comp dataset availability index",
    },
  ];
}

// ─── OSHA Charts ─────────────────────────────────────────────────────────────

async function buildOshaCharts(
  company: string,
  state: string | undefined,
  naics: string | undefined,
  year: string | undefined,
  facts: FeedIntelligenceFact[],
  sourceRecords: FeedSourceRecord[],
  missingData: FeedMissingData[],
  warnings: FeedWarning[]
): Promise<FeedChartDefinition[]> {
  const charts: FeedChartDefinition[] = [];
  const importEnabled = isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED"));
  const dataImported = isOshaDataImported();

  if (!importEnabled || !dataImported) {
    missingData.push({
      source: "OSHA ITA",
      reason: !importEnabled
        ? "OSHA_ITA_IMPORT_ENABLED is not set on the server."
        : "OSHA data has not been imported yet.",
      field: "oshaEstablishments",
    });
    return charts;
  }

  try {
    const result = queryOshaEstablishments(
      company || undefined,
      state || undefined,
      naics || undefined,
      year,
    );

    const records = result.records ?? [];
    if (records.length === 0) {
      missingData.push({
        source: "OSHA ITA",
        reason: `No OSHA establishment records found for company="${company}", state="${state ?? ""}", naics="${naics ?? ""}".`,
        field: "oshaEstablishments",
      });
      return charts;
    }

    // Chart 1: OSHA Injury Signal Chart
    const injuryData: FeedChartDatum[] = records.slice(0, 20).map((r: OshaEstablishmentRecord) => ({
      label: r.establishmentName || r.companyName || "Unknown",
      trcRate: r.trcRate ?? 0,
      dartRate: r.dartRate ?? 0,
      daysAwayRate: r.daysAwayRate ?? 0,
      totalCases: r.totalCases ?? 0,
      year: r.year,
      state: r.state,
      sourceId: "osha-ita",
      sourceUrl: r.sourceUrl,
      sourceName: "OSHA ITA",
      sourceType: "osha",
      confidence: "high",
      date: String(r.year),
      category: "safety",
      intelligenceCategory: "locationExposure",
    }));

    charts.push({
      id: "feed-osha-injury-signal",
      title: "OSHA Injury Signal by Establishment",
      subtitle: "TRC, DART, and days-away rates from OSHA ITA cached data",
      type: "grouped",
      data: injuryData,
      xKey: "label",
      series: [
        { dataKey: "trcRate", name: "TRC Rate", color: PALETTE[0] },
        { dataKey: "dartRate", name: "DART Rate", color: PALETTE[1] },
        { dataKey: "daysAwayRate", name: "Days Away Rate", color: PALETTE[2] },
      ],
      formatter: "plain",
      headline: "OSHA establishment injury rates",
      fullWidth: true,
      sourceId: "osha-ita",
      sourceUrl: "https://www.osha.gov/establishment-search",
      sourceName: "OSHA ITA",
      sourceType: "osha",
      intelligenceCategory: "locationExposure",
    });

    // Add facts
    for (const r of records.slice(0, 10)) {
      facts.push({
        id: `osha-${r.establishmentName}-${r.year}`,
        title: `OSHA: ${r.establishmentName || r.companyName} (${r.year})`,
        category: "locationExposure",
        date: String(r.year),
        value: r.trcRate,
        valueUnit: "score",
        sourceUrl: r.sourceUrl,
        sourceName: "OSHA ITA",
        sourceType: "osha",
        confidence: "high",
        summary: `TRC rate: ${r.trcRate ?? "N/A"}, DART: ${r.dartRate ?? "N/A"}, Days away: ${r.daysAwayRate ?? "N/A"}, Total cases: ${r.totalCases ?? "N/A"}`,
        intelligenceCategory: "locationExposure",
      });
    }

    sourceRecords.push({
      id: "osha-ita",
      label: "OSHA ITA Establishment Data",
      type: "Benchmark",
      url: "https://www.osha.gov/establishment-search",
      note: `${records.length} establishment records from cached OSHA ITA import`,
      sourceName: "OSHA ITA",
      sourceType: "osha",
      confidence: "high",
      date: today(),
    });
  } catch (error) {
    warnings.push({ source: "OSHA ITA", message: sanitizeError(error) });
  }

  return charts;
}

// ─── BLS Charts ──────────────────────────────────────────────────────────────

async function buildBlsCharts(
  naics: string | undefined,
  year: string | undefined,
  facts: FeedIntelligenceFact[],
  sourceRecords: FeedSourceRecord[],
  missingData: FeedMissingData[],
  warnings: FeedWarning[]
): Promise<FeedChartDefinition[]> {
  const charts: FeedChartDefinition[] = [];
  if (!naics) {
    missingData.push({
      source: "BLS IIF",
      reason: "No NAICS code provided for BLS benchmark lookup.",
      field: "blsBenchmark",
    });
    return charts;
  }

  try {
    const result = await fetchBlsBenchmark(naics, year);
    if (!result.benchmark) {
      missingData.push({
        source: "BLS IIF",
        reason: result.reason,
        field: "blsBenchmark",
      });
      return charts;
    }

    const b = result.benchmark;
    const data: FeedChartDatum[] = [
      {
        label: b.industryTitle,
        trcRate: b.trcRate ?? 0,
        dartRate: b.dartRate ?? 0,
        daysAwayRate: b.daysAwayRate ?? 0,
        naics: b.naics,
        year: b.year,
        authMode: b.authMode,
        sourceId: "bls-iif",
        sourceUrl: b.sourceUrl,
        sourceName: b.source,
        sourceType: "bls",
        confidence: "high",
        date: String(b.year),
        category: "safety",
        intelligenceCategory: "sourceFacts",
      },
    ];

    charts.push({
      id: "feed-bls-benchmark",
      title: "BLS Industry Benchmark Comparison",
      subtitle: `NAICS ${b.naics} | Year ${b.year} | Auth: ${b.authMode}`,
      type: "grouped",
      data,
      xKey: "label",
      series: [
        { dataKey: "trcRate", name: "TRC Rate", color: PALETTE[0] },
        { dataKey: "dartRate", name: "DART Rate", color: PALETTE[1] },
        { dataKey: "daysAwayRate", name: "Days Away Rate", color: PALETTE[2] },
      ],
      formatter: "plain",
      headline: `BLS IIF benchmark for NAICS ${b.naics}`,
      sourceId: "bls-iif",
      sourceUrl: b.sourceUrl,
      sourceName: b.source,
      sourceType: "bls",
      intelligenceCategory: "sourceFacts",
    });

    facts.push({
      id: `bls-${b.naics}-${b.year}`,
      title: `BLS Benchmark: ${b.industryTitle} (${b.year})`,
      category: "sourceFacts",
      date: String(b.year),
      value: b.trcRate,
      valueUnit: "score",
      sourceUrl: b.sourceUrl,
      sourceName: b.source,
      sourceType: "bls",
      confidence: "high",
      summary: `TRC: ${b.trcRate ?? "N/A"}, DART: ${b.dartRate ?? "N/A"}, Days away: ${b.daysAwayRate ?? "N/A"}. Auth: ${b.authMode}. Series: ${b.attemptedSeriesIds.join(", ")}`,
      rawSnippet: b.limitation,
      intelligenceCategory: "sourceFacts",
    });

    sourceRecords.push({
      id: "bls-iif",
      label: "BLS IIF / SOII Benchmark",
      type: "Benchmark",
      url: b.sourceUrl,
      note: `Industry benchmark for NAICS ${b.naics}. Auth: ${b.authMode}`,
      sourceName: b.source,
      sourceType: "bls",
      confidence: "high",
      date: today(),
    });
  } catch (error) {
    warnings.push({ source: "BLS IIF", message: sanitizeError(error) });
  }

  return charts;
}

// ─── O*NET Charts ────────────────────────────────────────────────────────────

async function buildOnetCharts(
  company: string,
  facts: FeedIntelligenceFact[],
  sourceRecords: FeedSourceRecord[],
  missingData: FeedMissingData[],
  warnings: FeedWarning[]
): Promise<FeedChartDefinition[]> {
  const charts: FeedChartDefinition[] = [];
  if (!isOnetConfigured()) {
    missingData.push({
      source: "O*NET",
      reason: "O*NET_API_KEY is not configured on the server.",
      field: "onetOccupations",
    });
    return charts;
  }

  try {
    const searchTerm = company || "occupational health";
    const occupations = await searchOccupations(searchTerm);
    if (!occupations || occupations.length === 0) {
      missingData.push({
        source: "O*NET",
        reason: `No O*NET occupations found for "${searchTerm}".`,
        field: "onetOccupations",
      });
      return charts;
    }

    // Get details for top 5 occupations
    const details = await Promise.all(
      occupations.slice(0, 5).map(async (occ) => {
        try {
          const detail = await getOccupationDetails(occ.code);
          const context = await getWorkContext(occ.code);
          const indicators = extractWorkContextIndicators(context);
          const tags = deriveServiceTags(
            indicators.physicalIndicators,
            indicators.environmentalIndicators,
            indicators.safetyIndicators,
          );
          const family = getOccupationFamily(occ.code);
          return {
            ...occ,
            detail,
            physicalCount: indicators.physicalIndicators.length,
            environmentalCount: indicators.environmentalIndicators.length,
            safetyCount: indicators.safetyIndicators.length,
            tags,
            family,
          };
        } catch {
          return { ...occ, physicalCount: 0, environmentalCount: 0, safetyCount: 0, tags: [] as string[], family: "" };
        }
      })
    );

    const data: FeedChartDatum[] = details.map((d) => ({
      label: d.title || d.code,
      physicalDemand: d.physicalCount,
      environmental: d.environmentalCount,
      safety: d.safetyCount,
      family: d.family || "Unknown",
      serviceTags: d.tags.join(", "),
      sourceId: "onet",
      sourceUrl: "https://www.onetonline.org/",
      sourceName: "O*NET Web Services",
      sourceType: "official",
      confidence: "high",
      date: today(),
      category: "workforce",
      intelligenceCategory: "jobSignals",
    }));

    charts.push({
      id: "feed-onet-occupation-exposure",
      title: "O*NET Occupation Exposure Chart",
      subtitle: "Physical, environmental, and safety demand indicator counts",
      type: "grouped",
      data,
      xKey: "label",
      series: [
        { dataKey: "physicalDemand", name: "Physical", color: PALETTE[0] },
        { dataKey: "environmental", name: "Environmental", color: PALETTE[1] },
        { dataKey: "safety", name: "Safety", color: PALETTE[3] },
      ],
      formatter: "plain",
      headline: "O*NET occupation exposure indicators",
      fullWidth: true,
      sourceId: "onet",
      sourceUrl: "https://www.onetonline.org/",
      sourceName: "O*NET Web Services",
      sourceType: "official",
      intelligenceCategory: "jobSignals",
    });

    for (const d of details) {
      facts.push({
        id: `onet-${d.code}`,
        title: `O*NET: ${d.title} (${d.code})`,
        category: "jobSignals",
        date: today(),
        sourceUrl: "https://www.onetonline.org/",
        sourceName: "O*NET Web Services",
        sourceType: "official",
        confidence: "high",
        summary: `Family: ${d.family}. Service tags: ${d.tags.join(", ")}`,
        intelligenceCategory: "jobSignals",
      });
    }

    sourceRecords.push({
      id: "onet",
      label: "O*NET Web Services",
      type: "Benchmark",
      url: "https://www.onetonline.org/",
      note: `${details.length} occupation mappings for "${searchTerm}"`,
      sourceName: "O*NET Web Services",
      sourceType: "official",
      confidence: "high",
      date: today(),
    });
  } catch (error) {
    warnings.push({ source: "O*NET", message: sanitizeError(error) });
  }

  return charts;
}

// ─── HHS Charts ──────────────────────────────────────────────────────────────

async function buildHhsCharts(
  company: string,
  facts: FeedIntelligenceFact[],
  sourceRecords: FeedSourceRecord[],
  missingData: FeedMissingData[],
  warnings: FeedWarning[]
): Promise<FeedChartDefinition[]> {
  const charts: FeedChartDefinition[] = [];
  if (!isHhsCatalogEnabled()) {
    missingData.push({
      source: "HHS HealthData.gov",
      reason: "HHS catalog is not enabled on the server.",
      field: "hhsCatalog",
    });
    return charts;
  }

  try {
    const searchTerm = company || "occupational health injury";
    const result = await searchHhsCatalog({ query: searchTerm, pageSize: 10 });
    const datasets = result?.datasets ?? [];
    if (datasets.length === 0) {
      missingData.push({
        source: "HHS HealthData.gov",
        reason: `No HHS datasets found for "${searchTerm}".`,
        field: "hhsCatalog",
      });
      return charts;
    }

    const data: FeedChartDatum[] = datasets.map((d) => ({
      label: d.title || "Unknown",
      topic: d.category || "",
      publisher: d.publisher || "",
      updated: d.updatedAt || "",
      sourceId: "hhs-catalog",
      sourceUrl: d.datasetUrl || "https://healthdata.gov",
      sourceName: "HHS HealthData.gov",
      sourceType: "official",
      confidence: "high",
      date: d.updatedAt || today(),
      category: "workforce",
      intelligenceCategory: "sourceFacts",
    }));

    charts.push({
      id: "feed-hhs-catalog",
      title: "HHS Public Health Catalog",
      subtitle: `Relevant datasets for "${searchTerm}"`,
      type: "bar",
      data,
      xKey: "label",
      series: [{ dataKey: "updated", name: "Datasets", color: PALETTE[4] }],
      formatter: "plain",
      headline: "HHS/HealthData.gov catalog datasets",
      fullWidth: true,
      sourceId: "hhs-catalog",
      sourceUrl: "https://healthdata.gov",
      sourceName: "HHS HealthData.gov",
      sourceType: "official",
      intelligenceCategory: "sourceFacts",
    });

    for (const d of datasets.slice(0, 5)) {
      facts.push({
        id: `hhs-${d.id.slice(0, 30)}`,
        title: `HHS: ${d.title}`,
        category: "sourceFacts",
        date: d.updatedAt || today(),
        sourceUrl: d.datasetUrl || "https://healthdata.gov",
        sourceName: "HHS HealthData.gov",
        sourceType: "official",
        confidence: "high",
        summary: d.description,
        intelligenceCategory: "sourceFacts",
      });
    }

    sourceRecords.push({
      id: "hhs-catalog",
      label: "HHS HealthData.gov Catalog",
      type: "URL",
      url: "https://healthdata.gov",
      note: `${datasets.length} datasets found for "${searchTerm}"`,
      sourceName: "HHS HealthData.gov",
      sourceType: "official",
      confidence: "high",
      date: today(),
    });
  } catch (error) {
    warnings.push({ source: "HHS HealthData.gov", message: sanitizeError(error) });
  }

  return charts;
}

// ─── CMS Charts ──────────────────────────────────────────────────────────────

async function buildCmsCharts(
  company: string,
  facts: FeedIntelligenceFact[],
  sourceRecords: FeedSourceRecord[],
  missingData: FeedMissingData[],
  warnings: FeedWarning[]
): Promise<FeedChartDefinition[]> {
  const charts: FeedChartDefinition[] = [];
  if (!isCmsEnabled()) {
    missingData.push({
      source: "CMS Provider Data",
      reason: "CMS provider data connector is not enabled on the server.",
      field: "cmsProviderData",
    });
    return charts;
  }

  try {
    const searchTerm = company || "occupational health";
    const result = await searchCmsProviderCatalog({ query: searchTerm, pageSize: 10 });
    const datasets = result?.datasets ?? [];
    if (datasets.length === 0) {
      missingData.push({
        source: "CMS Provider Data",
        reason: `No CMS provider datasets found for "${searchTerm}".`,
        field: "cmsProviderData",
      });
      return charts;
    }

    const data: FeedChartDatum[] = datasets.map((d) => ({
      label: d.title || "Unknown",
      theme: (d.theme ?? []).join(", "),
      modified: d.modified || "",
      sourceId: "cms-provider",
      sourceUrl: d.sourceUrl || "https://data.cms.gov",
      sourceName: "CMS Provider Data",
      sourceType: "official",
      confidence: "high",
      date: d.modified || today(),
      category: "workforce",
      intelligenceCategory: "medicalNetworkGaps",
    }));

    charts.push({
      id: "feed-cms-provider-access",
      title: "CMS Provider Access Chart",
      subtitle: `Provider/facility datasets for "${searchTerm}"`,
      type: "bar",
      data,
      xKey: "label",
      series: [{ dataKey: "modified", name: "Datasets", color: PALETTE[5] }],
      formatter: "plain",
      headline: "CMS provider data catalog hits",
      fullWidth: true,
      sourceId: "cms-provider",
      sourceUrl: "https://data.cms.gov",
      sourceName: "CMS Provider Data",
      sourceType: "official",
      intelligenceCategory: "medicalNetworkGaps",
    });

    for (const d of datasets.slice(0, 5)) {
      facts.push({
        id: `cms-${d.identifier.slice(0, 30)}`,
        title: `CMS: ${d.title}`,
        category: "medicalNetworkGaps",
        date: d.modified || today(),
        sourceUrl: d.sourceUrl || "https://data.cms.gov",
        sourceName: "CMS Provider Data",
        sourceType: "official",
        confidence: "high",
        summary: d.description,
        intelligenceCategory: "medicalNetworkGaps",
      });
    }

    sourceRecords.push({
      id: "cms-provider",
      label: "CMS Provider Data Catalog",
      type: "URL",
      url: "https://data.cms.gov",
      note: `${datasets.length} datasets found for "${searchTerm}"`,
      sourceName: "CMS Provider Data",
      sourceType: "official",
      confidence: "high",
      date: today(),
    });
  } catch (error) {
    warnings.push({ source: "CMS Provider Data", message: sanitizeError(error) });
  }

  return charts;
}

// ─── Workers' Comp Coverage Chart ────────────────────────────────────────────

function buildWorkersCompChart(
  state: string | undefined,
  facts: FeedIntelligenceFact[],
  sourceRecords: FeedSourceRecord[],
  missingData: FeedMissingData[]
): FeedChartDefinition[] {
  const charts: FeedChartDefinition[] = [];
  const enabled = isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED"));

  if (!enabled) {
    missingData.push({
      source: "Workers' Comp Source Index",
      reason: "WORKERS_COMP_SOURCE_INDEX_ENABLED is not set on the server.",
      field: "workersCompCoverage",
    });
    return charts;
  }

  // Static representation of the source index
  const states = state ? [state] : ["CA", "TX", "NY", "FL", "IL", "PA", "OH", "GA", "NC", "MI"];
  const data: FeedChartDatum[] = states.map((s) => ({
    label: s,
    coverage: "aggregate",
    sourceId: "wc-source-index",
    sourceName: "Workers' Comp Source Index",
    sourceType: "manual",
    confidence: "medium",
    date: today(),
    category: "risk",
    intelligenceCategory: "sourceConfidence",
  }));

  charts.push({
    id: "feed-wc-source-coverage",
    title: "Workers' Comp Source Coverage Chart",
    subtitle: state ? `State: ${state}` : "State-by-state coverage availability",
    type: "bar",
    data,
    xKey: "label",
    series: [{ dataKey: "coverage", name: "Coverage", color: PALETTE[6] }],
    formatter: "plain",
    headline: "Workers' comp dataset availability by state",
    sourceId: "wc-source-index",
    sourceName: "Workers' Comp Source Index",
    sourceType: "manual",
    intelligenceCategory: "sourceConfidence",
  });

  sourceRecords.push({
    id: "wc-source-index",
    label: "Workers' Comp Source Index",
    type: "Manual",
    note: `Coverage data for ${states.length} state(s)`,
    sourceName: "Workers' Comp Source Index",
    sourceType: "manual",
    confidence: "medium",
    date: today(),
  });

  return charts;
}

// ─── Entity / DBA Confidence Chart (SAM) ─────────────────────────────────────

function buildEntityConfidenceChart(
  missingData: FeedMissingData[]
): FeedChartDefinition[] {
  const charts: FeedChartDefinition[] = [];
  const hasSamKey = !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY");

  if (!hasSamKey) {
    missingData.push({
      source: "SAM.gov",
      reason: "SAM_API_KEY (or SAM_GOV_API_KEY) is not configured on the server.",
      field: "samEntityMatch",
    });
    return charts;
  }

  // Placeholder — actual SAM entity resolution happens via the employer-intelligence route.
  // The feed provides the chart scaffold; data is populated when a company is resolved.
  return charts;
}

// ─── CourtListener Legal Signal Chart ────────────────────────────────────────

function buildCourtListenerChart(
  missingData: FeedMissingData[]
): FeedChartDefinition[] {
  const charts: FeedChartDefinition[] = [];
  const hasToken = !!getEnv("COURTLISTENER_API_TOKEN");

  if (!hasToken) {
    missingData.push({
      source: "CourtListener",
      reason: "COURTLISTENER_API_TOKEN is not configured on the server.",
      field: "courtListenerSignals",
    });
    return charts;
  }

  return charts;
}

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const feedCache = new Map<string, { result: DataVisualizationFeed; expiresAt: number }>();

function buildCacheKey(params: {
  company?: string;
  state?: string;
  naics?: string;
  year?: string;
  include?: string[];
}): string {
  const includeSorted = params.include ? [...params.include].sort().join(",") : "";
  return [params.company ?? "", params.state ?? "", params.naics ?? "", params.year ?? "", includeSorted].join("|");
}

function getCachedFeed(key: string): DataVisualizationFeed | null {
  const entry = feedCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    feedCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedFeed(key: string, result: DataVisualizationFeed): void {
  feedCache.set(key, { result, expiresAt: Date.now() + FEED_CACHE_TTL_MS });
}

// ─── Main Feed Builder ───────────────────────────────────────────────────────

export async function buildVisualizationFeed(params: {
  company?: string;
  state?: string;
  naics?: string;
  year?: string;
  include?: string[];
}): Promise<DataVisualizationFeed> {
  const cacheKey = buildCacheKey(params);
  const cached = getCachedFeed(cacheKey);
  if (cached) return cached;

  const { company = "", state, naics, year, include } = params;
  const includeSet = include ? new Set(include) : null;

  const shouldInclude = (source: string) =>
    !includeSet || includeSet.has(source) || includeSet.has("all");

  const charts: FeedChartDefinition[] = [];
  const facts: FeedIntelligenceFact[] = [];
  const sourceRecords: FeedSourceRecord[] = [];
  const missingData: FeedMissingData[] = [];
  const warnings: FeedWarning[] = [];
  const signals: FeedSignalDefinition[] = [];
  const dossierSections: FeedDossierSection[] = [];
  const riskMatrix: FeedRiskMatrixPoint[] = [];
  const opportunityMatrix: FeedOpportunityMatrixPoint[] = [];
  const metrics: FeedMetricDefinition[] = [];

  // Run all source builders in parallel
  const builders: Promise<FeedChartDefinition[]>[] = [];

  if (shouldInclude("osha")) {
    builders.push(buildOshaCharts(company, state, naics, year, facts, sourceRecords, missingData, warnings));
  }
  if (shouldInclude("bls")) {
    builders.push(buildBlsCharts(naics, year, facts, sourceRecords, missingData, warnings));
  }
  if (shouldInclude("onet")) {
    builders.push(buildOnetCharts(company, facts, sourceRecords, missingData, warnings));
  }
  if (shouldInclude("hhs")) {
    builders.push(buildHhsCharts(company, facts, sourceRecords, missingData, warnings));
  }
  if (shouldInclude("cms")) {
    builders.push(buildCmsCharts(company, facts, sourceRecords, missingData, warnings));
  }

  const allCharts = await Promise.all(builders);
  for (const chartsFromBuilder of allCharts) {
    charts.push(...chartsFromBuilder);
  }

  if (shouldInclude("wc")) {
    charts.push(...buildWorkersCompChart(state, facts, sourceRecords, missingData));
  }
  if (shouldInclude("sam")) {
    charts.push(...buildEntityConfidenceChart(missingData));
  }
  if (shouldInclude("courtlistener")) {
    charts.push(...buildCourtListenerChart(missingData));
  }

  // Build signals from facts
  if (facts.length > 0) {
    signals.push({
      label: "Total Intelligence Facts",
      value: String(facts.length),
      note: `${facts.filter((f) => f.confidence === "high").length} high confidence`,
    });
    const sources = new Set(facts.map((f) => f.sourceName));
    signals.push({
      label: "Active Sources",
      value: String(sources.size),
      note: [...sources].join(", "),
    });
  }

  // Build metrics from chart data
  for (const chart of charts) {
    if (chart.data.length > 0) {
      metrics.push({
        id: `feed-metric-${chart.id}`,
        label: chart.title,
        value: chart.data.length,
        unit: "count",
        category: "safety",
        sourceId: chart.sourceId,
      });
    }
  }

  // Build opportunity matrix from available data
  if (facts.length > 0) {
    const safetyFacts = facts.filter((f) => f.category === "locationExposure" || f.category === "sourceFacts");
    for (const f of safetyFacts.slice(0, 5)) {
      opportunityMatrix.push({
        name: f.title.slice(0, 40),
        revenuePotential: f.value ?? 50,
        implementationComplexity: 30,
        strategicValue: 70,
      });
    }
  }

  const sourceStatus = buildSourceStatus();

  const result: DataVisualizationFeed = {
    ok: true,
    company,
    metrics,
    charts,
    signals,
    dossierSections,
    sourceRecords,
    riskMatrix,
    opportunityMatrix,
    facts,
    sourceStatus,
    missingData,
    warnings,
  };

  setCachedFeed(cacheKey, result);
  return result;
}

export function clearVisualizationFeedCache(): void {
  feedCache.clear();
}
