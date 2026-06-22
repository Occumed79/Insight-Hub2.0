import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

type OshaEstablishment = {
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
  lastImportedDate: string;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
};

type BlsBenchmark = {
  naics: string;
  industryTitle: string;
  year: number;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
  fatalityRate?: number;
  sourceUrl: string;
  sourceMetadata: string;
};

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

function safeFetch(url: string, options?: RequestInit): Promise<unknown | null> {
  return fetch(url, options).then((r) => {
    if (!r.ok) return null;
    return r.json() as Promise<unknown>;
  }).catch(() => null);
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

// ─── OSHA Connector ──────────────────────────────────────────────────────────

function calculateRate(cases: number, hours: number): number | undefined {
  if (!hours || hours === 0) return undefined;
  return Number((cases * 200000 / hours).toFixed(2));
}

function getOshaEstablishments(company?: string, state?: string, naics?: string, year?: string): OshaEstablishment[] {
  // OSHA ITA does not have a key-based API. This is a cached/import connector.
  // Return empty array if import is not enabled or no cached data available.
  const importEnabled = isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED"));
  if (!importEnabled) return [];

  // In production, this would query a cached OSHA ITA database table.
  // For now, return empty — the frontend will show "no data" with appropriate warnings.
  return [];
}

// ─── BLS Connector ───────────────────────────────────────────────────────────

async function fetchBlsBenchmark(naics: string, year?: string): Promise<BlsBenchmark | null> {
  const apiKey = getEnv("BLS_API_KEY");
  const importEnabled = isTruthy(getEnv("BLS_IMPORT_ENABLED"));
  if (!importEnabled && !apiKey) return null;

  const targetYear = year || String(new Date().getFullYear() - 1);
  const seriesId = `IIU${naics.padStart(6, "0")}`;

  try {
    const params = new URLSearchParams({
      seriesid: seriesId,
      startyear: targetYear,
      endyear: targetYear,
    });
    if (apiKey) params.set("registrationkey", apiKey);

    const data = await safeFetch(`https://api.bls.gov/publicAPI/v2/timeseries/data/?${params}`);
    if (!data) return null;

    const payload = data as Record<string, unknown>;
    const results = payload?.Results as Record<string, unknown> | undefined;
    const series = results?.series as Array<Record<string, unknown>> | undefined;
    if (!series || series.length === 0) return null;

    const seriesData = series[0];
    const dataPoints = seriesData?.data as Array<Record<string, unknown>> | undefined;
    if (!dataPoints || dataPoints.length === 0) return null;

    const latest = dataPoints[0];
    return {
      naics,
      industryTitle: String(seriesData?.seriesTitle ?? `NAICS ${naics}`),
      year: Number(latest?.year || targetYear),
      trcRate: latest?.value ? Number(latest.value) : undefined,
      sourceUrl: "https://www.bls.gov/iif/",
      sourceMetadata: "U.S. Bureau of Labor Statistics, Injuries, Illnesses, and Fatalities (IIF) program",
    };
  } catch {
    return null;
  }
}

// ─── SAM.gov Connector ───────────────────────────────────────────────────────

async function fetchSamEntity(companyName: string): Promise<Record<string, unknown> | null> {
  const apiKey = getEnv("SAM_API_KEY") || getEnv("SAM_GOV_API_KEY");
  if (!apiKey) return null;

  try {
    const data = await safeFetch(
      `https://api.sam.gov/entity-information/v3/entities?api_key=${encodeURIComponent(apiKey)}&legalBusinessName=${encodeURIComponent(companyName)}&registrationStatus=A`,
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
    const data = await safeFetch(
      `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(companyName)}&dateRange=custom&startdt=2020-01-01&enddt=${new Date().toISOString().split("T")[0]}`,
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
    const data = await safeFetch(
      `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(companyName)}+workplace+injury+OR+workers+compensation+OR+OSHA&court_type=d`,
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

async function normalizeJobTitle(
  title: string,
  description?: string,
  company?: string,
  location?: string,
): Promise<JobNormalization> {
  const apiKey = getEnv("ONET_API_KEY");
  if (!apiKey) {
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
    const searchData = await safeFetch(
      `https://services.onetcenter.org/ws/mnm/search?keyword=${encodeURIComponent(title)}`,
      { headers: { Accept: "application/json", "X-API-Key": apiKey } },
    );
    if (!searchData) {
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

    const payload = searchData as Record<string, unknown>;
    const occupations = (payload?.occupation ?? []) as Array<Record<string, unknown>>;
    const matches = occupations.slice(0, 5).map((o) => ({
      title: String(o.title ?? ""),
      code: String(o.code ?? ""),
      score: typeof o.relevance === "number" ? Number(o.relevance) : undefined,
    })).filter((m) => m.code && m.title);

    if (matches.length === 0) {
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

    // Fetch top match details for indicators
    const topCode = matches[0].code;
    const [detailsResult, contextResult] = await Promise.allSettled([
      safeFetch(
        `https://services.onetcenter.org/ws/online/occupation/${encodeURIComponent(topCode)}/details`,
        { headers: { Accept: "application/json", "X-API-Key": apiKey } },
      ),
      safeFetch(
        `https://services.onetcenter.org/ws/online/occupations/${encodeURIComponent(topCode)}/work_context`,
        { headers: { Accept: "application/json", "X-API-Key": apiKey } },
      ),
    ]);

    const details = detailsResult.status === "fulfilled" && detailsResult.value ? detailsResult.value as Record<string, unknown> : {};
    const contextData = contextResult.status === "fulfilled" && contextResult.value ? contextResult.value as Record<string, unknown> : {};

    const workContext = (contextData?.element ?? []) as Array<Record<string, unknown>>;
    const abilities = (details?.abilities ?? []) as Array<Record<string, unknown>>;
    const workActivities = (details?.work_activities ?? []) as Array<Record<string, unknown>>;

    const physicalIndicators: string[] = [];
    const environmentalIndicators: string[] = [];
    const safetyIndicators: string[] = [];
    const serviceTags: string[] = [];

    for (const ctx of workContext) {
      const name = String(ctx.name ?? ctx.element_name ?? "").toLowerCase();
      const responseArr = ctx.response as Array<Record<string, unknown>> | undefined;
      const value = String(responseArr?.[0]?.name ?? ctx.value ?? "");

      if (/spend time standing|spend time walking|spend time bending|kneeling|crawling|climbing|lifting|carrying|reaching|using hands|repetitive motions|keeping.*balance/.test(name)) {
        physicalIndicators.push(`${ctx.name ?? ctx.element_name}: ${value}`);
      }
      if (/outdoors|exposed to weather|exposed to contaminants|exposed to hazardous|exposed to noise|exposed to vibration|exposed to heat|exposed to cold|exposed to radiation/.test(name)) {
        environmentalIndicators.push(`${ctx.name ?? ctx.element_name}: ${value}`);
      }
      if (/wear.*protective|responsible for others.*safety|exposed to hazardous equipment|exposed to high places|exposed to disease|exposed to infection/.test(name)) {
        safetyIndicators.push(`${ctx.name ?? ctx.element_name}: ${value}`);
      }
    }

    // Derive service relevance tags
    const allContext = physicalIndicators.join(" ") + " " + environmentalIndicators.join(" ") + " " + safetyIndicators.join(" ");
    if (/lifting|carrying|material handling|musculoskeletal|strength|standing|walking|bending/.test(allContext.toLowerCase())) {
      serviceTags.push("fitness-for-duty", "return-to-work", "functional-capacity", "physical-exams");
    }
    if (/respirator|respiratory|contaminants|chemical|fumes|dust/.test(allContext.toLowerCase())) {
      serviceTags.push("respirator-clearance", "pulmonary-function", "osha-medical-surveillance");
    }
    if (/noise|hearing|auditory/.test(allContext.toLowerCase())) {
      serviceTags.push("audiograms", "hearing-conservation");
    }
    if (/driving|vehicle|transportation|truck|bus/.test(allContext.toLowerCase())) {
      serviceTags.push("dot-exams", "drug-screens", "sleep-apnea-screening");
    }
    if (/outdoor|heat|weather|hot|cold/.test(allContext.toLowerCase())) {
      serviceTags.push("heat-stress-surveillance", "annual-exams");
    }
    if (/hazardous|dangerous|protective equipment|safety equipment/.test(allContext.toLowerCase())) {
      serviceTags.push("occupational-medical-surveillance", "labs", "respirator-evaluations");
    }

    // Determine occupation family from SOC code prefix
    const socPrefix = topCode.split("-")[0];
    const familyMap: Record<string, string> = {
      "11": "Management",
      "13": "Business and Financial Operations",
      "15": "Computer and Mathematical",
      "17": "Architecture and Engineering",
      "19": "Life, Physical, and Social Science",
      "21": "Community and Social Service",
      "23": "Legal",
      "25": "Education, Training, and Library",
      "27": "Arts, Design, Entertainment, Sports, and Media",
      "29": "Healthcare Practitioners",
      "31": "Healthcare Support",
      "33": "Protective Service",
      "35": "Food Preparation and Serving",
      "37": "Building and Grounds Cleaning and Maintenance",
      "39": "Personal Care and Service",
      "41": "Sales and Related",
      "43": "Office and Administrative Support",
      "45": "Farming, Fishing, and Forestry",
      "47": "Construction and Extraction",
      "49": "Installation, Maintenance, and Repair",
      "51": "Production",
      "53": "Transportation and Material Moving",
    };
    const occupationFamily = familyMap[socPrefix] || "Other";

    const confidence = matches.length > 0 && matches[0].score ? Math.min(matches[0].score / 100, 1) : 0.5;

    return {
      inputTitle: title,
      occupationMatches: matches,
      socCode: topCode,
      occupationFamily,
      physicalDemandIndicators: physicalIndicators.slice(0, 10),
      environmentalIndicators: environmentalIndicators.slice(0, 10),
      safetySensitiveIndicators: safetyIndicators.slice(0, 10),
      serviceRelevanceTags: Array.from(new Set(serviceTags)),
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
  const oshaRecords = getOshaEstablishments(companyName, state, naics);
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
      error: error instanceof Error ? error.message : "Job normalization failed",
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
      error: error instanceof Error ? error.message : "Entity resolution failed",
    });
  }
});

// GET /api/osha/establishments
router.get("/osha/establishments", (req: Request, res: Response) => {
  try {
    const company = String(req.query?.company || "").trim();
    const state = String(req.query?.state || "").trim();
    const naics = String(req.query?.naics || "").trim();
    const year = String(req.query?.year || "").trim();

    const records = getOshaEstablishments(
      company || undefined,
      state || undefined,
      naics || undefined,
      year || undefined,
    );

    return res.json({
      ok: true,
      records,
      count: records.length,
      source: "OSHA ITA (cached/imported)",
      importEnabled: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
      warning: "OSHA/public injury data must not be used by the app to declare a company unsafe, negligent, dangerous, or noncompliant. The module should only surface service opportunity signals and data requiring human review.",
      sourceUrl: "https://www.osha.gov/establishment-specific-injury-and-illness-data",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "OSHA establishment query failed",
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

    const benchmark = await fetchBlsBenchmark(naics, year);

    if (!benchmark) {
      const apiKey = getEnv("BLS_API_KEY");
      const importEnabled = isTruthy(getEnv("BLS_IMPORT_ENABLED"));
      return res.json({
        ok: true,
        benchmark: null,
        message: !apiKey && !importEnabled
          ? "BLS API key not configured and import not enabled. Set BLS_API_KEY or enable BLS_IMPORT_ENABLED."
          : "No BLS benchmark data found for the specified NAICS/year.",
        configured: !!apiKey || importEnabled,
      });
    }

    return res.json({ ok: true, benchmark, source: "U.S. Bureau of Labor Statistics (IIF)" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "BLS benchmark query failed",
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
      error: error instanceof Error ? error.message : "Workers' comp source query failed",
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
      error: error instanceof Error ? error.message : "Opportunity scoring failed",
    });
  }
});

// GET /api/sources/status
router.get("/sources/status", (_req: Request, res: Response) => {
  try {
    const statuses: SourceStatus[] = [
      {
        source: "O*NET Web Services",
        configured: !!getEnv("ONET_API_KEY"),
        enabled: true,
        notes: "Occupation mapping, job context, physical/cognitive/safety demands",
      },
      {
        source: "BLS IIF",
        configured: !!getEnv("BLS_API_KEY"),
        enabled: isTruthy(getEnv("BLS_IMPORT_ENABLED")) || !!getEnv("BLS_API_KEY"),
        notes: "Industry injury/illness benchmark rates by NAICS",
      },
      {
        source: "SAM.gov Entity API",
        configured: !!getEnv("SAM_API_KEY") || !!getEnv("SAM_GOV_API_KEY"),
        enabled: true,
        notes: "Federal contractor entity resolution, UEI/CAGE, DBA names",
      },
      {
        source: "CourtListener",
        configured: !!getEnv("COURTLISTENER_API_TOKEN"),
        enabled: true,
        notes: "Workplace injury litigation signals (supporting signal only)",
      },
      {
        source: "OSHA ITA",
        configured: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
        enabled: isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")),
        notes: "Establishment-level injury/illness data (cached import, no API key)",
      },
      {
        source: "USAspending",
        configured: isTruthy(getEnv("USASPENDING_API_ENABLED")),
        enabled: isTruthy(getEnv("USASPENDING_API_ENABLED")),
        notes: "Federal contract award footprint (optional, not an injury source)",
      },
      {
        source: "CDC/NIOSH Socrata",
        configured: !!getEnv("CDC_SOCRATA_APP_TOKEN"),
        enabled: !!getEnv("CDC_SOCRATA_APP_TOKEN"),
        notes: "Occupational health datasets, workers' comp source discovery",
      },
      {
        source: "HHS Socrata",
        configured: !!getEnv("HHS_SOCRATA_APP_TOKEN"),
        enabled: !!getEnv("HHS_SOCRATA_APP_TOKEN"),
        notes: "Public health context, environmental data",
      },
      {
        source: "CMS Data",
        configured: !!getEnv("CMS_DATA_API_KEY"),
        enabled: !!getEnv("CMS_DATA_API_KEY"),
        notes: "Provider/facility density, healthcare access gaps",
      },
      {
        source: "HRSA",
        configured: !!getEnv("HRSA_API_KEY"),
        enabled: !!getEnv("HRSA_API_KEY"),
        notes: "Rural/underserved area identification, service feasibility",
      },
      {
        source: "SEC EDGAR",
        configured: !!getEnv("SEC_USER_AGENT"),
        enabled: !!getEnv("SEC_USER_AGENT"),
        notes: "Public company aliases, CIK/ticker, corporate relationships",
      },
      {
        source: "FEC",
        configured: !!getEnv("FEC_API_KEY"),
        enabled: !!getEnv("FEC_API_KEY"),
        notes: "Supplemental entity/context layer (low priority)",
      },
      {
        source: "Workers' Comp Source Index",
        configured: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")),
        enabled: isTruthy(getEnv("WORKERS_COMP_SOURCE_INDEX_ENABLED")),
        notes: "State-by-state workers' comp dataset availability index",
      },
    ];

    return res.json({ ok: true, sources: statuses });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Source status query failed",
    });
  }
});

export default router;
