import type { CompanyConfig } from "./types";

export const eccConfig: CompanyConfig = {
  companyId: "ecc",
  displayName: "Engineering & Construction Consulting (ECC)",
  shortName: "ECC",
  sector:
    "Construction, engineering, infrastructure, USACE contracts, OCONUS operations, DBA exposure, and occupational medicine support",
  headquarters: "Arlington, Virginia",
  employees: 1500,
  employeesAsOf: "Chart pack 2 ECC opportunity modeling data",
  summary:
    "Engineering & Construction Consulting (ECC) is a construction and engineering contractor with significant USACE and OCONUS operations. Chart pack 2 identifies ECC as a high-value opportunity target with modeled DBA exposure of $6.7M annually and strong OCONUS footprint. The company operates in multiple theaters including Iraq, Kuwait, and Afghanistan, with substantial construction and infrastructure projects requiring comprehensive occupational medicine support including pre-deployment screening, DBA medical protocols, and ongoing surveillance for field operations.",
  tags: [
    "Entity profile",
    "ECC",
    "Engineering & Construction Consulting",
    "Construction",
    "USACE",
    "OCONUS",
    "DBA exposure",
    "Infrastructure",
    "Opportunity target",
  ],
  aliases: ["ECC", "Engineering & Construction Consulting", "ECC International"],
  sourceFilters: {
    sam: { legalNames: ["Engineering & Construction Consulting"] },
    usaSpending: { recipientNames: ["Engineering & Construction Consulting", "ECC"] },
    newsSources: { aliases: ["Engineering & Construction Consulting", "ECC", "ECC International"] },
  },
  executiveSignals: [
    {
      label: "DBA exposure",
      value: "$6.7M/yr",
      note: "Chart pack 2 models annual DBA exposure at $6.7M for ECC operations.",
    },
    {
      label: "OCONUS footprint",
      value: "High",
      note: "ECC operates in Iraq, Kuwait, Afghanistan, and other OCONUS theaters.",
    },
    {
      label: "USACE contracts",
      value: "Active",
      note: "ECC holds USACE construction and infrastructure contracts.",
    },
    {
      label: "Opportunity score",
      value: "10",
      note: "Chart pack 2 priority roadmap identifies ECC as an immediate high-value target.",
    },
  ],
  curveTitle: "ECC DBA exposure and OCONUS opportunity curve",
  curveSubtitle:
    "Chart pack 2 ECC opportunity modeling normalized into entity profile. Values are modeled estimates and should be validated against current contract status.",
  chartDefinitions: [
    {
      id: "ecc-dba-exposure",
      title: "ECC DBA exposure by theater",
      subtitle: "Chart pack 2: modeled annual DBA exposure across OCONUS operations.",
      type: "bar",
      xKey: "theater",
      data: [
        { theater: "Iraq", exposure: 2.5 },
        { theater: "Kuwait", exposure: 2.0 },
        { theater: "Afghanistan", exposure: 1.5 },
        { theater: "Other OCONUS", exposure: 0.7 },
      ],
      series: [{ dataKey: "exposure", name: "DBA exposure $M", color: "#ef4444", radius: [10, 10, 0, 0] }],
      formatter: "currencyM",
      headline: "DBA exposure",
    },
    {
      id: "ecc-opportunity-modeling",
      title: "ECC opportunity modeling",
      subtitle: "Chart pack 2: revenue potential and implementation complexity assessment.",
      type: "bar",
      xKey: "metric",
      data: [
        { metric: "Revenue potential", value: 1785 },
        { metric: "Implementation complexity", value: 7 },
        { metric: "Strategic value", value: 9 },
      ],
      series: [{ dataKey: "value", name: "Score", color: "#22d3ee", radius: [10, 10, 0, 0] }],
      headline: "opportunity",
    },
    {
      id: "ecc-operations-by-country",
      title: "ECC operations by country",
      subtitle: "Chart pack 2: ECC construction and engineering project locations.",
      type: "bar",
      xKey: "country",
      data: [
        { country: "Iraq", projects: 8 },
        { country: "Kuwait", projects: 6 },
        { country: "Afghanistan", projects: 5 },
        { country: "Qatar", projects: 3 },
        { country: "UAE", projects: 2 },
      ],
      series: [{ dataKey: "projects", name: "Active projects", color: "#22c55e", radius: [10, 10, 0, 0] }],
      headline: "operations",
    },
  ],
  metricDefinitions: [
    { id: "ecc-employees", label: "Employees", value: 1500, unit: "count", category: "workforce" },
    { id: "ecc-dba-exposure", label: "Annual DBA exposure", value: 6.7, unit: "usd", category: "risk" },
    { id: "ecc-revenue-potential", label: "Revenue potential", value: 1785, unit: "usd", category: "financial" },
    { id: "ecc-implementation-complexity", label: "Implementation complexity", value: 7, unit: "score", category: "financial" },
    { id: "ecc-strategic-value", label: "Strategic value", value: 9, unit: "score", category: "financial" },
  ],
  riskMatrix: [
    { name: "OCONUS operations", revenue: 6.7, risk: 9.0, workers: 800 },
    { name: "USACE contracts", revenue: 15, risk: 7.5, workers: 1200 },
    { name: "DBA liability", revenue: 6.7, risk: 8.5, workers: 800 },
    { name: "Construction safety", revenue: 10, risk: 7.0, workers: 1500 },
  ],
  opportunityMatrix: [
    { name: "DBA Pre-Deployment Program", revenuePotential: 1785, implementationComplexity: 7, strategicValue: 9 },
    { name: "USACE Medical Surveillance", revenuePotential: 1200, implementationComplexity: 6, strategicValue: 8 },
    { name: "OCONUS Provider Network", revenuePotential: 900, implementationComplexity: 8, strategicValue: 9 },
    { name: "Construction Physicals", revenuePotential: 600, implementationComplexity: 5, strategicValue: 7 },
  ],
  dossierSections: [
    {
      type: "overview",
      title: "Entity overview",
      narrative:
        "ECC is a construction and engineering contractor with significant USACE and OCONUS operations. Chart pack 2 identifies ECC as a high-value opportunity target with substantial DBA exposure and strategic value.",
      bullets: [
        "Modeled annual DBA exposure is $6.7M across Iraq, Kuwait, Afghanistan, and other OCONUS theaters.",
        "ECC holds active USACE construction and infrastructure contracts.",
        "The company operates in multiple high-risk OCONUS locations requiring comprehensive occupational medicine support.",
        "Chart pack 2 priority roadmap identifies ECC as an immediate high-value target with strategic value score of 9.",
      ],
      metricIds: ["ecc-dba-exposure", "ecc-revenue-potential", "ecc-strategic-value"],
    },
    {
      type: "safety",
      title: "DBA exposure and OCONUS operations",
      narrative:
        "ECC's OCONUS footprint creates significant DBA liability and requires specialized medical protocols for pre-deployment screening and ongoing surveillance.",
      bullets: [
        "Iraq operations account for the largest share of DBA exposure at $2.5M annually.",
        "Kuwait and Afghanistan operations contribute $2.0M and $1.5M respectively in DBA exposure.",
        "Pre-deployment medical screening is critical for DBA risk mitigation.",
        "OCONUS provider network coverage is essential for ongoing medical support.",
      ],
      metricIds: ["ecc-dba-exposure"],
    },
    {
      type: "medical-opportunities",
      title: "Occu-Med service opportunity",
      narrative:
        "The ECC opportunity centers on DBA pre-deployment protocols, USACE medical surveillance, and OCONUS provider network support.",
      bullets: [
        "DBA pre-deployment medical screening is the highest-priority service lane.",
        "USACE contract requirements create structured medical surveillance demand.",
        "OCONUS provider network coverage across Iraq, Kuwait, and Afghanistan is essential.",
        "Construction physicals and fit-for-duty exams support field operations.",
      ],
      metricIds: ["ecc-revenue-potential", "ecc-implementation-complexity"],
    },
  ],
};
