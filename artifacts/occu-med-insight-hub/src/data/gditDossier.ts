import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const gditCompanies: Company[] = [
  {
    id: "gdit",
    name: "General Dynamics Information Technology",
    shortName: "GDIT",
    sector: "Federal enterprise IT, cloud modernization, communications support, mission support, and technology services",
    headquarters: "Falls Church, Virginia / General Dynamics corporate structure",
    employees: 30000,
    employeesAsOf: "Uploaded GDIT report planning estimate / FY2024 context",
    summary: "GDIT has been expanded into a workforce-readiness dossier focused on federal IT scale, cleared workforce concentration, data-center technician exposure, OCONUS deployed IT and mission personnel, STRATCOM/SOCOM operational stressors, and regulatory medical-surveillance signals. This profile intentionally excludes Occu-Med revenue-potential modeling.",
    tags: ["Enterprise IT", "Cleared workforce", "Data center exposure", "OCONUS support", "DBA relevance", "STRATCOM/SOCOM"],
  },
];

export const gditSources: SourceRecord[] = [
  { id: "gdit-public-contract-reporting", companyId: "gdit", label: "Public contract reporting set", type: "Manual", note: "Public reporting reviewed for GDIT shows large federal technology-services awards involving enterprise modernization, communications support, cloud transition, and overseas-support relevance." },
  { id: "gdit-uploaded-intelligence-report", companyId: "gdit", label: "Uploaded GDIT intelligence report", type: "Manual", note: "Uploaded GDIT report dated February 19, 2026 frames GDIT as a General Dynamics business unit with approximately 30,000 employees and $8.75B FY2024 revenue. It notes that General Dynamics does not publish GDIT-specific TRIR or fatality data, so injury exposure is modeled from BLS benchmarks applied to worker composition." },
  { id: "gdit-worker-risk-benchmark", companyId: "gdit", label: "GDIT worker risk by BLS TRIR benchmark visual", type: "Benchmark", note: "Uploaded report models worker categories: cleared IT analysts and engineers at roughly 22,000 workers / TRIR 0.50; data center technicians at roughly 2,000 / TRIR 1.80; OCONUS deployed IT/mission personnel at roughly 1,500 / TRIR 2.80; and mission support SOCOM/STRATCOM at roughly 4,500 / TRIR 0.60." },
  { id: "gdit-2025-contract-surge", companyId: "gdit", label: "GDIT 2025 contract surge visual", type: "Manual", note: "Uploaded report highlights 2025 contract activity including STRATCOM IT Modernization at $1.5B, EMITS 2 at $1.25B, SOCOM IT Enterprise at $396M, NOAA/NWS supercomputing at approximately $180M, and Army Base Readiness task order exposure." },
  { id: "gdit-oconus-dba-analysis", companyId: "gdit", label: "GDIT OCONUS DBA exposure analysis", type: "Manual", note: "Uploaded report states GDIT careers explicitly listed OCONUS recruiting for Cameroon, Egypt, and Somalia. It flags that IT contractors working OCONUS on U.S. government contracts may create DBA-covered exposure even when roles are not armed security roles." },
  { id: "gdit-injury-cost-architecture", companyId: "gdit", label: "GDIT injury cost architecture visual", type: "Benchmark", note: "Uploaded report estimates direct injury cost by worker type using BLS benchmark assumptions: cleared IT/engineering largest total volume, data center technicians highest domestic per-capita risk, OCONUS deployed personnel smaller but higher-severity DBA-relevant exposure, and mission support lower TRIR but continuity-sensitive." },
  { id: "gdit-ergonomic-liability-analysis", companyId: "gdit", label: "GDIT ergonomic and cleared-workforce analysis", type: "Manual", note: "Uploaded report identifies the large cleared IT workforce as desk-and-screen heavy, often working in SCIFs or government-furnished facilities with limited ergonomic flexibility. It models cumulative trauma and musculoskeletal exposure as a key risk lane rather than classic industrial injury exposure." },
  { id: "gdit-behavioral-health-analysis", companyId: "gdit", label: "GDIT STRATCOM and SOCOM behavioral health dimension", type: "Manual", note: "Uploaded report identifies STRATCOM and SOCOM worldwide IT support as mission-critical populations with elevated stress, clearance-sensitive help-seeking concerns, and behavioral-health referral sensitivity." },
  { id: "gdit-regulatory-obligations", companyId: "gdit", label: "GDIT regulatory obligations table", type: "Manual", note: "Uploaded report maps GDIT populations to requirements: OSHA 1910.95 hearing conservation for data center technicians where server noise reaches 85 dB; Defense Base Act for OCONUS deployed personnel; DOT physical and drug/alcohol rules for safety-sensitive vehicle operators; OSHA 1910.134 respirator clearance for data center workers with PPE requirements; and personnel-security fitness-for-duty referrals for cleared workers." },
];

export const gditMetrics: Metric[] = [
  { id: "gdit-modeled-workers", companyId: "gdit", label: "Approx. workforce planning base", value: 30000, unit: "count", category: "workforce", trend: 6.8, sourceId: "gdit-uploaded-intelligence-report" },
  { id: "gdit-fy2024-revenue", companyId: "gdit", label: "FY2024 revenue", value: 8750000000, unit: "usd", category: "financial", trend: 7.2, sourceId: "gdit-uploaded-intelligence-report" },
  { id: "gdit-cleared-it-workers", companyId: "gdit", label: "Cleared IT / engineering workers", value: 22000, unit: "count", category: "workforce", trend: 7.0, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-data-center-workers", companyId: "gdit", label: "Data center technicians", value: 2000, unit: "count", category: "workforce", trend: 6.2, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-oconus-workers", companyId: "gdit", label: "OCONUS deployed IT / mission personnel", value: 1500, unit: "count", category: "workforce", trend: 8.7, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-mission-support-workers", companyId: "gdit", label: "SOCOM / STRATCOM mission support", value: 4500, unit: "count", category: "workforce", trend: 8.0, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-cleared-it-trir-benchmark", companyId: "gdit", label: "Cleared IT TRIR benchmark", value: 0.5, unit: "score", category: "safety", trend: 3.2, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-data-center-trir-benchmark", companyId: "gdit", label: "Data center TRIR benchmark", value: 1.8, unit: "score", category: "safety", trend: 7.2, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-oconus-trir-benchmark", companyId: "gdit", label: "OCONUS deployed TRIR analog", value: 2.8, unit: "score", category: "safety", trend: 8.8, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-mission-support-trir-benchmark", companyId: "gdit", label: "Mission support TRIR benchmark", value: 0.6, unit: "score", category: "safety", trend: 4.0, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-expected-injuries", companyId: "gdit", label: "Modeled expected injuries / yr", value: 108, unit: "count", category: "safety", trend: 7.1, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-cleared-it-expected-injuries", companyId: "gdit", label: "Cleared IT expected injuries / yr", value: 55, unit: "count", category: "safety", trend: 6.6, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-data-center-expected-injuries", companyId: "gdit", label: "Data center expected injuries / yr", value: 18, unit: "count", category: "safety", trend: 6.8, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-oconus-expected-injuries", companyId: "gdit", label: "OCONUS expected injuries / yr", value: 21, unit: "count", category: "safety", trend: 8.4, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-mission-support-expected-injuries", companyId: "gdit", label: "Mission support expected injuries / yr", value: 14, unit: "count", category: "safety", trend: 5.3, sourceId: "gdit-worker-risk-benchmark" },
  { id: "gdit-stratcom-contract", companyId: "gdit", label: "STRATCOM IT modernization award", value: 1500000000, unit: "usd", category: "financial", trend: 8.8, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-emits2-contract", companyId: "gdit", label: "EMITS 2 award", value: 1250000000, unit: "usd", category: "financial", trend: 8.5, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-socom-contract", companyId: "gdit", label: "SOCOM IT Enterprise award", value: 396000000, unit: "usd", category: "financial", trend: 8.0, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-noaa-supercomputing", companyId: "gdit", label: "NOAA/NWS supercomputing award", value: 180000000, unit: "usd", category: "financial", trend: 6.4, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-baseline-turnover-hires-low", companyId: "gdit", label: "Modeled annual new hires low", value: 4500, unit: "count", category: "workforce", trend: 7.5, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-baseline-turnover-hires-high", companyId: "gdit", label: "Modeled annual new hires high", value: 6000, unit: "count", category: "workforce", trend: 8.0, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-contract-surge-hires-low", companyId: "gdit", label: "Contract-surge hires low", value: 500, unit: "count", category: "workforce", trend: 7.0, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-contract-surge-hires-high", companyId: "gdit", label: "Contract-surge hires high", value: 1500, unit: "count", category: "workforce", trend: 8.1, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-contract-momentum", companyId: "gdit", label: "Contract momentum signal", value: 9, unit: "score", category: "risk", trend: 8.8, sourceId: "gdit-2025-contract-surge" },
  { id: "gdit-oconus-support-signal", companyId: "gdit", label: "OCONUS support signal", value: 8.5, unit: "score", category: "risk", trend: 8.7, sourceId: "gdit-oconus-dba-analysis" },
  { id: "gdit-workforce-readiness-signal", companyId: "gdit", label: "Workforce-readiness signal", value: 8, unit: "score", category: "risk", trend: 8.1, sourceId: "gdit-regulatory-obligations" },
  { id: "gdit-data-center-risk-signal", companyId: "gdit", label: "Data center risk signal", value: 7.5, unit: "score", category: "risk", trend: 7.3, sourceId: "gdit-injury-cost-architecture" },
  { id: "gdit-behavioral-health-signal", companyId: "gdit", label: "Behavioral health signal", value: 8.2, unit: "score", category: "risk", trend: 8.2, sourceId: "gdit-behavioral-health-analysis" },
];

const gditSections: CompanyProfile["sections"] = [
  {
    id: "overview",
    title: "Overview",
    narrative: "GDIT is best framed as a high-scale federal technology-services target where the core risk signal is not heavy industrial exposure, but the combination of cleared workforce volume, secure-site access, OCONUS support, data-center technician hazards, and mission-critical continuity requirements. General Dynamics does not publish GDIT-specific TRIR or fatality data, so this dossier uses BLS worker-population benchmarks from the uploaded report.",
    bullets: [
      "The profile focuses on workforce-readiness, documentation, medical-surveillance, and operational-continuity signals rather than traditional industrial injury volume.",
      "The uploaded report models roughly 30,000 employees, with the largest cohort being cleared IT analysts and engineers.",
      "No Occu-Med revenue-potential estimate is included."
    ],
    metrics: ["gdit-modeled-workers", "gdit-fy2024-revenue", "gdit-expected-injuries"],
  },
  {
    id: "strategic-detail-contract-momentum",
    title: "Strategic Detail: 2025 Contract Momentum",
    narrative: "The uploaded report identifies 2025 as a major contract-surge period for GDIT. The important signal is not just award value; it is the hiring, onboarding, clearance, and readiness pressure created by large enterprise IT programs supporting STRATCOM, Army Europe & Africa, SOCOM, NOAA/NWS, and Army base readiness.",
    bullets: [
      "STRATCOM IT modernization is modeled at $1.5B and tied to Offutt AFB support.",
      "EMITS 2 is modeled at $1.25B and tied to Army Europe & Africa exposure, including Germany and Africa.",
      "SOCOM IT Enterprise is modeled at $396M and tied to worldwide Special Operations Forces mission support.",
      "Baseline turnover alone is modeled at roughly 4,500-6,000 new hires per year, before contract-surge additions."
    ],
    metrics: ["gdit-stratcom-contract", "gdit-emits2-contract", "gdit-socom-contract", "gdit-baseline-turnover-hires-low", "gdit-baseline-turnover-hires-high"],
  },
  {
    id: "strategic-detail-oconus-support",
    title: "Strategic Detail: OCONUS and DBA Exposure",
    narrative: "GDIT's overseas-support relevance is stronger than a normal IT contractor because the uploaded report flags active OCONUS recruiting in Cameroon, Egypt, and Somalia, plus SOCOM worldwide IT support. The key insight is that IT personnel deployed under U.S. government contracts may carry Defense Base Act exposure even when their job title looks non-industrial.",
    bullets: [
      "OCONUS IT and mission-support roles are modeled as a small population with outsized readiness and documentation importance.",
      "Cameroon, Egypt, and Somalia are highlighted in the uploaded report as active OCONUS recruiting footprints.",
      "DBA relevance should be framed around deployment fitness, medical documentation, travel readiness, and post-rotation follow-up rather than armed-security comparisons.",
      "A network engineer or IT specialist can still face vehicle, austere-site, limited-medical-infrastructure, and operational-tempo risks."
    ],
    metrics: ["gdit-oconus-workers", "gdit-oconus-trir-benchmark", "gdit-oconus-expected-injuries", "gdit-oconus-support-signal"],
  },
  {
    id: "workforce-risk-segmentation",
    title: "Workforce Risk Segmentation",
    narrative: "The uploaded report separates GDIT into four practical worker populations: cleared IT analysts/engineers, data center technicians, OCONUS deployed IT/mission personnel, and SOCOM/STRATCOM mission support. This creates a cleaner operational view than treating GDIT as one generic IT employer.",
    bullets: [
      "Cleared IT analysts and engineers: low benchmark TRIR but very high headcount, creating the largest modeled injury volume.",
      "Data center technicians: highest domestic per-capita physical-risk lane, driven by server rack handling, raised-floor electrical work, cable management, noise, and enclosed-equipment environments.",
      "OCONUS deployed IT/mission personnel: smaller population, but higher-severity deployment and DBA-relevant risk.",
      "SOCOM/STRATCOM mission support: lower physical TRIR benchmark but elevated continuity, stress, and clearance-sensitivity concerns."
    ],
    metrics: ["gdit-cleared-it-workers", "gdit-data-center-workers", "gdit-oconus-workers", "gdit-mission-support-workers", "gdit-data-center-risk-signal"],
  },
  {
    id: "ergonomic-and-data-center",
    title: "Strategic Detail: Ergonomics and Data Center Exposure",
    narrative: "GDIT's most visible workforce is desk-and-screen heavy, but that does not make it risk-free. The uploaded report flags SCIF and government-furnished workspaces where furniture, monitor positioning, workstation layout, and restricted-access replacement constraints can turn ergonomic issues into continuity problems. Separately, data center technicians carry a much higher physical-risk benchmark than the broader IT workforce.",
    bullets: [
      "The cleared IT cohort is modeled at roughly 22,000 workers and about 55 expected recordable injuries per year.",
      "The data center technician cohort is modeled at roughly 2,000 workers with a 1.80 TRIR benchmark.",
      "Server noise, rack handling, cable work, repetitive reaching, and heavy equipment movement create surveillance needs beyond ordinary office ergonomics.",
      "Restricted-access contracts make replacement and return-to-work delays more operationally sensitive than in ordinary office settings."
    ],
    metrics: ["gdit-cleared-it-trir-benchmark", "gdit-data-center-trir-benchmark", "gdit-cleared-it-expected-injuries", "gdit-data-center-expected-injuries"],
  },
  {
    id: "behavioral-health-and-clearance",
    title: "Strategic Detail: STRATCOM / SOCOM Behavioral Health Dimension",
    narrative: "The uploaded report flags behavioral health as a serious but less visible readiness issue. STRATCOM and SOCOM worldwide IT support can expose cleared technical workers to mission-consequence stress, high operational tempo, classified environments, and clearance-sensitive concerns that may discourage normal help-seeking.",
    bullets: [
      "STRATCOM support is described as mission-critical enterprise IT work with elevated continuity pressure.",
      "SOCOM worldwide IT support may place personnel in austere or classified mission environments.",
      "Standard EAP referral pathways may be underused by highly cleared workers worried about clearance implications.",
      "Behavioral-health readiness should be presented as a confidentiality-aware fitness-for-duty and referral pathway issue, not a generic wellness benefit."
    ],
    metrics: ["gdit-mission-support-workers", "gdit-socom-contract", "gdit-stratcom-contract", "gdit-behavioral-health-signal"],
  },
  {
    id: "regulatory-obligations",
    title: "Regulatory and Medical-Surveillance Signals",
    narrative: "The uploaded report maps GDIT worker populations to concrete surveillance triggers: hearing conservation, Defense Base Act deployment readiness, DOT physicals and drug/alcohol rules, respirator medical clearance, and personnel-security fitness-for-duty referrals.",
    bullets: [
      "OSHA 1910.95 hearing conservation may apply to data center technicians where server noise reaches or exceeds 85 dB.",
      "Defense Base Act exposure applies to OCONUS deployed personnel working on U.S. government contracts.",
      "DOT physicals and drug/alcohol rules apply to safety-sensitive vehicle operators at large facilities.",
      "OSHA 1910.134 respirator medical clearance applies where data center or facility roles require respirator/PPE assignment changes.",
      "Personnel-security fitness-for-duty referrals remain relevant to cleared workforce adjudication and reinvestigation scenarios."
    ],
    metrics: ["gdit-workforce-readiness-signal", "gdit-data-center-risk-signal", "gdit-oconus-support-signal"],
  },
  {
    id: "source-library",
    title: "Source Library",
    narrative: "This GDIT profile is grounded in the uploaded GDIT intelligence report plus public contract reporting. It can be expanded later with official award notices, USAspending records, General Dynamics annual-report references, and program-specific procurement documents.",
    bullets: ["Uploaded GDIT intelligence report", "Public contract reporting set", "BLS benchmark modeling by worker population", "Future expansion: official award notices and annual-report references"],
    metrics: [],
  },
];

export const gditProfiles: CompanyProfile[] = [
  { companyId: "gdit", sections: gditSections },
];

export const gditLocations: LocationRecord[] = [
  { id: "gdit-us-enterprise", companyId: "gdit", company: "GDIT", city: "U.S. enterprise support footprint", country: "USA", region: "United States", facilityType: "Federal technology services", activity: "Enterprise IT, modernization, and communications support", notes: "Planning location for domestic federal technology-services support, cleared IT, mission support, and data-center technician populations.", coordinates: [-77.1773, 38.8998] },
  { id: "gdit-falls-church-va", companyId: "gdit", company: "GDIT", city: "Falls Church", state: "Virginia", country: "USA", region: "United States", facilityType: "Headquarters / corporate support", activity: "GDIT headquarters and enterprise support coordination", notes: "Uploaded report identifies GDIT as headquartered in Falls Church, Virginia under General Dynamics.", coordinates: [-77.1711, 38.8823] },
  { id: "gdit-offutt-afb-stratcom", companyId: "gdit", company: "GDIT", city: "Offutt AFB", state: "Nebraska", country: "USA", region: "United States", facilityType: "STRATCOM IT modernization", activity: "Enterprise IT modernization support", notes: "Uploaded contract table ties STRATCOM IT Modernization to Offutt AFB, Nebraska.", coordinates: [-95.9222, 41.1183] },
  { id: "gdit-army-europe-africa-emits2", companyId: "gdit", company: "GDIT", city: "Germany / Africa", country: "Regional", region: "EUCOM / AFRICOM", facilityType: "Army Europe & Africa enterprise IT", activity: "EMITS 2 enterprise mission information technology support", notes: "Uploaded report ties EMITS 2 to Army Europe & Africa with Germany and Africa OCONUS exposure.", coordinates: [10.4515, 51.1657] },
  { id: "gdit-socom-worldwide", companyId: "gdit", company: "GDIT", city: "Worldwide SOCOM missions", country: "Regional", region: "Global", facilityType: "SOCOM IT enterprise support", activity: "Worldwide Special Operations Forces IT mission support", notes: "Uploaded report ties the SOCOM IT Enterprise award to worldwide SOCOM mission support and flags operational-tempo and behavioral-health relevance.", coordinates: [-82.5211, 27.8493] },
  { id: "gdit-cameroon-oconus", companyId: "gdit", company: "GDIT", city: "Cameroon", country: "Cameroon", region: "AFRICOM", facilityType: "OCONUS deployed IT / mission support", activity: "Overseas technology and mission support", notes: "Uploaded report states GDIT career postings explicitly listed Cameroon among active OCONUS recruiting footprints.", coordinates: [12.3547, 7.3697] },
  { id: "gdit-egypt-oconus", companyId: "gdit", company: "GDIT", city: "Egypt", country: "Egypt", region: "CENTCOM / AFRICOM", facilityType: "OCONUS deployed IT / mission support", activity: "Overseas technology and mission support", notes: "Uploaded report states GDIT career postings explicitly listed Egypt among active OCONUS recruiting footprints.", coordinates: [30.8025, 26.8206] },
  { id: "gdit-somalia-oconus", companyId: "gdit", company: "GDIT", city: "Somalia", country: "Somalia", region: "AFRICOM", facilityType: "OCONUS deployed IT / mission support", activity: "Overseas technology and mission support", notes: "Uploaded report states GDIT career postings explicitly listed Somalia among active OCONUS recruiting footprints.", coordinates: [46.1996, 5.1521] },
  { id: "gdit-noaa-nws-supercomputing", companyId: "gdit", company: "GDIT", city: "NOAA / NWS supercomputing footprint", country: "USA", region: "United States", facilityType: "Supercomputing / data systems", activity: "NOAA/NWS supercomputing support", notes: "Uploaded contract table lists NOAA/NWS supercomputing as an approximately $180M domestic multi-year award.", coordinates: [-77.0369, 38.9072] },
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
  {
    id: "gdit-uploaded-intelligence-report-update",
    companyId: "gdit",
    title: "GDIT uploaded intelligence report update",
    createdAt: "2026-06-05",
    summary: "The uploaded GDIT report expands the profile from a generic federal IT target into a segmented workforce-readiness dossier. It identifies roughly 30,000 workers, $8.75B FY2024 revenue, no GDIT-specific published TRIR/fatality data, and BLS benchmark modeling for cleared IT, data center technicians, OCONUS deployed IT/mission personnel, and SOCOM/STRATCOM mission support.",
    signals: [
      "General Dynamics does not publish GDIT-specific TRIR or fatality data in the uploaded report",
      "Cleared IT analysts and engineers represent the largest modeled worker cohort at roughly 22,000",
      "Data center technicians are the highest domestic per-capita risk lane with a 1.80 TRIR benchmark",
      "OCONUS deployed IT/mission personnel are modeled at a higher 2.80 DBA analog TRIR",
      "Total expected injuries are modeled at roughly 108 per year",
      "This update does not include Occu-Med revenue-potential modeling"
    ],
  },
  {
    id: "gdit-oconus-and-regulatory-readiness",
    companyId: "gdit",
    title: "GDIT OCONUS and regulatory readiness signal",
    createdAt: "2026-06-05",
    summary: "The uploaded report flags OCONUS recruiting and support in Cameroon, Egypt, Somalia, Army Europe & Africa, and worldwide SOCOM missions. It also maps GDIT populations to hearing conservation, DBA, DOT, respirator clearance, and personnel-security fitness-for-duty requirements.",
    signals: [
      "Cameroon, Egypt, and Somalia are identified as OCONUS recruiting footprints",
      "EMITS 2 creates Army Europe & Africa exposure including Germany and Africa",
      "SOCOM IT Enterprise creates worldwide mission-support relevance",
      "OSHA 1910.95 hearing conservation may apply to noisy data-center roles",
      "DBA readiness applies to OCONUS deployed personnel",
      "DOT, drug/alcohol, respirator, and personnel-security fitness-for-duty triggers are relevant sub-lanes"
    ],
  },
  {
    id: "gdit-stratcom-socom-behavioral-health",
    companyId: "gdit",
    title: "GDIT STRATCOM / SOCOM behavioral health and continuity signal",
    createdAt: "2026-06-05",
    summary: "The uploaded report identifies STRATCOM and SOCOM worldwide IT support as mission-critical populations where standard EAP pathways may be insufficient because of clearance-sensitive concerns, classified mission stress, high tempo, and continuity sensitivity.",
    signals: [
      "STRATCOM support is framed as mission-critical enterprise IT work with elevated continuity pressure",
      "SOCOM worldwide IT support may expose personnel to austere and classified mission environments",
      "Clearance-sensitive concerns may discourage ordinary behavioral-health utilization",
      "Behavioral-health screening should be framed as readiness and fitness-for-duty support rather than generic wellness",
      "Continuity risk is heightened because cleared personnel cannot be replaced as easily as ordinary commercial IT workers"
    ],
  },
];
