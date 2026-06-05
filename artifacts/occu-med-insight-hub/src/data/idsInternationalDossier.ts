import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const idsInternationalCompanies: Company[] = [
  {
    id: "ids-international",
    name: "IDS International",
    shortName: "IDS",
    sector: "Specialized government services, tactical training, cleared security, expeditionary support, cyber/information warfare training, and OCONUS workforce readiness",
    headquarters: "Arlington, Virginia",
    employees: 1340,
    employeesAsOf: "Approximate range from uploaded IDS intelligence report",
    summary:
      "IDS International has been added as a small, private, high-risk government-services dossier. The uploaded report frames IDS as a specialized contractor whose workforce is smaller than large federal primes but exposed to unusually high-consequence environments: Iraq, Jordan, Djibouti, sensitive U.S. facilities, live-fire training, guard operations, heat stress, travel medicine, and classified-site security.",
    tags: ["Private contractor", "Tactical training", "DECO security", "OCONUS", "DBA", "Heat readiness", "SMEIR", "Cleared facilities"],
  },
];

export const idsInternationalSources: SourceRecord[] = [
  {
    id: "ids-report-company-snapshot",
    companyId: "ids-international",
    label: "IDS company snapshot upload",
    type: "Manual",
    note:
      "Uploaded IDS report describes IDS as a privately held government-services contractor headquartered in Arlington, Virginia, with NAICS 611430, approximately 1,300-1,400 employees, and operations spanning training, logistics, security services, expeditionary support, and cyber/information warfare training.",
  },
  {
    id: "ids-report-operational-sites",
    companyId: "ids-international",
    label: "IDS operational-site exposure upload",
    type: "Manual",
    note:
      "Uploaded IDS report identifies Camp Taji in Iraq, Camp Lemonnier in Djibouti, and the King Abdullah II Special Operations Training Center in Jordan as key OCONUS exposure nodes, with live-fire, tactical training, security, heat, dust, infectious disease, and travel risks.",
  },
  {
    id: "ids-report-deco-security",
    companyId: "ids-international",
    label: "IDS / DECO domestic security upload",
    type: "Manual",
    note:
      "Uploaded IDS report states that DECO is part of the IDS corporate family and is licensed in 38 U.S. states with 16 staffed branch offices, supporting armed and unarmed security, cleared construction surveillance, security systems, and alarm/fire alarm services.",
  },
  {
    id: "ids-report-hidden-exam-menu",
    companyId: "ids-international",
    label: "IDS hidden exam menu upload",
    type: "Manual",
    note:
      "Uploaded IDS report maps practical exam needs to the work: noise/audiometry for ranges and generators, respiratory/PFT clearance for dusty austere sites, HAZWOPER, confined-space clearance, bloodborne pathogens, DOT physicals, DBA pre-deployment, heat illness protocols, FCEs, and ergonomic consultations.",
  },
];

export const idsInternationalMetrics: Metric[] = [
  { id: "ids-employee-range-high", companyId: "ids-international", label: "Approx. workforce high estimate", value: 1340, unit: "count", category: "workforce", trend: 6.1, sourceId: "ids-report-company-snapshot" },
  { id: "ids-employee-range-low", companyId: "ids-international", label: "Approx. workforce low estimate", value: 527, unit: "count", category: "workforce", trend: 3.8, sourceId: "ids-report-company-snapshot" },
  { id: "ids-deco-licensed-states", companyId: "ids-international", label: "DECO licensed states", value: 38, unit: "count", category: "workforce", trend: 7.3, sourceId: "ids-report-deco-security" },
  { id: "ids-deco-branch-offices", companyId: "ids-international", label: "DECO staffed branch offices", value: 16, unit: "count", category: "workforce", trend: 6.9, sourceId: "ids-report-deco-security" },
  { id: "ids-iraq-fte", companyId: "ids-international", label: "Iraq tactical-training FTE", value: 62, unit: "count", category: "workforce", trend: 7.7, sourceId: "ids-report-operational-sites" },
  { id: "ids-iraq-contract-value", companyId: "ids-international", label: "Iraq tactical-training contract ceiling", value: 27870000, unit: "usd", category: "financial", trend: 8.0, sourceId: "ids-report-operational-sites" },
  { id: "ids-security-trir-benchmark", companyId: "ids-international", label: "Security guard BLS TRIR benchmark", value: 1.1, unit: "score", category: "safety", trend: 6.4, sourceId: "ids-report-deco-security" },
  { id: "ids-security-dart-benchmark", companyId: "ids-international", label: "Security guard BLS DART benchmark", value: 0.7, unit: "score", category: "safety", trend: 5.8, sourceId: "ids-report-deco-security" },
  { id: "ids-security-dafw-benchmark", companyId: "ids-international", label: "Security guard BLS DAFW benchmark", value: 0.5, unit: "score", category: "safety", trend: 5.1, sourceId: "ids-report-deco-security" },
  { id: "ids-heat-temp-iraq", companyId: "ids-international", label: "Camp Taji summer heat marker", value: 113, unit: "score", category: "risk", trend: 9.0, sourceId: "ids-report-operational-sites" },
];

export const idsInternationalProfiles: CompanyProfile[] = [
  {
    companyId: "ids-international",
    sections: [
      {
        id: "overview",
        title: "Overview",
        narrative:
          "IDS is a smaller private contractor, but its work is not low-risk. The uploaded report frames IDS as a force-multiplier company operating in tactical training, security, expeditionary support, and cyber/information warfare training. The key profile issue is the mismatch between small headcount and high-consequence environments.",
        bullets: [
          "Privately held government-services contractor headquartered in Arlington, Virginia.",
          "Primary federal registration NAICS is 611430, but actual work extends far beyond classroom training.",
          "Work includes tactical, medical, explosives, security, expeditionary support, and SMEIR cyber/information warfare training.",
          "The workforce is smaller than Amentum, V2X, or Weatherford, but individual exposure intensity is higher for certain worker groups."
        ],
        metrics: ["ids-employee-range-high", "ids-employee-range-low"],
      },
      {
        id: "naics-mismatch",
        title: "NAICS Mismatch: Low-Hazard Label, High-Hazard Work",
        narrative:
          "The uploaded IDS report emphasizes that IDS may look like a professional training company on paper, while its actual work includes live-fire ranges, tactical movement, explosives awareness, armed security, cleared construction surveillance, and austere-site support.",
        bullets: [
          "Official NAICS 611430 can understate risk if used as the only basis for medical-program design.",
          "Tactical and military field training aligns more closely with elevated sprain, fall, weapon, hearing, heat, and vehicle risks.",
          "Domestic DECO security aligns with Security Guards and Patrol Services, where the uploaded report cites TRIR 1.1, DART 0.7, and DAFW 0.5.",
          "Facilities and base-support work may resemble construction and facility-support risk more than classroom training risk."
        ],
        metrics: ["ids-security-trir-benchmark", "ids-security-dart-benchmark", "ids-security-dafw-benchmark"],
      },
      {
        id: "oconus-sites",
        title: "OCONUS Exposure Nodes",
        narrative:
          "IDS's most important exposure nodes in the uploaded report are Camp Taji in Iraq, Camp Lemonnier in Djibouti, and the King Abdullah II Special Operations Training Center in Jordan. These sites combine tactical training, base security, heat, dust, travel medicine, infectious disease, and security risks.",
        bullets: [
          "Camp Taji, Iraq: Iraq QK Regiment tactical ground training support, live-fire, tactical movement, vehicle use, heat, dust, and infectious-disease environment.",
          "Camp Lemonnier, Djibouti: force-protection and physical-security support with heat, humidity, vector-borne disease, perimeter security, and access-control risks.",
          "KAII SOTC, Jordan: combat training support with high-intensity physical training, live-fire/CQB, explosives, altitude, and desert climate stress.",
          "These are the strongest lanes for pre-deployment, post-deployment, heat-readiness, and fitness-for-duty protocols."
        ],
        metrics: ["ids-iraq-fte", "ids-iraq-contract-value", "ids-heat-temp-iraq"],
      },
      {
        id: "deco-security",
        title: "DECO Domestic Security Exposure",
        narrative:
          "DECO creates the main domestic occupational-health exposure in the IDS profile. The uploaded report describes armed and unarmed guards, cleared construction surveillance technicians, security systems, alarm monitoring, and work at sensitive federal facilities.",
        bullets: [
          "DECO is licensed in 38 states and has 16 staffed branch offices.",
          "Domestic worker groups may include armed/unarmed guards, cleared construction surveillance technicians, and security-system personnel.",
          "Likely risk drivers include long shifts, night work, stress/fatigue, slips/trips/falls, vehicle incidents, and potential exposure to violence.",
          "Relevant protocols include pre-employment physicals, firearms/use-of-force fitness assessments, vision, hearing, cardiovascular review, sleep/fatigue screening, and behavioral-health screening."
        ],
        metrics: ["ids-deco-licensed-states", "ids-deco-branch-offices", "ids-security-trir-benchmark"],
      },
      {
        id: "exam-menu",
        title: "Hidden Exam Menu",
        narrative:
          "The uploaded report gives IDS a broad practical exam menu beyond standard physicals. The strongest differentiators are DBA pre-deployment, heat-readiness, weapons/fitness-for-duty, audiometry, respiratory clearance, travel medicine, and post-deployment follow-up.",
        bullets: [
          "Noise/hearing conservation: baseline and annual audiograms for weapons ranges, explosives training, tactical driving, and generators.",
          "Respiratory/PFT clearance: dusty, hot, austere sites including Iraq and Djibouti.",
          "Bloodborne pathogens: tactical medical trainers and camp medical staff.",
          "DOT physicals: instructors and staff driving buses, tactical trucks, or other CMVs.",
          "DBA pre-deployment and post-deployment exams for OCONUS staff in Iraq, Djibouti, Jordan, and similar locations.",
          "Heat illness protocol: screening, acclimatization planning, hydration/electrolyte counseling, and medical follow-up for high-heat work."
        ],
        metrics: ["ids-heat-temp-iraq", "ids-security-trir-benchmark"],
      },
      {
        id: "risk-signals",
        title: "Risk Signals",
        narrative:
          "IDS does not publish TRIR, DART, or LTIR, so the profile has to be built from operations, comparable benchmarks, and contract-risk signals. The uploaded report points to concentration risk, classification mismatch, clearance sensitivity, scale/procurement behavior, and heat/security/travel risk.",
        bullets: [
          "The Iraq tactical-training contract is a concentrated high-risk contract with 62 average FTE and a multi-year term.",
          "A stop-work order was issued in August 2025, showing that overseas staffing demand can be spiky and contract-dependent.",
          "Sensitive and cleared environments require careful medical documentation that protects HIPAA privacy and avoids sloppy clearance-impacting language.",
          "Procurement may be more relationship-driven and flexible than mega-prime RFPs, but volume can shift quickly if a regional relationship changes."
        ],
        metrics: ["ids-iraq-fte", "ids-iraq-contract-value"],
      },
      {
        id: "source-library",
        title: "Source Library",
        narrative:
          "The IDS profile is grounded in the uploaded IDS intelligence report and its extracted operational, NAICS, benchmark, contract, and regulatory themes.",
        bullets: [
          "Company snapshot and corporate-family notes",
          "Camp Taji, Camp Lemonnier, and Jordan training-center exposure notes",
          "DECO domestic security footprint notes",
          "NAICS mismatch and BLS benchmark discussion",
          "Hidden exam menu and heat-standard exposure discussion"
        ],
        metrics: [],
      },
    ],
  },
];

export const idsInternationalLocations: LocationRecord[] = [
  { id: "ids-arlington", companyId: "ids-international", company: "IDS International", city: "Arlington", state: "Virginia", country: "USA", region: "United States", facilityType: "Headquarters", activity: "Corporate and government services management", notes: "Headquarters location from uploaded IDS report.", coordinates: [-77.091, 38.8816] },
  { id: "ids-camp-taji", companyId: "ids-international", company: "IDS International", city: "Camp Taji", country: "Iraq", region: "Middle East", facilityType: "Tactical training support site", activity: "Iraq QK Regiment tactical ground training support", notes: "Uploaded IDS report describes live-fire, tactical movement, military vehicle, heat, dust, infectious disease, and security exposures.", coordinates: [44.256, 33.533] },
  { id: "ids-camp-lemonnier", companyId: "ids-international", company: "IDS International", city: "Camp Lemonnier", country: "Djibouti", region: "Horn of Africa", facilityType: "Force protection / physical security support", activity: "Guard services, antiterrorism support, and installation security support", notes: "Uploaded IDS report describes heat, humidity, vector-borne disease, perimeter security, and access-control risks.", coordinates: [43.148, 11.547] },
  { id: "ids-kaii-sotc", companyId: "ids-international", company: "IDS International", city: "Amman / KAII SOTC", country: "Jordan", region: "Middle East", facilityType: "Combat training center", activity: "Iraqi Special Operations Forces training support", notes: "Uploaded IDS report describes high-intensity physical training, CQB/live-fire, explosives, altitude, and desert climate stress.", coordinates: [35.93, 31.95] },
  { id: "ids-deco-domestic", companyId: "ids-international", company: "IDS International / DECO", city: "DECO domestic security footprint", country: "USA", region: "United States", facilityType: "Security services network", activity: "Armed/unarmed guards, cleared construction surveillance, alarm monitoring, and security systems", notes: "Uploaded IDS report states DECO is licensed in 38 states with 16 staffed branch offices.", coordinates: [-98.5795, 39.8283] },
];

export const idsInternationalReports: ReportRecord[] = [
  {
    id: "ids-high-risk-specialist-signal",
    companyId: "ids-international",
    title: "IDS International high-risk specialist and deployment-readiness signal",
    createdAt: "2026-06-04",
    summary:
      "IDS International is a smaller, private government-services contractor whose occupational-health relevance comes from the intensity of its work rather than large headcount. The uploaded report connects tactical training, DECO domestic security, Camp Taji, Camp Lemonnier, Jordan training support, heat stress, travel medicine, weapons/range exposure, respiratory clearance, DBA deployment exams, and clearance-sensitive documentation into one high-consequence workforce-readiness profile.",
    signals: [
      "Approximate workforce range: 527 to 1,342 employees",
      "DECO licensed in 38 states with 16 staffed branch offices",
      "Iraq tactical-training contract modeled at 62 average FTE",
      "Primary NAICS 611430 understates actual tactical/security/base-support risk",
      "Security guard BLS benchmark cited at TRIR 1.1, DART 0.7, DAFW 0.5",
      "Key exam lanes: DBA deployment, heat readiness, audiometry, respiratory clearance, DOT, bloodborne pathogens, FCE, and guard fitness-for-duty"
    ],
  },
];
