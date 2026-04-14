import type { Assumption, Company, CompanyProfile, InsightDataset, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const companies: Company[] = [
  { id: "v2x", name: "V2X, Inc.", shortName: "V2X", sector: "Defense services, logistics, training, and mission support", headquarters: "McLean, Virginia", employees: 16100, employeesAsOf: "2024-12-31", summary: "Global mission-support contractor with distributed field operations, aviation, logistics, facilities, and expeditionary workforce exposure.", tags: ["Federal contractor", "Global footprint", "High operational complexity"] },
  { id: "caci-international-inc", name: "CACI International Inc.", shortName: "CACI", sector: "Defense and government technology services", headquarters: "Reston, Virginia", employees: 25000, employeesAsOf: "2025-06-30", summary: "Technology and mission-services contractor with global program support and high-clearance workforce concentration.", tags: ["Benchmark peer", "Government services"] },
  { id: "fluor-corporation", name: "Fluor Corporation", shortName: "Fluor", sector: "Engineering, construction, and government services", headquarters: "Irving, Texas", employees: 26866, employeesAsOf: "2024-12-31", summary: "Large engineering and construction operator with material self-insured liability disclosures and global project delivery footprint.", tags: ["Benchmark peer", "Industrial risk"] },
];

export const sources: SourceRecord[] = [
  { id: "v2x-10k-2024", companyId: "v2x", label: "V2X FY2024 10-K", type: "SEC", url: "https://www.sec.gov/Archives/edgar/data/1601548/000160154825000009/vec-20241231.htm", note: "Seed workbook cites employee count and workers' compensation accrual from FY2024 10-K." },
  { id: "bls-ecec-2025", companyId: "v2x", label: "BLS ECEC June 2025 benchmark", type: "Benchmark", note: "Methodology workbook applies $0.43 per hour as baseline workers' compensation cost proxy." },
  { id: "geography-workbook", companyId: "v2x", label: "Draft Version of Tables 4 geographic workbook", type: "Workbook", note: "Workbook includes shared locations, client/country counts, facility types, and activity tables." },
  { id: "manual-ingestion", companyId: "v2x", label: "Manual analyst notes", type: "Manual", note: "Manual entries and URL notes can be appended through the reusable data model without component rewrites." },
];

export const metrics: Metric[] = [
  { id: "v2x-employees", companyId: "v2x", label: "Employees", value: 16100, unit: "count", category: "workforce", trend: 2.6, sourceId: "v2x-10k-2024" },
  { id: "v2x-wc-accrual", companyId: "v2x", label: "WC reserve / accrual", value: 9496000, unit: "usd", category: "financial", trend: 3.1, sourceId: "v2x-10k-2024" },
  { id: "v2x-wc-proxy", companyId: "v2x", label: "Estimated annual WC proxy", value: 13846000, unit: "usd", category: "financial", trend: 5.4, sourceId: "bls-ecec-2025" },
  { id: "v2x-global-locations", companyId: "v2x", label: "Mapped locations", value: 80, unit: "count", category: "risk", trend: 8.2, sourceId: "geography-workbook" },
  { id: "v2x-risk-index", companyId: "v2x", label: "Geographic risk index", value: 74, unit: "score", category: "risk", trend: 4.7, sourceId: "geography-workbook" },
  { id: "v2x-customer-mix", companyId: "v2x", label: "Federal exposure", value: 91, unit: "percent", category: "workforce", trend: 1.4, sourceId: "manual-ingestion" },
];

const sectionTitles = ["Overview", "Workforce & Operations", "Customer Mix", "Global Footprint", "Safety Metrics", "Injury Trends", "Geographic Risk", "Financial / Workers’ Comp Signal", "Source Library"];
const narratives = [
  "V2X is the initial dossier company because the attached proxy workbook includes direct employee, reserve, and annual workers' compensation proxy signals.",
  "The workforce profile combines public headcount, assumed annual hours, and global footprint signals to identify occupational-health service urgency.",
  "Customer exposure is modeled as predominantly federal and defense-linked, with operational footprints that overlap military installations and overseas support.",
  "The geographic workbook maps V2X across international operating environments, enabling country, region, facility type, and activity filtering.",
  "Public workers' compensation and benchmark assumptions become directional safety indicators where private claims detail is unavailable.",
  "The V1 trend model visualizes exposure directionally using workforce size, reserve signal, mapped locations, and indirect burden assumptions.",
  "Country dispersion and remote operating contexts create a service-fit signal for onsite medical, telemedicine, case management, and readiness programs.",
  "The proxy model estimates annual direct WC cost and economic burden using workbook assumptions that can be adjusted in the quant portal.",
  "Sources are structured records tied to companies and metrics, allowing analysts to add PDFs, spreadsheets, URLs, and manual notes later.",
];

export const profiles: CompanyProfile[] = [
  {
    companyId: "v2x",
    sections: sectionTitles.map((title, index) => ({
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title,
      narrative: narratives[index],
      bullets: index === 8 ? ["SEC filing source", "BLS benchmark source", "Geographic workbook source", "Manual source note support"] : ["Reusable section model", "Seeded with V2X workbook signals", "Ready for additional company ingestion"],
      metrics: index === 8 ? [] : ["v2x-employees", "v2x-wc-proxy", "v2x-global-locations"].slice(0, (index % 3) + 1),
    })),
  },
];

export const locations: LocationRecord[] = [
  { id: "v2x-bagram", companyId: "v2x", company: "V2X", city: "Bagram", country: "Afghanistan", region: "Central Asia", facilityType: "Contingency operations", activity: "Mission support", notes: "Seeded from workbook row with V2X presence.", coordinates: [69.2649, 34.9461] },
  { id: "v2x-kabul", companyId: "v2x", company: "V2X", city: "Kabul", country: "Afghanistan", region: "Central Asia", facilityType: "Program support", activity: "Operational support", notes: "Workbook marks V2X presence in Kabul shared operating environment.", coordinates: [69.2075, 34.5553] },
  { id: "v2x-stuttgart", companyId: "v2x", company: "V2X", city: "Stuttgart", country: "Germany", region: "Europe", facilityType: "Mission support", activity: "Defense support", notes: "European mission-support anchor for federal contractors.", coordinates: [9.1829, 48.7758] },
  { id: "v2x-guam", companyId: "v2x", company: "V2X", city: "Andersen AFB", country: "Guam", region: "Indo-Pacific", facilityType: "Air base support", activity: "Logistics and readiness", notes: "Indo-Pacific operating context with aviation and base-support relevance.", coordinates: [144.929, 13.584] },
  { id: "v2x-mclean", companyId: "v2x", company: "V2X", city: "McLean", state: "VA", country: "USA", region: "North America", facilityType: "Corporate HQ", activity: "Executive and administrative", notes: "Headquarters signal for buyer mapping and relationship planning.", coordinates: [-77.1773, 38.9339] },
  { id: "v2x-kuwait", companyId: "v2x", company: "V2X", city: "Kuwait City", country: "Kuwait", region: "Middle East", facilityType: "Logistics hub", activity: "Regional sustainment", notes: "Representative Middle East logistics-support operating environment.", coordinates: [47.9774, 29.3759] },
];

export const assumptions: Assumption[] = [
  { id: "hours", label: "Assumed hours per employee", value: 2000, unit: "hours/year", description: "Workbook baseline used to convert employee count to annual exposure hours." },
  { id: "wcRate", label: "BLS WC cost benchmark", value: 0.43, unit: "USD/hour", description: "BLS ECEC June 2025 baseline for workers' compensation cost proxy." },
  { id: "burden", label: "Economic burden multiplier", value: 1.25, unit: "x", description: "Accounts for administrative fees, insurance overhead, and tax loads." },
  { id: "indirect", label: "Indirect cost multiplier", value: 2.1, unit: "x", description: "Methodology workbook factor for productivity, equipment, legal, and operational impacts." },
];

export const reports: ReportRecord[] = [
  { id: "v2x-executive-signal", companyId: "v2x", title: "V2X occupational-health urgency signal", createdAt: "2026-04-14", summary: "V2X combines a large distributed workforce, direct WC reserve signal, and global operating footprint, creating a high-priority Occu-Med account profile.", signals: ["Direct annual WC proxy above $13M", "Public reserve/accrual signal available", "80-location workbook footprint", "Defense and federal operating environments"] },
];

export const seedDataset: InsightDataset = { companies, profiles, metrics, locations, sources, reports, assumptions, status: { proxyRows: 0, methodologyRows: 0, geographyRows: 0, loaded: false } };
