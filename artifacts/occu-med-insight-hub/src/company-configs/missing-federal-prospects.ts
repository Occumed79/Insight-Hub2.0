import type { CompanyConfig } from "./types";

export const missingFederalProspectsConfig: CompanyConfig = {
  companyId: "missing-federal-prospects",
  displayName: "Missing Federal Prospect Intelligence",
  shortName: "Missing Prospects",
  sector:
    "Federal contractor prospect discovery, Washington Technology Top 100 gap analysis, deployed workforce targeting, tribal 8(a) growth, USACE construction, DBA exams, and Occu-Med coverage overlap strategy",
  headquarters: "Occu-Med portfolio-level prospect discovery",
  employees: 0,
  employeesAsOf:
    "Uploaded missing-prospect report: cross-reference of 87 tracked companies against the 2025 Washington Technology Top 100 and deployed workforce filters",
  summary:
    "Missing Federal Prospect Intelligence captures the uploaded analysis identifying federal contractors that match Occu-Med's coverage logic but were not yet in the prospect list. The report calls out five immediate additions: Akima, AECOM, Cherokee Nation Businesses, Booz Allen Hamilton, and Bechtel. The strongest pattern is tribal and Alaska Native Corporation style contractors: Akima and Cherokee Nation Businesses resemble Alutiiq and Bodwe because they perform base operations, logistics, facilities, construction, IT, and expeditionary support across military installations while often lacking a mature internal medical-coordination layer. AECOM and Bechtel are USACE/Air Force construction and engineering targets with OCONUS/DBA medical needs. Booz Allen is not an industrial account, but its deployable analysts, project managers, cyber/IT staff, and austere-location postings create a selective high-value OCONUS exam lane.",
  tags: [
    "Entity profile",
    "Missing prospects",
    "Akima",
    "AECOM",
    "Cherokee Nation Businesses",
    "Booz Allen Hamilton",
    "Bechtel",
    "Tribal 8(a)",
    "ANC",
    "USACE",
    "DBA",
    "Deployed workforce",
    "Coverage overlap",
    "Chase outreach",
  ],
  aliases: ["Missing Prospects", "Federal Prospect Gap", "Top 100 Prospect Gap", "Coverage Match Prospects"],
  sourceFilters: {
    newsSources: {
      aliases: ["Akima base operations", "AECOM USACE Pacific", "Cherokee Nation Businesses Marine Corps logistics", "Booz Allen deployable", "Bechtel federal construction"],
    },
  },
  executiveSignals: [
    { label: "Immediate adds", value: "5", note: "Uploaded analysis names Akima, AECOM, Cherokee Nation Businesses, Booz Allen, and Bechtel as immediate prospect additions." },
    { label: "Biggest miss", value: "Akima", note: "Akima is framed as a larger Alutiiq-style ANC contractor with 9,000+ employees and 40+ subsidiaries." },
    { label: "Strongest pattern", value: "Tribal / ANC", note: "Akima, Cherokee Nation, Alutiiq, and Bodwe share a high-growth federal set-aside/base-ops pattern." },
    { label: "Range", value: "~1K-2.2K exams/yr", note: "Combined estimate from the report's prospect ranges across the five immediate additions." },
  ],
  curveTitle: "Missing federal prospect coverage-match and deployed-workforce curve",
  curveSubtitle:
    "Uploaded prospect-gap report normalized into a portfolio entity. Estimates are strategic screening values and require validation against current task orders and rosters.",
  chartDefinitions: [
    {
      id: "missing-prospect-exam-potential",
      title: "Immediate missing prospects by estimated exam potential",
      subtitle: "Uploaded report estimates annual exam potential for five high-fit missing prospects.",
      type: "grouped",
      xKey: "prospect",
      data: [
        { prospect: "Akima", low: 300, high: 600 },
        { prospect: "AECOM", low: 200, high: 400 },
        { prospect: "Cherokee Nation", low: 200, high: 400 },
        { prospect: "Booz Allen", low: 200, high: 500 },
        { prospect: "Bechtel", low: 100, high: 300 },
      ],
      series: [
        { dataKey: "low", name: "Low estimate", color: "#22d3ee", radius: [8, 8, 0, 0] },
        { dataKey: "high", name: "High estimate", color: "#22c55e", radius: [8, 8, 0, 0] },
      ],
      headline: "exam potential",
      fullWidth: true,
    },
    {
      id: "missing-prospect-fit-score",
      title: "Occu-Med fit score by prospect",
      subtitle: "Fit is driven by deployed workforce, OCONUS/DBA need, field hazards, and existing coverage overlap.",
      type: "bar",
      xKey: "prospect",
      data: [
        { prospect: "Akima", fit: 10 },
        { prospect: "Cherokee Nation", fit: 9 },
        { prospect: "AECOM", fit: 9 },
        { prospect: "Bechtel", fit: 8 },
        { prospect: "Booz Allen", fit: 7 },
      ],
      series: [{ dataKey: "fit", name: "Occu-Med fit", color: "#f97316", radius: [10, 10, 0, 0] }],
      domain: [0, 10],
      headline: "fit score",
    },
    {
      id: "tribal-anc-growth-pattern",
      title: "Tribal / ANC contractor growth pattern",
      subtitle: "The report frames Akima and Cherokee Nation as the same kind of opportunity class as Alutiiq and Bodwe.",
      type: "bar",
      xKey: "entity",
      data: [
        { entity: "Alutiiq", priority: 8 },
        { entity: "Bodwe", priority: 10 },
        { entity: "Akima", priority: 10 },
        { entity: "Cherokee Nation", priority: 9 },
      ],
      series: [{ dataKey: "priority", name: "Pattern strength", color: "#a78bfa", radius: [10, 10, 0, 0] }],
      domain: [0, 10],
      headline: "8(a) pattern",
    },
  ],
  metricDefinitions: [
    { id: "missing-prospect-count", label: "Immediate prospects", value: 5, unit: "count", category: "financial" },
    { id: "missing-akima-employees", label: "Akima employees", value: 9000, unit: "count", category: "workforce" },
    { id: "missing-aecom-employees", label: "AECOM employees", value: 52000, unit: "count", category: "workforce" },
    { id: "missing-cherokee-employees", label: "Cherokee Nation Businesses employees", value: 5000, unit: "count", category: "workforce" },
    { id: "missing-booz-employees", label: "Booz Allen employees", value: 33000, unit: "count", category: "workforce" },
    { id: "missing-bechtel-employees", label: "Bechtel global employees", value: 55000, unit: "count", category: "workforce" },
  ],
  riskMatrix: [
    { name: "Akima / ANC base ops", revenue: 600, risk: 9.0, workers: 9000 },
    { name: "AECOM USACE construction", revenue: 400, risk: 8.5, workers: 52000 },
    { name: "Cherokee Nation 8(a)", revenue: 400, risk: 8.5, workers: 5000 },
    { name: "Booz Allen deployable staff", revenue: 500, risk: 6.5, workers: 33000 },
    { name: "Bechtel nuclear/construction", revenue: 300, risk: 9.0, workers: 55000 },
  ],
  opportunityMatrix: [
    { name: "Akima Outreach", revenuePotential: 600, implementationComplexity: 5, strategicValue: 10 },
    { name: "Cherokee Nation Businesses Outreach", revenuePotential: 400, implementationComplexity: 5, strategicValue: 9 },
    { name: "AECOM USACE/CNA Channel", revenuePotential: 400, implementationComplexity: 7, strategicValue: 9 },
    { name: "Booz Allen Deployable Program", revenuePotential: 500, implementationComplexity: 8, strategicValue: 7 },
    { name: "Bechtel Nuclear/DBA Construction", revenuePotential: 300, implementationComplexity: 8, strategicValue: 8 },
  ],
  dossierSections: [
    {
      type: "overview",
      title: "The five companies missing from the prospect list",
      narrative:
        "The uploaded report cross-referenced the tracked Occu-Med universe against the Washington Technology Top 100 and filtered for field/deployed workforces likely to require occupational health exams.",
      bullets: [
        "Akima is named as the biggest miss and compared directly to Alutiiq.",
        "AECOM and Bechtel create USACE/Air Force engineering, construction, and DBA lanes.",
        "Cherokee Nation Businesses matches the tribal 8(a) growth pattern already visible in Alutiiq and Bodwe.",
        "Booz Allen is a selective deployed-workforce target rather than an industrial surveillance account.",
      ],
      metricIds: ["missing-prospect-count", "missing-akima-employees", "missing-aecom-employees"],
    },
    {
      type: "medical-opportunities",
      title: "Why tribal and ANC contractors matter",
      narrative:
        "The strongest non-obvious insight is the tribal/ANC pattern. These contractors are winning fast-growing federal work, often at military installations, but are less likely than major primes to have a mature internal medical-coordination system.",
      bullets: [
        "Alutiiq is already an Occu-Med client, so the model is familiar.",
        "Bodwe was already identified as a 100% coverage prospect.",
        "Akima and Cherokee Nation Businesses should be added to the same outreach lane.",
      ],
      metricIds: ["missing-cherokee-employees"],
    },
  ],
};
