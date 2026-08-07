import { Router, type IRouter, type Request, type Response } from "express";
import { getOshaImportInfo, isOshaDataImported } from "../services/oshaDataService";
import { getBlsStatus } from "../services/blsService";
import { isConfigured as isOnetConfigured } from "../services/onetService";

const router: IRouter = Router();

type SourceCategory = "injury" | "occupation" | "entity" | "company" | "workers-comp" | "dba";
type SourceMode = "live-api" | "manual-live" | "database-import" | "static-index" | "official-workbook";
type SourceState = "ready" | "partial" | "disabled" | "not-configured";
type ConfidenceTier = "high" | "moderate" | "context-only";

type GovernedSource = {
  id: string;
  label: string;
  authority: string;
  category: SourceCategory;
  mode: SourceMode;
  workspaces: string[];
  configured: boolean;
  enabled: boolean;
  state: SourceState;
  environmentKeys: string[];
  internalEndpoint: string;
  sourceUrl: string;
  provenance: {
    official: boolean;
    serverSide: boolean;
    reviewRequired: boolean;
    evidenceUnit: string;
  };
  confidence: {
    tier: ConfidenceTier;
    rationale: string;
  };
  freshness: {
    policy: string;
    lastKnown?: string;
  };
  limitations: string[];
  safeguards: string[];
};

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function sourceState(configured: boolean, enabled: boolean, partial = false): SourceState {
  if (!enabled) return "disabled";
  if (partial) return "partial";
  return configured ? "ready" : "not-configured";
}

async function getRegistry(): Promise<GovernedSource[]> {
  const [oshaImported, oshaInfo] = await Promise.all([isOshaDataImported(), getOshaImportInfo()]);
  const latestOshaRun = oshaInfo.importRuns.at(-1)?.importedAt;
  const oshaEnabled = truthy(process.env.OSHA_ITA_IMPORT_ENABLED) || oshaImported;

  const blsStatus = getBlsStatus();
  const blsConfigured = Boolean(process.env.BLS_API_KEY) || blsStatus.authMode === "public-v1";
  const samConfigured = Boolean(process.env.SAM_API_KEY || process.env.SAM_GOV_API_KEY);
  const secConfigured = Boolean(process.env.SEC_USER_AGENT);
  const courtConfigured = Boolean(process.env.COURTLISTENER_API_TOKEN);
  const usaSpendingEnabled = truthy(process.env.USASPENDING_API_ENABLED);
  const workersCompEnabled = truthy(process.env.WORKERS_COMP_SOURCE_INDEX_ENABLED);

  return [
    {
      id: "osha-ita",
      label: "OSHA Injury Tracking Application",
      authority: "U.S. Department of Labor — OSHA",
      category: "injury",
      mode: "database-import",
      workspaces: ["Employer Intelligence", "Entity Resolution", "Exposure Matrix"],
      configured: oshaImported,
      enabled: oshaEnabled,
      state: sourceState(oshaImported, oshaEnabled),
      environmentKeys: ["OSHA_ITA_IMPORT_ENABLED", "DATABASE_URL"],
      internalEndpoint: "/api/osha/establishments",
      sourceUrl: "https://www.osha.gov/Establishment-Specific-Injury-and-Illness-Data",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "OSHA establishment-year record" },
      confidence: { tier: "high", rationale: "Official establishment submissions, subject to reporting scope, name matching, and year coverage." },
      freshness: { policy: "Transactional database import", lastKnown: latestOshaRun },
      limitations: ["Not every employer or establishment is required to submit.", "Entity-name matching can be incomplete or ambiguous.", "Records describe reported establishments and reporting years, not current legal conclusions."],
      safeguards: ["No automatic refresh", "No unsafe-employer conclusion", "Visible match confidence"],
    },
    {
      id: "bls-iif",
      label: "BLS IIF / SOII Benchmarks",
      authority: "U.S. Bureau of Labor Statistics",
      category: "injury",
      mode: "live-api",
      workspaces: ["Employer Intelligence", "Exposure Matrix"],
      configured: blsConfigured,
      enabled: true,
      state: sourceState(blsConfigured, true, !blsConfigured),
      environmentKeys: ["BLS_API_KEY", "BLS_AUTH_MODE", "BLS_SERIES_MAPPING_ENABLED"],
      internalEndpoint: "/api/bls/benchmark",
      sourceUrl: "https://www.bls.gov/iif/",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "Industry benchmark series" },
      confidence: { tier: "moderate", rationale: "Official industry estimates; they are contextual benchmarks rather than employer-level measurements." },
      freshness: { policy: "Queried on demand; publication cadence controlled by BLS" },
      limitations: ["Industry averages do not establish an individual employer's rate.", "NAICS-to-series mapping can require review.", "Some detailed estimates may be unavailable or suppressed."],
      safeguards: ["Server-side API", "Benchmark-only labeling", "No employer fault inference"],
    },
    {
      id: "onet",
      label: "O*NET Web Services",
      authority: "U.S. Department of Labor — O*NET",
      category: "occupation",
      mode: "live-api",
      workspaces: ["Job Intelligence", "Exposure Matrix", "Employer Intelligence"],
      configured: isOnetConfigured(),
      enabled: true,
      state: sourceState(isOnetConfigured(), true),
      environmentKeys: ["ONET_API_KEY"],
      internalEndpoint: "/api/onet",
      sourceUrl: "https://www.onetcenter.org/web_services.html",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "Occupation and work-context element" },
      confidence: { tier: "moderate", rationale: "Authoritative occupation taxonomy and work-context data, but job-title normalization remains probabilistic." },
      freshness: { policy: "Queried on demand" },
      limitations: ["Job titles can map to multiple occupations.", "Employer-specific duties may differ from occupational norms.", "Service matching is interpretive and requires review."],
      safeguards: ["Visible occupation matches", "No medical determination", "No job-danger conclusion"],
    },
    {
      id: "sam",
      label: "SAM.gov Entity API",
      authority: "U.S. General Services Administration",
      category: "entity",
      mode: "live-api",
      workspaces: ["Entity Resolution", "Employer Intelligence", "Company Live Intel"],
      configured: samConfigured,
      enabled: samConfigured,
      state: sourceState(samConfigured, samConfigured),
      environmentKeys: ["SAM_GOV_API_KEY", "SAM_API_KEY"],
      internalEndpoint: "/api/company/live-intelligence",
      sourceUrl: "https://sam.gov/content/entity-information",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "Federal entity-registration result" },
      confidence: { tier: "high", rationale: "Strong identity evidence when legal name, identifiers, and address align; absence is not proof an entity does not exist." },
      freshness: { policy: "Manual scan only" },
      limitations: ["Registration coverage is federal-purpose specific.", "Inactive or differently named entities may not appear.", "Name-only matches require corroboration."],
      safeguards: ["Manual request", "Secret-safe server adapter", "Evidence-field matching"],
    },
    {
      id: "sec-edgar",
      label: "SEC EDGAR",
      authority: "U.S. Securities and Exchange Commission",
      category: "company",
      mode: "manual-live",
      workspaces: ["Entity Resolution", "Company Live Intel"],
      configured: secConfigured,
      enabled: secConfigured,
      state: sourceState(secConfigured, secConfigured),
      environmentKeys: ["SEC_USER_AGENT"],
      internalEndpoint: "/api/company/live-intelligence",
      sourceUrl: "https://www.sec.gov/edgar/search/",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "Public company filing/search result" },
      confidence: { tier: "high", rationale: "Strong for public-company identity and filings when entity identifiers align." },
      freshness: { policy: "Manual scan only; filing availability controlled by SEC" },
      limitations: ["Private companies may have no SEC record.", "Search results can include similarly named entities.", "A filing mention does not establish operational relevance."],
      safeguards: ["Manual request", "Required user-agent", "No filing-based risk conclusion"],
    },
    {
      id: "courtlistener",
      label: "CourtListener",
      authority: "Free Law Project",
      category: "company",
      mode: "manual-live",
      workspaces: ["Company Live Intel", "Entity Resolution"],
      configured: courtConfigured,
      enabled: courtConfigured,
      state: sourceState(courtConfigured, courtConfigured),
      environmentKeys: ["COURTLISTENER_API_TOKEN"],
      internalEndpoint: "/api/company/live-intelligence",
      sourceUrl: "https://www.courtlistener.com/",
      provenance: { official: false, serverSide: true, reviewRequired: true, evidenceUnit: "Public legal-reference search result" },
      confidence: { tier: "context-only", rationale: "Useful discovery signal; names, allegations, parties, and outcomes require direct legal-document review." },
      freshness: { policy: "Manual scan only" },
      limitations: ["Search results can be unrelated or incomplete.", "A reference does not establish wrongdoing or liability.", "Coverage varies by court and document availability."],
      safeguards: ["Supporting signal only", "No liability inference", "Source link preserved"],
    },
    {
      id: "usaspending",
      label: "USAspending",
      authority: "U.S. Department of the Treasury",
      category: "company",
      mode: "manual-live",
      workspaces: ["Company Live Intel", "Entity Resolution"],
      configured: true,
      enabled: usaSpendingEnabled,
      state: sourceState(true, usaSpendingEnabled),
      environmentKeys: ["USASPENDING_API_ENABLED"],
      internalEndpoint: "/api/company/live-intelligence",
      sourceUrl: "https://www.usaspending.gov/",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "Federal award record" },
      confidence: { tier: "context-only", rationale: "Useful for federal-award footprint and geography, not occupational risk or procurement opportunity." },
      freshness: { policy: "Manual scan only" },
      limitations: ["Award data is not injury evidence.", "Recipient naming and hierarchy can vary.", "Federal awards do not establish current workforce location."],
      safeguards: ["Footprint context only", "No procurement scoring", "Manual request"],
    },
    {
      id: "workers-comp-index",
      label: "State Workers’ Compensation Source Index",
      authority: "State agencies and official publications",
      category: "workers-comp",
      mode: "static-index",
      workspaces: ["Workers’ Comp Coverage", "Employer Intelligence"],
      configured: true,
      enabled: workersCompEnabled,
      state: sourceState(true, workersCompEnabled),
      environmentKeys: ["WORKERS_COMP_SOURCE_INDEX_ENABLED"],
      internalEndpoint: "/api/workers-comp/coverage",
      sourceUrl: "https://www.dol.gov/agencies/owcp",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "State source-registry entry" },
      confidence: { tier: "context-only", rationale: "The index describes public-source availability; it is not a unified claims database." },
      freshness: { policy: "Curated manual review" },
      limitations: ["State definitions and publication practices differ.", "Unindexed does not mean unavailable.", "Most sources are aggregate rather than claim-level."],
      safeguards: ["No national completeness claim", "Manual verification status", "No claim-validity inference"],
    },
    {
      id: "dol-dba",
      label: "DOL Defense Base Act Public Sources",
      authority: "U.S. Department of Labor — OWCP/DLHWC",
      category: "dba",
      mode: "official-workbook",
      workspaces: ["DBA Intelligence", "Entity Resolution"],
      configured: true,
      enabled: true,
      state: "ready",
      environmentKeys: [],
      internalEndpoint: "/api/dba/intelligence",
      sourceUrl: "https://www.dol.gov/agencies/owcp/dlhwc/lsdbareports",
      provenance: { official: true, serverSide: true, reviewRequired: true, evidenceUnit: "Public cumulative DBA workbook row or official reference" },
      confidence: { tier: "moderate", rationale: "Official administrative case-summary and waiver sources; employer-name matching and suppression require review." },
      freshness: { policy: "Manual scan of official DOL sources" },
      limitations: ["A case count is not necessarily a unique injury, accepted claim, casualty, or compensable event.", "Privacy-suppressed values are unknown, not zero.", "Public reports can be delayed or changed."],
      safeguards: ["No claimant data", "No liability or safety inference", "Suppression-aware parsing", "Manual request only"],
    },
  ];
}

router.get("/source-governance/overview", async (_req: Request, res: Response) => {
  try {
    const sources = await getRegistry();
    const summary = {
      totalSources: sources.length,
      readySources: sources.filter((source) => source.state === "ready").length,
      partialSources: sources.filter((source) => source.state === "partial").length,
      disabledSources: sources.filter((source) => source.state === "disabled").length,
      notConfiguredSources: sources.filter((source) => source.state === "not-configured").length,
      officialSources: sources.filter((source) => source.provenance.official).length,
      manualOnlySources: sources.filter((source) => ["manual-live", "official-workbook"].includes(source.mode)).length,
    };

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary,
      sources,
      workflows: [
        { id: "employer", label: "Employer Intelligence", dependsOn: ["osha-ita", "bls-iif", "onet", "workers-comp-index"] },
        { id: "entity", label: "Entity Resolution", dependsOn: ["sam", "sec-edgar", "osha-ita", "courtlistener", "usaspending", "dol-dba"] },
        { id: "exposure", label: "Exposure Matrix", dependsOn: ["onet", "osha-ita", "bls-iif"] },
        { id: "company-live", label: "Company Live Intel", dependsOn: ["sam", "sec-edgar", "courtlistener", "usaspending"] },
        { id: "workers-comp", label: "Workers’ Comp Coverage", dependsOn: ["workers-comp-index"] },
        { id: "dba", label: "DBA Intelligence", dependsOn: ["dol-dba"] },
      ],
      governance: {
        manualOnly: "Live and workbook requests run only after a user-triggered action in the responsible workspace.",
        partialResults: "A failed or disabled source must remain visible and must not erase successful evidence from other sources.",
        provenance: "Every surfaced signal should preserve its source, evidence unit, freshness, limitations, and human-review requirement.",
        confidence: "Confidence describes source fit or match quality. It never establishes truth, safety, liability, compliance, or medical necessity.",
        secrets: "Environment-key names may be displayed for operations; secret values must never leave the server.",
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/g, "[URL redacted]") : "Source governance overview failed",
    });
  }
});

export default router;
