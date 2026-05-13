import {
  assumptionsTable,
  companiesTable,
  db,
  locationsTable,
  metricsTable,
  profilesTable,
  reportsTable,
  searchRunsTable,
  sourcesTable,
} from "@workspace/db";

const now = new Date();

const companies = [
  {
    id: "v2x",
    name: "V2X, Inc.",
    shortName: "V2X",
    sector: "Defense services, logistics, training, and mission support",
    headquarters: "McLean, Virginia",
    employees: 16000,
    employeesAsOf: "Initial backend seed",
    summary:
      "Primary strategic account view for global defense support operations, overseas readiness, occupational health screening needs, and distributed workforce exposure.",
    tags: ["Federal contractor", "Global operations", "Deployment readiness", "Medical screening fit"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "kbr",
    name: "KBR, Inc.",
    shortName: "KBR",
    sector: "Government services, engineering, science, and mission support",
    headquarters: "Houston, Texas",
    employees: 37000,
    employeesAsOf: "Initial backend seed",
    summary:
      "Large mission-support and engineering organization with distributed workforce exposure and recurring occupational medical readiness needs.",
    tags: ["Benchmark peer", "Government services", "Large workforce"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "amentum",
    name: "Amentum",
    shortName: "Amentum",
    sector: "Engineering, logistics, environmental, and mission operations",
    headquarters: "Chantilly, Virginia",
    employees: 53000,
    employeesAsOf: "Initial backend seed",
    summary:
      "Benchmark mission-support organization with broad federal footprint, high-complexity operational settings, and occupational health relevance.",
    tags: ["Benchmark peer", "Mission support", "Global footprint"],
    createdAt: now,
    updatedAt: now,
  },
];

const sources = [
  {
    id: "v2x-initial-profile",
    companyId: "v2x",
    label: "V2X initial strategic profile",
    type: "Manual" as const,
    note:
      "Backend seed record. Replace with source-backed filings, contract records, and verified operating data as ingestion workflows are added.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "kbr-initial-profile",
    companyId: "kbr",
    label: "KBR benchmark profile",
    type: "Manual" as const,
    note:
      "Benchmark record for peer comparison and cost-model testing. Replace with validated source library entries.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "amentum-initial-profile",
    companyId: "amentum",
    label: "Amentum benchmark profile",
    type: "Manual" as const,
    note:
      "Benchmark record for peer comparison and cost-model testing. Replace with validated source library entries.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "geo-seed",
    companyId: "v2x",
    label: "Backend global footprint seed",
    type: "Manual" as const,
    note:
      "Initial location seed used by the API until workbook upload and persistent geographic ingestion are implemented.",
    createdAt: now,
    updatedAt: now,
  },
];

const metrics = [
  { id: "v2x-employees", companyId: "v2x", label: "Employees", value: 16000, unit: "count" as const, category: "workforce" as const, trend: 2.2, sourceId: "v2x-initial-profile", createdAt: now, updatedAt: now },
  { id: "v2x-wc-proxy", companyId: "v2x", label: "Estimated annual WC proxy", value: 13760000, unit: "usd" as const, category: "financial" as const, trend: 4.6, sourceId: "v2x-initial-profile", createdAt: now, updatedAt: now },
  { id: "v2x-readiness-score", companyId: "v2x", label: "Readiness complexity score", value: 87, unit: "score" as const, category: "risk" as const, trend: 8.1, sourceId: "v2x-initial-profile", createdAt: now, updatedAt: now },
  { id: "v2x-global-locations", companyId: "v2x", label: "Mapped locations", value: 7, unit: "count" as const, category: "risk" as const, trend: 8.2, sourceId: "geo-seed", createdAt: now, updatedAt: now },
  { id: "kbr-employees", companyId: "kbr", label: "Employees", value: 37000, unit: "count" as const, category: "workforce" as const, trend: 2.9, sourceId: "kbr-initial-profile", createdAt: now, updatedAt: now },
  { id: "kbr-wc-proxy", companyId: "kbr", label: "Estimated annual WC proxy", value: 31820000, unit: "usd" as const, category: "financial" as const, trend: 5.2, sourceId: "kbr-initial-profile", createdAt: now, updatedAt: now },
  { id: "amentum-employees", companyId: "amentum", label: "Employees", value: 53000, unit: "count" as const, category: "workforce" as const, trend: 3.4, sourceId: "amentum-initial-profile", createdAt: now, updatedAt: now },
  { id: "amentum-wc-proxy", companyId: "amentum", label: "Estimated annual WC proxy", value: 45580000, unit: "usd" as const, category: "financial" as const, trend: 5.8, sourceId: "amentum-initial-profile", createdAt: now, updatedAt: now },
];

const profiles = [
  {
    companyId: "v2x",
    sections: [
      {
        id: "v2x-account-fit",
        title: "Account fit",
        narrative:
          "V2X is the priority account because the operating model depends on distributed staffing, deployment readiness, medical screening consistency, and rapid documentation workflows.",
        bullets: [
          "High-volume workforce creates repeatable screening and renewal demand.",
          "Global support footprint creates country-specific medical readiness complexity.",
          "Audit-proof documentation and faster exception handling are strong value levers.",
        ],
        metrics: ["v2x-employees", "v2x-global-locations", "v2x-readiness-score"],
      },
      {
        id: "v2x-risk-signals",
        title: "Risk signals",
        narrative:
          "The strongest strategic angle is reducing delay, inconsistency, and medical-documentation friction before deployment or assignment deadlines.",
        bullets: [
          "Deployability depends on timely exam completion, provider documentation, and guideline-aware review.",
          "Geographic spread increases the value of a reliable provider network and standardized packets.",
          "Cost modeling can frame occupational health support as risk prevention instead of administrative overhead.",
        ],
        metrics: ["v2x-wc-proxy", "v2x-readiness-score"],
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    companyId: "kbr",
    sections: [
      {
        id: "kbr-benchmark",
        title: "Benchmark profile",
        narrative:
          "KBR is included as a peer comparator for workforce scale, government-services exposure, and occupational health program benchmarking.",
        bullets: [
          "Large workforce scale supports peer comparison.",
          "Federal services footprint creates screening relevance.",
          "Use as a cost and opportunity benchmark until deeper source ingestion is added.",
        ],
        metrics: ["kbr-employees", "kbr-wc-proxy"],
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    companyId: "amentum",
    sections: [
      {
        id: "amentum-benchmark",
        title: "Benchmark profile",
        narrative:
          "Amentum is included as a high-scale mission-support comparator for geographic and occupational medical opportunity modeling.",
        bullets: [
          "Very large employee base creates measurable occupational health exposure.",
          "Mission-support footprint is relevant to readiness and deployment screening.",
          "Useful as a peer benchmark for executive cost-model views.",
        ],
        metrics: ["amentum-employees", "amentum-wc-proxy"],
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

const locations = [
  { id: "v2x-mclean", companyId: "v2x", company: "V2X", city: "McLean", state: "VA", country: "USA", region: "North America", facilityType: "Corporate / program support", activity: "Program management and mission support", notes: "Seed headquarters and program-support location.", longitude: -77.1773, latitude: 38.9339, createdAt: now, updatedAt: now },
  { id: "v2x-kuwait", companyId: "v2x", company: "V2X", city: "Kuwait City", country: "Kuwait", region: "Middle East / Central Asia", facilityType: "AOR support", activity: "Logistics and deployment support", notes: "Seed AOR location for overseas readiness modeling.", longitude: 47.9774, latitude: 29.3759, createdAt: now, updatedAt: now },
  { id: "v2x-qatar", companyId: "v2x", company: "V2X", city: "Doha", country: "Qatar", region: "Middle East / Central Asia", facilityType: "AOR support", activity: "Mission support and logistics", notes: "Seed AOR location for overseas readiness modeling.", longitude: 51.531, latitude: 25.2854, createdAt: now, updatedAt: now },
  { id: "v2x-germany", companyId: "v2x", company: "V2X", city: "Kaiserslautern", country: "Germany", region: "Europe", facilityType: "Regional support", activity: "Defense support services", notes: "Seed Europe location for geographic filter testing.", longitude: 7.7689, latitude: 49.4401, createdAt: now, updatedAt: now },
  { id: "v2x-guam", companyId: "v2x", company: "V2X", city: "Tamuning", country: "Guam", region: "Indo-Pacific", facilityType: "Regional support", activity: "Indo-Pacific mission support", notes: "Seed Indo-Pacific location for map testing.", longitude: 144.7937, latitude: 13.4877, createdAt: now, updatedAt: now },
  { id: "v2x-japan", companyId: "v2x", company: "V2X", city: "Okinawa", country: "Japan", region: "Indo-Pacific", facilityType: "Regional support", activity: "Mission support and readiness", notes: "Seed Indo-Pacific location for map testing.", longitude: 127.7615, latitude: 26.3344, createdAt: now, updatedAt: now },
  { id: "v2x-albania", companyId: "v2x", company: "V2X", city: "Tirana", country: "Albania", region: "Europe", facilityType: "Regional support", activity: "Operational support", notes: "Seed Europe location for geographic filter testing.", longitude: 19.8187, latitude: 41.3275, createdAt: now, updatedAt: now },
];

const assumptions = [
  { id: "hours", label: "Annual hours per employee", value: 2000, unit: "hours", description: "Standard full-time annualized work-hours assumption used for proxy cost modeling.", createdAt: now, updatedAt: now },
  { id: "wcRate", label: "Workers compensation cost per hour", value: 0.43, unit: "USD/hour", description: "Editable proxy assumption until employer-specific loss data is available.", createdAt: now, updatedAt: now },
  { id: "burden", label: "Economic burden multiplier", value: 1.25, unit: "multiplier", description: "Adds administrative, productivity, and program-management burden above direct proxy cost.", createdAt: now, updatedAt: now },
  { id: "indirect", label: "Indirect cost multiplier", value: 2.1, unit: "multiplier", description: "Models broader operational disruption, delay, and replacement-cost exposure.", createdAt: now, updatedAt: now },
];

const reports = [
  {
    id: "v2x-readout",
    companyId: "v2x",
    title: "V2X executive signal report",
    summary:
      "V2X shows strong fit for an occupational-health intelligence workflow because workforce scale, geographic exposure, and deployment requirements create recurring documentation and readiness risk.",
    signals: [
      "Prioritize provider-network coverage in AOR-heavy regions.",
      "Position audit-proof outputs and faster waiver/documentation routing as operational risk reduction.",
      "Use cost-proxy modeling to frame screening delays as measurable exposure.",
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "kbr-readout",
    companyId: "kbr",
    title: "KBR benchmark signal report",
    summary:
      "KBR provides a useful peer benchmark for workforce scale and federal-services medical-readiness opportunity modeling.",
    signals: [
      "Use as a benchmark against V2X scale.",
      "Compare workforce-size-driven screening exposure.",
      "Add sourced contract and program records during enrichment.",
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "amentum-readout",
    companyId: "amentum",
    title: "Amentum benchmark signal report",
    summary:
      "Amentum provides a high-scale mission-support peer profile for cost-model and footprint comparison.",
    signals: [
      "Use as a high-scale comparator.",
      "Add program and procurement source records.",
      "Compare geography and readiness complexity.",
    ],
    createdAt: now,
    updatedAt: now,
  },
];

const searchRuns = [
  {
    id: "seed-v2x-opportunity-scan",
    query: "V2X occupational health medical screening deployment readiness",
    target: "company" as const,
    status: "completed" as const,
    resultCount: sources.length,
    notes:
      "Seed run placeholder. Replace with live Serper/Tavily/Exa/Apify workflows after provider keys are configured.",
    rawResults: [],
    createdAt: now,
    updatedAt: now,
  },
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before running seed:insight.");
  }

  await db.insert(companiesTable).values(companies).onConflictDoNothing();
  await db.insert(sourcesTable).values(sources).onConflictDoNothing();
  await db.insert(metricsTable).values(metrics).onConflictDoNothing();
  await db.insert(profilesTable).values(profiles).onConflictDoNothing();
  await db.insert(locationsTable).values(locations).onConflictDoNothing();
  await db.insert(assumptionsTable).values(assumptions).onConflictDoNothing();
  await db.insert(reportsTable).values(reports).onConflictDoNothing();
  await db.insert(searchRunsTable).values(searchRuns).onConflictDoNothing();

  console.log("Insight Hub seed data inserted or already present.");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
