import { expect, test, type Page, type Route } from "@playwright/test";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

const constructionBenchmark = {
  naics: "23",
  industryTitle: "Construction",
  year: 2024,
  trcRate: 2.5,
  dartRate: 1.6,
  daysAwayRate: 1.1,
  source: "BLS IIF / SOII",
  sourceUrl: "https://www.bls.gov/iif/",
  apiDocsUrl: "https://www.bls.gov/bls/api_features.htm",
  developerDocsUrl: "https://www.bls.gov/developers/",
  sourceMetadata: "BLS SOII test fixture",
  limitation: "Aggregate industry benchmark.",
  authMode: "public-v2",
  attemptedSeriesIds: ["ISUCONGP2CON31100"],
};

const transportationBenchmark = { ...constructionBenchmark, naics: "48", industryTitle: "Transportation and warehousing", trcRate: 4.1, dartRate: 2.7, daysAwayRate: 1.8 };

const manifest = {
  ok: true,
  businessQuestions: [
    { id: "where-hurt", title: "Where are workers getting hurt?", description: "Open OSHA injury burden, location, industry, and trend views.", source: "osha" },
    { id: "industry-opportunity", title: "Which industries create the greatest occupational-health opportunity?", description: "Open BLS benchmarks.", source: "bls" },
    { id: "job-services", title: "What services might a job require us to evaluate?", description: "Browse O*NET service evidence.", source: "onet" },
    { id: "public-data", title: "What public datasets exist that we have not exploited yet?", description: "Open curated Data.gov collections.", source: "datagov" },
  ],
  blsSectors: [
    { id: "construction", naics: "23", label: "Construction", description: "Construction workforces." },
    { id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Transportation workforces." },
  ],
  workforceGroups: [
    { id: "skilled-trades", label: "Skilled Trades", description: "Common trades.", occupations: ["Electrician", "Aircraft mechanic"] },
    { id: "emergency-safety", label: "Emergency & Safety", description: "Safety-sensitive work.", occupations: ["Firefighter"] },
  ],
  serviceOpportunities: [
    { id: "hearing", label: "Hearing Conservation / Audiometry", description: "Noise and hearing evidence.", occupations: ["Aircraft mechanic", "Electrician"] },
    { id: "respirator", label: "Respirator / Respiratory Programs", description: "Respiratory evidence.", occupations: ["Firefighter"] },
    { id: "physical", label: "Physical Ability / Functional Testing", description: "Physical demands.", occupations: ["Electrician"] },
  ],
  dataGovCollections: [
    { id: "injury-illness", label: "Employee Injury & Illness", query: "occupational injury illness workplace employee", why: "Find injury datasets.", analyses: ["Trend", "Geography"] },
  ],
  sources: [
    { id: "osha", source: "OSHA ITA", status: "integrated", officialUrl: "https://www.osha.gov/itadata", dataFamilies: [{ name: "Form 300A establishment summaries", coverage: "2016–current", status: "Query-ready" }, { name: "Form 300/301 case detail", coverage: "2023–current", status: "Importer/analytics ready" }] },
    { id: "bls", source: "BLS SOII / IIF", status: "live", officialUrl: "https://www.bls.gov/iif/", dataFamilies: [{ name: "Industry incidence rates", coverage: "Historical", status: "Live API" }] },
    { id: "onet", source: "O*NET Web Services", status: "live", officialUrl: "https://services.onetcenter.org/reference/online", dataFamilies: [{ name: "Tasks / context / abilities", coverage: "Occupation-specific", status: "Live API" }] },
    { id: "datagov", source: "Data.gov", status: "live-catalog", officialUrl: "https://catalog.data.gov/", dataFamilies: [{ name: "Employee Injury & Illness", coverage: "Government-wide", status: "Live catalog" }] },
  ],
};

const onetProfile = {
  ok: true,
  keyword: "Aircraft mechanic",
  source: "O*NET Web Services API v2",
  matches: [{ code: "49-3011.00", title: "Aircraft Mechanics and Service Technicians", score: 100 }],
  profile: {
    occupation: { code: "49-3011.00", title: "Aircraft Mechanics and Service Technicians", description: "Diagnose, adjust, repair, or overhaul aircraft engines and assemblies." },
    tasks: [{ name: "Inspect aircraft for defects and hazardous conditions.", value: 89, category: "Core" }, { name: "Use protective equipment around hazardous materials.", value: 72, category: "Core" }],
    workContext: [{ name: "Sounds, Noise Levels Are Distracting or Uncomfortable", value: 77, response: [{ percentage: 61, description: "Every day" }] }, { name: "Wear Common Protective or Safety Equipment", value: 83 }],
    abilities: [{ name: "Static Strength", value: 55 }, { name: "Near Vision", value: 70 }],
    workActivities: [{ name: "Handling and Moving Objects", value: 78 }],
    detailedWorkActivities: [{ name: "Inspect mechanical equipment to locate damage, defects, or wear." }],
    serviceMatches: [{ id: "hearing", label: "Hearing Conservation / Audiometry", description: "Noise evidence.", count: 1, evidence: [{ name: "Sounds, Noise Levels Are Distracting or Uncomfortable", value: 77 }] }, { id: "physical", label: "Physical Ability / Functional Testing", description: "Physical evidence.", count: 2, evidence: [{ name: "Static Strength", value: 55 }, { name: "Handling and Moving Objects", value: 78 }] }],
    counts: { tasks: 2, workContext: 2, abilities: 2, workActivities: 1, detailedWorkActivities: 1 },
    partialErrors: [],
  },
  limitation: "Service matches are transparent filters, not medical conclusions.",
};

async function installOccupationalApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/api/occupational-discovery/manifest")) return fulfillJson(route, manifest);
    if (path.endsWith("/api/occupational-discovery/bls-overview")) return fulfillJson(route, { ok: true, sectors: [{ id: "construction", naics: "23", label: "Construction", description: "Construction workforces.", benchmark: constructionBenchmark }, { id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Transportation workforces.", benchmark: transportationBenchmark }], ranked: [{ id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Transportation workforces.", benchmark: transportationBenchmark }, { id: "construction", naics: "23", label: "Construction", description: "Construction workforces.", benchmark: constructionBenchmark }], limitation: "Aggregate industry benchmarks." });
    if (path.endsWith("/api/occupational-discovery/bls-history")) return fulfillJson(route, { ok: true, history: { naics: url.searchParams.get("naics") || "23", industryTitle: url.searchParams.get("naics") === "48" ? "Transportation and warehousing" : "Construction", points: [{ year: 2020, trcRate: 3.1, dartRate: 2.0, daysAwayRate: 1.4 }, { year: 2021, trcRate: 3.0, dartRate: 1.9, daysAwayRate: 1.3 }, { year: 2022, trcRate: 2.8, dartRate: 1.8, daysAwayRate: 1.2 }, { year: 2023, trcRate: 2.7, dartRate: 1.7, daysAwayRate: 1.1 }, { year: 2024, trcRate: 2.5, dartRate: 1.6, daysAwayRate: 1.1 }], limitation: "Aggregate industry benchmark.", reason: "Historical SOII series retrieved." } });
    if (path.endsWith("/api/bls/industry-benchmark")) return fulfillJson(route, { ok: true, benchmark: constructionBenchmark, message: "Benchmark data retrieved." });
    if (path.endsWith("/api/occupational-discovery/osha-overview")) return fulfillJson(route, { ok: true, configured: true, imported: true, latestYear: 2025, importInfo: { totalRecords: 1200, importRuns: [] }, trend: [{ year: 2023, total_cases: 120, dart_cases: 50, hours: 5000000, trc_rate: 4.8 }, { year: 2024, total_cases: 110, dart_cases: 45, hours: 5000000, trc_rate: 4.4 }, { year: 2025, total_cases: 90, dart_cases: 35, hours: 5000000, trc_rate: 3.6 }], topEmployers: [{ name: "Example Infrastructure Co", establishments: 12, total_cases: 40, dart_cases: 18, hours: 1000000, trc_rate: 8.0 }], topStates: [{ name: "CA", establishments: 30, total_cases: 44, dart_cases: 15, hours: 900000, trc_rate: 9.8 }, { name: "TX", establishments: 25, total_cases: 30, dart_cases: 12, hours: 800000, trc_rate: 7.5 }], topIndustries: [{ name: "23", establishments: 20, total_cases: 38, trc_rate: 8.2 }], highRateEstablishments: [{ name: "Example Yard", company_name: "Example Infrastructure Co", city: "Fresno", state: "CA", naics: "237310", total_cases: 8, trc_rate: 12.4 }], limitation: "OSHA reporting scope limitation." });
    if (path.endsWith("/api/occupational-discovery/osha-case-overview")) return fulfillJson(route, { ok: true, configured: true, imported: true, importInfo: { totalCases: 340, years: [2024, 2025] }, overview: { totalCases: 340, years: [2024, 2025], latestYear: 2025, outcomeCounts: [{ name: "Days away from work", count: 120, daysAway: 980, restrictedDays: 200 }, { name: "Job transfer / restriction", count: 80, daysAway: 0, restrictedDays: 600 }], incidentTypes: [{ name: "Injury", count: 300 }, { name: "Hearing loss", count: 20 }], natures: [{ name: "Sprains, strains, tears", code: "1", count: 88 }], bodyParts: [{ name: "Back", code: "23", count: 66 }], events: [{ name: "Overexertion and bodily reaction", code: "71", count: 74 }], sources: [{ name: "Parts and materials", code: "4", count: 59 }], secondarySources: [], occupations: [{ name: "Construction Laborers", code: "47-2061", count: 35 }], trend: [{ year: 2024, cases: 150, daysAway: 700, restrictedDays: 300 }, { year: 2025, cases: 190, daysAway: 900, restrictedDays: 500 }] }, limitation: "Case-detail scope limitation." });
    if (path.endsWith("/api/osha/establishments")) return fulfillJson(route, { ok: true, configured: true, records: [], warning: "", source: "OSHA ITA imported records" });
    if (path.endsWith("/api/occupational-discovery/datagov-overview")) return fulfillJson(route, { ok: true, collections: [{ id: "injury-illness", label: "Employee Injury & Illness", why: "Find injury datasets.", analyses: ["Trend", "Geography"], count: 42, datasets: [{ id: "preview-dataset", title: "Occupational Injury Data", agency: "Department of Labor" }] }] });
    if (path.includes("/api/occupational-discovery/datagov-collection/")) return fulfillJson(route, { ok: true, datasets: [{ id: "injury-data", name: "injury-data", title: "Occupational Injury Data", description: "Public occupational injury records.", agency: "Department of Labor", updatedAt: "2026-01-01", apiReady: true, catalogUrl: "https://catalog.data.gov/dataset/injury-data", resources: [{ id: "resource-1", name: "Injury datastore", format: "CSV", url: "https://example.gov/injury.csv", apiReady: true }] }] });
    if (path.endsWith("/api/occupational-discovery/datagov-datastore-preview")) return fulfillJson(route, { ok: true, resourceId: "resource-1", total: 5000, displayed: 100, columns: [{ name: "year", declaredType: "int", nonEmpty: 100, inferredType: "numeric", min: 2016, max: 2025, samples: ["2025", "2024"] }, { name: "state", declaredType: "text", nonEmpty: 100, inferredType: "text", samples: ["CA", "TX"] }], records: [{ year: 2025, state: "CA" }, { year: 2025, state: "TX" }], limitation: "Bounded preview." });
    if (path.endsWith("/api/occupational-data/datagov")) return fulfillJson(route, { ok: true, datasets: [], count: 0 });
    if (path.endsWith("/api/occupational-discovery/onet/profile")) return fulfillJson(route, onetProfile);

    return fulfillJson(route, { ok: true, configured: true, records: [], datasets: [], matches: [] });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflowing).toBe(false);
}

test.beforeEach(async ({ page }) => { await installOccupationalApi(page); });

test("Occupational Data Explorer exposes prepared intelligence before search", async ({ page }) => {
  await page.goto("/occupational-data-explorer");
  await expect(page.getByRole("heading", { name: "Occupational Data Explorer" })).toBeVisible();
  await expect(page.getByText("Useful intelligence is already organized for you.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Where are workers getting hurt/ })).toBeVisible();
  await expect(page.getByText("Form 300A establishment summaries")).toBeVisible();

  await page.getByRole("button", { name: "BLS Industry Intelligence" }).click();
  await expect(page.getByText("Priority industry library")).toBeVisible();
  await page.getByRole("button", { name: /Construction/ }).first().click();
  await expect(page.getByText("Historical SOII time series")).toBeVisible();
  await expect(page.getByText("2020–2024")).toBeVisible();

  await page.getByRole("button", { name: "OSHA Injury Intelligence" }).click();
  await expect(page.getByText("Largest reported injury burden")).toBeVisible();
  await expect(page.getByText("Example Infrastructure Co", { exact: true })).toBeVisible();
  await expect(page.getByText("Injury composition is query-ready.")).toBeVisible();
  await expect(page.getByText("Sprains, strains, tears")).toBeVisible();
  await expect(page.getByText("Overexertion and bodily reaction")).toBeVisible();

  await page.getByRole("button", { name: "Public Data Collections" }).click();
  await expect(page.getByText("The useful government-data searches are already done.")).toBeVisible();
  await page.getByRole("button", { name: /Employee Injury & Illness/ }).click();
  await expect(page.getByText("Occupational Injury Data", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try workbench" }).click();
  await expect(page.getByText("Dataset workbench")).toBeVisible();
  await expect(page.getByText("Columns profiled")).toBeVisible();
  await expect(page.getByText("year", { exact: true }).first()).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

test("Industry Impact Calculator starts from ready BLS benchmarks and models actual gap", async ({ page }) => {
  await page.goto("/industry-impact-calculator");
  await expect(page.getByRole("heading", { name: "Industry Impact Calculator" })).toBeVisible();
  await expect(page.getByText("Ready BLS benchmarks")).toBeVisible();
  await page.getByRole("button", { name: /Construction/ }).first().click();
  await page.getByLabel("Annual hours worked").fill("200000");
  await page.getByLabel("Recordable cases").fill("4");
  await expect(page.getByText("Actual TRIR", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Cases above benchmark")).toBeVisible();
  await expect(page.getByText("Five-year trajectory")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Calculator suite uses live job evidence and operational readiness schedule facts", async ({ page }) => {
  await page.goto("/occupational-calculators");
  await expect(page.getByRole("heading", { name: "Occupational Calculators" })).toBeVisible();
  await expect(page.getByText("Less manual hunting. More useful analysis.")).toBeVisible();

  await page.getByRole("button", { name: /Condition × Job Demands/ }).click();
  await expect(page.getByRole("heading", { name: "Condition × Job Demand Analyzer" })).toBeVisible();
  await page.getByRole("button", { name: "Aircraft mechanic" }).click();
  await expect(page.getByText("Matched demand evidence")).toBeVisible();
  await expect(page.getByText("Automated medical conclusion")).toBeVisible();
  await expect(page.getByText("None", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /Deployment Readiness/ }).click();
  await expect(page.getByRole("heading", { name: "Workforce Deployment Readiness Funnel" })).toBeVisible();
  await expect(page.getByText(/never invents a health-resilience percentage/i)).toBeVisible();

  await page.getByRole("button", { name: /Shift & Fatigue Exposure/ }).click();
  await expect(page.getByRole("heading", { name: "Shift & Fatigue Exposure Analyzer" })).toBeVisible();
  await expect(page.getByText(/without inventing an impairment score/i)).toBeVisible();
  await expect(page.getByText(/^Critical$/)).toHaveCount(0);
  await expect(page.getByText(/^High$/)).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});

test("O*NET Master Tool is browsable by service opportunity before free-text search", async ({ page }) => {
  await page.goto("/onet-master-tool");
  await expect(page.getByRole("heading", { name: "O*NET Master Tool" })).toBeVisible();
  await expect(page.getByText("Browse by Occu-Med service opportunity")).toBeVisible();
  await expect(page.getByText("Browse by workforce")).toBeVisible();
  await page.getByRole("button", { name: /Hearing Conservation \/ Audiometry/ }).click();
  await page.getByRole("button", { name: /Aircraft mechanic/ }).click();
  await expect(page.getByText("Aircraft Mechanics and Service Technicians", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Returned source items", { exact: true })).toBeVisible();
  await expect(page.getByText("Unsupported risk score", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Work Context" }).click();
  await expect(page.getByText("O*NET value 77", { exact: true })).toBeVisible();
  await expect(page.getByText("Risk Index", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Collision Index", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
