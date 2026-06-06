import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const caciCompanies: Company[] = [
  {
    id: "caci",
    name: "CACI International Inc",
    shortName: "CACI",
    sector: "Defense, intelligence, federal civilian technology, mission support, counterterrorism training, cyber, systems integration, and professional services",
    headquarters: "Reston, Virginia",
    employees: 25000,
    employeesAsOf: "Uploaded CACI brief cites FY2025 10-K confirmation of approximately 25,000 employees",
    summary: "CACI is a large federal contractor with approximately 25,000 employees, 136 U.S. locations across 27 states plus D.C., and heavy DoD concentration. The uploaded brief frames the primary occupational-health intelligence around multi-state workers' compensation complexity, indirect/fringe cost exposure, Defense Base Act exposure, acquisition integration, insurance-risk language, Flexible Time Off tracking gaps, and DCAA-defensible fringe-cost management. This dossier intentionally excludes any Occu-Med revenue-potential modeling.",
    tags: ["DoD prime", "Intelligence community", "Federal civilian", "Workers compensation", "Fringe cost exposure", "Defense Base Act", "DCAA", "Multi-state WC", "Acquisition integration", "Employee wellbeing", "FTO"],
  },
];

export const caciSources: SourceRecord[] = [
  { id: "caci-upload-snapshot", companyId: "caci", label: "Uploaded CACI company snapshot", type: "Manual", note: "Uploaded brief cites FY2025 revenue of $8.627B, a Dec 2025 six-month run rate of $4.508B, approximately 25,000 employees, 136 U.S. locations in 27 states plus D.C., $31.4B FY2025 backlog, and $32.8B Dec 2025 backlog." },
  { id: "caci-upload-accrued-comp", companyId: "caci", label: "Uploaded accrued compensation and benefits breakdown", type: "Manual", note: "Uploaded brief identifies accrued salaries and withholdings, accrued leave, and an Other line likely containing WC reserves, benefit accruals, short-term disability accruals, or similar liabilities." },
  { id: "caci-upload-fringe", companyId: "caci", label: "Uploaded fringe and indirect cost exposure", type: "Manual", note: "Uploaded brief shows indirect costs and fringe grew from $1.591B in FY2023 to $1.720B in FY2024 and $1.833B in FY2025, while indirect cost as a share of revenue declined from 23.7% to 21.2%." },
  { id: "caci-upload-benefits", companyId: "caci", label: "Uploaded retirement and benefit plan costs", type: "Manual", note: "Uploaded brief lists 401(k) match, supplemental executive retirement plan, total defined contribution expense, post-retirement obligations, and stock-based compensation in the indirect pool." },
  { id: "caci-upload-insurance-risk", companyId: "caci", label: "Uploaded 10-K insurance risk language analysis", type: "Manual", note: "Uploaded brief highlights CACI risk-factor language about hazards inherent in federal business, possible injury, bodily harm, death, or kidnapping during deployments, and potential inadequacy of insurance coverage." },
  { id: "caci-upload-wc-complexity", companyId: "caci", label: "Uploaded multi-state WC jurisdiction complexity", type: "Manual", note: "Uploaded brief maps CACI's 136 locations across 27 states plus D.C. to complex multi-state WC administration, provider consistency, decentralized incident reporting, DBA requirements, and counterterrorism training hazards." },
  { id: "caci-upload-acquisitions", companyId: "caci", label: "Uploaded acquisition integration signal", type: "Manual", note: "Uploaded brief states CACI completed seven acquisitions in three years and three FY2025 acquisitions, creating potential WC program integration gaps and redundancy." },
  { id: "caci-upload-wc-estimates", companyId: "caci", label: "Uploaded WC cost estimation", type: "Manual", note: "Uploaded brief estimates WC premium plus DBA exposure based on disclosed labor base and industry benchmarks. These are exposure estimates only; actual CACI WC spend is not publicly disclosed." },
  { id: "caci-upload-wellbeing-fto", companyId: "caci", label: "Uploaded employee wellbeing and FTO signal", type: "Manual", note: "Uploaded brief states CACI replaced traditional accrued PTO with Flexible Time Off and describes a comprehensive wellbeing program covering social, physical, financial, and emotional wellbeing." },
  { id: "caci-upload-dcaa", companyId: "caci", label: "Uploaded DCAA audit exposure", type: "Manual", note: "Uploaded brief states DCAA audits are current through FY2023, with FY2024 and FY2025 open/upcoming, and notes that WC, claim payments, and occupational-health costs can flow through indirect cost pools billed to the U.S. government." },
];

export const caciMetrics: Metric[] = [
  { id: "caci-revenue-fy2025", companyId: "caci", label: "FY2025 revenue", value: 8627000000, unit: "usd", category: "financial", trend: 7.0, sourceId: "caci-upload-snapshot" },
  { id: "caci-revenue-six-month-dec2025", companyId: "caci", label: "Dec 2025 six-month revenue run rate", value: 4508000000, unit: "usd", category: "financial", trend: 7.2, sourceId: "caci-upload-snapshot" },
  { id: "caci-employees", companyId: "caci", label: "Confirmed employees", value: 25000, unit: "count", category: "workforce", trend: 7.5, sourceId: "caci-upload-snapshot" },
  { id: "caci-us-locations", companyId: "caci", label: "U.S. locations", value: 136, unit: "count", category: "workforce", trend: 8.0, sourceId: "caci-upload-snapshot" },
  { id: "caci-states-dc", companyId: "caci", label: "States plus D.C. footprint", value: 28, unit: "count", category: "risk", trend: 8.2, sourceId: "caci-upload-wc-complexity" },
  { id: "caci-backlog-fy2025", companyId: "caci", label: "FY2025 contract backlog", value: 31400000000, unit: "usd", category: "financial", trend: 7.5, sourceId: "caci-upload-snapshot" },
  { id: "caci-backlog-dec2025", companyId: "caci", label: "Dec 2025 contract backlog", value: 32800000000, unit: "usd", category: "financial", trend: 7.8, sourceId: "caci-upload-snapshot" },
  { id: "caci-dod-revenue-share", companyId: "caci", label: "DoD revenue concentration", value: 75.4, unit: "percent", category: "financial", trend: 7.0, sourceId: "caci-upload-snapshot" },
  { id: "caci-accrued-other-fy2025", companyId: "caci", label: "Accrued comp and benefits Other line FY2025", value: 24704000, unit: "usd", category: "risk", trend: 7.0, sourceId: "caci-upload-accrued-comp" },
  { id: "caci-accrued-other-fy2024", companyId: "caci", label: "Accrued comp and benefits Other line FY2024", value: 22646000, unit: "usd", category: "risk", trend: 6.6, sourceId: "caci-upload-accrued-comp" },
  { id: "caci-accrued-leave-fy2025", companyId: "caci", label: "Accrued leave FY2025", value: 41884000, unit: "usd", category: "risk", trend: 5.5, sourceId: "caci-upload-accrued-comp" },
  { id: "caci-accrued-leave-fy2024", companyId: "caci", label: "Accrued leave FY2024", value: 75339000, unit: "usd", category: "risk", trend: 6.2, sourceId: "caci-upload-accrued-comp" },
  { id: "caci-indirect-fy2023", companyId: "caci", label: "Indirect costs and fringe FY2023", value: 1591000000, unit: "usd", category: "financial", trend: 6.3, sourceId: "caci-upload-fringe" },
  { id: "caci-indirect-fy2024", companyId: "caci", label: "Indirect costs and fringe FY2024", value: 1720000000, unit: "usd", category: "financial", trend: 6.7, sourceId: "caci-upload-fringe" },
  { id: "caci-indirect-fy2025", companyId: "caci", label: "Indirect costs and fringe FY2025", value: 1833000000, unit: "usd", category: "financial", trend: 7.0, sourceId: "caci-upload-fringe" },
  { id: "caci-indirect-share-fy2025", companyId: "caci", label: "Indirect cost as percentage of revenue FY2025", value: 21.2, unit: "percent", category: "financial", trend: -1.3, sourceId: "caci-upload-fringe" },
  { id: "caci-indirect-growth-3yr", companyId: "caci", label: "Three-year indirect/fringe cost increase", value: 242000000, unit: "usd", category: "financial", trend: 7.5, sourceId: "caci-upload-fringe" },
  { id: "caci-401k-match-fy2025", companyId: "caci", label: "401(k) match expense FY2025", value: 74700000, unit: "usd", category: "financial", trend: 6.0, sourceId: "caci-upload-benefits" },
  { id: "caci-dc-expense-fy2025", companyId: "caci", label: "Total defined contribution expense FY2025", value: 84400000, unit: "usd", category: "financial", trend: 6.0, sourceId: "caci-upload-benefits" },
  { id: "caci-post-retirement-fy2025", companyId: "caci", label: "Post-retirement obligations FY2025", value: 6970000, unit: "usd", category: "financial", trend: 5.0, sourceId: "caci-upload-benefits" },
  { id: "caci-stock-comp-fy2025", companyId: "caci", label: "Stock-based compensation in indirect pool FY2025", value: 60200000, unit: "usd", category: "financial", trend: 5.0, sourceId: "caci-upload-benefits" },
  { id: "caci-acquisitions-3yr", companyId: "caci", label: "Acquisitions in three years", value: 7, unit: "count", category: "risk", trend: 8.0, sourceId: "caci-upload-acquisitions" },
  { id: "caci-fy2025-acquisition-revenue", companyId: "caci", label: "FY2025 post-acquisition revenue contribution", value: 368000000, unit: "usd", category: "financial", trend: 7.0, sourceId: "caci-upload-dcaa" },
  { id: "caci-wc-conservative-low", companyId: "caci", label: "Estimated WC plus DBA exposure low", value: 14000000, unit: "usd", category: "risk", trend: 7.0, sourceId: "caci-upload-wc-estimates" },
  { id: "caci-wc-conservative-high", companyId: "caci", label: "Estimated WC plus DBA exposure conservative high", value: 23000000, unit: "usd", category: "risk", trend: 7.5, sourceId: "caci-upload-wc-estimates" },
  { id: "caci-wc-moderate-high", companyId: "caci", label: "Estimated WC plus DBA exposure moderate high", value: 42000000, unit: "usd", category: "risk", trend: 8.5, sourceId: "caci-upload-wc-estimates" },
  { id: "caci-multistate-risk-score", companyId: "caci", label: "Multi-state WC complexity score", value: 9, unit: "score", category: "risk", trend: 9.0, sourceId: "caci-upload-wc-complexity" },
  { id: "caci-dcaa-risk-score", companyId: "caci", label: "DCAA fringe-cost defensibility score", value: 8, unit: "score", category: "risk", trend: 8.2, sourceId: "caci-upload-dcaa" },
  { id: "caci-fto-tracking-gap-score", companyId: "caci", label: "FTO lost-time tracking gap score", value: 7, unit: "score", category: "risk", trend: 7.0, sourceId: "caci-upload-wellbeing-fto" },
  { id: "caci-insurance-risk-score", companyId: "caci", label: "Insurance adequacy risk signal", value: 8, unit: "score", category: "risk", trend: 8.0, sourceId: "caci-upload-insurance-risk" },
];

const caciSections: CompanyProfile["sections"] = [
  {
    id: "overview",
    title: "Overview",
    narrative: "CACI is a large DoD and intelligence-community contractor with enough scale to create meaningful occupational-health, workers' compensation, benefits, and audit-defensibility complexity. The uploaded page 1 snapshot shows approximately 25,000 employees, 136 U.S. locations across 27 states plus D.C., $8.627B in FY2025 revenue, and a heavy DoD concentration. This dossier keeps the financial and risk intelligence but excludes any Occu-Med revenue-potential modeling.",
    bullets: [
      "FY2025 revenue: $8.627B, with $4.508B reported for the Dec 2025 six-month period.",
      "Employee count: approximately 25,000 confirmed employees.",
      "U.S. footprint: 136 locations across 27 states plus D.C.",
      "Backlog increased from $31.4B at FY2025 year-end to $32.8B by Dec 2025.",
      "Primary customer exposure is DoD, with 75.4% of revenue tied to DoD in the uploaded snapshot."
    ],
    metrics: ["caci-revenue-fy2025", "caci-employees", "caci-us-locations", "caci-backlog-dec2025", "caci-dod-revenue-share"],
  },
  {
    id: "accrued-comp-benefits",
    title: "Accrued Compensation and Benefits Signals",
    narrative: "The uploaded page 1 table breaks accrued compensation and benefits into salaries/withholdings, accrued leave, and an Other line. The uploaded brief flags the Other line as the most likely place where workers' compensation reserves, short-term disability accruals, and similar benefit liabilities would be captured. That line increased from $22.646M in FY2024 to $24.704M in FY2025.",
    bullets: [
      "Accrued salaries and withholdings were $216.399M in FY2025 compared with $218.529M in FY2024.",
      "Accrued leave dropped from $75.339M in FY2024 to $41.884M in FY2025.",
      "The uploaded report links the leave decrease to CACI's shift from accrued PTO to Flexible Time Off, while noting that FTO can make injury and sick-time tracking harder.",
      "The Other line grew year over year and is treated as a risk signal rather than a disclosed WC amount.",
      "Actual WC reserves are not publicly disclosed; the dashboard stores the line item as an exposure indicator."
    ],
    metrics: ["caci-accrued-other-fy2024", "caci-accrued-other-fy2025", "caci-accrued-leave-fy2024", "caci-accrued-leave-fy2025", "caci-fto-tracking-gap-score"],
  },
  {
    id: "fringe-indirect-costs",
    title: "Fringe and Indirect Cost Exposure",
    narrative: "The uploaded page 2 table shows that indirect costs and fringe increased from $1.591B in FY2023 to $1.833B in FY2025. The brief emphasizes that fringe benefit expenses on a higher labor base were identified as a primary driver of indirect cost increases. Even while indirect cost as a percentage of revenue declined, absolute fringe/indirect dollars grew materially with workforce and acquisition scale.",
    bullets: [
      "Indirect costs and fringe: $1.591B in FY2023, $1.720B in FY2024, and $1.833B in FY2025.",
      "Three-year increase: approximately $242M, or 15.2% cumulative growth.",
      "Indirect cost as a share of revenue declined from 23.7% in FY2023 to 21.2% in FY2025.",
      "The absolute dollar pool still grew, which matters because WC, benefits, leave, disability, and occupational-health costs can sit inside or alongside this cost structure.",
      "This is a finance and contracts-management signal, not just an HR signal."
    ],
    metrics: ["caci-indirect-fy2023", "caci-indirect-fy2024", "caci-indirect-fy2025", "caci-indirect-share-fy2025", "caci-indirect-growth-3yr"],
  },
  {
    id: "benefits-retirement",
    title: "Retirement and Benefit Plan Costs",
    narrative: "The uploaded page 2 benefit-plan table adds context to CACI's fully-loaded workforce cost. The brief lists FY2025 401(k) match expense of $74.7M, total defined contribution expense of $84.4M, post-retirement obligations of $6.97M, and stock-based compensation in the indirect pool of $60.2M.",
    bullets: [
      "401(k) match contribution expense grew from $52.7M in FY2023 to $74.7M in FY2025.",
      "Total defined contribution expense was $84.4M in FY2025.",
      "Post-retirement obligations were $6.97M in FY2025.",
      "Stock-based compensation in the indirect pool reached $60.2M in FY2025.",
      "The uploaded brief interprets these figures as evidence that CACI is a sophisticated benefits buyer with significant employee-cost visibility."
    ],
    metrics: ["caci-401k-match-fy2025", "caci-dc-expense-fy2025", "caci-post-retirement-fy2025", "caci-stock-comp-fy2025"],
  },
  {
    id: "insurance-risk-language",
    title: "Insurance and Employee Injury Risk Language",
    narrative: "The uploaded page 3 section highlights direct risk-factor language from CACI's 10-K. The brief says CACI acknowledges hazards inherent in aspects of its federal business, potential injury, bodily harm, death, or kidnapping during deployments, and that insurance coverage may not be adequate to cover claims or liabilities. That makes injury prevention, early intervention, return-to-work, and deployment documentation a risk-mitigation conversation.",
    bullets: [
      "The brief flags counterterrorism training services as an example of hazards inherent in federal business.",
      "Deployment-related injury, bodily harm, death, and kidnapping are included as severe-risk signals.",
      "Insurance adequacy is identified as a public-filing risk factor.",
      "The right framing is proactive risk mitigation and defensible documentation rather than routine clinic access alone.",
      "This risk signal connects HR, risk management, contracts, and finance stakeholders."
    ],
    metrics: ["caci-insurance-risk-score", "caci-wc-conservative-low", "caci-wc-conservative-high", "caci-wc-moderate-high"],
  },
  {
    id: "multi-state-wc-dba",
    title: "Multi-State WC and DBA Complexity",
    narrative: "The uploaded pages 3-4 identify CACI's 136-location, 27-state-plus-D.C. footprint as a core WC complexity issue. The brief also calls out Defense Base Act requirements for international deployments and elevated risk around counterterrorism training services. The practical risk is inconsistent provider access, decentralized incident reporting, delayed treatment, DBA gaps, and uneven acquired-company protocols.",
    bullets: [
      "27 states plus D.C. means separate WC rules, premium structures, and jurisdictional requirements.",
      "Virginia headquarters creates a likely concentration point for risk-management and WC administration decisions.",
      "DoD/IC field deployments create Defense Base Act exposure separate from standard domestic WC.",
      "136 locations increase decentralized incident-reporting and treatment-delay risk.",
      "The uploaded report also flags seven acquisitions in three years as a WC-integration risk."
    ],
    metrics: ["caci-us-locations", "caci-states-dc", "caci-multistate-risk-score", "caci-acquisitions-3yr"],
  },
  {
    id: "wc-exposure-estimates",
    title: "Workers' Compensation Exposure Estimates",
    narrative: "The uploaded page 4 estimation table uses CACI's FY2025 direct labor base and industry benchmarks to frame WC exposure. The conservative estimate shows roughly $14M-$23M per year including DBA, while the moderate estimate shows roughly $27M-$42M per year including DBA. These are not disclosed actual spend amounts and should be treated as modeled exposure estimates only.",
    bullets: [
      "FY2025 direct labor base used in the model: $5.836B.",
      "Estimated WC-attributable labor base: approximately $3.79B using a 65% assumption.",
      "Conservative blended WC rate assumption: 0.30% for knowledge workers.",
      "Moderate blended WC rate assumption: 0.60% for mixed workforce.",
      "Defense Base Act is modeled as an additional overseas exposure pool."
    ],
    metrics: ["caci-wc-conservative-low", "caci-wc-conservative-high", "caci-wc-moderate-high"],
  },
  {
    id: "wellbeing-fto",
    title: "Wellbeing Program and FTO Tracking Gap",
    narrative: "The uploaded page 4-5 wellbeing section says CACI has a comprehensive wellbeing program covering social, physical, financial, and emotional wellbeing, plus financial wellness resources and post-retirement obligations. The brief's key operational signal is that occupational health and injury-management infrastructure is not prominent in that wellbeing description, while Flexible Time Off can obscure health-related absence tracking.",
    bullets: [
      "Flexible Time Off replaced traditional accrued PTO, contributing to a large accrued-leave reduction.",
      "FTO can make sick time, injury absence, and lost-time claim patterns harder to detect early.",
      "CACI's wellbeing program shows benefits-program sophistication and readiness for measurable employee-facing programs.",
      "Post-retirement benefits and third-party benefit relationships indicate a mature benefits ecosystem.",
      "The gap is a documented occupational-health and injury-management layer that connects wellbeing to WC outcomes."
    ],
    metrics: ["caci-fto-tracking-gap-score", "caci-accrued-leave-fy2024", "caci-accrued-leave-fy2025", "caci-post-retirement-fy2025"],
  },
  {
    id: "dcaa-audit",
    title: "DCAA Audit and Fringe-Cost Defensibility",
    narrative: "The uploaded page 5 DCAA section is one of the strongest non-clinical angles. The brief states that DCAA audits are current through FY2023, while FY2024 and FY2025 are open/upcoming. It also states that WC premiums, self-insured claim payments, and occupational-health costs can flow through CACI's indirect cost pool and be billed to the U.S. government, making documentation and cost reasonableness important.",
    bullets: [
      "DCAA audits completed through FY2023, with FY2024 and FY2025 still open/upcoming.",
      "Benefit cost allocations and cost-accounting practices are review areas.",
      "If WC or fringe costs spike without documented management efforts, cost reasonableness can become harder to defend.",
      "Three FY2025 acquisitions added integration and audit complexity.",
      "The decision-maker path should include finance, contracts, compliance, risk management, and benefits."
    ],
    metrics: ["caci-dcaa-risk-score", "caci-fy2025-acquisition-revenue", "caci-acquisitions-3yr", "caci-indirect-fy2025"],
  },
  {
    id: "conversation-starters",
    title: "Conversation Starters",
    narrative: "The uploaded page 6 recommended approach gives practical stakeholder questions. For Insight Hub, these are retained as business-development intelligence without any Occu-Med revenue-potential modeling.",
    bullets: [
      "What portion of indirect/fringe growth is WC-related, and what is the current management strategy?",
      "With 136 locations in 27 states, how is CACI managing provider access consistency and claim intake across jurisdictions?",
      "How are Applied Insight, Azure Summit, and Identity E2E being integrated into CACI's WC and benefit-cost structure?",
      "What occupational-health infrastructure exists to reduce claim frequency, delayed care, and lost work time?",
      "With FY2024-FY2025 DCAA audits open or upcoming, what documentation supports fringe-cost reasonableness?"
    ],
    metrics: ["caci-multistate-risk-score", "caci-dcaa-risk-score", "caci-insurance-risk-score"],
  },
  {
    id: "monitoring-watchlist",
    title: "Monitoring Watchlist",
    narrative: "The uploaded page 6 monitoring section identifies what to watch next: future 10-Q and 10-K disclosures, the Accrued Compensation - Other line, fringe-cost language, DCAA audit updates, acquisitions, and accrued leave trends under FTO.",
    bullets: [
      "Next 10-Q: watch the Accrued Compensation - Other line and any new fringe-cost language.",
      "Next 10-K: watch retirement plan cost disclosure and updated accrued compensation breakdown.",
      "Commitments and Contingencies: watch for DCAA disputes or disallowance language.",
      "M&A activity: each acquisition can create WC integration and provider-network standardization needs.",
      "Accrued leave: continued FTO-driven decline may reduce visibility into injury-related absence patterns."
    ],
    metrics: ["caci-accrued-other-fy2025", "caci-indirect-fy2025", "caci-acquisitions-3yr", "caci-fto-tracking-gap-score"],
  },
  {
    id: "source-library",
    title: "Source Library",
    narrative: "This CACI profile is grounded in the uploaded seven-page financial intelligence brief, including the page 1 company snapshot and accrued compensation table, page 2 fringe and benefit-cost tables, page 3 insurance-risk and multi-state WC section, page 4 WC/DBA estimate and wellbeing section, page 5 DCAA and decision-maker section, and page 6 conversation starter and monitoring sections.",
    bullets: [
      "Uploaded company snapshot and accrued compensation table.",
      "Uploaded fringe/indirect cost and benefit-plan tables.",
      "Uploaded insurance risk-factor analysis.",
      "Uploaded multi-state WC, DBA, and acquisition-integration analysis.",
      "Uploaded DCAA audit exposure and stakeholder mapping.",
      "Uploaded monitoring watchlist."
    ],
    metrics: [],
  },
];

export const caciProfiles: CompanyProfile[] = [
  { companyId: "caci", sections: caciSections },
];

export const caciLocations: LocationRecord[] = [
  { id: "caci-hq-reston", companyId: "caci", company: "CACI International Inc", city: "Reston", state: "Virginia", country: "USA", region: "Headquarters", facilityType: "Corporate headquarters", activity: "Corporate, finance, risk management, contracts, benefits, and federal program administration", notes: "Uploaded brief identifies Virginia headquarters and uses it as a key WC administration and decision-maker signal.", coordinates: [-77.3570, 38.9586] },
  { id: "caci-us-footprint", companyId: "caci", company: "CACI International Inc", city: "Multi-state U.S. footprint", country: "USA", region: "27 states plus D.C.", facilityType: "Distributed U.S. operations", activity: "Defense, intelligence, IT, cyber, training, and professional services delivery", notes: "Uploaded brief cites 136 U.S. locations across 27 states plus D.C., creating multi-state WC jurisdiction complexity and decentralized provider-access needs.", coordinates: [-98.5795, 39.8283] },
  { id: "caci-dod-ic-deployments", companyId: "caci", company: "CACI International Inc", city: "DoD / IC deployments", country: "Worldwide", region: "OCONUS / DBA exposure", facilityType: "Deployed federal mission support", activity: "DoD, intelligence, counterterrorism, and overseas contractor support", notes: "Uploaded brief links international DoD work to Defense Base Act requirements and cites 10-K risk language around deployment injury, bodily harm, death, or kidnapping.", coordinates: [44.3661, 33.3152] },
  { id: "caci-training-operations", companyId: "caci", company: "CACI International Inc", city: "Training operations", country: "USA / Worldwide", region: "Counterterrorism training risk", facilityType: "Training and mission-support environments", activity: "Counterterrorism training services and related federal operations", notes: "Uploaded brief identifies counterterrorism training services as a risk-factor example tied to employee hazards and elevated WC exposure.", coordinates: [-77.0369, 38.9072] },
  { id: "caci-acquired-companies", companyId: "caci", company: "CACI International Inc", city: "Applied Insight / Azure Summit / Identity E2E", country: "USA", region: "FY2025 acquisition integration", facilityType: "Acquired-company integration", activity: "Fringe, benefit, WC, and provider-program integration", notes: "Uploaded brief names three FY2025 acquisitions and flags fringe structure, WC program, and audit integration as active issues.", coordinates: [-77.4360, 37.5407] },
];

export const caciReports: ReportRecord[] = [
  {
    id: "caci-financial-wc-risk-brief",
    companyId: "caci",
    title: "CACI Financial, WC, Fringe, and DCAA Risk Brief",
    createdAt: "2026-06-05",
    summary: "Uploaded CACI brief converted into an Insight Hub dossier with no Occu-Med revenue-potential modeling. Key signals include 25,000 employees, 136 U.S. locations across 27 states plus D.C., $1.833B FY2025 indirect/fringe costs, an increasing Accrued Compensation and Benefits Other line, FTO-related tracking gaps, insurance-risk language, DBA exposure, acquisition integration, and DCAA fringe-cost defensibility.",
    signals: [
      "Large 25,000-employee workforce with 136 U.S. locations across 27 states plus D.C.",
      "Indirect/fringe cost pool increased by approximately $242M over three years.",
      "Accrued Compensation and Benefits Other line increased from $22.646M to $24.704M.",
      "Flexible Time Off may reduce visibility into injury-related absence and lost-time tracking.",
      "10-K risk-factor language supports an insurance and employee-injury risk conversation.",
      "Defense Base Act exposure and multi-state WC administration create complexity beyond routine urgent-care access.",
      "DCAA audits through FY2023 are complete, while FY2024-FY2025 are open or upcoming, making fringe-cost documentation important.",
      "No Occu-Med revenue-potential modeling is included."
    ],
  },
];
