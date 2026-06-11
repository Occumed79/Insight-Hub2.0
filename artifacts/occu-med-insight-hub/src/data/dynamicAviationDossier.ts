import type { Company, CompanyProfile, LocationRecord, Metric, ReportRecord, SourceRecord } from "./types";

export const dynamicAviationCompanies: Company[] = [
  {
    id: "dynamic-aviation",
    name: "Dynamic Aviation Group, Inc.",
    shortName: "Dynamic Aviation",
    sector: "Aviation services, aircraft maintenance, ISR support, flight operations, and aerial-fire support",
    headquarters: "Not specified in uploaded material",
    employees: 575,
    employeesAsOf: "Modeled worker categories from uploaded Dynamic Aviation visual set",
    summary: "Dynamic Aviation has been added as an aviation-maintenance and flight-support risk dossier. The uploaded visuals connect Mechanics/MRO injury-cost exposure, pilot and flight-crew risk, USFS aerial-fire seasonal risk, ISR support exposure, aircraft mechanic severe-injury trend escalation, and BLS TRIR benchmark segmentation.",
    tags: ["Aviation maintenance", "Flight crew", "Aerial fire", "ISR support", "TRIR benchmark", "Severe-injury trend"],
  },
];

export const dynamicAviationSources: SourceRecord[] = [
  {
    id: "dynamic-aviation-injury-cost-visual",
    companyId: "dynamic-aviation",
    label: "Dynamic Aviation estimated annual injury cost by worker type visual",
    type: "Manual",
    note: "Uploaded Dynamic Aviation chart models annual injury-cost exposure by worker category. Mechanics/MRO show approximately 250 workers, 8 modeled injuries, $382K low estimate, and $256K additional high-estimate burden. Pilots/Flight Crew show approximately 150 workers, 4 modeled injuries, $189K low estimate, and $126K additional burden. USFS Aerial Fire shows approximately 50 seasonal workers, 2 injuries, $99K low estimate, and $66K additional burden. ISR Support/Office shows approximately 125 workers, 1 injury, $36K low estimate, and $24K additional burden.",
  },
  {
    id: "dynamic-aviation-mechanic-severe-injury-trend",
    companyId: "dynamic-aviation",
    label: "US aircraft mechanic severe injuries trend visual",
    type: "Benchmark",
    note: "Uploaded trend visual shows U.S. aircraft mechanic severe injuries from 2015 through 2022: 14, 13, 19, 16, 15, 11, 12, and 30. The visual frames 2022 as a doubling event after several years of lower severe-injury counts.",
  },
  {
    id: "dynamic-aviation-trir-benchmark-visual",
    companyId: "dynamic-aviation",
    label: "Dynamic Aviation worker risk by BLS TRIR benchmark visual",
    type: "Benchmark",
    note: "Uploaded TRIR benchmark visual ranks Aerial Firefighters at 4.5, Aircraft Mechanics at 3.4, Avionics/MRO Techs at 3.4, ISR Pilots & Flight Crew at 2.8, and Office Analysts / ISR Support at 0.6.",
  },
];

export const dynamicAviationMetrics: Metric[] = [
  { id: "dynamic-workers-modeled", companyId: "dynamic-aviation", label: "Modeled worker population", value: 575, unit: "count", category: "workforce", trend: 7.2, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-mechanics-workers", companyId: "dynamic-aviation", label: "Mechanics/MRO workers", value: 250, unit: "count", category: "workforce", trend: 8.4, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-mechanics-injuries", companyId: "dynamic-aviation", label: "Mechanics/MRO modeled injuries", value: 8, unit: "count", category: "safety", trend: 8.6, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-mechanics-injury-cost", companyId: "dynamic-aviation", label: "Mechanics/MRO injury-cost exposure", value: 638000, unit: "usd", category: "financial", trend: 8.8, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-pilots-workers", companyId: "dynamic-aviation", label: "Pilots/Flight Crew workers", value: 150, unit: "count", category: "workforce", trend: 7.1, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-pilots-injury-cost", companyId: "dynamic-aviation", label: "Pilots/Flight Crew injury-cost exposure", value: 315000, unit: "usd", category: "financial", trend: 7.3, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-aerial-fire-workers", companyId: "dynamic-aviation", label: "USFS Aerial Fire seasonal workers", value: 50, unit: "count", category: "workforce", trend: 7.5, sourceId: "dynamic-aviation-injury-cost-visual" },
  { id: "dynamic-aerial-fire-trir", companyId: "dynamic-aviation", label: "Aerial Firefighter TRIR benchmark", value: 4.5, unit: "score", category: "safety", trend: 9.1, sourceId: "dynamic-aviation-trir-benchmark-visual" },
  { id: "dynamic-mechanic-trir", companyId: "dynamic-aviation", label: "Aircraft mechanic TRIR benchmark", value: 3.4, unit: "score", category: "safety", trend: 8.4, sourceId: "dynamic-aviation-trir-benchmark-visual" },
  { id: "dynamic-2022-severe-injuries", companyId: "dynamic-aviation", label: "2022 aircraft mechanic severe injuries", value: 30, unit: "count", category: "safety", trend: 9.4, sourceId: "dynamic-aviation-mechanic-severe-injury-trend" },
];

export const dynamicAviationLocations: LocationRecord[] = [
  {
    id: "dynamic-aviation-us-operations",
    companyId: "dynamic-aviation",
    company: "Dynamic Aviation",
    city: "Bridgewater",
    state: "VA",
    country: "USA",
    region: "North America",
    facilityType: "Aviation operations and maintenance node",
    activity: "Aircraft maintenance, flight operations, ISR support, and aerial-service operations",
    notes: "Representative U.S. operating marker. Uploaded visuals focus on worker categories rather than a detailed facility roster.",
    coordinates: [-78.9767, 38.3821],
  },
];

export const dynamicAviationProfiles: CompanyProfile[] = [
  {
    companyId: "dynamic-aviation",
    sections: [
      {
        id: "overview",
        title: "Overview",
        narrative: "Dynamic Aviation is framed as an aviation-maintenance and flight-support workforce risk dossier. The uploaded visuals show a risk profile concentrated in Mechanics/MRO, Pilots/Flight Crew, USFS Aerial Fire seasonal personnel, and ISR Support/Office workers.",
        bullets: ["Profile built from uploaded Dynamic Aviation injury-cost, severe-injury trend, and TRIR benchmark visuals", "Aviation maintenance and aerial-fire support are the strongest risk signals", "Revenue-potential visuals were intentionally excluded under the current no-revenue profile rule"],
        metrics: ["dynamic-workers-modeled", "dynamic-mechanics-injury-cost", "dynamic-2022-severe-injuries"],
      },
      {
        id: "workforce-operations",
        title: "Workforce & Operations",
        narrative: "The uploaded injury-cost model separates Dynamic Aviation workers into Mechanics/MRO, Pilots/Flight Crew, USFS Aerial Fire seasonal personnel, and ISR Support/Office workers. This creates a clear occupational-health segmentation for maintenance, flight operations, aerial-fire support, and lower-risk office/ISR support.",
        bullets: ["Mechanics/MRO: approximately 250 workers", "Pilots/Flight Crew: approximately 150 workers", "USFS Aerial Fire: approximately 50 seasonal workers", "ISR Support/Office: approximately 125 workers"],
        metrics: ["dynamic-workers-modeled", "dynamic-mechanics-workers", "dynamic-pilots-workers", "dynamic-aerial-fire-workers"],
      },
      {
        id: "injury-cost-exposure",
        title: "Injury Cost Exposure",
        narrative: "Mechanics/MRO carry the highest modeled injury-cost exposure. The chart shows 8 modeled injuries, a $382K low estimate, and a $256K additional high-estimate burden for approximately $638K total exposure. Pilots/Flight Crew are second at approximately $315K total exposure, followed by USFS Aerial Fire at approximately $165K and ISR Support/Office at approximately $60K.",
        bullets: ["Mechanics/MRO: $638K total modeled injury-cost exposure", "Pilots/Flight Crew: $315K total modeled exposure", "USFS Aerial Fire: $165K total modeled exposure", "ISR Support/Office: $60K total modeled exposure"],
        metrics: ["dynamic-mechanics-injury-cost", "dynamic-pilots-injury-cost", "dynamic-mechanics-injuries"],
      },
      {
        id: "severe-injury-trend",
        title: "Severe Injury Trend",
        narrative: "The aircraft mechanic severe-injury trend visual shows U.S. aircraft mechanic severe injuries fluctuating between 11 and 19 from 2015 through 2021, then rising sharply to 30 in 2022. The visual frames 2022 as a doubling event, making aircraft mechanic injury prevention and medical surveillance a central profile theme.",
        bullets: ["2015: 14 severe injuries", "2017 peak before 2022: 19 severe injuries", "2020 low point: 11 severe injuries", "2022: 30 severe injuries"],
        metrics: ["dynamic-2022-severe-injuries", "dynamic-mechanic-trir"],
      },
      {
        id: "trir-benchmark-risk",
        title: "TRIR Benchmark Risk",
        narrative: "The TRIR benchmark visual places Aerial Firefighters as the highest-risk group at 4.5. Aircraft Mechanics and Avionics/MRO Techs are both shown at 3.4, ISR Pilots & Flight Crew at 2.8, and Office Analysts / ISR Support at 0.6. This creates a clear risk hierarchy for profile prioritization.",
        bullets: ["Highest benchmark: Aerial Firefighters at TRIR 4.5", "Aircraft Mechanics and Avionics/MRO Techs: TRIR 3.4", "ISR Pilots & Flight Crew: TRIR 2.8", "Office Analysts / ISR Support: TRIR 0.6"],
        metrics: ["dynamic-aerial-fire-trir", "dynamic-mechanic-trir"],
      },
      {
        id: "source-library",
        title: "Source Library",
        narrative: "The Dynamic Aviation profile is currently grounded in the uploaded visual set. Additional source documents, facility rosters, contracts, locations, and contact notes can be layered in later.",
        bullets: ["Uploaded annual injury-cost by worker type visual", "Uploaded aircraft mechanic severe-injury trend visual", "Uploaded worker-risk by BLS TRIR benchmark visual", "Revenue-potential visual excluded unless explicitly approved"],
        metrics: [],
      },
    ],
  },
];

export const dynamicAviationReports: ReportRecord[] = [
  {
    id: "dynamic-aviation-risk-summary",
    companyId: "dynamic-aviation",
    title: "Dynamic Aviation aviation workforce risk summary",
    createdAt: "2026-06-11",
    summary: "Dynamic Aviation shows a concentrated aviation-maintenance and flight-support risk profile, with Mechanics/MRO carrying the largest injury-cost exposure and Aerial Firefighters carrying the highest TRIR benchmark.",
    signals: ["Mechanics/MRO injury-cost exposure: approximately $638K", "2022 U.S. aircraft mechanic severe injuries: 30", "Aerial Firefighter TRIR benchmark: 4.5", "Aircraft mechanic TRIR benchmark: 3.4"],
  },
];
