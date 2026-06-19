import type { CompanyConfig } from "./types";

export const uploadedPdfFifthIntelligenceConfig: CompanyConfig = {
  companyId: "uploaded-pdf-fifth-intelligence",
  displayName: "Uploaded PDF Fifth Intelligence",
  shortName: "PDF Batch 5",
  sector: "Referral volume and network revenue intelligence",
  headquarters: "Occu-Med analytics intake layer",
  employees: 0,
  employeesAsOf: "Uploaded PDF chart deck; visible chart data captured from pages 1-16.",
  summary:
    "Temporary intake profile for the uploaded PDF dashboard deck. The deck includes referral program volume, US staging-city demand, regional demand, hiring demand, site mapping, concentration, and revenue-opportunity charts. The highest visible program is 1,312 referrals, the top US staging city is Fort Worth at 199 referrals, and the deck maps 2,403 sites across 88 companies and 134 countries.",
  tags: ["Entity profile", "Referral volume", "Network revenue", "Staging cities", "Hiring demand", "Provider network", "Revenue concentration"],
  executiveSignals: [
    { label: "Top referral program", value: "1,312 refs", note: "Largest visible program in the uploaded chart deck." },
    { label: "Top staging city", value: "Fort Worth 199", note: "Highest US staging-city referral node in this deck." },
    { label: "Mapped sites", value: "2,403", note: "Deck maps sites across 88 companies and 134 countries." },
  ],
  chartDefinitions: [
    {
      id: "pdf5-program-volume-short",
      title: "Top referral programs",
      subtitle: "Visible chart values captured from uploaded deck.",
      type: "bar",
      xKey: "program",
      data: [
        { program: "Program 1", referrals: 1312 },
        { program: "Program 2", referrals: 880 },
        { program: "Program 3", referrals: 472 },
        { program: "Program 4", referrals: 308 },
        { program: "Program 5", referrals: 302 },
      ],
      series: [{ dataKey: "referrals", name: "Referrals", color: "#22d3ee", radius: [10, 10, 0, 0] }],
      headline: "program volume",
      fullWidth: true,
    },
    {
      id: "pdf5-staging-city-short",
      title: "US staging cities",
      subtitle: "Visible chart values captured from uploaded deck.",
      type: "bar",
      xKey: "city",
      data: [
        { city: "Fort Worth", referrals: 199 },
        { city: "Greenville", referrals: 192 },
        { city: "Corpus Christi", referrals: 103 },
        { city: "San Antonio", referrals: 55 },
        { city: "El Paso", referrals: 48 },
      ],
      series: [{ dataKey: "referrals", name: "Referrals", color: "#22d3ee", radius: [10, 10, 0, 0] }],
      headline: "staging cities",
      fullWidth: true,
    }
  ],
};
