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

    if (path.endsWith("/api/portal-links")) {
      return fulfillJson(route, { links: portalLinks });
    }
    if (path.endsWith("/api/prospects")) {
      return fulfillJson(route, { prospects });
    }
    if (path.endsWith("/api/clients")) {
      return fulfillJson(route, { clients });
    }
    if (path.endsWith("/api/entities/saved")) {
      return fulfillJson(route, { ok: true, entities: savedGeographicEntities });
    }
    if (path.endsWith("/api/hiring-intelligence/analyze")) {
      return fulfillJson(route, hiringFixture);
    }

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

test("Entities routes preserve active navigation, keyboard cards, modal focus, and empty-safe layout", async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto("/entities");

  await expect(page.getByRole("heading", { name: "Entities", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search prospects" })).toBeVisible();
  await expect(page.locator('a[aria-current="page"]').filter({ hasText: "Entities" })).toHaveCount(2);
  await expectNoDocumentOverflow(page);

  const record = page.getByRole("button", { name: "Open details for V2X" });
  await expect(record).toBeVisible();
  await record.focus();
  await page.keyboard.press("Enter");

  const details = page.getByRole("dialog", { name: "V2X" });
  await expect(details).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(record).toBeFocused();

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