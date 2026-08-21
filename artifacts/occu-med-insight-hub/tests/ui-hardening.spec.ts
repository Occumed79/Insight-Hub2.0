import { expect, test, type Page, type Route } from "@playwright/test";

const portalLinks = {
  entity: "/competitors",
  discovery: "/geographic-data",
  federal: "/federal-agencies",
};

const prospects = [
  {
    id: "prospect-v2x",
    name: "V2X",
    website: "https://www.v2x.com",
    description: "Public research target used by deterministic browser acceptance.",
    industry: "Government services",
    headquarters: "McLean, VA",
    employeeCount: "10,000+",
    status: "active",
    tier: "Tier 1",
    researchSummary: "Deterministic browser fixture.",
    opportunitySignals: JSON.stringify(["global footprint", "safety-sensitive workforce"]),
    lastResearched: "2026-08-07T00:00:00.000Z",
  },
];

const clients = [
  {
    id: "client-demo",
    name: "Demo Client",
    website: "https://example.com",
    industry: "Engineering",
    headquarters: "Fresno, CA",
    overallHiringTrend: "stable",
    branches: [{ id: "branch-1", name: "West", city: "Fresno", state: "CA", country: "US" }],
    contacts: [{ id: "contact-1", name: "Demo Contact", title: "Operations", email: "demo@example.com" }],
  },
];

const savedGeographicEntities = [
  {
    id: 1,
    name: "V2X",
    company: "V2X",
    status: "active",
    locations: [
      {
        id: 101,
        entityId: 1,
        placeName: "V2X Fresno",
        formattedAddress: "Fresno, CA, USA",
        city: "Fresno",
        state: "CA",
        country: "US",
        region: "California",
        coordinates: [-119.7871, 36.7378],
        geocodeSource: "manual",
        geocodeConfidence: "exact",
        reviewStatus: "verified",
      },
    ],
  },
  {
    id: 2,
    name: "Demo Engineering",
    company: "Demo Engineering",
    status: "active",
    locations: [
      {
        id: 201,
        entityId: 2,
        placeName: "Demo Fresno",
        formattedAddress: "Clovis, CA, USA",
        city: "Clovis",
        state: "CA",
        country: "US",
        region: "California",
        coordinates: [-119.7029, 36.8252],
        geocodeSource: "manual",
        geocodeConfidence: "exact",
        reviewStatus: "verified",
      },
    ],
  },
];

const blsOverviewFixture = {
  ok: true,
  sectors: [
    {
      id: "manufacturing",
      naics: "31",
      label: "Manufacturing",
      description: "Production and industrial operations.",
      benchmark: { naics: "31", year: 2025, trcRate: 2.8, dartRate: 1.6, daysAwayRate: 1.1 },
    },
  ],
  ranked: [],
  limitation: "Deterministic BLS browser fixture.",
};

const onetProfileFixture = {
  ok: true,
  matches: [{ code: "49-3011.00", title: "Aircraft Mechanics and Service Technicians", score: 100 }],
  profile: {
    occupation: {
      code: "49-3011.00",
      title: "Aircraft Mechanics and Service Technicians",
      description: "Diagnose, adjust, repair, or overhaul aircraft engines and assemblies.",
    },
    tasks: [{ name: "Inspect aircraft components", description: "Inspect completed work for conformance." }],
    workContext: [{ name: "Wear Common Protective or Safety Equipment" }],
    abilities: [{ name: "Manual Dexterity" }],
    workActivities: [{ name: "Inspecting Equipment, Structures, or Material" }],
    detailedWorkActivities: [{ name: "Inspect aircraft equipment" }],
  },
  source: "O*NET Web Services",
};

const hiringFixture = {
  startedAt: "2026-08-07T20:00:00.000Z",
  completedAt: "2026-08-07T20:00:01.000Z",
  sourceUrl: "https://example.com/careers",
  companyName: "Demo Engineering",
  platform: "greenhouse",
  coverage: {
    complete: true,
    analyzedPages: 1,
    totalDiscovered: 3,
    note: "Deterministic browser fixture.",
  },
  warnings: [],
  summary: {
    totalJobs: 3,
    uniqueLocations: 2,
    countries: 1,
    remoteJobs: 1,
    topLocations: [
      { label: "Fresno, CA", count: 2 },
      { label: "Remote", count: 1 },
    ],
    jobFamilies: [
      { label: "Engineering", count: 2 },
      { label: "Operations", count: 1 },
    ],
    seniority: [
      { label: "Senior", count: 2 },
      { label: "Individual contributor", count: 1 },
    ],
    employmentTypes: [{ label: "Full-time", count: 3 }],
    remoteMix: [
      { label: "Onsite", count: 2 },
      { label: "Remote", count: 1 },
    ],
  },
  jobs: [
    {
      id: "job-1",
      title: "Senior Safety Engineer",
      url: "https://example.com/careers/job-1",
      companyName: "Demo Engineering",
      locationText: "Fresno, CA",
      city: "Fresno",
      region: "CA",
      country: "US",
      department: "Engineering",
      jobFamily: "Engineering",
      seniority: "Senior",
      employmentType: "Full-time",
      remoteType: "onsite",
      postedAt: "2026-08-01",
      description: "Safety-sensitive engineering role.",
      source: "https://example.com/careers/job-1",
      adapter: "greenhouse",
    },
  ],
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

async function installDeterministicApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/api/portal-links")) return fulfillJson(route, { links: portalLinks });
    if (path.endsWith("/api/prospects")) return fulfillJson(route, { prospects });
    if (path.endsWith("/api/clients")) return fulfillJson(route, { clients });
    if (path.endsWith("/api/entities/saved")) return fulfillJson(route, { ok: true, entities: savedGeographicEntities });
    if (path.endsWith("/api/hiring-intelligence/analyze")) return fulfillJson(route, hiringFixture);
    if (path.endsWith("/api/occupational-discovery/bls-overview")) return fulfillJson(route, blsOverviewFixture);
    if (path.endsWith("/api/bls/industry-benchmark")) return fulfillJson(route, { ok: true, benchmark: blsOverviewFixture.sectors[0].benchmark });
    if (path.endsWith("/api/occupational-discovery/onet/profile")) return fulfillJson(route, onetProfileFixture);
    if (path.endsWith("/api/occupational-discovery/onet/profile-by-code")) return fulfillJson(route, { ok: true, profile: onetProfileFixture.profile });
    if (path.endsWith("/api/job-intelligence/profiles")) return fulfillJson(route, { ok: true, profiles: [] });
    if (path.includes("/api/federal-intel/")) return fulfillJson(route, { items: [], bucket: "fixture", total: 0, page: 1, limit: 200, pages: 0 });

    return fulfillJson(route, { ok: true, configured: true, results: [], records: [] });
  });

  await page.route(/images\.unsplash\.com/, (route) => route.abort());
  await page.route(/services\.arcgisonline\.com/, (route) => route.abort());
}

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      })),
    )
    .toEqual(expect.objectContaining({
      scrollWidth: expect.any(Number),
      clientWidth: expect.any(Number),
    }));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await installDeterministicApi(page);
});

test("landing page is contained and portal-link modal is keyboard-safe", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Insight Hub", exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);

  const openButton = page.getByRole("button", { name: "Manage portal links" });
  await openButton.focus();
  await openButton.click();

  const dialog = page.getByRole("dialog", { name: "Manage portal links" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("Entities routes preserve navigation, selection shortcuts, keyboard cards, modal focus, and layout", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/entities");

  await expect(page.getByRole("heading", { name: "Entities", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search prospects" })).toBeVisible();
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Entities" })).toHaveCount(2);
  await expectNoDocumentOverflow(page);

  const record = page.getByRole("button", { name: "Open details for V2X" });
  await record.focus();
  await page.keyboard.press("Enter");

  const details = page.getByRole("dialog", { name: "V2X" });
  await expect(details).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(record).toBeFocused();

  await expect(page.getByText("Selected Entity", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Federal Awards", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Legal & Injury", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "FEC Relationship", exact: true })).toBeVisible();

  await page.goto("/clients");
  await expect(page.getByRole("tab", { name: "Client Records" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Entities" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Open details for Demo Client" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("core intelligence routes load through lazy boundaries without browser errors", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/competitors");
  await expect(page.getByRole("heading", { name: "Competitors", exact: true })).toBeVisible();
  await expect(page.locator('nav[aria-label="Insight Hub intelligence tools"] a').filter({ hasText: "Competitors" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);

  await page.goto("/federal-agencies");
  await expect(page.getByRole("heading", { name: "Federal Agencies", exact: true })).toBeVisible();
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Federal Agencies" })).toHaveCount(2);
  await expectNoDocumentOverflow(page);

  expect(pageErrors).toEqual([]);
});

test("reviewed intelligence hierarchy aliases and calculator workstation remain enforced", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/industry-injury-benchmarks");
  await expect(page.getByRole("heading", { name: "Industry Impact Calculator", exact: true })).toBeVisible();
  await expect(page.getByLabel("Workforce size (headcount or FTE)")).toBeVisible();
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Industry Impact Calculator" })).toHaveCount(2);
  await expect(page.locator('nav[aria-label="Insight Hub intelligence tools"] a').filter({ hasText: "Industry Injury Benchmarks" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);

  await page.goto("/occupational-demands");
  await expect(page.getByRole("heading", { name: "Job Intelligence", exact: true })).toBeVisible();
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Job Intelligence" })).toHaveCount(2);
  await expect(page.locator('nav[aria-label="Insight Hub intelligence tools"] a').filter({ hasText: "Occupational Demands" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);

  await page.goto("/occupational-calculators");
  await expect(page.getByRole("heading", { name: "Occupational Calculators", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Workforce Health" }).click();
  await expect(page.getByText("Age-Based Chronic Conditions", { exact: true })).toBeVisible();
  await expect(page.getByText("Aggravation & Comorbidity Overlap", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);

  expect(pageErrors).toEqual([]);
});

test("exact O*NET code can be reviewed from Job Intelligence without title ambiguity", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/job-intelligence");

  const search = page.getByPlaceholder("Search occupation title");
  await search.fill("49-3011.00");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByText("Aircraft Mechanics and Service Technicians", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("49-3011.00", { exact: true }).first()).toBeVisible();
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("active Location Overlap Leaflet map renders safely", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/location-overlap");

  await expect(page.getByRole("heading", { name: "Global Location Overlap", exact: true })).toBeVisible();
  await expect(page.locator(".location-overlap-map.leaflet-container")).toBeVisible();
  await expect(page.getByText("2 worldwide sites")).toBeVisible();
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("populated Hiring Intelligence Recharts render safely", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/hiring-intelligence");

  await expect(page.getByRole("heading", { name: "Hiring Intelligence", exact: true })).toBeVisible();
  await page.getByPlaceholder("https://company.com/careers or the public ATS page").fill("https://example.com/careers");
  await page.getByRole("button", { name: "Analyze careers site" }).click();

  await expect(page.getByRole("heading", { name: "Where hiring is concentrated", exact: true })).toBeVisible();
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
  await expect(page.locator("svg.recharts-surface")).toHaveCount(4);
  await expect(page.getByText("Senior Safety Engineer", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});

async function roster(page: Page) {
  await page.route("**/api/entities/roster", (route) => fulfillJson(route, { entities: [{ id: "v2x", name: "V2X", source: "prospect" }], counts: { clients: 0, prospects: 1, competitors: 0 } }));
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 760, height: 900 }]) {
  test(`competitor database is useful before search at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/competitors", (route) => fulfillJson(route, { competitors: [{ id: "c1", name: "Concentra", tier: "national", headquarters: "Addison, TX", services: JSON.stringify(["Occupational medicine", "Drug testing"]), coverageStates: JSON.stringify(["TX", "VA"]), employeeCount: "10,000+", founded: "1979", description: "National occupational-health network", notes: "Broad clinic footprint", website: "https://www.concentra.com" }] }));
    await page.goto("/competitors");
    await expect(page.getByText("Concentra", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Service Capability")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("");
  });
}

test("known entity automatically loads federal awards", async ({ page }) => {
  await roster(page);
  await page.route("**/api/public-data/usaspending", (route) => fulfillJson(route, { ok: true, companyName: "V2X", fromDate: "2020-01-01", toDate: "2026-01-01", awards: [], totalAwardAmount: 0, sourceUrl: "https://usaspending.gov" }));
  await page.goto("/federal-awards");
  await expect(page.getByText("V2X", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("No employer selected")).toHaveCount(0);
});

test("calculators open with clearly labeled non-zero sample", async ({ page }) => {
  await page.route("**/api/occupational-discovery/bls-overview", (route) => fulfillJson(route, { ok: true, sectors: [] }));
  await page.goto("/occupational-calculators");
  await expect(page.getByText(/Sample scenario — replace with employer values/i)).toBeVisible();
  await expect(page.getByText("3.2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Reset shared context/i }).click();
  await expect(page.getByText("Waiting for inputs")).toBeVisible();
});

test("legal intelligence auto-loads a known entity and excludes generic litigation", async ({ page }) => {
  await page.route("**/api/entities/roster", (route) => fulfillJson(route, { entities: [{ id: "v2x", name: "V2X", source: "prospect" }] }));
  await page.route("**/api/public-data/courtlistener?**", (route) => fulfillJson(route, { ok: true, query: "V2X", sourceUrl: "https://courtlistener.com", references: [
    { caseName: "Worker v. V2X", court: "D. Va.", dateFiled: "2025-02-03", snippet: "Employee workers compensation claim under the Defense Base Act after workplace injury.", contentSource: "CourtListener", recordType: "opinion", sourceUrl: "https://courtlistener.com/injury" },
    { caseName: "Vendor v. V2X", court: "D. Del.", dateFiled: "2025-01-01", snippet: "Generic commercial invoice dispute.", contentSource: "CourtListener", recordType: "opinion", sourceUrl: "https://courtlistener.com/invoice" },
  ] }));
  await page.goto("/public-legal-references");
  await expect(page.getByText("V2X", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Workers’ compensation", { exact: true })).toBeVisible();
  await expect(page.getByText("DBA / overseas contractor", { exact: true })).toBeVisible();
  await expect(page.getByText(/Why it may matter to Occu-Med/)).toBeVisible();
  await expect(page.getByText("Vendor v. V2X", { exact: true })).toHaveCount(0);
});

test("SEC resolves the Insight Hub roster and automatically requests EDGAR filings", async ({ page }) => {
  let feedRequests = 0;
  await page.addInitScript(() => sessionStorage.clear());
  await page.route("**/api/entities/roster", (route) => fulfillJson(route, { entities: [{ id: "v2x", name: "V2X", source: "prospect" }, { id: "dynamic", name: "Dynamic Public Corp", source: "client" }] }));
  await page.route("**/api/sec-filings/search?**", (route) => fulfillJson(route, { query: "Dynamic Public Corp", issuers: [{ cik: "0000123456", name: "Dynamic Public Corp", ticker: "DPC", exchange: "NYSE" }], source: "SEC", fetchedAt: "2026-08-20" }));
  await page.route("**/api/sec-filings/feed", (route) => { feedRequests += 1; return fulfillJson(route, { startedAt: "2026-08-20", completedAt: "2026-08-20", source: "SEC EDGAR", freshness: "live", issuerCount: 2, filingCount: 1, forms: ["10-K"], errors: [], filings: [{ id: "f1", cik: "0001601548", companyName: "V2X, Inc.", ticker: "VVX", accessionNumber: "1", form: "10-K", filingDate: "2026-08-01", isXbrl: true, isInlineXbrl: true, filingUrl: "https://sec.gov/f1" }] }); });
  await page.goto("/sec-filings");
  await expect(page.getByText("V2X, Inc.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Dynamic Public Corp", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("10-K", { exact: true }).first()).toBeVisible();
  expect(feedRequests).toBeGreaterThan(0);
});

test("Federal pipeline keeps hardware out, validates type evidence, and exposes SAM zero diagnostics", async ({ page }) => {
  const row = (id: string, bucket: string, title: string, summary: string) => ({ id, bucket, title, summary, agency: "Department of Defense", sourceType: "fixture", status: "planned", fetchedAt: "2026-08-20", datePosted: "2026-08-19" });
  await page.route("**/api/federal-intel/forecast?**", (route) => fulfillJson(route, { items: [row("bad", "forecast", "Gantry crane roof painting", "Forecast for valves, clamps and drums"), row("forecast", "forecast", "Occupational health procurement forecast", "Planned acquisition for physical exams and respirator fit testing")], total: 2 }));
  await page.route("**/api/federal-intel/recompete-watch?**", (route) => fulfillJson(route, { items: [row("recompete", "recompete-watch", "Occupational medicine contract recompete", "Expiring contract renewal for medical surveillance and drug testing"), row("wrong", "recompete-watch", "Occupational health market note", "No renewal or expiration evidence")], total: 2 }));
  await page.route("**/api/federal-intel/incumbent-tracker?**", (route) => fulfillJson(route, { items: [], total: 0 }));
  await page.route("**/api/federal-intel/deployment-medical?**", (route) => fulfillJson(route, { items: [], total: 0 }));
  await page.route("**/api/core-intelligence/federal-live/directory", (route) => fulfillJson(route, { configured: true, organizations: [{ id: "dod", name: "Department of Defense" }] }));
  await page.route("**/api/core-intelligence/federal-live/opportunities?**", (route) => fulfillJson(route, { configured: true, opportunities: [], returned: 0, limitation: "No records after official fallback", diagnostics: { configured: true, resultStatus: "zero-after-fallback", requestedAgency: "Department of Defense", queryFilterMode: "broad-retrieval-local-parent-match", postedFrom: "08/20/2025", postedTo: "08/20/2026", pagesRequested: 2, rawRecordsReturned: 100, normalizedRecordsReturned: 0, totalRecordsReportedBySam: 100, agencyMatchMethod: "canonical parent-path/token match" } }));
  await page.route("**/api/core-intelligence/federal-live/leadership?**", (route) => fulfillJson(route, { leaders: [], source: "OPM" }));
  await page.route("**/api/core-intelligence/federal-live/structure?**", (route) => fulfillJson(route, { organizations: [], configured: true }));
  await page.goto("/federal-agencies");
  await expect(page.getByTestId("sam-diagnostics")).toContainText("zero-after-fallback");
  await expect(page.getByTestId("sam-diagnostics")).toContainText("100 raw / 0 matched");
  await page.getByRole("button", { name: "Recompetes", exact: true }).last().click();
  await expect(page.getByText("Occupational medicine contract recompete", { exact: true })).toBeVisible();
  await expect(page.getByText("Occupational health market note", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Forecasts", exact: true }).last().click();
  await expect(page.getByText("Occupational health procurement forecast", { exact: true })).toBeVisible();
  await expect(page.getByText("Gantry crane roof painting", { exact: true })).toHaveCount(0);
});

test("industry impact sample is non-zero, labeled, and clearable", async ({ page }) => {
  await page.goto("/industry-impact-calculator");
  await expect(page.getByText(/Demo \/ sample scenario — replace with employer values/i)).toBeVisible();
  await expect(page.getByText("16.0", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear sample scenario" }).click();
  await expect(page.getByText("16.0", { exact: true })).toHaveCount(0);
});
