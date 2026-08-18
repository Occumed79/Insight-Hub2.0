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

const reviewerAor = {
  ok: true,
  command: "centcom",
  commandLabel: "USCENTCOM",
  partial: false,
  sourceHealth: [
    { provider: "WHO Disease Outbreak News", ok: true, count: 1 },
    { provider: "GDACS", ok: true, count: 1 },
    { provider: "USGS Earthquake Catalog", ok: true, count: 1 },
  ],
  outbreaks: [
    {
      id: "who-1",
      title: "Test outbreak — Jordan",
      publishedAt: "2026-08-16T12:00:00.000Z",
      summary: "A source-attributed outbreak item for browser acceptance.",
      matchedArea: "Jordan",
      url: "https://www.who.int/emergencies/disease-outbreak-news",
    },
  ],
  disasters: [
    {
      id: "gdacs-1",
      title: "Flood event",
      alertLevel: "orange",
      country: "Pakistan",
      eventType: "FL",
      fromDate: "2026-08-16T08:00:00.000Z",
      url: "https://www.gdacs.org/",
    },
  ],
  earthquakes: [
    {
      id: "usgs-1",
      title: "M 5.1 — Iran",
      place: "Iran",
      magnitude: 5.1,
      occurredAt: "2026-08-16T06:00:00.000Z",
      depthKm: 12.4,
      tsunami: false,
      url: "https://earthquake.usgs.gov/",
    },
  ],
};

async function installOccupationalApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/api/official-source-webview")) {
      const source = url.searchParams.get("source") || "unknown";
      const labels: Record<string, string> = {
        bls: "BLS official source",
        osha: "OSHA official source",
        datagov: "Data.gov official source",
        onet: "O*NET official source",
      };
      return route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><body><main>${labels[source] || "Official source"}</main></body></html>`,
      });
    }

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
    if (path.endsWith("/api/occupational-discovery/osha-overview")) {
      return fulfillJson(route, {
        ok: true,
        imported: true,
        latestYear: 2025,
        topEmployers: [{ establishment_name: "Example Employer", total_cases: 41 }],
        topStates: [{ state: "TX", total_cases: 310 }],
        highRateEstablishments: [{ establishment_name: "Example Facility", trc: 7.4 }],
      });
    }
    if (path.endsWith("/api/reviewer-tools/aor")) return fulfillJson(route, reviewerAor);
    if (path.endsWith("/api/reviewer-tools/rxnorm")) {
      return fulfillJson(route, { ok: true, source: "NLM RxNorm", candidates: [{ rxcui: "25480", name: "gabapentin 300 MG Oral Capsule", score: 100 }] });
    }
    if (path.endsWith("/api/reviewer-tools/pubchem")) {
      return fulfillJson(route, {
        ok: true,
        source: "NIH PubChem PUG REST",
        molecule: { CID: 3446, MolecularFormula: "C9H17NO2", MolecularWeight: "171.24", XLogP: -1.1, TPSA: 63.3 },
        structureImageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
        pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/3446",
      });
    }

    return fulfillJson(route, { ok: true, configured: true, records: [], datasets: [], matches: [] });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflowing).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await installOccupationalApi(page);
});

test("Occupational Data Explorer renders official sources through the working webview", async ({ page }) => {
  await page.goto("/occupational-data-explorer");
  await expect(page.getByRole("heading", { name: "Occupational Data Explorer" })).toBeVisible();
  await expect(page.getByText("Official source portal", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "BLS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OSHA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Data.gov" })).toBeVisible();

  const blsFrame = page.locator('iframe[title="BLS Injuries, Illnesses & Fatalities official data portal"]');
  await expect(blsFrame).toHaveAttribute("src", /\/api\/official-source-webview\?source=bls/);
  await expect(blsFrame).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(blsFrame).not.toHaveAttribute("sandbox", /allow-same-origin/);
  await expect(page.frameLocator('iframe[title="BLS Injuries, Illnesses & Fatalities official data portal"]').getByText("BLS official source")).toBeVisible();

  await page.getByRole("button", { name: "OSHA" }).click();
  const oshaFrame = page.locator('iframe[title="OSHA Data official data portal"]');
  await expect(oshaFrame).toHaveAttribute("src", /\/api\/official-source-webview\?source=osha/);
  await expect(page.frameLocator('iframe[title="OSHA Data official data portal"]').getByText("OSHA official source")).toBeVisible();

  await page.getByRole("button", { name: "Data.gov" }).click();
  const dataGovFrame = page.locator('iframe[title="Data.gov Catalog official data portal"]');
  await expect(dataGovFrame).toHaveAttribute("src", /\/api\/official-source-webview\?source=datagov/);
  await expect(page.frameLocator('iframe[title="Data.gov Catalog official data portal"]').getByText("Data.gov official source")).toBeVisible();
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

test("O*NET Master Tool renders the official O*NET site through the working webview", async ({ page }) => {
  await page.goto("/onet-master-tool");
  await expect(page.getByRole("heading", { name: "O*NET Master Tool" })).toBeVisible();
  await expect(page.getByText("O*NET OnLine", { exact: true })).toBeVisible();
  const frame = page.locator('iframe[title="O*NET OnLine official data portal"]');
  await expect(frame).toHaveAttribute("src", /\/api\/official-source-webview\?source=onet/);
  await expect(page.frameLocator('iframe[title="O*NET OnLine official data portal"]').getByText("O*NET official source")).toBeVisible();
  await expect(page.getByText("Browse by Occu-Med service opportunity")).toHaveCount(0);
  await expect(page.getByText("Raw O*NET Database Tables")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("all six transplanted reviewer tools render and retain their core interactions", async ({ page }) => {
  await page.goto("/injuries-medical-conditions");
  await expect(page.getByRole("heading", { name: "Injuries & Medical Conditions" })).toBeVisible();
  await expect(page.getByText("Reported injury burden")).toBeVisible();
  await page.getByRole("tab", { name: "Medical Conditions" }).click();
  await expect(page.getByRole("heading", { name: "Diabetes" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/job-intelligence");
  await expect(page.getByRole("heading", { name: "Job Intelligence" })).toBeVisible();
  await page.getByPlaceholder("Aircraft mechanic, firefighter, HVAC mechanic…").fill("Aircraft mechanic");
  await page.getByRole("button", { name: "Search O*NET" }).click();
  await expect(page.getByText("Aircraft Mechanics and Service Technicians")).toBeVisible();
  await expect(page.getByText("Inspect aircraft for defects and hazardous conditions.")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/aor-factors");
  await expect(page.getByRole("heading", { name: "AOR Factors" })).toBeVisible();
  await expect(page.getByText("WHO Disease Outbreaks")).toBeVisible();
  await expect(page.getByText("Test outbreak — Jordan")).toBeVisible();
  await page.getByRole("tab", { name: "Environmental & Performance Factors" }).click();
  await expect(page.getByText("Build the work environment")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/drug-checker");
  await expect(page.getByRole("heading", { name: "Drug Checker" })).toBeVisible();
  await page.getByPlaceholder("Gabapentin, Eliquis, metoprolol…").fill("gabapentin");
  await expect(page.getByRole("button", { name: /gabapentin 300 MG Oral Capsule/ })).toBeVisible();
  await page.getByRole("button", { name: /gabapentin 300 MG Oral Capsule/ }).click();
  await expect(page.getByText("Reviewed occupational profile")).toBeVisible();
  await expect(page.getByText("C9H17NO2")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/clinical-calculators");
  await expect(page.getByRole("heading", { name: "Clinical Calculators" })).toBeVisible();
  await page.getByLabel("Weight · kg").fill("78");
  await page.getByLabel("Height · cm").fill("180");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("24.1", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/standards-intelligence");
  await expect(page.getByRole("heading", { name: "Standards Intelligence" })).toBeVisible();
  await expect(page.getByText("Deployment functional baseline")).toBeVisible();
  await page.getByLabel("Condition").fill("Obstructive sleep apnea");
  await expect(page.getByText("Obstructive sleep apnea deployment criteria")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});