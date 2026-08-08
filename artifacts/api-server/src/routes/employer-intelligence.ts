import { Router, type IRouter, type Request, type Response } from "express";
import {
  queryOshaEstablishments,
  getOshaImportInfo,
  isOshaDataImported,
  nameSimilarity,
  type OshaEstablishmentRecord,
} from "../services/oshaDataService";
import { fetchBlsBenchmark as fetchBlsBenchmarkService, getBlsStatus as getBlsServiceStatus, type BlsBenchmarkResult } from "../services/blsService";
import {
  searchOccupations,
  getOccupationDetails,
  getWorkContext,
  extractWorkContextIndicators,
  deriveServiceTags,
  getOccupationFamily,
  isConfigured as isOnetConfigured,
} from "../services/onetService";
import {
  searchHhsCatalog,
  getHhsDataset,
  getHhsCatalogStatus,
  isCatalogEnabled as isHhsCatalogEnabled,
  sanitizeError as sanitizeHhsError,
} from "../services/hhsCatalogService";
import {
  searchCmsProviderCatalog,
  getCmsProviderDataset,
  getCmsProviderDatastoreStats,
  queryCmsProviderDatastore,
  getCmsProviderDataStatus,
  isCmsEnabled,
  sanitizeError as sanitizeCmsError,
} from "../services/cmsProviderDataService";

const router: IRouter = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

type OshaEstablishment = OshaEstablishmentRecord;

type BlsBenchmark = BlsBenchmarkResult;

type WorkersCompSource = {
  state: string;
  availableDatasets: { name: string; url: string; type: string }[];
  coverageNotes: string;
  dataLimitations: string;
  claimLevel: boolean;
  aggregate: boolean;
  unavailable: boolean;
};

type EntityMatch = {
  matchType: string;
  source: string;
  confidence: number;
  evidenceFields: string[];
  canonicalName: string;
  aliases: string[];
  dbaNames: string[];
  subsidiaryNames: string[];
  legacyNames: string[];
  cage?: string;
  uei?: string;
  cik?: string;
  ticker?: string;
  naicsCodes?: string[];
  address?: string;
  matchedEstablishments?: { name: string; address: string; source: string }[];
  unmatchedEstablishments?: { name: string; source: string }[];
  warnings: string[];
};

type OpportunityScore = {
  score: number;
  label: string;
  topFactors: { factor: string; contribution: number }[];
  matchedServices: { service: string; reason: string; fitScore: number }[];
  sourceConfidence: number;
  missingData: string[];
  warnings: string[];
};

type JobNormalization = {
  inputTitle: string;
  occupationMatches: { title: string; code: string; score?: number }[];
  socCode?: string;
  occupationFamily?: string;
  physicalDemandIndicators: string[];
  environmentalIndicators: string[];
  safetySensitiveIndicators: string[];
  serviceRelevanceTags: string[];
  confidence: number;
};

type SourceStatus = {
  source: string;
  configured: boolean;
  enabled: boolean;
  lastSync?: string;
  lastError?: string;
  dataType: "live-api" | "cached-import" | "database-import" | "static-index" | "not-configured";
  nextRefresh?: string;
  notes: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === "true" || value === "1" || value === "yes";
}

/**
 * Sanitize error messages — never include full URLs that might contain tokens/keys.
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/https?:\/\/[^\s]+/g, "[URL redacted]");
  }
  return "Request failed";
}

/**
 * Safe fetch wrapper — returns null on non-ok or error, never throws.
 * Does not log URLs (which may contain API keys in query params).
 */
async function safeFetch(url: string, options?: RequestInit): Promise<unknown | null> {
  try {
    const r = await fetch(url, options);
    if (!r.ok) return null;
    return await r.json() as unknown;
  } catch {
    return null;
  }
}

// ─── OSHA Connector ──────────────────────────────────────────────────────────
// OSHA ITA data is imported into Postgres by scripts/import-osha.ts and queried from the database.
async function getOshaEstablishments(company?: string, state?: string, naics?: string, year?: string): Promise<OshaEstablishment[]> {
  const result = await queryOshaEstablishments(company, state, naics, year);
  return result.records;
}

// ─── BLS Connector ───────────────────────────────────────────────────────────
// BLS benchmark logic is now in src/services/blsService.ts
// It constructs proper SOII series IDs, queries the BLS API, and returns
// structured results with clear status if data is unavailable.

// ─── SAM.gov Connector ───────────────────────────────────────────────────────

async function fetchSamEntity(companyName: string): Promise<Record<string, unknown> | null> {
  const apiKey = getEnv("SAM_API_KEY") || getEnv("SAM_GOV_API_KEY");
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      legalBusinessName: companyName,
      registrationStatus: "A",
    });
    const data = await safeFetch(
      `https://api.sam.gov/entity-information/v3/entities?${params}`,
    );
    if (!data) return null;
    const payload = data as Record<string, unknown>;
    const entities = payload?.entities as Array<Record<string, unknown>> | undefined;
    if (!entities || entities.length === 0) return null;
    return entities[0];
  } catch {
    return null;
  }
}

// ─── SEC EDGAR Connector ─────────────────────────────────────────────────────

async function fetchSecEntity(companyName: string): Promise<Record<string, unknown> | null> {
  const userAgent = getEnv("SEC_USER_AGENT");
  if (!userAgent) return null;

  try {
    const params = new URLSearchParams({
      q: companyName,
      dateRange: "custom",
      startdt: "2020-01-01",
      enddt: new Date().toISOString().split("T")[0],
    });
    const data = await safeFetch(
      `https://efts.sec.gov/LATEST/search-index?${params}`,
      { headers: { "User-Agent": userAgent } },
    );
    if (!data) return null;
    const payload = data as Record<string, unknown>;
    const hits = payload?.hits as Record<string, unknown> | undefined;
    const hitsArray = hits?.hits as Array<Record<string, unknown>> | undefined;
    if (!hitsArray || hitsArray.length === 0) return null;
    return hitsArray[0];
  } catch {
    return null;
  }
}

// ─── CourtListener Connector ─────────────────────────────────────────────────

async function fetchCourtListenerResults(companyName: string): Promise<Record<string, unknown>[]> {
  const token = getEnv("COURTLISTENER_API_TOKEN");
  if (!token) return [];

  try {
    const params = new URLSearchParams({
      q: `${companyName} workplace injury OR workers compensation OR OSHA`,
      court_type: "d",
    });
    const data = await safeFetch(
      `https://www.courtlistener.com/api/rest/v4/search/?${params}`,
      { headers: { Authorization: `Token ${token}` } },
    );
    if (!data) return [];
    const payload = data as Record<string, unknown>;
    const results = payload?.results as Array<Record<string, unknown>> | undefined;
    return results || [];
  } catch {
    return [];
  }
}

// ─── USAspending Connector ───────────────────────────────────────────────────

async function fetchUsaSpendingAwards(companyName: string): Promise<Record<string, unknown>[]> {
  const enabled = isTruthy(getEnv("USASPENDING_API_ENABLED"));
  if (!enabled) return [];

  try {
    const data = await safeFetch("https://api.usaspending.gov/api/v1/search/awards/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          recipient_search_text: [companyName],
          award_type_codes: ["A", "B", "C", "D"],
        },
        fields: ["Award ID", "Recipient Name", "Award Amount", "Place of Performance State", "NAICS"],
        limit: 10,
      }),
    });
    if (!data) return [];
    const payload = data as Record<string, unknown>;
    const results = payload?.results as Array<Record<string, unknown>> | undefined;
    return results || [];
  } catch {
    return [];
  }
}

// ─── Workers' Comp Source Index ──────────────────────────────────────────────

function getWorkersCompSources(state: string): WorkersCompSource {
  const indexEnabled = isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED"));

  const stateUpper = state.toUpperCase().trim();

  // Known public workers' comp data sources by state
  const knownSources: Record<string, { name: string; url: string; type: string }[]> = {
    CA: [
      { name: "California DWC Stats", url: "https://www.dir.ca.gov/dwc/", type: "aggregate" },
      { name: "CWCI Annual Reports", url: "https://www.cwci.org/", type: "aggregate" },
    ],
    TX: [
      { name: "Texas DWC Data", url: "https://www.tdi.texas.gov/wc/", type: "aggregate" },
      { name: "TX Comp Claims Data", url: "https://www.txsafework.org/", type: "aggregate" },
    ],
    NY: [
      { name: "NY WCB Stats", url: "https://www.wcb.ny.gov/", type: "aggregate" },
    ],
    FL: [
      { name: "Florida DWC Data", url: "https://www.myfloridacfo.com/division/wc/", type: "aggregate" },
    ],
    PA: [
      { name: "PA Bureau of Workers' Comp", url: "https://www.dli.pa.gov/Workers/", type: "aggregate" },
    ],
    IL: [
      { name: "Illinois WCB Annual Report", url: "https://www2.illinois.gov/iwcc/", type: "aggregate" },
    ],
    OH: [
      { name: "Ohio BWC Stats", url: "https://www.bwc.ohio.gov/", type: "aggregate" },
    ],
    WA: [
      { name: "WA L&I Workers' Comp", url: "https://www.lni.wa.gov/claims/", type: "claim-level" },
    ],
    OR: [
      { name: "Oregon DCBS Stats", url: "https://www.oregon.gov/dcbs/", type: "aggregate" },
    ],
  };

  const sources = knownSources[stateUpper] || [];
  const hasClaimLevel = sources.some((s) => s.type === "claim-level");
  const hasAggregate = sources.some((s) => s.type === "aggregate");

  return {
    state: stateUpper,
    availableDatasets: indexEnabled ? sources : [],
    coverageNotes: sources.length > 0
      ? `${sources.length} public dataset(s) available for ${stateUpper}.`
      : `No known public workers' compensation datasets indexed for ${stateUpper}.`,
    dataLimitations: "There is no single complete national workers' compensation database. State coverage varies significantly. Claim-level data is rare; most states publish aggregate statistics only.",
    claimLevel: hasClaimLevel,
    aggregate: hasAggregate,
    unavailable: sources.length === 0,
  };
}

// ─── O*NET Job Normalization ─────────────────────────────────────────────────
// Uses shared service module: src/services/onetService.ts

async function normalizeJobTitle(
  title: string,
  _description?: string,
  _company?: string,
  _location?: string,
): Promise<JobNormalization> {
  if (!isOnetConfigured()) {
    return {
      inputTitle: title,
      occupationMatches: [],
      confidence: 0,
      physicalDemandIndicators: [],
      environmentalIndicators: [],
      safetySensitiveIndicators: [],
      serviceRelevanceTags: [],
    };
  }

  try {
    const matches = await searchOccupations(title);
    const topMatches = matches.slice(0, 5);

    if (topMatches.length === 0) {
      return {
        inputTitle: title,
        occupationMatches: [],
        confidence: 0,
        physicalDemandIndicators: [],
        environmentalIndicators: [],
        safetySensitiveIndicators: [],
        serviceRelevanceTags: [],
      };
    }

    const topCode = topMatches[0].code;
    const [detailsResult, contextResult] = await Promise.allSettled([
      getOccupationDetails(topCode),
      getWorkContext(topCode),
    ]);

    const details = detailsResult.status === "fulfilled" ? detailsResult.value : {};
    const contextData = contextResult.status === "fulfilled" ? contextResult.value : {};

    const workContextRaw = (contextData as Record<string, unknown>)?.element ?? [];
    const { physicalIndicators, environmentalIndicators, safetyIndicators } =
      extractWorkContextIndicators(workContextRaw);

    const serviceTags = deriveServiceTags(physicalIndicators, environmentalIndicators, safetyIndicators);
    const occupationFamily = getOccupationFamily(topCode);
    const confidence = topMatches[0].score ? Math.min(topMatches[0].score / 100, 1) : 0.5;

    return {
      inputTitle: title,
      occupationMatches: topMatches,
      socCode: topCode,
      occupationFamily,
      physicalDemandIndicators: physicalIndicators.slice(0, 10),
      environmentalIndicators: environmentalIndicators.slice(0, 10),
      safetySensitiveIndicators: safetyIndicators.slice(0, 10),
      serviceRelevanceTags: serviceTags,
      confidence,
    };
  } catch {
    return {
      inputTitle: title,
      occupationMatches: [],
      confidence: 0,
      physicalDemandIndicators: [],
      environmentalIndicators: [],
      safetySensitiveIndicators: [],
      serviceRelevanceTags: [],
    };
  }
}

// ─── Entity Resolver ─────────────────────────────────────────────────────────

async function resolveEntity(
  companyName: string,
  dbaNames?: string[],
  location?: string,
  state?: string,
  naics?: string,
): Promise<EntityMatch> {
  const aliases: string[] = [];
  const matchedDbas: string[] = [];
  const subsidiaryNames: string[] = [];
  const legacyNames: string[] = [];
  const evidenceFields: string[] = [];
  const warnings: string[] = [];
  const matchedEstablishments: { name: string; address: string; source: string }[] = [];
  const unmatchedEstablishments: { name: string; source: string }[] = [];
  let confidence = 0.3;
  let cage: string | undefined;
  let uei: string | undefined;
  let cik: string | undefined;
  let ticker: string | undefined;
  const naicsCodes: string[] = [];
  let resolvedAddress: string | undefined;

  // SAM.gov lookup
  const samEntity = await fetchSamEntity(companyName);
  if (samEntity) {
    const samData = samEntity as Record<string, unknown>;
    const samName = String(samData?.legalBusinessName ?? samData?.entityName ?? "");
    if (samName) {
      const sim = nameSimilarity(companyName, samName);
      if (sim > 0.5) {
        confidence = Math.max(confidence, sim);
        evidenceFields.push(`SAM.gov legal name match: ${samName} (similarity: ${sim.toFixed(2)})`);
        cage = String(samData?.cageCode ?? samData?.cage ?? "");
        uei = String(samData?.ueiSAM ?? samData?.uei ?? "");
        const samNaics = samData?.naicsCodes as string[] | undefined;
        if (samNaics) naicsCodes.push(...samNaics);
        const samAddress = samData?.mailingAddress as Record<string, unknown> | undefined;
        if (samAddress) {
          resolvedAddress = `${samAddress?.addressLine1 ?? ""}, ${samAddress?.city ?? ""}, ${samAddress?.stateOrProvince ?? ""} ${samAddress?.zipCode ?? ""}`;
        }
        const altNames = samData?.dbaNames as string[] | undefined;
        if (altNames) matchedDbas.push(...altNames);
      } else {
        warnings.push(`SAM.gov entity name "${samName}" has low similarity to input "${companyName}"`);
      }
    }
  }

  // SEC EDGAR lookup
  const secEntity = await fetchSecEntity(companyName);
  if (secEntity) {
    const secData = secEntity as Record<string, unknown>;
    const source = secData?._source as Record<string, unknown> | undefined;
    if (source) {
      const secName = String(source?.entity_name ?? source?.display_name ?? "");
      if (secName) {
        const sim = nameSimilarity(companyName, secName);
        if (sim > 0.4) {
          confidence = Math.max(confidence, sim * 0.9);
          evidenceFields.push(`SEC EDGAR entity match: ${secName} (similarity: ${sim.toFixed(2)})`);
          cik = String(source?.entity_id ?? "").replace(/[^0-9]/g, "");
          ticker = String(source?.ticker ?? "");
          const sic = String(source?.sic ?? "");
          if (sic) naicsCodes.push(sic);
        }
      }
    }
  }

  // OSHA establishment matching
  const oshaRecords = await getOshaEstablishments(companyName, state, naics);
  for (const record of oshaRecords) {
    const sim = nameSimilarity(companyName, record.establishmentName);
    if (sim > 0.6) {
      matchedEstablishments.push({
        name: record.establishmentName,
        address: `${record.address}, ${record.city}, ${record.state} ${record.zip}`,
        source: "OSHA ITA",
      });
      confidence = Math.max(confidence, sim * 0.85);
    } else if (sim > 0.3) {
      unmatchedEstablishments.push({ name: record.establishmentName, source: "OSHA ITA" });
    }
  }

  // CourtListener signals
  const courtResults = await fetchCourtListenerResults(companyName);
  if (courtResults.length > 0) {
    evidenceFields.push(`CourtListener: ${courtResults.length} potentially relevant legal case(s) found`);
    warnings.push("CourtListener results are supporting signals only, not injury-rate data");
  }

  // USAspending awards
  const usaAwards = await fetchUsaSpendingAwards(companyName);
  if (usaAwards.length > 0) {
    evidenceFields.push(`USAspending: ${usaAwards.length} federal award(s) found`);
  }

  // Add input DBAs
  if (dbaNames) {
    matchedDbas.push(...dbaNames);
  }

  // Deduplicate
  const allAliases = Array.from(new Set([companyName, ...matchedDbas, ...subsidiaryNames, ...legacyNames]));

  if (confidence < 0.5) {
    warnings.push("Low entity match confidence — manual review recommended");
  }

  return {
    matchType: confidence > 0.8 ? "strong" : confidence > 0.5 ? "moderate" : "weak",
    source: confidence > 0.5 ? "SAM.gov + SEC + OSHA" : "limited",
    confidence: Number(confidence.toFixed(2)),
    evidenceFields,
    canonicalName: companyName,
    aliases: allAliases,
    dbaNames: Array.from(new Set(matchedDbas)),
    subsidiaryNames,
    legacyNames,
    cage,
    uei,
    cik,
    ticker,
    naicsCodes: Array.from(new Set(naicsCodes)),
    address: resolvedAddress,
    matchedEstablishments,
    unmatchedEstablishments,
    warnings,
  };
}

// ─── Opportunity Scoring ─────────────────────────────────────────────────────

function calculateOpportunityScore(input: {
  companyName: string;
  oshaEstablishments?: OshaEstablishment[];
  blsBenchmark?: BlsBenchmark | null;
  onetMapping?: JobNormalization | null;
  workersCompNotes?: WorkersCompSource | null;
  locationContext?: string;
  entityConfidence?: number;
}): OpportunityScore {
  const factors: { factor: string; contribution: number }[] = [];
  const matchedServices: { service: string; reason: string; fitScore: number }[] = [];
  const missingData: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let sourceConfidence = 0.3;

  // OSHA establishment signals
  const oshaRecords = input.oshaEstablishments ?? [];
  if (oshaRecords.length > 0) {
    const totalCases = oshaRecords.reduce((sum, r) => sum + (r.totalCases ?? 0), 0);
    const totalDart = oshaRecords.reduce((sum, r) => sum + (r.dartCases ?? 0), 0);
    const totalHours = oshaRecords.reduce((sum, r) => sum + (r.totalHoursWorked ?? 0), 0);
    const avgTrcRate = oshaRecords.reduce((sum, r) => sum + (r.trcRate ?? 0), 0) / oshaRecords.length;
    const avgDartRate = oshaRecords.reduce((sum, r) => sum + (r.dartRate ?? 0), 0) / oshaRecords.length;

    if (avgTrcRate > 0) {
      factors.push({ factor: `OSHA TRC rate: ${avgTrcRate.toFixed(2)}`, contribution: Math.min(avgTrcRate * 3, 25) });
      score += Math.min(avgTrcRate * 3, 25);
      sourceConfidence += 0.15;
    }
    if (avgDartRate > 0) {
      factors.push({ factor: `OSHA DART rate: ${avgDartRate.toFixed(2)}`, contribution: Math.min(avgDartRate * 4, 20) });
      score += Math.min(avgDartRate * 4, 20);
      sourceConfidence += 0.1;
    }
    factors.push({ factor: `${oshaRecords.length} OSHA establishment(s) matched`, contribution: Math.min(oshaRecords.length * 3, 10) });
    score += Math.min(oshaRecords.length * 3, 10);
  } else {
    missingData.push("No OSHA establishment data available for this employer");
  }

  // BLS benchmark comparison
  if (input.blsBenchmark) {
    const benchmark = input.blsBenchmark;
    if (benchmark.trcRate) {
      const oshaAvgTrc = oshaRecords.length > 0
        ? oshaRecords.reduce((s, r) => s + (r.trcRate ?? 0), 0) / oshaRecords.length
        : 0;
      if (oshaAvgTrc > 0 && benchmark.trcRate > 0) {
        const ratio = oshaAvgTrc / benchmark.trcRate;
        if (ratio > 1.2) {
          factors.push({ factor: `OSHA rate ${ratio.toFixed(1)}x above BLS industry benchmark`, contribution: 15 });
          score += 15;
        } else if (ratio > 1.0) {
          factors.push({ factor: `OSHA rate slightly above BLS benchmark`, contribution: 8 });
          score += 8;
        }
      }
      sourceConfidence += 0.1;
    }
  } else {
    missingData.push("No BLS industry benchmark available for comparison");
  }

  // O*NET occupation mapping
  if (input.onetMapping) {
    const onet = input.onetMapping;
    if (onet.serviceRelevanceTags.length > 0) {
      factors.push({ factor: `${onet.serviceRelevanceTags.length} O*NET service-relevance tag(s)`, contribution: Math.min(onet.serviceRelevanceTags.length * 4, 20) });
      score += Math.min(onet.serviceRelevanceTags.length * 4, 20);
      sourceConfidence += 0.1;

      // Map tags to services
      const serviceMap: Record<string, { service: string; reason: string }> = {
        "fitness-for-duty": { service: "Fitness-for-Duty Exams", reason: "Physical demand indicators from O*NET" },
        "return-to-work": { service: "Return-to-Work Evaluations", reason: "Musculoskeletal/lifting exposure indicators" },
        "functional-capacity": { service: "Functional Capacity Evaluations", reason: "Physical demand indicators from O*NET" },
        "physical-exams": { service: "Physical Examinations", reason: "Physical demand indicators from O*NET" },
        "respirator-clearance": { service: "Respirator Clearance", reason: "Respiratory exposure indicators from O*NET" },
        "pulmonary-function": { service: "PFT/Spirometry", reason: "Respiratory exposure indicators from O*NET" },
        "osha-medical-surveillance": { service: "OSHA Medical Surveillance", reason: "Hazardous exposure indicators from O*NET" },
        "audiograms": { service: "Audiograms", reason: "Noise/hearing exposure indicators from O*NET" },
        "hearing-conservation": { service: "Hearing Conservation Program", reason: "Noise exposure indicators from O*NET" },
        "dot-exams": { service: "DOT/FMCSA Exams", reason: "Transportation/driving role indicators from O*NET" },
        "drug-screens": { service: "Drug Screening", reason: "Transportation/safety-sensitive role indicators" },
        "sleep-apnea-screening": { service: "Sleep Apnea Documentation", reason: "Transportation role indicators from O*NET" },
        "heat-stress-surveillance": { service: "Heat Stress Surveillance", reason: "Outdoor/heat exposure indicators from O*NET" },
        "annual-exams": { service: "Annual Medical Exams", reason: "Environmental exposure indicators from O*NET" },
        "occupational-medical-surveillance": { service: "Occupational Medical Surveillance", reason: "Hazardous exposure indicators from O*NET" },
        "labs": { service: "Occupational Labs", reason: "Hazardous exposure indicators from O*NET" },
        "respirator-evaluations": { service: "Respirator Evaluations", reason: "Respiratory exposure indicators from O*NET" },
      };

      for (const tag of onet.serviceRelevanceTags) {
        const mapping = serviceMap[tag];
        if (mapping) {
          matchedServices.push({
            service: mapping.service,
            reason: mapping.reason,
            fitScore: Math.min(70 + onet.confidence * 30, 100),
          });
        }
      }
    }
  } else {
    missingData.push("No O*NET occupation mapping available");
  }

  // Workers' comp source availability
  if (input.workersCompNotes && !input.workersCompNotes.unavailable) {
    factors.push({ factor: `Workers' comp data available in ${input.workersCompNotes.state}`, contribution: 5 });
    score += 5;
    sourceConfidence += 0.05;
  } else if (input.workersCompNotes?.unavailable) {
    missingData.push(`No workers' comp data sources indexed for ${input.workersCompNotes.state}`);
  }

  // Entity confidence
  if (input.entityConfidence !== undefined) {
    if (input.entityConfidence > 0.7) {
      sourceConfidence += 0.1;
    } else if (input.entityConfidence < 0.4) {
      warnings.push("Low entity match confidence — score may be based on incomplete data");
    }
  }

  // Geographic / service feasibility
  if (input.locationContext) {
    factors.push({ factor: `Geographic context: ${input.locationContext}`, contribution: 5 });
    score += 5;
  }

  // Clamp score
  score = Math.min(Math.round(score), 100);
  sourceConfidence = Math.min(Number(sourceConfidence.toFixed(2)), 1);

  let label: string;
  if (missingData.length >= 3 && score < 20) {
    label = "Insufficient data";
  } else if (score >= 60) {
    label = "High service opportunity signal";
  } else if (score >= 35) {
    label = "Moderate service opportunity signal";
  } else if (score >= 15) {
    label = "Low service opportunity signal";
  } else {
    label = "Needs source review";
  }

  warnings.push("The Occu-Med opportunity score is a business development and research signal, not a safety rating or compliance determination.");

  return {
    score,
    label,
    topFactors: factors.sort((a, b) => b.contribution - a.contribution).slice(0, 10),
    matchedServices: matchedServices.sort((a, b) => b.fitScore - a.fitScore),
    sourceConfidence,
    missingData,
    warnings,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/jobs/normalize
router.post("/jobs/normalize", async (req: Request, res: Response) => {
  try {
    const { jobTitle, jobDescription, company, location } = req.body ?? {};
    if (!jobTitle || typeof jobTitle !== "string") {
      return res.status(400).json({ ok: false, error: "jobTitle is required" });
    }

    const result = await normalizeJobTitle(jobTitle, jobDescription, company, location);
    return res.json({ ok: true, ...result, source: "O*NET Web Services" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "Job normalization failed",
    });
  }
});

// POST /api/employers/resolve
router.post("/employers/resolve", async (req: Request, res: Response) => {
  try {
    const { companyName, dbaNames, location, state, naics } = req.body ?? {};
    if (!companyName || typeof companyName !== "string") {
      return res.status(400).json({ ok: false, error: "companyName is required" });
    }

    const result = await resolveEntity(companyName, dbaNames, location, state, naics);
    return res.json({ ok: true, entity: result, source: "SAM.gov + SEC EDGAR + OSHA + CourtListener" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "Entity resolution failed",
    });
  }
});

// GET /api/osha/establishments
router.get("/osha/establishments", async (req: Request, res: Response) => {
  try {
    const company = String(req.query?.company || "").trim();
    const state = String(req.query?.state || "").trim();
    const naics = String(req.query?.naics || "").trim();
    const year = String(req.query?.year || "").trim();

    const result = await queryOshaEstablishments(
      company || undefined,
      state || undefined,
      naics || undefined,
      year || undefined,
    );

    return res.json({
      ok: true,
      records: result.records,
      count: result.count,
      source: result.dataSource === "database" ? "OSHA ITA (Postgres)" : "OSHA ITA (not imported)",
      importEnabled: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
      importRuns: result.importRuns,
      dataSource: result.dataSource,
      warning: result.warning,
      sourceUrl: "https://www.osha.gov/establishment-specific-injury-and-illness-data",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "OSHA establishment query failed",
    });
  }
});

// GET /api/bls/industry-benchmark
router.get("/bls/industry-benchmark", async (req: Request, res: Response) => {
  try {
    const naics = String(req.query?.naics || "").trim();
    const year = String(req.query?.year || "").trim();

    if (!naics) {
      return res.status(400).json({ ok: false, error: "naics query parameter is required" });
    }

    const blsResult = await fetchBlsBenchmarkService(naics, year);

    if (!blsResult.benchmark) {
      return res.json({
        ok: true,
        benchmark: null,
        message: blsResult.reason,
        configured: blsResult.configured,
        enabled: blsResult.enabled,
        authMode: blsResult.authMode,
        attempted: blsResult.attempted,
        attemptedSeriesIds: blsResult.attemptedSeriesIds,
      });
    }

    return res.json({
      ok: true,
      benchmark: blsResult.benchmark,
      source: blsResult.benchmark.source,
      sourceUrl: blsResult.benchmark.sourceUrl,
      apiDocsUrl: blsResult.benchmark.apiDocsUrl,
      developerDocsUrl: blsResult.benchmark.developerDocsUrl,
      limitation: blsResult.benchmark.limitation,
      configured: blsResult.configured,
      enabled: blsResult.enabled,
      authMode: blsResult.authMode,
      attempted: blsResult.attempted,
      attemptedSeriesIds: blsResult.attemptedSeriesIds,
      message: blsResult.reason,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "BLS benchmark query failed",
    });
  }
});

// GET /api/workers-comp/sources
router.get("/workers-comp/sources", (req: Request, res: Response) => {
  try {
    const state = String(req.query?.state || "").trim();
    if (!state) {
      return res.status(400).json({ ok: false, error: "state query parameter is required" });
    }

    const sourceInfo = getWorkersCompSources(state);
    return res.json({
      ok: true,
      ...sourceInfo,
      source: "State workers' compensation agencies + CDC/NIOSH source index",
      disclaimer: "There is no single complete national workers' compensation database. State coverage varies significantly.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "Workers' comp source query failed",
    });
  }
});

// POST /api/opportunity/score
router.post("/opportunity/score", async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      oshaEstablishments,
      blsBenchmark,
      onetMapping,
      workersCompNotes,
      locationContext,
      entityConfidence,
    } = req.body ?? {};

    if (!companyName || typeof companyName !== "string") {
      return res.status(400).json({ ok: false, error: "companyName is required" });
    }

    const result = calculateOpportunityScore({
      companyName,
      oshaEstablishments,
      blsBenchmark,
      onetMapping,
      workersCompNotes,
      locationContext,
      entityConfidence,
    });

    return res.json({ ok: true, ...result, source: "Occu-Med Service Opportunity Scoring Engine" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "Opportunity scoring failed",
    });
  }
});

// GET /api/hhs/catalog/search
router.get("/hhs/catalog/search", async (req: Request, res: Response) => {
  try {
    if (!isHhsCatalogEnabled()) {
      return res.json({
        ok: true,
        datasets: [],
        total: 0,
        page: 1,
        pageSize: 20,
        authMode: "public",
        domain: "healthdata.gov",
        message: "HHS catalog discovery is disabled. Set HHS_CATALOG_ENABLED=true to enable.",
      });
    }

    const query = String(req.query?.query || "").trim();
    const page = Number(req.query?.page) || 1;
    const pageSize = Number(req.query?.pageSize) || 20;
    const sortBy = String(req.query?.sortBy || "newest").trim();

    const result = await searchHhsCatalog({ query: query || undefined, page, pageSize, sortBy });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || sanitizeHhsError(error) || "HHS catalog search failed",
    });
  }
});

// GET /api/hhs/catalog/datasets/:id
router.get("/hhs/catalog/datasets/:id", async (req: Request, res: Response) => {
  try {
    if (!isHhsCatalogEnabled()) {
      return res.json({
        ok: true,
        dataset: null,
        authMode: "public",
        message: "HHS catalog discovery is disabled. Set HHS_CATALOG_ENABLED=true to enable.",
      });
    }

    const id = String(req.params?.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Dataset id is required" });
    }

    const result = await getHhsDataset(id);

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || sanitizeHhsError(error) || "HHS dataset lookup failed",
    });
  }
});

// GET /api/hhs/catalog/status
router.get("/hhs/catalog/status", (_req: Request, res: Response) => {
  try {
    const status = getHhsCatalogStatus();
    return res.json({ ok: true, ...status });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "HHS catalog status failed",
    });
  }
});

// GET /api/cms/provider-data/search
router.get("/cms/provider-data/search", async (req: Request, res: Response) => {
  try {
    if (!isCmsEnabled()) {
      return res.json({
        ok: true,
        datasets: [],
        total: 0,
        page: 1,
        pageSize: 20,
        authMode: "public",
        baseUrl: "https://data.cms.gov/provider-data/api/1",
        message: "CMS Provider Data catalog is disabled. Set CMS_PROVIDER_DATA_ENABLED=true to enable.",
      });
    }

    const query = String(req.query?.query || "").trim();
    const page = Number(req.query?.page) || 1;
    const pageSize = Number(req.query?.pageSize) || 20;
    const sort = String(req.query?.sort || "").trim() || undefined;

    const result = await searchCmsProviderCatalog({ query: query || undefined, page, pageSize, sort });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || sanitizeCmsError(error) || "CMS catalog search failed",
    });
  }
});

// GET /api/cms/provider-data/datasets/:identifier
router.get("/cms/provider-data/datasets/:identifier", async (req: Request, res: Response) => {
  try {
    if (!isCmsEnabled()) {
      return res.json({
        ok: true, dataset: null, authMode: "public", message: "CMS Provider Data catalog is disabled." });
    }

    const identifier = String(req.params?.identifier || "").trim();
    if (!identifier) {
      return res.status(400).json({ ok: false, error: "Dataset identifier is required" });
    }

    const result = await getCmsProviderDataset(identifier);

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || sanitizeCmsError(error) || "CMS dataset lookup failed",
    });
  }
});

// GET /api/cms/provider-data/datastore/imports/:identifier
router.get("/cms/provider-data/datastore/imports/:identifier", async (req: Request, res: Response) => {
  try {
    if (!isCmsEnabled()) {
      return res.json({ ok: true, identifier: "", message: "CMS Provider Data catalog is disabled." });
    }

    const identifier = String(req.params?.identifier || "").trim();
    if (!identifier) {
      return res.status(400).json({ ok: false, error: "Dataset identifier is required" });
    }

    const result = await getCmsProviderDatastoreStats(identifier);

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || sanitizeCmsError(error) || "CMS datastore stats failed",
    });
  }
});

// POST /api/cms/provider-data/datastore/query
router.post("/cms/provider-data/datastore/query", async (req: Request, res: Response) => {
  try {
    if (!isCmsEnabled()) {
      return res.json({ ok: true, results: [], limit: 100, offset: 0, message: "CMS Provider Data catalog is disabled." });
    }

    const body = req.body as {
      distributionId?: string;
      datasetId?: string;
      index?: string;
      conditions?: Record<string, unknown>[];
      limit?: number;
      offset?: number;
      sorts?: string[];
    } || {};

    const result = await queryCmsProviderDatastore({
      distributionId: body.distributionId,
      datasetId: body.datasetId,
      index: body.index,
      conditions: body.conditions,
      limit: body.limit,
      offset: body.offset,
      sorts: body.sorts,
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || sanitizeCmsError(error) || "CMS datastore query failed",
    });
  }
});

// GET /api/cms/provider-data/status
router.get("/cms/provider-data/status", (_req: Request, res: Response) => {
  try {
    const status = getCmsProviderDataStatus();
    return res.json({ ok: true, ...status });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "CMS provider data status failed",
    });
  }
});

// GET /api/sources/status
router.get("/sources/status", async (_req: Request, res: Response) => {
  try {
    const [oshaImportInfo, oshaDataImported] = await Promise.all([getOshaImportInfo(), isOshaDataImported()]);
    const oshaRefreshCron = getEnv("OSHA_DATA_REFRESH_CRON");

    const statuses: SourceStatus[] = [
      {
        source: "O*NET Web Services",
        configured: isOnetConfigured(),
        enabled: true,
        dataType: isOnetConfigured() ? "live-api" : "not-configured",
        notes: "Occupation mapping, job context, physical/cognitive/safety demands",
      },
      {
        source: "BLS IIF",
        configured: !!getEnv("BLS_API_KEY"),
        enabled: true,
        dataType: !!getEnv("BLS_API_KEY") ? "live-api" : isTruthy(getEnv("BLS_IMPORT_ENABLED")) ? "cached-import" : "live-api",
        notes: `BLS IIF/SOII industry benchmark rates. Auth mode: ${getBlsServiceStatus().authMode}. Series ID mapping may need correction for specific NAICS codes.`,
      },
      {
        source: "SAM.gov Entity API",
        configured: !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY"),
        enabled: !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY"),
        dataType: !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY") ? "live-api" : "not-configured",
        notes: "Federal contractor entity resolution, UEI/CAGE, DBA names",
      },
      {
        source: "CourtListener",
        configured: !!getEnv("COURTLISTENER_API_TOKEN"),
        enabled: !!getEnv("COURTLISTENER_API_TOKEN"),
        dataType: !!getEnv("COURTLISTENER_API_TOKEN") ? "live-api" : "not-configured",
        notes: "Workplace injury litigation signals (supporting signal only)",
      },
      {
        source: "OSHA ITA",
        configured: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
        enabled: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
        dataType: oshaDataImported ? "database-import" : isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")) ? "database-import" : "not-configured",
        lastSync: oshaImportInfo.importRuns.length > 0 ? oshaImportInfo.importRuns[oshaImportInfo.importRuns.length - 1].importedAt : undefined,
        nextRefresh: oshaRefreshCron || undefined,
        notes: oshaDataImported
          ? `Establishment-level injury/illness data (${oshaImportInfo.totalRecords} records from ${oshaImportInfo.importRuns.length} dataset(s)). Persisted in Postgres.`
          : "Import enabled but no dataset imported yet. Download OSHA ITA CSV files and run scripts/import-osha.ts.",
      },
      {
        source: "USAspending",
        configured: isTruthy(getEnv("USASPENDING_API_ENABLED")),
        enabled: isTruthy(getEnv("USASPENDING_API_ENABLED")),
        dataType: isTruthy(getEnv("USASPENDING_API_ENABLED")) ? "live-api" : "not-configured",
        notes: "Federal contract award footprint (optional, not an injury source)",
      },
      {
        source: "CDC/NIOSH Socrata",
        configured: !!getEnv("CDC_SOCRATA_APP_TOKEN"),
        enabled: !!getEnv("CDC_SOCRATA_APP_TOKEN"),
        dataType: !!getEnv("CDC_SOCRATA_APP_TOKEN") ? "live-api" : "not-configured",
        notes: "Occupational health datasets, workers' comp source discovery",
      },
      {
        source: "HHS / HealthData.gov Catalog",
        configured: !!getEnv("HHS_SOCRATA_APP_TOKEN"),
        enabled: isHhsCatalogEnabled(),
        dataType: isHhsCatalogEnabled() ? "live-api" : "not-configured",
        notes: `Public HealthData.gov catalog discovery; auth mode: ${getHhsCatalogStatus().authMode}. App token optional for higher rate limits.`,
      },
      {
        source: "CMS Provider Data",
        configured: isCmsEnabled(),
        enabled: isCmsEnabled(),
        dataType: isCmsEnabled() ? "live-api" : "not-configured",
        notes: "CMS Provider Data Catalog public DKAN API; provider/facility density, healthcare access gaps, service feasibility context.",
      },
      {
        source: "HRSA",
        configured: !!getEnv("HRSA_API_KEY"),
        enabled: !!getEnv("HRSA_API_KEY"),
        dataType: !!getEnv("HRSA_API_KEY") ? "live-api" : "not-configured",
        notes: "Rural/underserved area identification, service feasibility",
      },
      {
        source: "SEC EDGAR",
        configured: !!getEnv("SEC_USER_AGENT"),
        enabled: !!getEnv("SEC_USER_AGENT"),
        dataType: !!getEnv("SEC_USER_AGENT") ? "live-api" : "not-configured",
        notes: "Public company aliases, CIK/ticker, corporate relationships",
      },
      {
        source: "FEC",
        configured: !!getEnv("FEC_API_KEY"),
        enabled: !!getEnv("FEC_API_KEY"),
        dataType: !!getEnv("FEC_API_KEY") ? "live-api" : "not-configured",
        notes: "Supplemental entity/context layer (low priority)",
      },
      {
        source: "Workers' Comp Source Index",
        configured: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")),
        enabled: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")),
        dataType: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")) ? "static-index" : "not-configured",
        notes: "State-by-state workers' comp dataset availability index",
      },
    ];

    return res.json({ ok: true, sources: statuses });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error) || "Source status query failed",
    });
  }
});

export default router;
