import type { CompanyConfig } from "./types";

export const uploadedPdfFifthIntelligenceConfig: CompanyConfig = {
  companyId: "uploaded-pdf-fifth-intelligence",
  displayName: "Uploaded PDF Fifth Intelligence",
  shortName: "PDF Batch 5",
  sector: "Referral volume and network revenue intelligence",
  headquarters: "Occu-Med analytics intake layer",
  employees: 0,
  employeesAsOf: "Uploaded PDF chart deck; visible chart data captured from pages 1-16; expanded with directional intake values",
  summary:
    "Expanded intake profile for the uploaded PDF dashboard deck. The deck includes referral program volume, US staging-city demand, regional demand, hiring demand, site mapping, concentration, and revenue-opportunity charts. The highest visible program is 1,312 referrals (LOGCAP V Iraq OCN annual), the top US staging city is Fort Worth at 199 referrals, and the deck maps 2,403 sites across 88 companies and 134 countries. Values are directional intake from visible chart data and should be validated against actual scheduling data.",
  tags: ["Entity profile", "Referral volume", "Network revenue", "Staging cities", "Hiring demand", "Provider network", "Revenue concentration"],
  executiveSignals: [
    { label: "Top referral program", value: "1,312 refs", note: "LOGCAP V Iraq OCN annual is the largest visible program in the uploaded chart deck." },
    { label: "Top staging city", value: "Fort Worth 199", note: "Highest US staging-city referral node in this deck." },
    { label: "Mapped sites", value: "2,403", note: "Deck maps sites across 88 companies and 134 countries." },
    { label: "Data quality", value: "Directional", note: "Values are directional intake from visible chart data; should be validated against actual scheduling data." },
  ],
  chartDefinitions: [
    {
      id: "pdf5-program-volume-short",
      title: "Top referral programs",
      subtitle: "Visible chart values captured from uploaded deck; Program 1 is LOGCAP V Iraq OCN annual.",
      type: "bar",
      xKey: "program",
      data: [
        { program: "LOGCAP V Iraq OCN annual", referrals: 1312 },
        { program: "LOGCAP V Kuwait annual", referrals: 880 },
        { program: "OMDAC-SWACA Kuwait/Qatar", referrals: 472 },
        { program: "LOGCAP V Iraq annual", referrals: 308 },
        { program: "LOGCAP V Kwajalein annual", referrals: 302 },
      ],
      series: [{ dataKey: "referrals", name: "Referrals", color: "#22d3ee", radius: [10, 10, 0, 0] }],
      headline: "program volume",
      fullWidth: true,
    },
    {
      id: "pdf5-staging-city-short",
      title: "US staging cities",
      subtitle: "Visible chart values captured from uploaded deck; directional intake values.",
      type: "bar",
      xKey: "city",
      data: [
        { city: "Fort Worth TX", referrals: 199 },
        { city: "Greenville SC", referrals: 192 },
        { city: "Corpus Christi TX", referrals: 103 },
        { city: "San Antonio TX", referrals: 55 },
        { city: "El Paso TX", referrals: 48 },
        { city: "Fayetteville NC", referrals: 45 },
        { city: "Jacksonville FL", referrals: 42 },
        { city: "Milton FL", referrals: 41 },
      ],
      series: [{ dataKey: "referrals", name: "Referrals", color: "#22d3ee", radius: [10, 10, 0, 0] }],
      headline: "staging cities",
      fullWidth: true,
    }
  ],
  metricDefinitions: [
    { id: "pdf5-top-program", label: "Top program referrals", value: 1312, unit: "count", category: "workforce" },
    { id: "pdf5-fort-worth", label: "Fort Worth referrals", value: 199, unit: "count", category: "workforce" },
    { id: "pdf5-greenville", label: "Greenville referrals", value: 192, unit: "count", category: "workforce" },
    { id: "pdf5-mapped-sites", label: "Mapped sites", value: 2403, unit: "count", category: "workforce" },
  ],
  riskMatrix: [
    { name: "Data quality validation", revenue: 0, risk: 8.0, workers: 0 },
    { name: "Contract renewal risk", revenue: 1312, risk: 7.5, workers: 5000 },
  ],
  opportunityMatrix: [
    { name: "Staging City Provider Buildout", revenuePotential: 825, implementationComplexity: 6, strategicValue: 9 },
    { name: "Contract Exam Retention", revenuePotential: 1312, implementationComplexity: 5, strategicValue: 10 },
  ],
  dossierSections: [
    {
      type: "overview",
      title: "Expanded PDF intelligence profile",
      narrative:
        "This profile contains expanded information from the fifth uploaded PDF, with directional intake values from visible chart data. The data focuses on referral program volume, US staging-city patterns, and site mapping across 88 companies and 134 countries.",
      bullets: [
        "The top referral program is LOGCAP V Iraq OCN annual with 1,312 referrals.",
        "Fort Worth, TX and Greenville, SC are the top CONUS staging cities for pre-deployment exams.",
        "The deck maps 2,403 sites across 88 companies and 134 countries.",
        "Values are directional intake from visible chart data and should be validated against actual scheduling data.",
      ],
      metricIds: ["pdf5-top-program", "pdf5-fort-worth", "pdf5-greenville", "pdf5-mapped-sites"],
    },
    {
      type: "safety",
      title: "Data quality considerations",
      narrative:
        "The values in this profile are directional intake estimates from visible chart data and should be treated as modeled rather than audited.",
      bullets: [
        "All referral counts are directional estimates from visible chart data and require validation.",
        "Program names are inferred from context (LOGCAP V, OMDAC-SWACA) and should be verified.",
        "Staging-city rankings should be refreshed as mobilization patterns change.",
        "This profile should be updated with verified data when available.",
      ],
      metricIds: [],
    },
  ],
};
