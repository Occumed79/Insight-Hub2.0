import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const freeportWeatherfordCompanies: Company[] = [
  {
    id: "freeport-mcmoran",
    name: "Freeport-McMoRan",
    shortName: "FCX",
    sector: "Copper mining, MSHA-regulated operations, contractor safety, hearing conservation, silica surveillance, heat readiness, and altitude readiness",
    headquarters: "Phoenix, Arizona",
    employees: 34800,
    employeesAsOf: "North America workforce planning estimate from revised FCX report",
    summary: "Freeport-McMoRan has been added as a mining safety and MSHA-compliance dossier. The revised report highlights a split safety story: total TRIR is strong, but employee TRIR, LTIR, near-miss frequency, fatalities, and contractor exposure point to readiness and surveillance gaps.",
    tags: ["Copper mining", "MSHA", "Contractor safety", "Near misses", "Hearing conservation", "Silica surveillance"],
  },
  {
    id: "weatherford",
    name: "Weatherford International",
    shortName: "WFRD",
    sector: "Oilfield services, drilling support, global operations, near-miss reporting, remote workforce readiness, and hearing conservation",
    headquarters: "Houston, Texas",
    employees: 19000,
    employeesAsOf: "2024 global workforce from revised Weatherford report",
    summary: "Weatherford has been revised as a best-in-class oilfield-services safety dossier. The revised report emphasizes 0.12 TRIR, zero fatalities, externally assured safety data, a small North American injury burden, and a large near-miss pool showing persistent exposure pressure.",
    tags: ["Oilfield services", "TRIR benchmark", "Near misses", "Remote work", "International workforce", "Hearing conservation"],
  },
];

export const freeportWeatherfordSources: SourceRecord[] = [
  { id: "fcx-revised-report-upload", companyId: "freeport-mcmoran", label: "Revised FCX intelligence report upload", type: "Manual", note: "Uploaded revised FCX report states 2024 total TRIR 0.69; employee TRIR 0.77; contractor TRIR 0.57; near-miss rate 1.61; fatalities 5; recordable events 419; and employee LTIR 0.33." },
  { id: "fcx-msha-sierrita-upload", companyId: "freeport-mcmoran", label: "Revised FCX MSHA / Sierrita hotspot upload", type: "Manual", note: "Uploaded revised FCX report identifies Sierrita Mine as the Arizona FCX site with the highest 2025 MSHA penalty total, approximately $61.2K across four citations, including two higher-severity penalties." },
  { id: "wfrd-revised-report-upload", companyId: "weatherford", label: "Revised Weatherford intelligence report upload", type: "Manual", note: "Uploaded revised Weatherford report states 2024 TRIR 0.12, LTIR 0.02, 8 lost-time injuries, 42 recordable incidents, 0 fatalities, near-miss frequency rate 17.87, and 71,457,567 hours worked." },
  { id: "wfrd-na-footprint-upload", companyId: "weatherford", label: "Revised Weatherford domestic-footprint analysis upload", type: "Manual", note: "Uploaded revised Weatherford report states 81% of Weatherford's 19,000 employees are outside North America and North America is approximately 3,518 workers." },
];

export const freeportWeatherfordMetrics: Metric[] = [
  { id: "fcx-total-trir-2024", companyId: "freeport-mcmoran", label: "2024 total TRIR", value: 0.69, unit: "score", category: "safety", trend: -0.01, sourceId: "fcx-revised-report-upload" },
  { id: "fcx-employee-trir-2024", companyId: "freeport-mcmoran", label: "2024 employee TRIR", value: 0.77, unit: "score", category: "safety", trend: 0.02, sourceId: "fcx-revised-report-upload" },
  { id: "fcx-contractor-trir-2024", companyId: "freeport-mcmoran", label: "2024 contractor TRIR", value: 0.57, unit: "score", category: "safety", trend: -0.05, sourceId: "fcx-revised-report-upload" },
  { id: "fcx-near-miss-rate-2024", companyId: "freeport-mcmoran", label: "2024 near-miss rate", value: 1.61, unit: "score", category: "safety", trend: 7.3, sourceId: "fcx-revised-report-upload" },
  { id: "fcx-fatalities-2024", companyId: "freeport-mcmoran", label: "2024 fatalities", value: 5, unit: "count", category: "safety", trend: 9.5, sourceId: "fcx-revised-report-upload" },
  { id: "fcx-sierrita-penalties-2025", companyId: "freeport-mcmoran", label: "Sierrita 2025 MSHA penalties", value: 61200, unit: "usd", category: "risk", trend: 8.6, sourceId: "fcx-msha-sierrita-upload" },
  { id: "wfrd-global-workforce", companyId: "weatherford", label: "Global workforce", value: 19000, unit: "count", category: "workforce", trend: 7.4, sourceId: "wfrd-revised-report-upload" },
  { id: "wfrd-north-america-workers", companyId: "weatherford", label: "North America workers", value: 3518, unit: "count", category: "workforce", trend: 5.2, sourceId: "wfrd-na-footprint-upload" },
  { id: "wfrd-international-workforce", companyId: "weatherford", label: "Workforce outside North America", value: 81, unit: "percent", category: "workforce", trend: 8.5, sourceId: "wfrd-na-footprint-upload" },
  { id: "wfrd-trir-2024", companyId: "weatherford", label: "2024 TRIR", value: 0.12, unit: "score", category: "safety", trend: -9.3, sourceId: "wfrd-revised-report-upload" },
  { id: "wfrd-ltir-2024", companyId: "weatherford", label: "2024 LTIR", value: 0.02, unit: "score", category: "safety", trend: -9.0, sourceId: "wfrd-revised-report-upload" },
  { id: "wfrd-recordables-2024", companyId: "weatherford", label: "2024 recordable incidents", value: 42, unit: "count", category: "safety", trend: -4.6, sourceId: "wfrd-revised-report-upload" },
  { id: "wfrd-near-misses-2024", companyId: "weatherford", label: "2024 near misses", value: 6380, unit: "count", category: "safety", trend: 8.2, sourceId: "wfrd-revised-report-upload" },
  { id: "wfrd-near-miss-frequency", companyId: "weatherford", label: "Near-miss frequency rate", value: 17.87, unit: "score", category: "safety", trend: 8.4, sourceId: "wfrd-revised-report-upload" },
];

export const freeportWeatherfordProfiles: CompanyProfile[] = [
  { companyId: "freeport-mcmoran", sections: [
    { id: "overview", title: "Overview", narrative: "FCX presents two safety stories at the same time. The headline TRIR remains strong versus the BLS copper-mining benchmark, but employee TRIR, employee LTIR, near-miss frequency, and fatalities all worsened.", bullets: ["2024 total TRIR is 0.69, nearly flat versus 0.70 in 2023.", "Employee TRIR worsened from 0.75 to 0.77 while contractor TRIR improved from 0.62 to 0.57.", "Near-miss rate rose from 0.93 to 1.61, a 73% increase.", "Fatalities rose from 2 to 5, with four of five involving contract personnel."], metrics: ["fcx-total-trir-2024", "fcx-employee-trir-2024", "fcx-near-miss-rate-2024", "fcx-fatalities-2024"] },
    { id: "contractor-gap", title: "Contractor Gap", narrative: "The contractor population is the most actionable risk gap in the FCX profile. Four of the five 2024 fatalities were contract personnel.", bullets: ["Contractor medical screening should be compared against direct-employee standards.", "Relevant workflows include pre-placement quality, fit-for-duty review, periodic surveillance, and return-to-work documentation."], metrics: ["fcx-contractor-trir-2024", "fcx-fatalities-2024"] },
    { id: "msha-hotspot-sierrita", title: "MSHA Hotspot: Sierrita", narrative: "The revised report flags Sierrita Mine in Pima County, Arizona as the clearest site-level hotspot, with approximately $61.2K in 2025 MSHA penalties across four citations.", bullets: ["Sierrita is the Arizona FCX site with the highest 2025 MSHA penalty total in the revised report.", "This supports a site-specific focus on medical-surveillance documentation quality."], metrics: ["fcx-sierrita-penalties-2025"] },
    { id: "msha-template-gap", title: "MSHA Template Gap", narrative: "FCX mine sites require MSHA-aware workflows, not generic OSHA-only urgent-care templates.", bullets: ["Hearing conservation, silica surveillance, B-reader chest X-ray needs, pulmonary testing, and Part 50 reporting nuance should be reflected.", "A provider workflow built only for OSHA compliance is not enough for FCX mine sites."], metrics: ["fcx-total-trir-2024", "fcx-sierrita-penalties-2025"] }
  ] },
  { companyId: "weatherford", sections: [
    { id: "overview", title: "Overview", narrative: "Weatherford is a sustain-the-advantage story. The company shows a 2024 TRIR of 0.12, LTIR of 0.02, zero fatalities, 42 recordable incidents, and 71.46M hours worked.", bullets: ["2024 TRIR is 0.12, described in the revised report as 93% below the BLS oilfield-services benchmark.", "2024 LTIR is 0.02, with only 8 lost-time injuries across the company.", "The near-miss pool is large enough to show persistent exposure while recordable injuries remain exceptionally low."], metrics: ["wfrd-trir-2024", "wfrd-ltir-2024", "wfrd-recordables-2024", "wfrd-near-misses-2024"] },
    { id: "domestic-footprint", title: "Domestic Footprint Reality", narrative: "Weatherford is a smaller domestic opportunity because most of the workforce sits outside North America.", bullets: ["81% of the 19,000-worker population is outside North America.", "North America is approximately 3,518 workers, or 19% of the total.", "At current TRIR, the North American recordable injury burden is small in absolute terms."], metrics: ["wfrd-global-workforce", "wfrd-international-workforce", "wfrd-north-america-workers"] },
    { id: "near-miss-alarm", title: "Near-Miss Number Is the Alarm", narrative: "The 17.87 near-miss frequency rate and roughly 6,380 near misses are the main leading-indicator issue.", bullets: ["The report calculates about 152 near misses per recordable injury.", "The high near-miss count can signal strong reporting culture, persistent exposure, or both.", "The core message is protecting an unusually strong safety advantage, not fixing a broken safety program."], metrics: ["wfrd-near-miss-frequency", "wfrd-near-misses-2024", "wfrd-recordables-2024"] }
  ] },
];

export const freeportWeatherfordLocations: LocationRecord[] = [
  { id: "fcx-morenci", companyId: "freeport-mcmoran", company: "Freeport-McMoRan", city: "Morenci", state: "Arizona", country: "USA", region: "Arizona", facilityType: "Copper mine", activity: "Mining operations", notes: "Primary FCX Arizona operating concentration referenced in the revised report.", coordinates: [-109.3654, 33.0787] },
  { id: "fcx-sierrita", companyId: "freeport-mcmoran", company: "Freeport-McMoRan", city: "Sierrita / Pima County", state: "Arizona", country: "USA", region: "Arizona", facilityType: "Copper mine", activity: "Mining operations and MSHA-regulated workforce", notes: "Revised report flags Sierrita as the clearest MSHA penalty hotspot among Arizona FCX sites.", coordinates: [-111.113, 31.957] },
  { id: "fcx-tyrone-chino", companyId: "freeport-mcmoran", company: "Freeport-McMoRan", city: "Tyrone / Chino", state: "New Mexico", country: "USA", region: "New Mexico", facilityType: "Copper mine", activity: "Mining operations", notes: "New Mexico FCX operations referenced in the revised geographic distribution section.", coordinates: [-108.28, 32.78] },
  { id: "wfrd-north-america", companyId: "weatherford", company: "Weatherford", city: "North America", country: "Regional", region: "North America", facilityType: "Oilfield services region", activity: "Domestic oilfield service operations", notes: "Revised report estimates approximately 3,518 North American workers, or 19% of global workforce.", coordinates: [-95.3698, 29.7604] }
];

export const freeportWeatherfordReports: ReportRecord[] = [
  { id: "fcx-revised-mining-safety-signal", companyId: "freeport-mcmoran", title: "Freeport-McMoRan revised mining safety and MSHA-readiness signal", createdAt: "2026-06-04", summary: "Freeport-McMoRan shows a strong headline TRIR, but the revised report highlights worsening employee TRIR, rising employee LTIR, a 73% near-miss rate increase, five fatalities, and a contractor-heavy fatality pattern.", signals: ["2024 total TRIR 0.69", "Employee TRIR worsened from 0.75 to 0.77", "Near-miss rate rose 73%", "Fatalities rose from 2 to 5; four of five were contract personnel", "Sierrita Mine flagged as a 2025 MSHA penalty hotspot"] },
  { id: "wfrd-revised-safety-sustainment-signal", companyId: "weatherford", title: "Weatherford revised safety-sustainment and near-miss exposure signal", createdAt: "2026-06-04", summary: "Weatherford is a sustain-the-advantage target, not a safety turnaround target. The revised report shows 2024 TRIR of 0.12, LTIR of 0.02, zero fatalities, eight lost-time injuries, 42 recordables, and roughly 6,380 near misses.", signals: ["2024 TRIR 0.12 and LTIR 0.02", "Zero fatalities in 2024", "Only 8 lost-time injuries", "Approximately 6,380 near misses and NMFR 17.87", "81% of workforce outside North America"] }
];
