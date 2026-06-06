import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const versarGlobalSolutionsCompanies: Company[] = [
  {
    id: "versar-global-solutions",
    name: "Versar Global Solutions",
    shortName: "Versar",
    sector: "Environmental remediation, munitions response, construction management, security systems, cyber/intelligence support, and OCONUS infrastructure services",
    headquarters: "Washington, D.C.",
    employees: 2000,
    employeesAsOf: "Nearly 2,000 team members per uploaded Versar intelligence report",
    summary:
      "Versar Global Solutions has been added as a private-equity-backed mid-tier contractor whose occupational-health profile is driven by high-hazard environmental remediation, munitions/UXO response, rapid acquisition growth, and new OCONUS construction-management exposure through the Parsons-Versar Middle East CPSS contract.",
    tags: ["Private contractor", "Kingswood", "HAZWOPER", "HTRW", "MEC/UXO", "USACE", "Louis Berger", "CENTCOM", "DBA", "Heat readiness"],
  },
];

export const versarGlobalSolutionsSources: SourceRecord[] = [
  {
    id: "versar-report-snapshot",
    companyId: "versar-global-solutions",
    label: "Versar company snapshot upload",
    type: "Manual",
    note:
      "Uploaded Versar report describes the company as a privately held government-services contractor headquartered in Washington, D.C., with nearly 2,000 team members, Kingswood Capital ownership, and core NAICS spanning remediation, construction, engineering, and security guards.",
  },
  {
    id: "versar-report-ma-growth",
    companyId: "versar-global-solutions",
    label: "Versar acquisition-growth upload",
    type: "Manual",
    note:
      "Uploaded Versar report states the company expanded from roughly 350 employees in 2017 to nearly 2,000 by 2023 after acquisitions including BayFirst, Black & Veatch Environmental Services, and WSP Global's Louis Berger unit.",
  },
  {
    id: "versar-report-hazwoper",
    companyId: "versar-global-solutions",
    label: "Versar HAZWOPER mandate upload",
    type: "Manual",
    note:
      "Uploaded Versar report identifies HAZWOPER as the central mandatory medical-surveillance obligation for environmental field workers involved in hazardous waste operations, emergency response, contaminated-site work, PPE use, and HTRW assignments.",
  },
  {
    id: "versar-report-uxo-munitions",
    companyId: "versar-global-solutions",
    label: "Versar munitions-response upload",
    type: "Manual",
    note:
      "Uploaded Versar report identifies munitions response, MEC/UXO, CWM, range remediation, and USACE Huntsville EMR2 work as the highest-risk portion of the Versar occupational-health profile.",
  },
  {
    id: "versar-report-cpss",
    companyId: "versar-global-solutions",
    label: "Versar Middle East CPSS upload",
    type: "Manual",
    note:
      "Uploaded Versar report describes the Parsons-Versar Middle East CPSS contract as new OCONUS deployment exposure across Saudi Arabia, Qatar, UAE, Kuwait, and surrounding countries, with DBA, heat, construction, and security risk implications.",
  },
];

export const versarGlobalSolutionsMetrics: Metric[] = [
  { id: "versar-workforce-2017", companyId: "versar-global-solutions", label: "Estimated workforce 2017", value: 350, unit: "count", category: "workforce", trend: 3.5, sourceId: "versar-report-ma-growth" },
  { id: "versar-workforce-2021", companyId: "versar-global-solutions", label: "Estimated workforce 2021", value: 700, unit: "count", category: "workforce", trend: 4.8, sourceId: "versar-report-ma-growth" },
  { id: "versar-workforce-2023", companyId: "versar-global-solutions", label: "Estimated workforce 2023", value: 2000, unit: "count", category: "workforce", trend: 8.8, sourceId: "versar-report-ma-growth" },
  { id: "versar-headcount-growth-multiple", companyId: "versar-global-solutions", label: "Workforce growth multiple", value: 5, unit: "score", category: "risk", trend: 8.6, sourceId: "versar-report-ma-growth" },
  { id: "versar-revenue-estimate-2025", companyId: "versar-global-solutions", label: "Estimated annual company revenue", value: 500000000, unit: "usd", category: "financial", trend: 7.2, sourceId: "versar-report-snapshot" },
  { id: "versar-htrw-revenue-mix", companyId: "versar-global-solutions", label: "Environmental remediation / HTRW mix", value: 45, unit: "percentage", category: "financial", trend: 8.2, sourceId: "versar-report-hazwoper" },
  { id: "versar-munitions-revenue-mix", companyId: "versar-global-solutions", label: "Munitions response mix", value: 20, unit: "percentage", category: "financial", trend: 9.2, sourceId: "versar-report-uxo-munitions" },
  { id: "versar-construction-management-mix", companyId: "versar-global-solutions", label: "Construction management mix", value: 20, unit: "percentage", category: "financial", trend: 7.1, sourceId: "versar-report-cpss" },
  { id: "versar-security-systems-mix", companyId: "versar-global-solutions", label: "Security systems mix", value: 10, unit: "percentage", category: "financial", trend: 5.2, sourceId: "versar-report-snapshot" },
  { id: "versar-cyber-mix", companyId: "versar-global-solutions", label: "IT / cyber mix", value: 5, unit: "percentage", category: "financial", trend: 3.4, sourceId: "versar-report-snapshot" },
  { id: "versar-hazwoper-trir", companyId: "versar-global-solutions", label: "Environmental remediation BLS TRIR", value: 1.7, unit: "score", category: "safety", trend: 7.1, sourceId: "versar-report-hazwoper" },
  { id: "versar-heavy-construction-trir", companyId: "versar-global-solutions", label: "Heavy construction / munitions-site BLS TRIR", value: 2.1, unit: "score", category: "safety", trend: 7.8, sourceId: "versar-report-uxo-munitions" },
  { id: "versar-uxo-risk-score", companyId: "versar-global-solutions", label: "Munitions response worker risk score", value: 10, unit: "score", category: "risk", trend: 9.8, sourceId: "versar-report-uxo-munitions" },
  { id: "versar-environmental-risk-score", companyId: "versar-global-solutions", label: "Environmental field worker risk score", value: 9, unit: "score", category: "risk", trend: 9.0, sourceId: "versar-report-hazwoper" },
  { id: "versar-cpss-contract-value", companyId: "versar-global-solutions", label: "Parsons-Versar Middle East CPSS", value: 75000000, unit: "usd", category: "financial", trend: 7.9, sourceId: "versar-report-cpss" },
  { id: "versar-middle-east-heat", companyId: "versar-global-solutions", label: "CENTCOM summer heat marker", value: 120, unit: "score", category: "risk", trend: 9.1, sourceId: "versar-report-cpss" },
];

export const versarGlobalSolutionsProfiles: CompanyProfile[] = [
  {
    companyId: "versar-global-solutions",
    sections: [
      {
        id: "overview",
        title: "Overview",
        narrative:
          "Versar is a privately held, Kingswood-backed government-services contractor with a high-hazard operating profile. The uploaded report frames Versar as a transformed mid-tier contractor whose modern risk picture is built around environmental remediation, munitions response, construction management, security systems, and cyber/intelligence support.",
        bullets: [
          "Headquartered in Washington, D.C., with nearly 2,000 team members.",
          "Private-equity-backed by Kingswood Capital after the 2017 take-private transaction.",
          "Core operating lanes include remediation, construction, engineering, security systems, and cyber/intelligence support.",
          "The occupational-health profile is more hazardous than a simple engineering-services label would suggest."
        ],
        metrics: ["versar-workforce-2023", "versar-revenue-estimate-2025"],
      },
      {
        id: "acquisition-transformation",
        title: "Acquisition Transformation",
        narrative:
          "The uploaded report emphasizes that Versar's current workforce is the result of rapid acquisition integration. The headcount expansion from roughly 350 to nearly 2,000 workers is itself a risk signal because surveillance tracking, baseline exams, medical histories, HAZWOPER records, and provider networks have to scale faster than the business.",
        bullets: [
          "2017: Kingswood take-private created the modern platform.",
          "2021: BayFirst added network engineering, cybersecurity, and intelligence-support capability.",
          "2021: Black & Veatch Environmental Services added EPA/USACE remediation depth.",
          "2023: WSP Global's Louis Berger unit added a large OCONUS construction-management and infrastructure workforce.",
          "Rapid acquisition integration raises the risk of inconsistent occ-med records, missed surveillance cycles, and uneven safety culture across inherited populations."
        ],
        metrics: ["versar-workforce-2017", "versar-workforce-2021", "versar-workforce-2023", "versar-headcount-growth-multiple"],
      },
      {
        id: "risk-architecture",
        title: "Risk Architecture",
        narrative:
          "The uploaded report separates Versar's worker risk into HTRW environmental field work, munitions response, construction management, security systems, and IT/cyber. The most important distinction is that munitions response and HAZWOPER work carry risks that are not captured well by broad NAICS labels.",
        bullets: [
          "Environmental remediation / HTRW is the founding identity and the largest hazard-bearing work lane.",
          "Munitions response includes MEC, UXO, CWM, range remediation, controlled detonations, excavation, and remote-site response.",
          "Construction management includes CONUS and OCONUS work, including Middle East CPSS exposure.",
          "Security systems adds specialty trade and facility-security exposure.",
          "IT/cyber is lower acute physical risk but still relevant for ergonomics, vision, stress, and travel-linked work."
        ],
        metrics: ["versar-htrw-revenue-mix", "versar-munitions-revenue-mix", "versar-construction-management-mix", "versar-security-systems-mix", "versar-cyber-mix"],
      },
      {
        id: "hazwoper",
        title: "HAZWOPER Medical Surveillance",
        narrative:
          "HAZWOPER is the central compliance issue in Versar's dossier. The uploaded report states that workers handling, investigating, sampling, remediating, or responding to hazardous substances require structured medical surveillance, not just a basic clinic physical.",
        bullets: [
          "Applies to HTRW sites, contaminated-site field staff, supervisors, equipment operators, field engineers, emergency responders, and workers using Level A-D PPE.",
          "Medical surveillance should include pre-placement, annual, termination, and post-incident evaluations when applicable.",
          "Exam scope should be site-specific: renal, hepatic, pulmonary, neurological, cardiovascular review, physical exam, and hazard-specific labs when indicated.",
          "Heavy metals, chlorinated solvents, respiratory protection, and PPE burden are central to the medical review.",
          "This is the most defensible compliance-driven program lane for Versar."
        ],
        metrics: ["versar-hazwoper-trir", "versar-environmental-risk-score"],
      },
      {
        id: "munitions-response",
        title: "Munitions Response / UXO / CWM",
        narrative:
          "The uploaded report identifies munitions response as Versar's highest-consequence workforce category. Workers may be involved in detection, excavation, disposal, range remediation, CWM identification, and work around unexploded ordnance or legacy military munitions.",
        bullets: [
          "Risk drivers include detonation, blast overpressure, hearing damage, chemical residues, remote-site logistics, and long medevac times.",
          "Medical programs should not treat these workers like generic environmental staff.",
          "Relevant protocols include enhanced audiometric baseline, blast-exposure documentation, musculoskeletal fitness, psychological resilience review, and respirator/PPE clearance.",
          "A serious event can trigger stop-work, USACE scrutiny, investigation, and reputational impact."
        ],
        metrics: ["versar-munitions-revenue-mix", "versar-heavy-construction-trir", "versar-uxo-risk-score"],
      },
      {
        id: "oconus-cpss",
        title: "OCONUS Construction Management and DBA Exposure",
        narrative:
          "The Parsons-Versar Middle East CPSS contract creates a newer OCONUS deployment lane for the current Versar platform. The uploaded report ties this to Saudi Arabia, Kuwait, UAE, Qatar, and surrounding countries, with construction-site hazards, extreme heat, DBA requirements, and security exposure.",
        bullets: [
          "Middle East CPSS work introduces deployment-readiness needs for construction managers, engineers, and quality-assurance personnel.",
          "Risk drivers include 110-120°F heat, falls, struck-by hazards, cranes, vehicles, security risks, travel medicine, and medical evacuation planning.",
          "Relevant protocols include DBA pre-deployment clearance, heat-readiness screening, cardiovascular review, vaccination/travel medicine, and post-deployment follow-up.",
          "Louis Berger's legacy OCONUS workforce may have experience, but the current integrated Versar platform still needs consistent documentation and standardized protocols."
        ],
        metrics: ["versar-cpss-contract-value", "versar-middle-east-heat"],
      },
      {
        id: "geographic-hotspots",
        title: "Geographic Hotspots",
        narrative:
          "The uploaded report maps Versar's field exposure across CONUS FUDS/IRP sites, USACE munitions-response districts, Middle East CPSS locations, and California proximity opportunities.",
        bullets: [
          "New Mexico: Cannon AFB and Holloman AFB fence-to-fence environmental-services footprint.",
          "Colorado, Wyoming, Montana: USACE Northwestern Division remediation with heavy metals, radiological contamination, uranium mill, and FUDS exposure potential.",
          "Southeast and Mid-Atlantic: dense FUDS and district remediation opportunities.",
          "Huntsville Engineering & Support Center: central munitions-response vehicle and EMR2-related work.",
          "California: Versar Security Systems OSHA activity and potential relevance around Vandenberg/Edwards/South Pacific Division work."
        ],
        metrics: ["versar-environmental-risk-score", "versar-uxo-risk-score"],
      },
      {
        id: "exam-protocols",
        title: "Exam Protocol Recommendations",
        narrative:
          "The uploaded report's best operational use is turning Versar's exposure map into a protocol map. The strongest lanes are HAZWOPER surveillance, munitions-response fitness, respirator clearance, chemical-exposure monitoring, DBA deployment clearance, heat readiness, and post-acquisition baseline normalization.",
        bullets: [
          "HAZWOPER annual physicals for environmental field workers.",
          "Respirator medical clearance and PFT protocols for HTRW and dusty/austere-site workers.",
          "Chemical-exposure surveillance based on site hazards, including lead, arsenic, chromium, mercury, TCE, and PCE where applicable.",
          "Munitions-response physicals with audiometry, blast-exposure history, musculoskeletal readiness, and psychological resilience review.",
          "DBA pre-deployment and post-deployment evaluations for Middle East and other OCONUS personnel.",
          "Heat-readiness protocol for CENTCOM and desert remediation/construction work.",
          "Post-acquisition baseline exams for inherited Louis Berger and Black & Veatch populations where records may not align."
        ],
        metrics: ["versar-hazwoper-trir", "versar-uxo-risk-score", "versar-middle-east-heat"],
      },
      {
        id: "risk-signals",
        title: "Risk Signals",
        narrative:
          "Versar's strongest risk signals are rapid acquisition integration, HAZWOPER tracking gaps, newly scaled OCONUS exposure, munitions-response fatality/stop-work risk, and private-equity exit pressure. These do not require public TRIR data to be actionable.",
        bullets: [
          "Rapid growth creates risk of inconsistent medical records and uneven baseline surveillance.",
          "HAZWOPER compliance gaps can become audit, OSHA, or USACE-due-diligence problems.",
          "Middle East CPSS ramp-up creates deployment medical-clearance and heat-readiness urgency.",
          "Munitions casualties can become contract-ending or stop-work events.",
          "Kingswood ownership means compliance cleanliness and workers' comp documentation may matter in exit diligence."
        ],
        metrics: ["versar-headcount-growth-multiple", "versar-cpss-contract-value", "versar-uxo-risk-score"],
      },
      {
        id: "source-library",
        title: "Source Library",
        narrative:
          "The Versar profile is grounded in the uploaded Versar intelligence report and its extracted acquisition, business-line, HAZWOPER, munitions, OCONUS, benchmark, hotspot, and risk-signal themes.",
        bullets: [
          "Company snapshot and Kingswood ownership notes",
          "Acquisition transformation and Louis Berger workforce-growth notes",
          "Revenue mix and high-hazard work distribution charts",
          "BLS TRIR benchmark table and worker-risk chart",
          "HAZWOPER medical-surveillance section",
          "Middle East CPSS and geographic hotspot sections"
        ],
        metrics: [],
      }
    ],
  },
];

export const versarGlobalSolutionsLocations: LocationRecord[] = [
  { id: "versar-washington-dc", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Washington", state: "District of Columbia", country: "USA", region: "United States", facilityType: "Headquarters", activity: "Corporate management and government-services administration", notes: "Headquarters from uploaded Versar report.", coordinates: [-77.0369, 38.9072] },
  { id: "versar-springfield-va", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Springfield", state: "Virginia", country: "USA", region: "United States", facilityType: "Legacy corporate footprint", activity: "Former headquarters / legacy Versar footprint", notes: "Uploaded report notes Washington, D.C. headquarters, formerly Springfield, Virginia.", coordinates: [-77.1872, 38.7893] },
  { id: "versar-cannon-afb", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Cannon AFB", state: "New Mexico", country: "USA", region: "Southwest", facilityType: "Environmental services site", activity: "Fence-to-fence environmental services and remediation support", notes: "Uploaded report identifies Cannon AFB as part of a 20+ year New Mexico fence-to-fence environmental-services presence.", coordinates: [-103.322, 34.3828] },
  { id: "versar-holloman-afb", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Holloman AFB", state: "New Mexico", country: "USA", region: "Southwest", facilityType: "Environmental services site", activity: "Fence-to-fence environmental services and remediation support", notes: "Uploaded report identifies Holloman AFB as part of a 20+ year New Mexico fence-to-fence environmental-services presence.", coordinates: [-106.1065, 32.8525] },
  { id: "versar-huntsville-emr2", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Huntsville", state: "Alabama", country: "USA", region: "Southeast", facilityType: "USACE munitions-response contract hub", activity: "Environmental and munitions response restricted services support", notes: "Uploaded report identifies USACE Huntsville as the central munitions-response vehicle for EMR2-related work.", coordinates: [-86.5861, 34.7304] },
  { id: "versar-vandenberg", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Vandenberg Space Force Base", state: "California", country: "USA", region: "California / Occu-Med proximity", facilityType: "Potential remediation footprint", activity: "Environmental remediation / USACE LA District market adjacency", notes: "Uploaded report flags Vandenberg as strategically relevant to Occu-Med's geographic market even where Versar may participate as competitor or subcontractor rather than prime.", coordinates: [-120.5724, 34.742] },
  { id: "versar-edwards", companyId: "versar-global-solutions", company: "Versar Global Solutions", city: "Edwards AFB", state: "California", country: "USA", region: "California / Occu-Med proximity", facilityType: "Potential IRP/remediation footprint", activity: "Environmental remediation / South Pacific Division adjacency", notes: "Uploaded report flags Edwards AFB and USACE South Pacific Division work as potential California-relevant remediation exposure.", coordinates: [-117.8837, 34.9054] },
  { id: "versar-middle-east-cpss", companyId: "versar-global-solutions", company: "Parsons-Versar JV", city: "CENTCOM CPSS footprint", country: "Saudi Arabia / Qatar / UAE / Kuwait", region: "Middle East", facilityType: "OCONUS construction management footprint", activity: "USACE Middle East District construction phase support services", notes: "Uploaded report identifies Saudi Arabia, Qatar, UAE, Kuwait, and surrounding countries as CPSS deployment locations with heat, construction, DBA, and security exposures.", coordinates: [45.0, 24.0] },
];

export const versarGlobalSolutionsReports: ReportRecord[] = [
  {
    id: "versar-hazwoper-uxo-cpss-signal",
    companyId: "versar-global-solutions",
    title: "Versar Global Solutions HAZWOPER, UXO, and OCONUS readiness signal",
    createdAt: "2026-06-04",
    summary:
      "Versar Global Solutions is now represented as a high-hazard mid-tier federal contractor with three primary exposure engines: HTRW/HAZWOPER environmental remediation, MEC/UXO munitions response, and newly scaled OCONUS construction management through the Parsons-Versar Middle East CPSS contract. The uploaded report also flags rapid acquisition integration and private-equity ownership as important compliance and safety-risk accelerators.",
    signals: [
      "Nearly 2,000 workers after rapid acquisition growth from roughly 350 in 2017",
      "Louis Berger acquisition added the largest OCONUS construction-management workforce block",
      "Environmental remediation / HTRW is the largest high-hazard work lane",
      "Munitions response is the highest-consequence work lane, with MEC/UXO/CWM and blast/hearing exposure",
      "HAZWOPER surveillance is the core compliance framework for environmental field workers",
      "Middle East CPSS creates DBA, heat-readiness, travel medicine, and construction-site clearance needs",
      "California proximity matters through Vandenberg, Edwards, Versar Security Systems activity, and USACE South Pacific Division adjacency"
    ],
  },
];
