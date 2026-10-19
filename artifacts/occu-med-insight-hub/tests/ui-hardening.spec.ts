import { expect, test, type Page, type Route } from "@playwright/test";

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

    if (path.endsWith("/api/entities/saved")) return fulfillJson(route, { ok: true, entities: savedGeographicEntities });
    if (path.endsWith("/api/hiring-intelligence/analyze")) return fulfillJson(route, hiringFixture);
    if (path.endsWith("/api/occupational-discovery/bls-overview")) return fulfillJson(route, blsOverviewFixture);
    if (path.endsWith("/api/bls/industry-benchmark")) return fulfillJson(route, { ok: true, benchmark: blsOverviewFixture.sectors[0].benchmark });
    if (path.endsWith("/api/occupational-discovery/onet/profile")) return fulfillJson(route, onetProfileFixture);
    if (path.endsWith("/api/occupational-discovery/onet/profile-by-code")) return fulfillJson(route, { ok: true, profile: onetProfileFixture.profile });
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

test("landing page shows only active portals with no legacy-link access", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Insight Hub", exact: true })).toBeVisible();
  for (const title of ["Intelligence Tools", "Global Locations", "Global Location Overlap"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  for (const title of ["Clients Service Map", "Admin for Map", "DocBox"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Manage portal links" })).toHaveCount(0);
  await expect(page.locator('main a')).toHaveCount(3);
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("Company Library aliases remain relationship-neutral and keyboard-safe", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/entities");

  await expect(page.getByRole("heading", { name: "Company Library", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search researched companies" })).toBeVisible();
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Entities" })).toHaveCount(0);
  await expect(page.getByText("Prospect Profiles", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Client Records", { exact: true })).toHaveCount(0);
  await expectNoDocumentOverflow(page);

  const record = page.getByRole("button", { name: "Open details for V2X" });
  await record.focus();
  await page.keyboard.press("Enter");

  const details = page.getByRole("dialog", { name: "V2X" });
  await expect(details).toBeVisible();
  await expect(details.getByText(/No client or commercial relationship is implied/i)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(record).toBeFocused();

  await expect(page.getByText("Selected Company", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "FEC Evidence", exact: true })).toBeVisible();

  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Company Library", exact: true })).toBeVisible();
  await expect(page.getByText("Client Records", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Prospect Profiles", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Entities" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Open details for V2X" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open details for Demo Engineering" })).toBeVisible();
  await expect(page.getByText("Demo Client", { exact: true })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("core intelligence routes load through lazy boundaries without browser errors", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/competitors");
  await expect(page.getByRole("heading", { name: "Competitors", exact: true })).toBeVisible();
  await expect(page.locator('nav[aria-label="Insight Hub intelligence tools"] a').filter({ hasText: "Competitors" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);


  expect(pageErrors).toEqual([]);
});

test("sidebar exposes exactly four retained tools and a Back button", async ({ page }) => {
  await page.goto("/onet-master-tool");
  const links = page.locator(".insight-sidebar nav a");
  await expect(links).toHaveCount(4);
  await expect(links).toHaveText([
    "Injuries & Medical Conditions",
    "AOR Factors",
    "O*NET Master Tool",
    "Occupational Data Explorer",
  ]);
  await expect(page.locator(".insight-sidebar").getByRole("link", { name: "Back to landing page" })).toBeVisible();
  await expect(page.locator(".insight-sidebar")).not.toContainText("Insight Hub 2");
  await expect(page.locator(".insight-mobile-nav a")).toHaveCount(5);
});

test("retired sidebar applications are no longer routable", async ({ page }) => {
  for (const route of ["/drug-checker", "/standards-intelligence", "/federal-agencies", "/state-agencies", "/sec-filings", "/leadership-map", "/dba-intelligence", "/industry-impact-calculator", "/occupational-calculators", "/war-costs-intelligence", "/federal-awards", "/public-legal-references"]) {
    await page.goto(route);
    await expect(page.getByText("Page Not Found")).toBeVisible();
  }
});

test("retired Job Intelligence is absent from navigation; O*NET remains available", async ({ page }) => {
  await page.goto("/onet-master-tool");
  await expect(page.getByRole("heading", { name: "O*NET Master Tool" })).toBeVisible();
  await expect(page.locator('nav[aria-label="Insight Hub intelligence tools"] a').filter({ hasText: "Job Intelligence" })).toHaveCount(0);
});

test("Global Locations uses the full canvas without shared navigation", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/geographic-data");

  await expect(page.getByRole("heading", { name: "Locations", exact: true })).toBeVisible();
  await expect(page.locator(".insight-sidebar")).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Insight Hub intelligence tools"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to the Insight Hub landing page" })).toBeVisible();
  const contentLeft = await page.locator("main > section").evaluate((element) => element.getBoundingClientRect().left);
  expect(contentLeft).toBeLessThanOrEqual(1);
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

