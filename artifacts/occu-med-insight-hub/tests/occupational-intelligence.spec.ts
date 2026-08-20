import { expect, test, type Page, type Route } from "@playwright/test";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

const constructionBenchmark = {
  naics: "23",
  industryTitle: "Construction",
  year: 2025,
  trcRate: 2.5,
  dartRate: 1.6,
  daysAwayRate: 1.1,
  source: "BLS IIF / SOII",
  sourceUrl: "https://www.bls.gov/iif/",
  limitation: "Aggregate industry benchmark.",
};

const onetProfile = {
  ok: true,
  source: "O*NET Web Services API v2",
  matches: [{ code: "49-3011.00", title: "Aircraft Mechanics and Service Technicians", score: 100 }],
  profile: {
    occupation: {
      code: "49-3011.00",
      title: "Aircraft Mechanics and Service Technicians",
      description: "Diagnose, adjust, repair, or overhaul aircraft engines and assemblies.",
    },
    tasks: [{ name: "Inspect aircraft for defects and hazardous conditions.", value: 89, category: "Core" }],
    workContext: [{ name: "Sounds, Noise Levels Are Distracting or Uncomfortable", value: 77 }],
    abilities: [{ name: "Static Strength", value: 55 }, { name: "Near Vision", value: 70 }],
    workActivities: [{ name: "Handling and Moving Objects", value: 78 }],
    detailedWorkActivities: [{ name: "Inspect mechanical equipment to locate damage, defects, or wear." }],
  },
};

async function installOccupationalApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
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

    if (path.endsWith("/api/map-config")) return fulfillJson(route, { configured: false, apiKey: "" }, 503);
    if (path.endsWith("/api/occupational-discovery/manifest")) {
      return fulfillJson(route, {
        ok: true,
        businessQuestions: [],
        blsSectors: [{ id: "construction", naics: "23", label: "Construction", description: "Construction workforces." }],
        workforceGroups: [],
        serviceOpportunities: [],
        dataGovCollections: [],
        sources: [],
      });
    }
    if (path.endsWith("/api/occupational-discovery/bls-overview")) {
      return fulfillJson(route, {
        ok: true,
        sectors: [{ id: "construction", naics: "23", label: "Construction", description: "Construction workforces.", benchmark: constructionBenchmark }],
        ranked: [{ id: "construction", naics: "23", label: "Construction", description: "Construction workforces.", benchmark: constructionBenchmark }],
        limitation: "Aggregate industry benchmark.",
      });
    }
    if (path.endsWith("/api/bls/industry-benchmark")) {
      return fulfillJson(route, { ok: true, benchmark: constructionBenchmark, message: "Benchmark data retrieved." });
    }
    if (path.endsWith("/api/occupational-discovery/onet/profile")) return fulfillJson(route, onetProfile);
    if (path.endsWith("/api/occupational-discovery/onet/profile-by-code")) return fulfillJson(route, { ok: true, profile: onetProfile.profile });

    if (path.endsWith("/api/reviewer-tools/rxnorm")) {
      const term = (url.searchParams.get("term") || "").toLowerCase();
      if (term.includes("metoprolol")) {
        return fulfillJson(route, { ok: true, source: "NLM RxNorm", candidates: [{ rxcui: "866924", name: "metoprolol succinate 50 MG Extended Release Oral Tablet", score: 100 }] });
      }
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
    if (path.endsWith("/api/reviewer-tools/drug-intelligence")) {
      const rxcui = url.searchParams.get("rxcui") || "25480";
      const isMetoprolol = rxcui === "866924";
      const canonicalName = isMetoprolol ? "metoprolol succinate 50 MG Extended Release Oral Tablet" : "gabapentin 300 MG Oral Capsule";
      return fulfillJson(route, {
        ok: true,
        medication: { rxcui, name: canonicalName },
        identity: { rxcui, canonicalName, termType: "SCD", ingredients: [isMetoprolol ? "metoprolol" : "gabapentin"], source: "NLM RxNorm", sourceUrl: "https://rxnav.nlm.nih.gov/" },
        classes: [{ classId: "class-1", className: isMetoprolol ? "Beta-Adrenergic Blocker" : "Anticonvulsant", classType: "MOA", relationship: "has_MoA", relationshipSource: "MEDRT" }],
        fdaClassNames: [isMetoprolol ? "beta-Adrenergic Blocker" : "Gabapentinoid"],
        label: {
          setId: isMetoprolol ? "metoprolol-test" : "gabapentin-test",
          effectiveTime: "20260715",
          genericNames: [isMetoprolol ? "metoprolol succinate" : "gabapentin"],
          brandNames: [],
          manufacturers: ["Test Labeler"],
          routes: ["ORAL"],
          dosageForms: ["TABLET"],
          pharmClassEpc: [],
          pharmClassMoa: [],
          sections: {
            boxedWarning: "",
            warningsAndCautions: isMetoprolol ? "Treatment may cause dizziness and bradycardia." : "Gabapentin may cause somnolence and dizziness and may impair the ability to drive or operate complex machinery.",
            adverseReactions: isMetoprolol ? "Common reactions include fatigue and dizziness." : "Common reactions include dizziness, somnolence, and ataxia.",
            drugInteractions: isMetoprolol ? "Concomitant use with other agents that slow heart rate should be reviewed." : "Metoprolol is listed here for regimen-test cross-label matching.",
            contraindications: "",
            precautions: "",
            patientCounseling: "Use caution with safety-sensitive activity until effects are known.",
            useInSpecificPopulations: "",
          },
          source: "FDA Structured Product Labeling via openFDA",
          sourceUrl: "https://api.fda.gov/drug/label.json",
          dailyMedUrl: "https://dailymed.nlm.nih.gov/",
        },
        signals: [{ id: "alertness", label: "Alertness / psychomotor", domain: "Safety-sensitive work", section: "Warnings and Precautions", evidence: "Dizziness and somnolence may affect safety-sensitive work.", source: "FDA product labeling" }],
        coverage: { rxnorm: true, rxclass: true, fdaLabel: true, signalCount: 1 },
        limitation: "Label-derived occupational signals are reviewer evidence, not fitness determinations.",
      });
    }
    if (path.endsWith("/api/reviewer-tools/drug-regimen")) {
      return fulfillJson(route, {
        ok: true,
        medications: [],
        overlaps: [{
          id: "alertness",
          label: "Alertness / psychomotor",
          domain: "Safety-sensitive work",
          medications: [
            { rxcui: "25480", name: "gabapentin 300 MG Oral Capsule", evidence: "Somnolence and dizziness.", section: "Warnings and Precautions" },
            { rxcui: "866924", name: "metoprolol succinate 50 MG Extended Release Oral Tablet", evidence: "Treatment may cause dizziness.", section: "Warnings and Precautions" },
          ],
        }],
        interactionMentions: [{
          fromRxcui: "25480",
          fromDrug: "gabapentin 300 MG Oral Capsule",
          toRxcui: "866924",
          toDrug: "metoprolol succinate 50 MG Extended Release Oral Tablet",
          section: "FDA Drug Interactions",
          evidence: "Metoprolol is listed here for regimen-test cross-label matching.",
        }],
        coverage: { selected: 2, fdaLabels: 2, rxClasses: 2, medicationsWithSignals: 2 },
        limitation: "No fabricated interaction severity score is calculated.",
      });
    }

    if (request.method() === "GET") return fulfillJson(route, { ok: true, records: [], results: [], profiles: [] });
    return fulfillJson(route, { ok: true });
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
  await expect(page.frameLocator('iframe[title="BLS Injuries, Illnesses & Fatalities official data portal"]').getByText("BLS official source")).toBeVisible();

  await page.getByRole("button", { name: "OSHA" }).click();
  await expect(page.frameLocator('iframe[title="OSHA Data official data portal"]').getByText("OSHA official source")).toBeVisible();
  await page.getByRole("button", { name: "Data.gov" }).click();
  await expect(page.frameLocator('iframe[title="Data.gov Catalog official data portal"]').getByText("Data.gov official source")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Industry Impact uses the reviewed workforce-driven BLS scenario model", async ({ page }) => {
  await page.goto("/industry-impact-calculator");
  await expect(page.getByRole("heading", { name: "Industry Impact Calculator" })).toBeVisible();
  await expect(page.getByText("Prepared BLS industry library", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Construction/ }).first().click();
  await page.getByLabel("Workforce size (headcount or FTE)").fill("100");
  await page.getByLabel("Observed employer TRIR").fill("4");
  await page.getByLabel("Target TRIR").fill("2");
  await expect(page.getByText("Affected workers / recordables", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Employer vs official BLS benchmark", { exact: true })).toBeVisible();
  await expect(page.getByText("Five-year linear scenario path", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Calculator workstation exposes workforce health, live O*NET job evidence, readiness, and schedule exposure", async ({ page }) => {
  await page.goto("/occupational-calculators");
  await expect(page.getByRole("heading", { name: "Occupational Calculators" })).toBeVisible();
  await expect(page.getByText("11", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Workforce Health" }).click();
  await expect(page.getByText("Age-Based Chronic Conditions", { exact: true })).toBeVisible();
  await expect(page.getByText("Aggravation & Comorbidity Overlap", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Job & Exposure" }).click();
  await page.getByRole("button", { name: /Condition × Job Demands/ }).click();
  await page.getByPlaceholder("aircraft mechanic").fill("Aircraft mechanic");
  await page.getByRole("button", { name: "Lookup", exact: true }).click();
  await expect(page.getByText("Aircraft Mechanics and Service Technicians", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Readiness" }).click();
  await expect(page.getByText("Deployment Readiness", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Job & Exposure" }).click();
  await expect(page.getByText("Shift & Fatigue Exposure", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("O*NET Master Tool renders the official O*NET site through the working webview", async ({ page }) => {
  await page.goto("/onet-master-tool");
  await expect(page.getByRole("heading", { name: "O*NET Master Tool" })).toBeVisible();
  await expect(page.getByText("O*NET OnLine", { exact: true })).toBeVisible();
  const frame = page.locator('iframe[title="O*NET OnLine official data portal"]');
  await expect(frame).toHaveAttribute("src", /\/api\/official-source-webview\?source=onet/);
  await expect(page.frameLocator('iframe[title="O*NET OnLine official data portal"]').getByText("O*NET official source")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Drug Checker surfaces FDA label evidence and regimen overlap without fabricated severity", async ({ page }) => {
  await page.goto("/drug-checker");
  await page.getByPlaceholder("Gabapentin, Eliquis, metoprolol…").fill("gabapentin");
  await page.getByRole("button", { name: /gabapentin 300 MG Oral Capsule/ }).click();
  await expect(page.getByText("04 · FDA label intelligence", { exact: true })).toBeVisible();
  await expect(page.getByText("Alertness / psychomotor").first()).toBeVisible();

  await page.getByPlaceholder("Gabapentin, Eliquis, metoprolol…").fill("metoprolol");
  await page.getByRole("button", { name: /metoprolol succinate 50 MG Extended Release Oral Tablet/ }).click();
  await expect(page.getByText("Combined medication burden")).toBeVisible();
  await expect(page.getByText("No fabricated interaction severity score is calculated.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});