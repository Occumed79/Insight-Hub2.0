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

const transportationBenchmark = {
  ...constructionBenchmark,
  naics: "48",
  industryTitle: "Transportation and warehousing",
  trcRate: 4.1,
  dartRate: 2.7,
  daysAwayRate: 1.8,
};

const manifest = {
  ok: true,
  businessQuestions: [],
  blsSectors: [
    { id: "construction", naics: "23", label: "Construction", description: "Construction workforces." },
    { id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Transportation workforces." },
  ],
  workforceGroups: [
    { id: "skilled-trades", label: "Skilled Trades", description: "Common trades.", occupations: ["Electrician", "Aircraft mechanic"] },
  ],
  serviceOpportunities: [
    { id: "hearing", label: "Hearing Conservation / Audiometry", description: "Noise and hearing evidence.", occupations: ["Aircraft mechanic", "Electrician"] },
    { id: "physical", label: "Physical Ability / Functional Testing", description: "Physical demands.", occupations: ["Electrician"] },
  ],
  dataGovCollections: [],
  sources: [],
};

const onetProfile = {
  ok: true,
  keyword: "Aircraft mechanic",
  source: "O*NET Web Services API v2",
  matches: [{ code: "49-3011.00", title: "Aircraft Mechanics and Service Technicians", score: 100 }],
  profile: {
    occupation: {
      code: "49-3011.00",
      title: "Aircraft Mechanics and Service Technicians",
      description: "Diagnose, adjust, repair, or overhaul aircraft engines and assemblies.",
    },
    tasks: [{ name: "Inspect aircraft for defects and hazardous conditions.", value: 89, category: "Core" }],
    workContext: [{ name: "Sounds, Noise Levels Are Distracting or Uncomfortable", value: 77, response: [{ percentage: 61, description: "Every day" }] }],
    abilities: [{ name: "Static Strength", value: 55 }, { name: "Near Vision", value: 70 }],
    workActivities: [{ name: "Handling and Moving Objects", value: 78 }],
    detailedWorkActivities: [{ name: "Inspect mechanical equipment to locate damage, defects, or wear." }],
    serviceMatches: [
      { id: "hearing", label: "Hearing Conservation / Audiometry", description: "Noise evidence.", count: 1, evidence: [{ name: "Sounds, Noise Levels Are Distracting or Uncomfortable", value: 77 }] },
      { id: "physical", label: "Physical Ability / Functional Testing", description: "Physical evidence.", count: 2, evidence: [{ name: "Static Strength", value: 55 }, { name: "Handling and Moving Objects", value: 78 }] },
    ],
    counts: { tasks: 1, workContext: 1, abilities: 2, workActivities: 1, detailedWorkActivities: 1 },
    partialErrors: [],
  },
  limitation: "Service matches are transparent filters, not medical conclusions.",
};

async function installOccupationalApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/api/occupational-discovery/manifest")) return fulfillJson(route, manifest);
    if (path.endsWith("/api/occupational-discovery/bls-overview")) {
      return fulfillJson(route, {
        ok: true,
        sectors: [
          { id: "construction", naics: "23", label: "Construction", description: "Construction workforces.", benchmark: constructionBenchmark },
          { id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Transportation workforces.", benchmark: transportationBenchmark },
        ],
        ranked: [
          { id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Transportation workforces.", benchmark: transportationBenchmark },
          { id: "construction", naics: "23", label: "Construction", description: "Construction workforces.", benchmark: constructionBenchmark },
        ],
        limitation: "Aggregate industry benchmarks.",
      });
    }
    if (path.endsWith("/api/occupational-discovery/bls-history")) {
      return fulfillJson(route, {
        ok: true,
        history: {
          naics: url.searchParams.get("naics") || "23",
          industryTitle: "Construction",
          points: [
            { year: 2020, trcRate: 3.1, dartRate: 2.0, daysAwayRate: 1.4 },
            { year: 2024, trcRate: 2.5, dartRate: 1.6, daysAwayRate: 1.1 },
          ],
          limitation: "Aggregate industry benchmark.",
          reason: "Historical SOII series retrieved.",
        },
      });
    }
    if (path.endsWith("/api/bls/industry-benchmark")) {
      return fulfillJson(route, { ok: true, benchmark: constructionBenchmark, message: "Benchmark data retrieved." });
    }
    if (path.endsWith("/api/occupational-discovery/onet/profile")) return fulfillJson(route, onetProfile);

    return fulfillJson(route, { ok: true, configured: true, records: [], datasets: [], matches: [] });
  });

  const sourcePages = [
    ["https://www.bls.gov/**", "BLS official source"],
    ["https://www.osha.gov/**", "OSHA official source"],
    ["https://catalog.data.gov/**", "Data.gov official source"],
    ["https://www.onetonline.org/**", "O*NET official source"],
  ] as const;

  for (const [pattern, label] of sourcePages) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: `<!doctype html><html><body><main>${label}</main></body></html>` });
    });
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflowing).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await installOccupationalApi(page);
});

test("Occupational Data Explorer is an iframe-style official source portal", async ({ page }) => {
  await page.goto("/occupational-data-explorer");
  await expect(page.getByRole("heading", { name: "Occupational Data Explorer" })).toBeVisible();
  await expect(page.getByText("Official source portal", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "BLS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OSHA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Data.gov" })).toBeVisible();

  const frame = page.locator('iframe[title="BLS Injuries, Illnesses & Fatalities official data portal"]');
  await expect(frame).toHaveAttribute("src", "https://www.bls.gov/iif/data-overview.htm");
  await expect(page.frames().find((candidate) => candidate.url().includes("bls.gov"))?.locator("body") ?? page.locator("body")).toContainText("BLS official source");

  await page.getByRole("button", { name: "OSHA" }).click();
  await expect(page.locator('iframe[title="OSHA Data official data portal"]')).toHaveAttribute("src", "https://www.osha.gov/data");

  await page.getByRole("button", { name: "Data.gov" }).click();
  await expect(page.locator('iframe[title="Data.gov Catalog official data portal"]')).toHaveAttribute("src", "https://catalog.data.gov/");
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

test("O*NET Master Tool is the official O*NET iframe-style page", async ({ page }) => {
  await page.goto("/onet-master-tool");
  await expect(page.getByRole("heading", { name: "O*NET Master Tool" })).toBeVisible();
  await expect(page.getByText("O*NET OnLine", { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="O*NET OnLine official data portal"]')).toHaveAttribute("src", "https://www.onetonline.org/");
  await expect(page.getByText("Browse by Occu-Med service opportunity")).toHaveCount(0);
  await expect(page.getByText("Raw O*NET Database Tables")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
