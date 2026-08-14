import { expect, test, type Page, type Route } from "@playwright/test";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

async function installOccupationalApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/api/occupational-data/catalog")) {
      return fulfillJson(route, {
        ok: true,
        topics: [
          {
            id: "injury-illness",
            label: "Injuries & Illnesses",
            query: "occupational injury illness workplace",
            description: "Recordable events and occupational-health datasets.",
          },
        ],
      });
    }

    if (path.endsWith("/api/occupational-onet/job-context")) {
      return fulfillJson(route, {
        ok: true,
        keyword: "electrician",
        source: "O*NET Web Services API v2",
        context: {
          occupation: {
            code: "47-2111.00",
            title: "Electricians",
            score: 100,
            description: "Install, maintain, and repair electrical systems.",
          },
          matches: [
            { code: "47-2111.00", title: "Electricians", score: 100 },
          ],
          physical_demands: {
            summary: "2 source-backed physical-demand indicators identified.",
            abilities: [{ name: "Static Strength" }],
            work_activities: [{ name: "Handling and Moving Objects" }],
            detailed_work_activities: [],
            work_context: [],
          },
          cognitive_demands: {
            summary: "1 source-backed cognitive-demand indicator identified.",
            abilities: [{ name: "Problem Sensitivity" }],
            work_activities: [],
            work_context: [],
          },
          safety_sensitive_indicators: {
            safety_sensitive: true,
            indicators: ["1 O*NET task statement matched explicit safety terms."],
            work_context: [],
            work_activities: [],
            tasks: [{ name: "Inspect electrical systems for hazards." }],
          },
          environmental_indicators: {
            summary: "1 source-backed environmental-exposure indicator identified.",
            work_context: [{ name: "Outdoors, Exposed to Weather" }],
          },
          essential_function_suggestions: [
            "Inspect electrical systems for hazards.",
          ],
          partialErrors: [],
          raw: {
            tasks: [],
            work_context: [],
            abilities: [],
            work_activities: [],
          },
        },
      });
    }

    if (path.endsWith("/api/occupational-onet/occupation/47-2111.00")) {
      return fulfillJson(route, {
        ok: true,
        source: "O*NET Web Services API v2",
        occupation: {
          code: "47-2111.00",
          title: "Electricians",
          description: "Install, maintain, and repair electrical systems.",
          tasks: [{ name: "Inspect electrical systems for hazards." }],
          work_activities: [{ name: "Handling and Moving Objects" }],
          detailed_work_activities: [],
          abilities: [{ name: "Static Strength" }],
          work_context: [{ name: "Outdoors, Exposed to Weather" }],
          skills: [],
          knowledge: [],
          related_occupations: [],
          technology_skills: [],
        },
      });
    }

    return fulfillJson(route, {
      ok: true,
      configured: true,
      records: [],
      datasets: [],
      matches: [],
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflowing).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await installOccupationalApi(page);
});

test("Occupational Data Explorer starts blank and tells the truth about OSHA scope", async ({ page }) => {
  await page.goto("/occupational-data-explorer");

  await expect(page.getByRole("heading", { name: "Occupational Data Explorer" })).toBeVisible();
  await expect(page.getByText("No BLS benchmark loaded")).toBeVisible();
  await expect(page.getByPlaceholder("2–6 digits")).toHaveValue("");
  await expect(page.getByText("BLS Master Explorer")).toHaveCount(0);

  await page.getByRole("button", { name: "OSHA ITA Records" }).click();
  await expect(page.getByText("Imported OSHA ITA establishment records")).toBeVisible();
  await expect(page.getByText("This is not a universal live OSHA search.")).toBeVisible();
  await expect(page.getByText("OSHA Master Explorer")).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});

test("Industry Impact Calculator does not preload findings or financial assumptions", async ({ page }) => {
  await page.goto("/industry-impact-calculator");

  await expect(page.getByRole("heading", { name: "Industry Impact Calculator" })).toBeVisible();
  await expect(page.getByText("Blank by design")).toBeVisible();
  await expect(page.getByText("Needs TRC rate + annual hours")).toBeVisible();
  await expect(page.getByText("Needs events + direct cost")).toBeVisible();

  const numericInputs = page.locator('input[type="number"]');
  const count = await numericInputs.count();
  for (let index = 0; index < count; index += 1) {
    await expect(numericInputs.nth(index)).toHaveValue("0");
  }

  await expectNoHorizontalOverflow(page);
});

test("Calculator suite exposes no custom readiness, fatigue, or aggravation score", async ({ page }) => {
  await page.goto("/occupational-calculators");

  await expect(page.getByRole("heading", { name: "Occupational Calculators" })).toBeVisible();
  await expect(page.getByText("Useful models without fake certainty.")).toBeVisible();

  await page.getByRole("button", { name: /Aggravation Review/ }).click();
  await expect(page.getByRole("heading", { name: "Condition-Demand Review Builder" })).toBeVisible();
  await expect(page.getByText("Automated conclusion")).toHaveCount(0);
  await expect(page.getByText(/aggravation index/i)).toBeVisible();

  await page.getByRole("button", { name: /Readiness Profile/ }).click();
  await expect(page.getByRole("heading", { name: "Workforce Readiness Input Profile" })).toBeVisible();
  await expect(page.getByText(/unsupported single readiness index/i)).toBeVisible();
  await expect(page.getByText(/^Strong$/)).toHaveCount(0);
  await expect(page.getByText(/^Vulnerable$/)).toHaveCount(0);

  await page.getByRole("button", { name: /Fatigue \/ Shift Profile/ }).click();
  await expect(page.getByRole("heading", { name: "Fatigue & Shift Input Profile" })).toBeVisible();
  await expect(page.getByText(/previous custom fatigue index/i)).toBeVisible();
  await expect(page.getByText(/^Critical$/)).toHaveCount(0);
  await expect(page.getByText(/^High$/)).toHaveCount(0);
  await expect(page.getByText(/^Elevated$/)).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});

test("O*NET Master Tool shows source evidence instead of pseudo-risk scores", async ({ page }) => {
  await page.goto("/onet-master-tool");

  await expect(page.getByRole("heading", { name: "O*NET Master Tool" })).toBeVisible();
  await page.getByPlaceholder(/Aircraft mechanic/i).fill("electrician");
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByText("Electricians", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Returned source items", { exact: true })).toBeVisible();
  await expect(page.getByText("Explicit safety matches", { exact: true })).toBeVisible();
  await expect(page.getByText(/not severity or risk scores/i)).toBeVisible();
  await expect(page.getByText("Risk Index", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Collision Index", { exact: true })).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});