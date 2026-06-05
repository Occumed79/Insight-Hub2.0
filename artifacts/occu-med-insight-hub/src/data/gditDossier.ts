import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const gditCompanies: Company[] = [
  {
    id: "gdit",
    name: "General Dynamics Information Technology",
    shortName: "GDIT",
    sector: "Federal enterprise IT, cloud modernization, communications support, and technology services",
    headquarters: "Falls Church, Virginia / General Dynamics corporate structure",
    employees: 30000,
    employeesAsOf: "Approximate planning estimate pending a current official headcount source",
    summary: "GDIT has been added as a federal technology-services dossier focused on contract momentum, distributed workforce support, overseas-service relevance, and workforce-readiness signals. This profile does not include any Occu-Med revenue-potential modeling.",
    tags: ["Enterprise IT", "Cloud modernization", "Communications support", "Federal technology", "OCONUS support"],
  },
];

export const gditSources: SourceRecord[] = [
  { id: "gdit-public-contract-reporting", companyId: "gdit", label: "Public contract reporting set", type: "Manual", note: "Public reporting reviewed for GDIT shows large federal technology-services awards involving enterprise modernization, communications support, cloud transition, and overseas-support relevance." },
];

export const gditMetrics: Metric[] = [
  { id: "gdit-modeled-workers", companyId: "gdit", label: "Approx. workforce planning base", value: 30000, unit: "count", category: "workforce", trend: 6.8, sourceId: "gdit-public-contract-reporting" },
  { id: "gdit-contract-momentum", companyId: "gdit", label: "Contract momentum signal", value: 9, unit: "score", category: "risk", trend: 8.8, sourceId: "gdit-public-contract-reporting" },
  { id: "gdit-oconus-support-signal", companyId: "gdit", label: "OCONUS support signal", value: 8.5, unit: "score", category: "risk", trend: 8.7, sourceId: "gdit-public-contract-reporting" },
  { id: "gdit-workforce-readiness-signal", companyId: "gdit", label: "Workforce-readiness signal", value: 8, unit: "score", category: "risk", trend: 8.1, sourceId: "gdit-public-contract-reporting" },
];

const gditSections: CompanyProfile["sections"] = [
  {
    id: "overview",
    title: "Overview",
    narrative: "GDIT is best framed as a federal technology-services and modernization target. The strongest current signals are enterprise IT modernization, distributed support needs, cloud transition, overseas-support relevance, and staffing continuity.",
    bullets: [
      "The profile focuses on workforce-readiness and operational-support signals rather than traditional industrial injury volume.",
      "GDIT's public award pattern points to large, multi-year federal technology-services work.",
      "No Occu-Med revenue-potential estimate is included."
    ],
    metrics: ["gdit-modeled-workers", "gdit-contract-momentum", "gdit-oconus-support-signal"],
  },
  {
    id: "strategic-detail-contract-momentum",
    title: "Strategic Detail: Contract Momentum",
    narrative: "The key business-development signal is not a single isolated award. It is the pattern of large modernization, enterprise-support, communications, and cloud-transition work across federal customers.",
    bullets: [
      "Large multi-year awards indicate durable service demand rather than short one-off tasking.",
      "Enterprise modernization work creates recurring staffing, documentation, and continuity needs.",
      "Cloud-transition and communications-support work can require a dependable, cleared, and geographically flexible workforce."
    ],
    metrics: ["gdit-contract-momentum"],
  },
  {
    id: "strategic-detail-oconus-support",
    title: "Strategic Detail: OCONUS Support",
    narrative: "GDIT's overseas-support relevance is important because it suggests travel, access documentation, continuity planning, and readiness-sensitive staffing may matter more than classic physical hazard exposure.",
    bullets: [
      "Distributed support footprints can increase coordination and documentation burden.",
      "Overseas-support roles may require stricter readiness tracking than standard domestic enterprise IT roles.",
      "Continuity matters when teams support time-sensitive operations or large user populations."
    ],
    metrics: ["gdit-oconus-support-signal", "gdit-workforce-readiness-signal"],
  },
  {
    id: "workforce-risk-segmentation",
    title: "Workforce Risk Segmentation",
    narrative: "GDIT's workforce signal is likely less about heavy industrial exposure and more about secure-site access, travel or overseas-readiness needs, high-volume support functions, and continuity-sensitive technical teams.",
    bullets: [
      "Overseas support personnel: strongest readiness and documentation relevance.",
      "Cloud and modernization teams: high execution pressure tied to large transformation programs.",
      "Enterprise support teams: lower physical-risk profile but potentially high volume and continuity sensitivity."
    ],
    metrics: ["gdit-modeled-workers", "gdit-workforce-readiness-signal"],
  },
  {
    id: "source-library",
    title: "Source Library",
    narrative: "This GDIT profile is grounded in public contract reporting and can be expanded later with official award notices, USAspending records, annual-report references, and program-specific procurement documents.",
    bullets: ["Public contract reporting set", "Federal modernization and support award reporting", "Future expansion: official award notices and annual-report references"],
    metrics: [],
  },
];

export const gditProfiles: CompanyProfile[] = [
  { companyId: "gdit", sections: gditSections },
];

export const gditLocations: LocationRecord[] = [
  { id: "gdit-us-enterprise", companyId: "gdit", company: "GDIT", city: "U.S. enterprise support footprint", country: "USA", region: "United States", facilityType: "Federal technology services", activity: "Enterprise IT, modernization, and communications support", notes: "Planning location for domestic federal technology-services support.", coordinates: [-77.1773, 38.8998] },
  { id: "gdit-oconus-support", companyId: "gdit", company: "GDIT", city: "OCONUS support footprint", country: "Regional", region: "OCONUS", facilityType: "Overseas support footprint", activity: "Distributed technology and communications support", notes: "Planning location for overseas-support relevance and readiness-sensitive staffing.", coordinates: [10.4515, 51.1657] },
];

export const gditReports: ReportRecord[] = [
  {
    id: "gdit-federal-technology-services-signal",
    companyId: "gdit",
    title: "GDIT federal technology-services and workforce-readiness signal",
    createdAt: "2026-06-04",
    summary: "GDIT shows a concentrated federal technology-services pattern involving modernization, communications support, cloud transition, distributed support, and overseas-service relevance. The profile excludes Occu-Med revenue-potential modeling.",
    signals: [
      "Large federal technology-services award pattern",
      "Overseas-support relevance",
      "Cloud and modernization execution pressure",
      "Workforce-readiness and documentation sensitivity",
      "Lower traditional industrial exposure but stronger continuity and staffing-risk signal"
    ],
  },
];
