import { expect, test, type Route } from "@playwright/test";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

const onetProfile = {
  ok: true,
  source: "O*NET Web Services API v2",
  matches: [
    { code: "33-2011.00", title: "Firefighters", score: 100 },
    { code: "33-1021.00", title: "First-Line Supervisors of Fire Fighting and Prevention Workers", score: 72 },
  ],
  profile: {
    occupation: {
      code: "33-2011.00",
      title: "Firefighters",
      description: "Control and extinguish fires or respond to emergency situations where life, property, or the environment is at risk.",
    },
    tasks: [
      { id: "task-1", name: "Respond to fire alarms and emergency calls.", value: 91, category: "Core" },
      { id: "task-2", name: "Rescue victims from burning buildings and accident sites.", value: 87, category: "Core" },
    ],
    workContext: [
      {
        id: "ctx-1",
        name: "Wear Common Protective or Safety Equipment",
        value: 88,
        response: [
          { percentage: 82, description: "Every day" },
          { percentage: 14, description: "Once a week or more but not every day" },
        ],
      },
    ],
    abilities: [{ id: "ability-1", name: "Static Strength", value: 72 }],
    workActivities: [{ id: "activity-1", name: "Assisting and Caring for Others", value: 81 }],
    detailedWorkActivities: [{ id: "dwa-1", name: "Operate firefighting equipment." }],
    counts: { tasks: 2, workContext: 1, abilities: 1, workActivities: 1, detailedWorkActivities: 1 },
    partialErrors: [],
  },
};

test("Job Intelligence persists a structured company/job profile instead of a global browser duty bucket", async ({ page }) => {
  let profiles: any[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/api/job-intelligence/profiles") && request.method() === "GET") {
      return fulfillJson(route, { ok: true, profiles });
    }
    if (path.endsWith("/api/job-intelligence/profiles") && request.method() === "POST") {
      const body = request.postDataJSON();
      const profile = {
        ...body,
        id: "profile-1",
        createdAt: "2026-08-19T11:20:00.000Z",
        updatedAt: "2026-08-19T11:20:00.000Z",
      };
      profiles = [profile];
      return fulfillJson(route, { ok: true, profile }, 201);
    }
    if (path.includes("/api/job-intelligence/profiles/") && request.method() === "PATCH") {
      const body = request.postDataJSON();
      const profile = { ...profiles[0], ...body, id: "profile-1", updatedAt: "2026-08-19T11:21:00.000Z" };
      profiles = [profile];
      return fulfillJson(route, { ok: true, profile });
    }
    if (path.includes("/api/job-intelligence/profiles/") && request.method() === "DELETE") {
      profiles = [];
      return fulfillJson(route, { ok: true });
    }
    if (path.endsWith("/api/occupational-discovery/onet/profile")) return fulfillJson(route, onetProfile);
    if (path.endsWith("/api/map-config")) return fulfillJson(route, { configured: false, apiKey: "" }, 503);
    return fulfillJson(route, { ok: true, records: [], matches: [] });
  });

  await page.goto("/job-intelligence");
  await expect(page.getByRole("heading", { name: "Job Intelligence" })).toBeVisible();
  await expect(page.getByText("NEON-BACKED")).toBeVisible();

  await page.getByLabel("Company / employer").fill("V2X");
  await page.getByLabel("Profile name").fill("Redzikowo Firefighter");
  await page.getByLabel("Work location").fill("Redzikowo, Poland");
  await page.getByLabel("Internal / client job title").fill("Firefighter");

  const search = page.getByPlaceholder("Aircraft mechanic, firefighter, HVAC mechanic…");
  await search.fill("Firefighter");
  await page.getByRole("button", { name: "Search O*NET" }).click();

  await expect(page.getByRole("heading", { name: "Firefighters", exact: true })).toBeVisible();
  await expect(page.getByText("O*NET 33-2011.00")).toBeVisible();
  await page.getByRole("button", { name: "Add Respond to fire alarms and emergency calls." }).click();

  const dutyCard = page.locator("article").filter({ hasText: "Respond to fire alarms and emergency calls." }).last();
  await expect(dutyCard.getByText("OFFICIAL O*NET")).toBeVisible();
  await dutyCard.getByLabel("Essentiality").selectOption("essential");
  await dutyCard.getByLabel("Frequency").selectOption("frequent");
  await dutyCard.getByLabel("Max lift / carry (lb)").fill("75");
  await dutyCard.getByRole("button", { name: "Physical" }).click();
  await dutyCard.getByRole("button", { name: "Emergency response" }).click();

  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();

  expect(profiles).toHaveLength(1);
  expect(profiles[0].companyName).toBe("V2X");
  expect(profiles[0].profileName).toBe("Redzikowo Firefighter");
  expect(profiles[0].onetCode).toBe("33-2011.00");
  expect(profiles[0].duties).toHaveLength(1);
  expect(profiles[0].duties[0].domains).toContain("Physical");
  expect(profiles[0].duties[0].essentiality).toBe("essential");
  expect(profiles[0].duties[0].frequency).toBe("frequent");
  expect(profiles[0].duties[0].maxLiftLbs).toBe(75);
  expect(profiles[0].duties[0].emergencyResponse).toBe(true);

  await page.reload();
  const savedSelect = page.getByLabel("Saved profiles");
  await expect(savedSelect.locator("option", { hasText: "V2X · Redzikowo Firefighter" })).toHaveCount(1);
  await savedSelect.selectOption("profile-1");
  await expect(page.getByLabel("Profile name")).toHaveValue("Redzikowo Firefighter");
  const restoredDuty = page.locator("article").filter({ hasText: "OFFICIAL O*NET" }).last();
  await expect(restoredDuty.locator("textarea").first()).toHaveValue("Respond to fire alarms and emergency calls.");
  await expect(restoredDuty.getByText("OFFICIAL O*NET")).toBeVisible();
});
