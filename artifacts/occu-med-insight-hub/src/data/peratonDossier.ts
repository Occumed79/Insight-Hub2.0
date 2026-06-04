import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const peratonCompanies: Company[] = [
  {
    id: "peraton",
    name: "Peraton",
    shortName: "Peraton",
    sector: "Space and intelligence, classified mission support, cyber operations, ground-station operations, health IT, and enterprise IT services",
    headquarters: "Not specified in uploaded material",
    employees: 18300,
    employeesAsOf: "Modeled worker population from uploaded Peraton visual set",
    summary: "Peraton has been added as a Space & Intel and classified-awards visual dossier. The uploaded charts connect rising classified award volume, post-Perspecta revenue scale, IPO-readiness disclosure gaps, worker-risk segmentation, and a modeled Occu-Med revenue opportunity led by behavioral health, pre-employment physicals, DBA pre-deploy, ergonomic assessment, RF/EMF surveillance, and audiometry.",
    tags: ["Space & Intel", "Classified awards", "IPO readiness", "Behavioral health", "RF/EMF surveillance", "Ground-station risk"],
  },
];

export const peratonSources: SourceRecord[] = [
  { id: "peraton-classified-awards-visual", companyId: "peraton", label: "Peraton annual classified awards visual", type: "Manual", note: "Uploaded Peraton Space & Intel visual shows annual classified awards of approximately $0.36B in 2022, $1.2B in 2023, and $1.15B in 2024." },
  { id: "peraton-ipo-readiness-gap-visual", companyId: "peraton", label: "Peraton IPO-readiness gap visual", type: "Manual", note: "Uploaded visual compares Peraton against public company ESG/safety standards. Public peer maturity is shown at 5 for TRIR published, fatality data published, and sustainability reports; 4 for occupational medical program documentation; 2 for behavioral health protocol; and 3 for RF/EMF surveillance. Peraton is shown with a limited current score of 1 for occupational medical program documentation and no visible current score for the other categories." },
  { id: "peraton-revenue-potential-visual", companyId: "peraton", label: "Peraton Occu-Med revenue potential by exam type visual", type: "Manual", note: "Uploaded Peraton visual models annual Occu-Med revenue potential by exam type: pre-employment physicals $938K, DBA pre-deploy OCONUS $462K, behavioral health for IC workers $1.55M, RF/EMF surveillance $155K, ergonomic assessments $375K, and audiometry for ground-station/data-center workers $82K." },
  { id: "peraton-revenue-build-up-visual", companyId: "peraton", label: "Peraton revenue build-up 2017-2024 visual", type: "Manual", note: "Uploaded Peraton visual models revenue build-up from about $0.7B in 2017 to $1.5B in 2019, approximately $7.1B in 2021 after the Perspecta acquisition, $7.4B in 2022, and $8.1B in 2024." },
  { id: "peraton-worker-trir-visual", companyId: "peraton", label: "Peraton worker risk by BLS TRIR benchmark visual", type: "Benchmark", note: "Uploaded Peraton visual models worker-risk categories by BLS TRIR benchmark: Space & Intel Analysts around 5K workers at TRIR ~0.5, Cyber Mission around 3K at TRIR ~0.5, Ground Station Ops & Techs around 1K at TRIR ~2.2, DHA Health IT OCONUS around 1.8K at TRIR ~1.2, and Enterprise IT around 7.5K at TRIR ~0.5." },
];

export const peratonMetrics: Metric[] = [
  { id: "peraton-modeled-workers", companyId: "peraton", label: "Modeled workers", value: 18300, unit: "count", category: "workforce", trend: 7.8, sourceId: "peraton-worker-trir-visual" },
  { id: "peraton-revenue-2024", companyId: "peraton", label: "Modeled 2024 revenue", value: 8100000000, unit: "usd", category: "financial", trend: 8.9, sourceId: "peraton-revenue-build-up-visual" },
  { id: "peraton-classified-awards-2024", companyId: "peraton", label: "2024 classified awards", value: 1150000000, unit: "usd", category: "financial", trend: 8.4, sourceId: "peraton-classified-awards-visual" },
  { id: "peraton-classified-awards-2023", companyId: "peraton", label: "2023 classified awards", value: 1200000000, unit: "usd", category: "financial", trend: 8.7, sourceId: "peraton-classified-awards-visual" },
  { id: "peraton-occu-med-revenue-potential", companyId: "peraton", label: "Annual Occu-Med revenue potential", value: 3562000, unit: "usd", category: "financial", trend: 9.2, sourceId: "peraton-revenue-potential-visual" },
  { id: "peraton-behavioral-health-revenue", companyId: "peraton", label: "Behavioral health revenue potential", value: 1550000, unit: "usd", category: "financial", trend: 9.1, sourceId: "peraton-revenue-potential-visual" },
  { id: "peraton-preemployment-revenue", companyId: "peraton", label: "Pre-employment physical revenue", value: 938000, unit: "usd", category: "financial", trend: 8.0, sourceId: "peraton-revenue-potential-visual" },
  { id: "peraton-dba-revenue", companyId: "peraton", label: "DBA pre-deploy revenue", value: 462000, unit: "usd", category: "financial", trend: 7.4, sourceId: "peraton-revenue-potential-visual" },
  { id: "peraton-ergonomic-revenue", companyId: "peraton", label: "Ergonomic assessment revenue", value: 375000, unit: "usd", category: "financial", trend: 6.8, sourceId: "peraton-revenue-potential-visual" },
  { id: "peraton-highest-trir", companyId: "peraton", label: "Highest TRIR benchmark", value: 2.2, unit: "score", category: "safety", trend: 7.0, sourceId: "peraton-worker-trir-visual" },
  { id: "peraton-ground-station-workers", companyId: "peraton", label: "Ground station ops workers", value: 1000, unit: "count", category: "workforce", trend: 6.5, sourceId: "peraton-worker-trir-visual" },
  { id: "peraton-enterprise-it-workers", companyId: "peraton", label: "Enterprise IT workers", value: 7500, unit: "count", category: "workforce", trend: 5.6, sourceId: "peraton-worker-trir-visual" },
  { id: "peraton-ipo-gap-score", companyId: "peraton", label: "IPO readiness gap score", value: 1, unit: "score", category: "risk", trend: 8.8, sourceId: "peraton-ipo-readiness-gap-visual" },
];

const peratonSections: CompanyProfile["sections"] = [
  {
    id: "overview",
    title: "Overview",
    narrative: "Peraton is framed as a Space & Intel and classified-awards occupational-health opportunity. The uploaded visuals show annual classified awards above $1B in 2023 and 2024, post-Perspecta revenue scale around $8.1B by 2024, and a modeled Occu-Med annual revenue opportunity of approximately $3.562M.",
    bullets: ["Classified awards shown at approximately $1.2B in 2023 and $1.15B in 2024", "Modeled revenue build-up reaches approximately $8.1B by 2024", "Annual modeled Occu-Med revenue potential totals approximately $3.562M", "Primary service lanes include behavioral health for IC workers, pre-employment physicals, DBA pre-deploy, ergonomic assessments, RF/EMF surveillance, and audiometry"],
    metrics: ["peraton-revenue-2024", "peraton-classified-awards-2024", "peraton-occu-med-revenue-potential"],
  },
  {
    id: "workforce-operations",
    title: "Workforce & Operations",
    narrative: "The worker-risk visual separates Peraton into space and intelligence analysts, cyber mission workers, ground-station operations and technicians, DHA Health IT OCONUS workers, and enterprise IT. This creates a practical segmentation for occupational-health service matching.",
    bullets: ["Space & Intel Analysts: approximately 5K workers", "Cyber Mission: approximately 3K workers", "Ground Station Ops & Techs: approximately 1K workers", "DHA Health IT OCONUS: approximately 1.8K workers", "Enterprise IT: approximately 7.5K workers"],
    metrics: ["peraton-modeled-workers", "peraton-ground-station-workers", "peraton-enterprise-it-workers"],
  },
  {
    id: "customer-mix",
    title: "Customer Mix",
    narrative: "The available uploaded material emphasizes classified Space & Intel awards and mission categories rather than a named customer breakout. The strongest current customer signal is the classified-awards lane, which remains above $1B in both 2023 and 2024 in the uploaded chart.",
    bullets: ["2022 classified awards: approximately $0.36B", "2023 classified awards: approximately $1.2B", "2024 classified awards: approximately $1.15B", "Customer breakout should be expanded later if a contract/customer list is uploaded"],
    metrics: ["peraton-classified-awards-2024", "peraton-classified-awards-2023"],
  },
  {
    id: "safety-metrics",
    title: "Safety Metrics",
    narrative: "The TRIR benchmark visual identifies ground-station operations and technicians as the highest modeled worker-risk category, followed by DHA Health IT OCONUS. Space/intel analysts, cyber mission workers, and enterprise IT sit lower on the benchmark scale but remain relevant for behavioral health, ergonomic, and exam-readiness services.",
    bullets: ["Ground Station Ops & Techs: TRIR approximately 2.2", "DHA Health IT OCONUS: TRIR approximately 1.2", "Space & Intel Analysts: TRIR approximately 0.5", "Cyber Mission: TRIR approximately 0.5", "Enterprise IT: TRIR approximately 0.5"],
    metrics: ["peraton-highest-trir", "peraton-ground-station-workers"],
  },
  {
    id: "ipo-readiness-gap",
    title: "IPO Readiness Gap",
    narrative: "The IPO-readiness visual creates a strong disclosure and governance signal. Public peers are shown with mature TRIR, fatality-data, and sustainability reporting, while Peraton is shown with a limited current occupational medical program documentation score and no visible current score across several other readiness categories.",
    bullets: ["Public peer average shown at 5/5 for TRIR publication", "Public peer average shown at 5/5 for fatality data publication", "Public peer average shown at 5/5 for sustainability reporting", "Public peer average shown at 4/5 for occupational medical program documentation", "Peraton current score is shown only as 1/5 for occupational medical program documentation"],
    metrics: ["peraton-ipo-gap-score"],
  },
  {
    id: "financial-workers-comp-signal",
    title: "Financial / Workers’ Comp Signal",
    narrative: "The revenue-potential visual is the most actionable Peraton business-development signal. Behavioral health for IC workers is the largest modeled revenue lane, followed by pre-employment physicals and DBA pre-deploy services.",
    bullets: ["Behavioral health for IC workers: approximately $1.55M annually", "Pre-employment physicals: approximately $938K annually", "DBA pre-deploy OCONUS: approximately $462K annually", "Ergonomic assessments: approximately $375K annually", "RF/EMF surveillance: approximately $155K annually", "Audiometry: approximately $82K annually"],
    metrics: ["peraton-occu-med-revenue-potential", "peraton-behavioral-health-revenue", "peraton-preemployment-revenue"],
  },
  {
    id: "source-library",
    title: "Source Library",
    narrative: "The Peraton profile is currently grounded in the uploaded visual set. Additional 10-K, procurement, customer, ESG, and safety-program sources can be attached later to strengthen the evidence trail.",
    bullets: ["Uploaded annual classified awards visual", "Uploaded IPO-readiness gap visual", "Uploaded Occu-Med revenue potential visual", "Uploaded revenue build-up visual", "Uploaded worker-risk by BLS TRIR benchmark visual"],
    metrics: [],
  },
];

export const peratonProfiles: CompanyProfile[] = [
  { companyId: "peraton", sections: peratonSections },
];

export const peratonLocations: LocationRecord[] = [
  { id: "peraton-space-intel", companyId: "peraton", company: "Peraton", city: "Space & Intel Analyst Population", country: "USA", region: "United States", facilityType: "Modeled worker category", activity: "Classified space and intelligence support", notes: "Uploaded Peraton worker-risk visual shows approximately 5K Space & Intel analysts at TRIR ~0.5.", coordinates: [-98.5795, 39.8283] },
  { id: "peraton-ground-station", companyId: "peraton", company: "Peraton", city: "Ground Station Ops & Techs", country: "USA", region: "United States", facilityType: "Ground-station operations", activity: "Technical operations and maintenance support", notes: "Uploaded Peraton worker-risk visual shows approximately 1K ground-station operations and technician workers at TRIR ~2.2.", coordinates: [-104.8214, 38.8339] },
  { id: "peraton-dha-health-it-oconus", companyId: "peraton", company: "Peraton", city: "DHA Health IT OCONUS", country: "Regional", region: "OCONUS", facilityType: "Health IT OCONUS support", activity: "DHA health IT and deployed support", notes: "Uploaded Peraton worker-risk visual shows approximately 1.8K DHA Health IT OCONUS workers at TRIR ~1.2.", coordinates: [47.4818, 29.3117] },
];

export const peratonReports: ReportRecord[] = [
  { id: "peraton-space-intel-ipo-readiness-signal", companyId: "peraton", title: "Peraton Space & Intel classified-awards and IPO-readiness signal", createdAt: "2026-06-04", summary: "Peraton combines large classified Space & Intel award volume, post-Perspecta revenue scale, a visible IPO-readiness disclosure gap, and a practical occupational-health revenue model led by behavioral health, pre-employment physicals, DBA pre-deploy services, ergonomic assessments, RF/EMF surveillance, and audiometry.", signals: ["2024 classified awards shown at approximately $1.15B", "Modeled 2024 revenue shown at approximately $8.1B", "Ground Station Ops & Techs shown as highest TRIR benchmark category at approximately 2.2", "Modeled annual Occu-Med revenue potential totals approximately $3.562M", "Behavioral health for IC workers is the largest modeled revenue lane at approximately $1.55M", "IPO-readiness visual shows a major safety/ESG documentation gap versus public peer standards"] },
];
