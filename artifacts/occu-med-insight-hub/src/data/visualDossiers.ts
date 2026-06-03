import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const visualCompanies: Company[] = [
  {
    id: "s3-international",
    name: "S3 International",
    shortName: "S3",
    sector: "International aviation maintenance, Saudi Arabia support, OCONUS deployment, and defense contractor workforce services",
    headquarters: "Not specified in uploaded material",
    employees: 680,
    employeesAsOf: "Modeled workforce deployment from uploaded S3 visual set",
    summary: "S3 International has been added as a Saudi Arabia and OCONUS aviation-support dossier. The uploaded visuals connect aircraft maintenance noise exposure, extreme heat and chemical hazards, Saudi-based DBA medical risk, international deployment headcount, and Occu-Med revenue opportunities across pre-deploy exams, heat illness assessment, hearing conservation, JP-8 surveillance, lead monitoring, pilot physicals, and pre-employment physicals.",
    tags: ["Saudi Arabia", "Aviation maintenance", "Noise exposure", "DBA pre-deploy", "OCONUS workforce", "Hazard gap"],
  },
];

export const visualSources: SourceRecord[] = [
  { id: "s3-aircraft-noise-visual", companyId: "s3-international", label: "S3 aircraft fleet noise exposure visual", type: "Manual", note: "Uploaded S3 chart compares aircraft run-up and maintenance noise levels to OSHA thresholds. AH-64E is shown at 115 dB, UH-60M at 112 dB, AH-6I at 108 dB, MD-530F at 105 dB, and CH-47F at 118 dB, all above the 85 dBA action threshold and 90 dB OSHA threshold lines." },
  { id: "s3-saudi-hazard-gap-visual", companyId: "s3-international", label: "S3 Saudi Arabia hazard severity vs Occu-Med gap visual", type: "Manual", note: "Uploaded S3 chart scores hazard severity and Occu-Med gap from 1-5. Hazards include extreme heat, JP-8/Skydrol chemical exposure, helicopter noise, armament lead exposure, aviation fatality risk, and DBA unlimited medical liability." },
  { id: "s3-deployment-location-visual", companyId: "s3-international", label: "S3 International workforce deployment by location visual", type: "Manual", note: "Uploaded S3 chart models workforce deployment by location. Saudi Arabia / Team GDC-ME is shown at 300 workers with 9/10 risk, Partner Nation Africa/MENA at 80 workers with 7/10 risk, Partner Nation S/SE Asia at 60 workers with 6/10 risk, Partner Nation Europe/NATO at 40 workers with 4/10 risk, and CONUS ANG + AACE at 200 workers with 0/10 risk." },
  { id: "s3-revenue-potential-visual", companyId: "s3-international", label: "S3 International Occu-Med revenue potential visual", type: "Manual", note: "Uploaded S3 chart models annual revenue potential by exam type. DBA pre-deploy for Saudi and OCONUS is shown at $220K, heat illness assessment at $40K, hearing conservation at $32K, JP-8 chemical surveillance at $48K, lead monitoring at $28K, pilot physicals at $26K, and pre-employment physicals at $20K." },
];

export const visualMetrics: Metric[] = [
  { id: "s3-modeled-workers", companyId: "s3-international", label: "Modeled deployed workforce", value: 680, unit: "count", category: "workforce", trend: 7.1, sourceId: "s3-deployment-location-visual" },
  { id: "s3-saudi-workers", companyId: "s3-international", label: "Saudi Arabia workers", value: 300, unit: "count", category: "workforce", trend: 8.7, sourceId: "s3-deployment-location-visual" },
  { id: "s3-peak-noise", companyId: "s3-international", label: "Peak aircraft noise", value: 118, unit: "score", category: "safety", trend: 9.2, sourceId: "s3-aircraft-noise-visual" },
  { id: "s3-osha-action-threshold", companyId: "s3-international", label: "OSHA action threshold", value: 85, unit: "score", category: "safety", trend: 0, sourceId: "s3-aircraft-noise-visual" },
  { id: "s3-saudi-risk-index", companyId: "s3-international", label: "Saudi risk score", value: 9, unit: "score", category: "risk", trend: 9.1, sourceId: "s3-deployment-location-visual" },
  { id: "s3-revenue-potential", companyId: "s3-international", label: "Annual revenue potential", value: 414000, unit: "usd", category: "financial", trend: 7.9, sourceId: "s3-revenue-potential-visual" },
];

export const visualProfiles: CompanyProfile[] = [
  {
    companyId: "s3-international",
    sections: [
      { id: "overview", title: "Overview", narrative: "S3 International is framed as an aviation-maintenance and Saudi Arabia OCONUS occupational-health opportunity. The uploaded visuals show a high-risk noise profile across aircraft platforms, a strong Saudi hazard gap, and a serviceable revenue model led by DBA pre-deployment exams.", bullets: ["All listed aircraft platforms exceed OSHA hearing-conservation threshold lines", "Saudi Arabia / Team GDC-ME is the largest and highest-risk workforce node", "Annual modeled Occu-Med revenue potential totals approximately $414K", "Main service lanes include DBA pre-deploy exams, hearing conservation, heat illness assessment, JP-8 surveillance, lead monitoring, pilot physicals, and pre-employment physicals"], metrics: ["s3-revenue-potential", "s3-modeled-workers", "s3-peak-noise"] },
      { id: "workforce-operations", title: "Workforce & Operations", narrative: "The S3 workforce model spans Saudi Arabia, partner-nation Africa/MENA, partner-nation South/Southeast Asia, partner-nation Europe/NATO, and CONUS ANG/AACE operations. The operational story is concentrated around aviation maintenance, field deployment, and exposure-heavy support environments.", bullets: ["Saudi Arabia / Team GDC-ME: 300 workers", "CONUS ANG + AACE: 200 workers", "Partner Nation Africa/MENA: 80 workers", "Partner Nation South/Southeast Asia: 60 workers", "Partner Nation Europe/NATO: 40 workers"], metrics: ["s3-modeled-workers", "s3-saudi-workers"] },
      { id: "customer-mix", title: "Customer Mix", narrative: "The uploaded visuals point to international defense-support activity, Saudi-based support, partner-nation programs, and CONUS ANG/AACE work. This profile should be expanded later with contract vehicles, primes/sub relationships, and decision-maker notes when available.", bullets: ["Saudi Arabia / Team GDC-ME appears as the main international node", "Partner-nation Africa/MENA and S/SE Asia are moderate-risk deployment lanes", "CONUS ANG + AACE adds domestic aviation-support relevance"], metrics: ["s3-saudi-risk-index"] },
      { id: "global-footprint", title: "Global Footprint", narrative: "Saudi Arabia is the dominant international deployment node in the uploaded S3 model, with additional partner-nation exposure across Africa/MENA, South/Southeast Asia, Europe/NATO, and CONUS operations.", bullets: ["Saudi Arabia: 300 workers, risk 9/10", "Africa/MENA: 80 workers, risk 7/10", "South/Southeast Asia: 60 workers, risk 6/10", "Europe/NATO: 40 workers, risk 4/10", "CONUS ANG + AACE: 200 workers, risk 0/10"], metrics: ["s3-saudi-workers", "s3-saudi-risk-index"] },
      { id: "safety-metrics", title: "Safety Metrics", narrative: "Aircraft maintenance noise exposure is the most visually obvious safety signal. The uploaded chart shows every aircraft platform above the OSHA action and threshold lines, with CH-47F Chinook at the highest modeled value.", bullets: ["CH-47F Chinook: 118 dB", "AH-64E Apache: 115 dB", "UH-60M Black Hawk: 112 dB", "AH-6I Little Bird: 108 dB", "MD-530F Cayuse Warrior: 105 dB", "OSHA action threshold shown at 85 dBA and OSHA threshold shown at 90 dB"], metrics: ["s3-peak-noise", "s3-osha-action-threshold"] },
      { id: "injury-trends", title: "Injury Trends", narrative: "The hazard gap visual shows recurring operational threats rather than a single incident trend. Extreme heat, aviation fatality risk, and DBA unlimited medical liability carry the highest severity values, while JP-8/Skydrol exposure and helicopter noise remain important surveillance lanes.", bullets: ["Extreme heat: severity 5, Occu-Med gap 4", "JP-8 / Skydrol chemical exposure: severity 4, gap 4", "Helicopter noise: severity 4, gap 3", "Armament lead exposure: severity 3, gap 4", "Aviation fatality risk: severity 5, gap 3", "DBA unlimited medical liability: severity 5, gap 5"], metrics: ["s3-saudi-risk-index", "s3-peak-noise"] },
      { id: "geographic-risk", title: "Geographic Risk", narrative: "Saudi Arabia carries the strongest geographic-risk signal in the uploaded deployment model, with risk 9/10 and the largest modeled worker headcount. This makes Saudi-specific pre-deployment and surveillance services the clearest initial pitch lane.", bullets: ["Saudi Arabia: 300 workers, risk 9/10", "Africa/MENA partner nation: 80 workers, risk 7/10", "S/SE Asia partner nation: 60 workers, risk 6/10", "Europe/NATO partner nation: 40 workers, risk 4/10", "CONUS ANG + AACE: 200 workers, risk 0/10"], metrics: ["s3-saudi-workers", "s3-saudi-risk-index"] },
      { id: "financial-workers-comp-signal", title: "Financial / Workers’ Comp Signal", narrative: "The revenue visual makes the S3 profile immediately actionable. DBA pre-deploy for Saudi and OCONUS is the largest modeled service lane, followed by JP-8 surveillance, heat illness assessment, hearing conservation, lead monitoring, pilot physicals, and pre-employment physicals.", bullets: ["Total modeled annual revenue potential: approximately $414K", "DBA pre-deploy for Saudi + OCONUS: $220K", "JP-8 chemical surveillance: $48K", "Heat illness assessment: $40K", "Hearing conservation: $32K", "Lead monitoring: $28K", "Pilot physicals: $26K", "Pre-employment physicals: $20K"], metrics: ["s3-revenue-potential"] },
      { id: "source-library", title: "Source Library", narrative: "The S3 profile is currently grounded in the uploaded visual set. Additional contract links, client notes, location details, and outreach history can be layered into the dossier later.", bullets: ["Uploaded aircraft noise chart", "Uploaded Saudi hazard gap chart", "Uploaded workforce deployment by location chart", "Uploaded Occu-Med revenue potential chart"], metrics: [] },
    ],
  },
];

export const visualLocations: LocationRecord[] = [
  { id: "s3-saudi-arabia", companyId: "s3-international", company: "S3 International", city: "Saudi Arabia / Team GDC-ME", country: "Saudi Arabia", region: "Middle East", facilityType: "Aviation support / deployed workforce", activity: "Aircraft maintenance and OCONUS support", notes: "Uploaded S3 deployment visual shows 300 workers and risk 9/10.", coordinates: [46.6753, 24.7136] },
  { id: "s3-africa-mena", companyId: "s3-international", company: "S3 International", city: "Partner Nation Africa/MENA", country: "Regional", region: "Africa / MENA", facilityType: "Partner-nation deployment lane", activity: "International support", notes: "Uploaded S3 deployment visual shows 80 workers and risk 7/10.", coordinates: [31.2357, 30.0444] },
  { id: "s3-sse-asia", companyId: "s3-international", company: "S3 International", city: "Partner Nation S/SE Asia", country: "Regional", region: "South / Southeast Asia", facilityType: "Partner-nation deployment lane", activity: "International support", notes: "Uploaded S3 deployment visual shows 60 workers and risk 6/10.", coordinates: [100.5018, 13.7563] },
  { id: "s3-europe-nato", companyId: "s3-international", company: "S3 International", city: "Partner Nation Europe/NATO", country: "Regional", region: "Europe", facilityType: "Partner-nation deployment lane", activity: "International support", notes: "Uploaded S3 deployment visual shows 40 workers and risk 4/10.", coordinates: [4.3517, 50.8503] },
  { id: "s3-conus-ang-aace", companyId: "s3-international", company: "S3 International", city: "CONUS ANG + AACE", country: "USA", region: "North America", facilityType: "Domestic aviation support", activity: "ANG and AACE support", notes: "Uploaded S3 deployment visual shows 200 workers and risk 0/10.", coordinates: [-97.7431, 30.2672] },
];

export const visualReports: ReportRecord[] = [
  { id: "s3-saudi-aviation-signal", companyId: "s3-international", title: "S3 Saudi aviation occupational-health opportunity signal", createdAt: "2026-06-03", summary: "S3 International combines aircraft maintenance noise exposure, Saudi Arabia deployment risk, chemical and heat hazards, and a clear DBA-led revenue opportunity, making it a strong candidate for an aviation-focused Occu-Med visual dossier.", signals: ["Peak aircraft noise of 118 dB", "Saudi Arabia workforce node: 300 workers at risk 9/10", "$414K modeled annual Occu-Med revenue potential", "DBA Saudi + OCONUS exams are the largest modeled lane at $220K", "Hazard gap includes heat, JP-8/Skydrol, helicopter noise, lead, aviation fatality, and DBA liability"] },
];

export function mergeVisualDossiers<T extends { id: string }>(base: T[], additions: T[]) {
  const existing = new Set(base.map((item) => item.id));
  return [...base, ...additions.filter((item) => !existing.has(item.id))];
}
