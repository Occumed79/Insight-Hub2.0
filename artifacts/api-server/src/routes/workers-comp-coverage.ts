import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

type Region = "Northeast" | "Midwest" | "South" | "West";
type CoverageType = "claim-level" | "aggregate" | "administrative" | "unindexed";
type ReviewStatus = "indexed-pending-review" | "unindexed";

type WorkersCompSource = {
  name: string;
  agency: string;
  url: string;
  type: Exclude<CoverageType, "unindexed">;
  publicationNote: string;
};

type StateCoverage = {
  code: string;
  name: string;
  region: Region;
  coverageType: CoverageType;
  reviewStatus: ReviewStatus;
  sourceCount: number;
  sources: WorkersCompSource[];
  coverageNotes: string;
  freshness: string;
  limitations: string[];
};

const LIMITATION = "There is no single complete national workers’ compensation database. State coverage, publication practices, definitions, reporting periods, and availability vary. Insight Hub 2.0 uses these sources for research and service-opportunity context only, not to determine legal liability, claim validity, negligence, compliance, or whether an employer is unsafe.";

const STATE_LIST: Array<[string, string, Region]> = [
  ["AL", "Alabama", "South"], ["AK", "Alaska", "West"], ["AZ", "Arizona", "West"], ["AR", "Arkansas", "South"],
  ["CA", "California", "West"], ["CO", "Colorado", "West"], ["CT", "Connecticut", "Northeast"], ["DE", "Delaware", "South"],
  ["FL", "Florida", "South"], ["GA", "Georgia", "South"], ["HI", "Hawaii", "West"], ["ID", "Idaho", "West"],
  ["IL", "Illinois", "Midwest"], ["IN", "Indiana", "Midwest"], ["IA", "Iowa", "Midwest"], ["KS", "Kansas", "Midwest"],
  ["KY", "Kentucky", "South"], ["LA", "Louisiana", "South"], ["ME", "Maine", "Northeast"], ["MD", "Maryland", "South"],
  ["MA", "Massachusetts", "Northeast"], ["MI", "Michigan", "Midwest"], ["MN", "Minnesota", "Midwest"], ["MS", "Mississippi", "South"],
  ["MO", "Missouri", "Midwest"], ["MT", "Montana", "West"], ["NE", "Nebraska", "Midwest"], ["NV", "Nevada", "West"],
  ["NH", "New Hampshire", "Northeast"], ["NJ", "New Jersey", "Northeast"], ["NM", "New Mexico", "West"], ["NY", "New York", "Northeast"],
  ["NC", "North Carolina", "South"], ["ND", "North Dakota", "Midwest"], ["OH", "Ohio", "Midwest"], ["OK", "Oklahoma", "South"],
  ["OR", "Oregon", "West"], ["PA", "Pennsylvania", "Northeast"], ["RI", "Rhode Island", "Northeast"], ["SC", "South Carolina", "South"],
  ["SD", "South Dakota", "Midwest"], ["TN", "Tennessee", "South"], ["TX", "Texas", "South"], ["UT", "Utah", "West"],
  ["VT", "Vermont", "Northeast"], ["VA", "Virginia", "South"], ["WA", "Washington", "West"], ["WV", "West Virginia", "South"],
  ["WI", "Wisconsin", "Midwest"], ["WY", "Wyoming", "West"],
];

const INDEXED_SOURCES: Partial<Record<string, WorkersCompSource[]>> = {
  CA: [
    { name: "California DWC statistics and reports", agency: "California Division of Workers’ Compensation", url: "https://www.dir.ca.gov/dwc/", type: "aggregate", publicationNote: "Agency statistics, reports, and administrative publications; manual verification of specific datasets remains required." },
    { name: "CWCI annual research reports", agency: "California Workers’ Compensation Institute", url: "https://www.cwci.org/", type: "aggregate", publicationNote: "Research and aggregate reporting; not a complete public claim-level source." },
  ],
  TX: [
    { name: "Texas DWC data and reports", agency: "Texas Department of Insurance, Division of Workers’ Compensation", url: "https://www.tdi.texas.gov/wc/", type: "aggregate", publicationNote: "Agency statistics and reports; publication scope varies by report." },
    { name: "Texas occupational safety data resources", agency: "Texas Department of Insurance", url: "https://www.txsafework.org/", type: "administrative", publicationNote: "Contextual occupational safety and workers’ compensation resources; not treated as claim-level data." },
  ],
  NY: [
    { name: "New York Workers’ Compensation Board reports", agency: "New York State Workers’ Compensation Board", url: "https://www.wcb.ny.gov/", type: "aggregate", publicationNote: "Board statistics and administrative publications; coverage varies." },
  ],
  FL: [
    { name: "Florida workers’ compensation data and reports", agency: "Florida Division of Workers’ Compensation", url: "https://www.myfloridacfo.com/division/wc/", type: "aggregate", publicationNote: "Agency reporting and statistical publications; manual dataset review required." },
  ],
  PA: [
    { name: "Pennsylvania workers’ compensation reports", agency: "Pennsylvania Bureau of Workers’ Compensation", url: "https://www.dli.pa.gov/Workers/", type: "aggregate", publicationNote: "Administrative and annual reporting; not assumed to provide public claim-level records." },
  ],
  IL: [
    { name: "Illinois Workers’ Compensation Commission reports", agency: "Illinois Workers’ Compensation Commission", url: "https://www2.illinois.gov/iwcc/", type: "administrative", publicationNote: "Commission annual and administrative reporting; current source location requires manual verification." },
  ],
  OH: [
    { name: "Ohio BWC statistics and research", agency: "Ohio Bureau of Workers’ Compensation", url: "https://www.bwc.ohio.gov/", type: "aggregate", publicationNote: "Agency statistics and research publications; not treated as a complete claim-level feed." },
  ],
  WA: [
    { name: "Washington workers’ compensation claims resources", agency: "Washington State Department of Labor & Industries", url: "https://www.lni.wa.gov/claims/", type: "claim-level", publicationNote: "The index identifies claim-oriented public resources; record-level availability and access restrictions require manual verification." },
  ],
  OR: [
    { name: "Oregon workers’ compensation statistics", agency: "Oregon Department of Consumer and Business Services", url: "https://www.oregon.gov/dcbs/", type: "aggregate", publicationNote: "State statistics and administrative reporting; manual dataset review required." },
  ],
};

function deriveCoverageType(sources: WorkersCompSource[]): CoverageType {
  if (sources.some((source) => source.type === "claim-level")) return "claim-level";
  if (sources.some((source) => source.type === "aggregate")) return "aggregate";
  if (sources.some((source) => source.type === "administrative")) return "administrative";
  return "unindexed";
}

function buildStateCoverage(enabled: boolean): StateCoverage[] {
  return STATE_LIST.map(([code, name, region]) => {
    const indexed = INDEXED_SOURCES[code] ?? [];
    const sources = enabled ? indexed : [];
    const coverageType = deriveCoverageType(sources);
    return {
      code,
      name,
      region,
      coverageType,
      reviewStatus: sources.length > 0 ? "indexed-pending-review" : "unindexed",
      sourceCount: sources.length,
      sources,
      coverageNotes: sources.length > 0
        ? `${sources.length} source${sources.length === 1 ? "" : "s"} indexed for research. Specific datasets, publication dates, and access terms still require manual verification.`
        : enabled
          ? "No public source has been indexed for this state yet. This does not mean that no public workers’ compensation information exists."
          : "The workers’ compensation source index is disabled by configuration.",
      freshness: sources.length > 0 ? "Source landing pages indexed; publication freshness not yet verified" : "Not reviewed",
      limitations: [
        "State definitions, reporting periods, and publication practices are not standardized.",
        "An indexed landing page does not guarantee public record-level access.",
        "No indexed source must not be interpreted as no available state data.",
      ],
    };
  });
}

router.get("/workers-comp/coverage", (req: Request, res: Response) => {
  try {
    const enabledValue = process.env.WORKERS_COMP_SOURCE_INDEX_ENABLED?.trim().toLowerCase();
    const enabled = enabledValue === "true" || enabledValue === "1" || enabledValue === "yes" || enabledValue === "on";
    const state = String(req.query.state ?? "").trim().toUpperCase();
    const region = String(req.query.region ?? "").trim();
    const coverageType = String(req.query.coverageType ?? "").trim();
    const reviewStatus = String(req.query.reviewStatus ?? "").trim();
    const query = String(req.query.query ?? "").trim().toLowerCase();

    let states = buildStateCoverage(enabled);
    if (state) states = states.filter((record) => record.code === state);
    if (region) states = states.filter((record) => record.region === region);
    if (coverageType) states = states.filter((record) => record.coverageType === coverageType);
    if (reviewStatus) states = states.filter((record) => record.reviewStatus === reviewStatus);
    if (query) {
      states = states.filter((record) =>
        record.code.toLowerCase().includes(query)
        || record.name.toLowerCase().includes(query)
        || record.sources.some((source) => `${source.name} ${source.agency}`.toLowerCase().includes(query)),
      );
    }

    const allStates = buildStateCoverage(enabled);
    const summary = {
      totalStates: allStates.length,
      indexedStates: allStates.filter((record) => record.reviewStatus === "indexed-pending-review").length,
      unindexedStates: allStates.filter((record) => record.reviewStatus === "unindexed").length,
      claimLevelStates: allStates.filter((record) => record.coverageType === "claim-level").length,
      aggregateStates: allStates.filter((record) => record.coverageType === "aggregate").length,
      administrativeStates: allStates.filter((record) => record.coverageType === "administrative").length,
      sourceCount: allStates.reduce((sum, record) => sum + record.sourceCount, 0),
    };

    return res.json({
      ok: true,
      enabled,
      generatedAt: new Date().toISOString(),
      sourceModel: "Manual static source index",
      summary,
      states,
      limitation: LIMITATION,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 240) : "Workers’ compensation coverage query failed",
    });
  }
});

export default router;
