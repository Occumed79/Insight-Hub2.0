import type { Assumption, Company, CompanyProfile, InsightDataset, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const companies: Company[] = [
  { id: "v2x", name: "V2X, Inc.", shortName: "V2X", sector: "Defense services, logistics, training, and mission support", headquarters: "McLean, Virginia", employees: 16100, employeesAsOf: "2024-12-31", summary: "Global mission-support contractor with distributed field operations, aviation, logistics, facilities, and expeditionary workforce exposure.", tags: ["Federal contractor", "Global footprint", "High operational complexity"] },
  { id: "ids", name: "IDS", shortName: "IDS", sector: "Defense training, security, expeditionary support, and domestic security operations", headquarters: "Not specified in uploaded material", employees: 1300, employeesAsOf: "Worker population estimate from uploaded IDS visual model", summary: "Defense-support operator with concentrated contract-value exposure across tactical training, security guard, expeditionary support, and domestic security worker populations. Uploaded risk visuals indicate that a single preventable event could create stop-work exposure across high-value operational locations.", tags: ["Defense support", "Stop-work exposure", "Worker-risk model", "Contract value at risk"] },
  { id: "caci-international-inc", name: "CACI International Inc.", shortName: "CACI", sector: "Defense and government technology services", headquarters: "Reston, Virginia", employees: 25000, employeesAsOf: "2025-06-30", summary: "Technology and mission-services contractor with global program support and high-clearance workforce concentration.", tags: ["Benchmark peer", "Government services"] },
  { id: "fluor-corporation", name: "Fluor Corporation", shortName: "Fluor", sector: "Engineering, construction, and government services", headquarters: "Irving, Texas", employees: 26866, employeesAsOf: "2024-12-31", summary: "Large engineering and construction operator with material self-insured liability disclosures and global project delivery footprint.", tags: ["Benchmark peer", "Industrial risk"] },
];

export const sources: SourceRecord[] = [
  { id: "v2x-10k-2024", companyId: "v2x", label: "V2X FY2024 10-K", type: "SEC", url: "https://www.sec.gov/Archives/edgar/data/1601548/000160154825000009/vec-20241231.htm", note: "Seed workbook cites employee count and workers' compensation accrual from FY2024 10-K." },
  { id: "bls-ecec-2025", companyId: "v2x", label: "BLS ECEC June 2025 benchmark", type: "Benchmark", note: "Methodology workbook applies $0.43 per hour as baseline workers' compensation cost proxy." },
  { id: "geography-workbook", companyId: "v2x", label: "Draft Version of Tables 4 geographic workbook", type: "Workbook", note: "Workbook includes shared locations, client/country counts, facility types, and activity tables." },
  { id: "manual-ingestion", companyId: "v2x", label: "Manual analyst notes", type: "Manual", note: "Manual entries and URL notes can be appended through the reusable data model without component rewrites." },
  { id: "ids-contract-risk-visual", companyId: "ids", label: "IDS contract value at risk visual", type: "Manual", note: "Uploaded IDS chart cites DoD contract W900KK24C0036 and models Iraq as sole-source, where one preventable event may trigger stop-work exposure. Visual values include Iraq Tactical Training / Camp Taji at $27.9M, Djibouti / Camp Lemonnier at $8M, Jordan / KASOTC at $6M, and DECO Domestic Security at $4M." },
  { id: "ids-injury-cost-visual", companyId: "ids", label: "IDS estimated annual injury cost visual", type: "Manual", note: "Uploaded IDS chart applies BLS benchmark assumptions and average claim cost range of $40K-$80K. Modeled worker groups include DECO Security Guards, Tactical Trainers, Expeditionary Support, and Cyber/Office populations." },
  { id: "ids-trir-benchmark-visual", companyId: "ids", label: "IDS TRIR benchmark visual", type: "Benchmark", note: "Uploaded IDS chart references BLS 2023 NAICS 561612 and law-enforcement training analogues. It states there is no public IDS TRIR and uses benchmark values by worker population." },
];

export const metrics: Metric[] = [
  { id: "v2x-employees", companyId: "v2x", label: "Employees", value: 16100, unit: "count", category: "workforce", trend: 2.6, sourceId: "v2x-10k-2024" },
  { id: "v2x-wc-accrual", companyId: "v2x", label: "WC reserve / accrual", value: 9496000, unit: "usd", category: "financial", trend: 3.1, sourceId: "v2x-10k-2024" },
  { id: "v2x-wc-proxy", companyId: "v2x", label: "Estimated annual WC proxy", value: 13846000, unit: "usd", category: "financial", trend: 5.4, sourceId: "bls-ecec-2025" },
  { id: "v2x-global-locations", companyId: "v2x", label: "Mapped locations", value: 80, unit: "count", category: "risk", trend: 8.2, sourceId: "geography-workbook" },
  { id: "v2x-risk-index", companyId: "v2x", label: "Geographic risk index", value: 74, unit: "score", category: "risk", trend: 4.7, sourceId: "geography-workbook" },
  { id: "v2x-customer-mix", companyId: "v2x", label: "Federal exposure", value: 91, unit: "percent", category: "workforce", trend: 1.4, sourceId: "manual-ingestion" },
  { id: "ids-worker-population", companyId: "ids", label: "Modeled worker population", value: 1300, unit: "count", category: "workforce", trend: 6.2, sourceId: "ids-injury-cost-visual" },
  { id: "ids-contract-value-risk", companyId: "ids", label: "Contract value at risk", value: 45900000, unit: "usd", category: "financial", trend: 9.4, sourceId: "ids-contract-risk-visual" },
  { id: "ids-stop-work-events", companyId: "ids", label: "Stop-work trigger event", value: 1, unit: "count", category: "risk", trend: 8.8, sourceId: "ids-contract-risk-visual" },
  { id: "ids-injury-cost-low", companyId: "ids", label: "Direct injury cost low", value: 830000, unit: "usd", category: "financial", trend: 5.6, sourceId: "ids-injury-cost-visual" },
  { id: "ids-injury-cost-high", companyId: "ids", label: "Estimated total injury cost high", value: 1540000, unit: "usd", category: "financial", trend: 7.1, sourceId: "ids-injury-cost-visual" },
  { id: "ids-trir-peak", companyId: "ids", label: "Highest TRIR benchmark", value: 2.5, unit: "score", category: "safety", trend: 6.7, sourceId: "ids-trir-benchmark-visual" },
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

const idsProfileSections = [
  {
    id: "overview",
    title: "Overview",
    narrative: "IDS has been added as a visual intelligence dossier centered on preventable-event risk, stop-work exposure, and worker-population injury-cost modeling. The uploaded visuals make the client profile highly presentation-ready because they connect safety events to contract value and operational disruption.",
    bullets: ["Visual profile focuses on contract exposure, worker injury cost, and TRIR benchmark risk", "One modeled preventable event is framed as a potential stop-work trigger", "Profile is ready for additional client details, decision makers, procurement notes, and service-fit findings"],
    metrics: ["ids-contract-value-risk", "ids-worker-population", "ids-stop-work-events"],
  },
  {
    id: "workforce-operations",
    title: "Workforce & Operations",
    narrative: "The uploaded IDS model organizes the workforce into DECO security guards, tactical trainers, expeditionary support, and cyber/office populations. This creates a clear occupational-health segmentation for readiness, surveillance, injury-prevention, and case-management positioning.",
    bullets: ["DECO Security Guards estimated at approximately 700 workers", "Tactical Trainers estimated at approximately 300 workers", "Expeditionary Support estimated at approximately 200 workers", "Cyber/Office estimated at approximately 100 workers"],
    metrics: ["ids-worker-population", "ids-trir-peak"],
  },
  {
    id: "customer-mix",
    title: "Customer Mix",
    narrative: "The available uploaded material ties IDS risk modeling to a DoD contract reference and defense-support operating locations. The profile should be expanded later with customer names, buying offices, prime/sub relationships, and known contract vehicles.",
    bullets: ["DoD contract reference W900KK24C0036 appears in the contract-value visual", "Risk model frames Iraq as sole-source for the cited stop-work scenario", "Additional customer-mix detail should be added when client-specific information is uploaded"],
    metrics: ["ids-contract-value-risk", "ids-stop-work-events"],
  },
  {
    id: "global-footprint",
    title: "Global Footprint",
    narrative: "IDS visual data highlights contract or worker exposure across Iraq, Djibouti, Jordan, and domestic security operations. These locations can support geographic mapping, service coverage planning, and provider-network gap analysis.",
    bullets: ["Iraq Tactical Training / Camp Taji is the largest modeled contract-value exposure", "Djibouti / Camp Lemonnier and Jordan / KASOTC appear as mid-tier exposure nodes", "DECO Domestic Security is included as a lower-value but worker-heavy domestic risk group"],
    metrics: ["ids-contract-value-risk"],
  },
  {
    id: "safety-metrics",
    title: "Safety Metrics",
    narrative: "The TRIR visual uses external benchmark analogues because no public IDS TRIR is identified in the uploaded material. Tactical trainers and expeditionary support show the highest modeled benchmark risk, while cyber/office is the lowest benchmark category.",
    bullets: ["Tactical Trainers benchmarked at TRIR 2.5", "Expeditionary Support benchmarked at TRIR 2.0", "DECO Security Guards benchmarked at TRIR 1.1", "Cyber/Office benchmarked at TRIR 0.5"],
    metrics: ["ids-trir-peak", "ids-worker-population"],
  },
  {
    id: "injury-trends",
    title: "Injury Trends",
    narrative: "The injury-cost visual estimates approximately $1.1M to $1.5M in annual injury cost exposure across the modeled worker populations. DECO Security Guards and Tactical Trainers represent the largest estimated cost centers.",
    bullets: ["Direct low estimate totals approximately $830K across modeled populations", "High estimate adds approximately $710K in additional cost exposure", "Total high estimate is approximately $1.54M across the modeled categories"],
    metrics: ["ids-injury-cost-low", "ids-injury-cost-high"],
  },
  {
    id: "geographic-risk",
    title: "Geographic Risk",
    narrative: "The contract-value visual frames geography as a risk amplifier because a preventable event can affect work continuity across operational locations. The largest exposure is tied to Iraq Tactical Training / Camp Taji.",
    bullets: ["Camp Taji / Iraq Tactical Training: $27.9M value at risk", "Camp Lemonnier / Djibouti: $8M value at risk", "KASOTC / Jordan: $6M value at risk", "DECO Domestic Security: $4M value at risk"],
    metrics: ["ids-contract-value-risk", "ids-stop-work-events"],
  },
  {
    id: "financial-workers-comp-signal",
    title: "Financial / Workers’ Comp Signal",
    narrative: "The IDS dossier connects injury prevention directly to financial risk: annual injury-cost exposure is estimated in the seven figures, while stop-work exposure reaches approximately $45.9M across modeled contract/location groups.",
    bullets: ["Contract value at risk totals approximately $45.9M", "Estimated annual injury cost ranges from approximately $1.1M to $1.5M based on uploaded visual labels", "Financial framing supports a prevention-focused occupational-health pitch"],
    metrics: ["ids-contract-value-risk", "ids-injury-cost-high"],
  },
  {
    id: "source-library",
    title: "Source Library",
    narrative: "The IDS profile is currently grounded in the uploaded visual models. Additional uploaded client documents, URLs, contract extracts, and contact notes can be added to strengthen the evidence trail.",
    bullets: ["Uploaded contract-value risk chart", "Uploaded annual injury-cost chart", "Uploaded TRIR benchmark chart", "Pending additional client-specific source documents"],
    metrics: [],
  },
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
  {
    companyId: "ids",
    sections: idsProfileSections,
  },
];

export const locations: LocationRecord[] = [
  { id: "v2x-bagram", companyId: "v2x", company: "V2X", city: "Bagram", country: "Afghanistan", region: "Central Asia", facilityType: "Contingency operations", activity: "Mission support", notes: "Seeded from workbook row with V2X presence.", coordinates: [69.2649, 34.9461] },
  { id: "v2x-kabul", companyId: "v2x", company: "V2X", city: "Kabul", country: "Afghanistan", region: "Central Asia", facilityType: "Program support", activity: "Operational support", notes: "Workbook marks V2X presence in Kabul shared operating environment.", coordinates: [69.2075, 34.5553] },
  { id: "v2x-stuttgart", companyId: "v2x", company: "V2X", city: "Stuttgart", country: "Germany", region: "Europe", facilityType: "Mission support", activity: "Defense support", notes: "European mission-support anchor for federal contractors.", coordinates: [9.1829, 48.7758] },
  { id: "v2x-guam", companyId: "v2x", company: "V2X", city: "Andersen AFB", country: "Guam", region: "Indo-Pacific", facilityType: "Air base support", activity: "Logistics and readiness", notes: "Indo-Pacific operating context with aviation and base-support relevance.", coordinates: [144.929, 13.584] },
  { id: "v2x-mclean", companyId: "v2x", company: "V2X", city: "McLean", state: "VA", country: "USA", region: "North America", facilityType: "Corporate HQ", activity: "Executive and administrative", notes: "Headquarters signal for buyer mapping and relationship planning.", coordinates: [-77.1773, 38.9339] },
  { id: "v2x-kuwait", companyId: "v2x", company: "V2X", city: "Kuwait City", country: "Kuwait", region: "Middle East", facilityType: "Logistics hub", activity: "Regional sustainment", notes: "Representative Middle East logistics-support operating environment.", coordinates: [47.9774, 29.3759] },
  { id: "ids-camp-taji", companyId: "ids", company: "IDS", city: "Camp Taji", country: "Iraq", region: "Middle East", facilityType: "Tactical training", activity: "Training support", notes: "Approximate marker based on uploaded IDS contract-risk visual listing Iraq Tactical Training / Camp Taji at $27.9M value at risk.", coordinates: [44.2725, 33.5206] },
  { id: "ids-camp-lemonnier", companyId: "ids", company: "IDS", city: "Camp Lemonnier", country: "Djibouti", region: "East Africa", facilityType: "Training / mission support", activity: "Regional support", notes: "Approximate marker based on uploaded IDS contract-risk visual listing Djibouti / Camp Lemonnier at $8M value at risk.", coordinates: [43.1481, 11.5473] },
  { id: "ids-kasotc", companyId: "ids", company: "IDS", city: "KASOTC", country: "Jordan", region: "Middle East", facilityType: "Special operations training center", activity: "Training support", notes: "Approximate marker based on uploaded IDS contract-risk visual listing Jordan / KASOTC at $6M value at risk.", coordinates: [35.8623, 31.9566] },
  { id: "ids-deco-domestic-security", companyId: "ids", company: "IDS", city: "Domestic Security", country: "USA", region: "North America", facilityType: "Domestic security operations", activity: "Security guard workforce", notes: "Representative domestic marker based on uploaded IDS visual listing DECO Domestic Security at $4M value at risk and approximately 700 workers.", coordinates: [-77.0369, 38.9072] },
];

export const assumptions: Assumption[] = [
  { id: "hours", label: "Assumed hours per employee", value: 2000, unit: "hours/year", description: "Workbook baseline used to convert employee count to annual exposure hours." },
  { id: "wcRate", label: "BLS WC cost benchmark", value: 0.43, unit: "USD/hour", description: "BLS ECEC June 2025 baseline for workers' compensation cost proxy." },
  { id: "burden", label: "Economic burden multiplier", value: 1.25, unit: "x", description: "Accounts for administrative fees, insurance overhead, and tax loads." },
  { id: "indirect", label: "Indirect cost multiplier", value: 2.1, unit: "x", description: "Methodology workbook factor for productivity, equipment, legal, and operational impacts." },
];

export const reports: ReportRecord[] = [
  { id: "v2x-executive-signal", companyId: "v2x", title: "V2X occupational-health urgency signal", createdAt: "2026-04-14", summary: "V2X combines a large distributed workforce, direct WC reserve signal, and global operating footprint, creating a high-priority Occu-Med account profile.", signals: ["Direct annual WC proxy above $13M", "Public reserve/accrual signal available", "80-location workbook footprint", "Defense and federal operating environments"] },
  { id: "ids-prevention-risk-signal", companyId: "ids", title: "IDS preventable-event and injury-cost risk signal", createdAt: "2026-06-03", summary: "IDS combines meaningful stop-work exposure, concentrated worker-risk categories, and seven-figure estimated annual injury-cost exposure, making prevention, readiness, and occupational-health surveillance a clear strategic opportunity.", signals: ["$45.9M modeled contract value at risk", "One preventable event modeled as stop-work trigger", "Approximately 1,300 modeled workers", "$1.1M-$1.5M estimated annual injury-cost exposure", "Highest benchmarked TRIR category: Tactical Trainers at 2.5"] },
];

export const seedDataset: InsightDataset = { companies, profiles, metrics, locations, sources, reports, assumptions, status: { proxyRows: 0, methodologyRows: 0, geographyRows: 0, loaded: false } };
