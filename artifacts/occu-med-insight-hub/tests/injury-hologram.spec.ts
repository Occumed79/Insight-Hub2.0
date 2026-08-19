import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/occupational-discovery/onet/profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          occupation: {
            code: "33-2011.00",
            title: "Firefighters",
            description: "Respond to emergencies, climb stairs, carry equipment, lift patients, use hand tools, and work while standing and reaching.",
          },
          serviceMatches: [
            { id: "physical", label: "Physical demand", count: 5, description: "Lifting, carrying, climbing, standing, reaching, and manual tool use." },
            { id: "resp", label: "Respiratory protection", count: 2, description: "Respirator use and chest respiratory load in hazardous environments." },
          ],
        },
      }),
    });
  });

  await page.route("**/api/occupational-discovery/osha-occupation-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        configured: true,
        imported: true,
        profile: {
          matchedBy: "soc",
          requestedSocCode: "33-2011.00",
          matchedSocCode: "33-2011",
          occupationTitle: "Firefighters",
          selectedYear: 2024,
          totalCases: 128,
          codedBodyPartCases: 100,
          codedNatureCases: 108,
          codedEventCases: 104,
          codedSourceCases: 99,
          totalDaysAway: 846,
          totalRestrictedDays: 392,
          outcomes: [
            { name: "Days away from work", count: 61 },
            { name: "Job transfer / restriction", count: 39 },
            { name: "Other recordable case", count: 28 },
          ],
          bodyParts: [
            { name: "Back", code: "32", count: 31, share: 31 },
            { name: "Upper extremities", code: "21", count: 24, share: 24 },
            { name: "Lower extremities", code: "42", count: 19, share: 19 },
          ],
          natures: [
            { name: "Sprains, strains, tears", code: "12", count: 45, share: 41.7 },
            { name: "Soreness, pain, hurt", code: "14", count: 25, share: 23.1 },
          ],
          events: [
            { name: "Overexertion and bodily reaction", code: "71", count: 42, share: 40.4 },
            { name: "Falls, slips, trips", code: "44", count: 28, share: 26.9 },
          ],
          sources: [
            { name: "Structures and surfaces", code: "62", count: 30, share: 30.3 },
            { name: "Persons, plants, animals, minerals", code: "11", count: 22, share: 22.2 },
          ],
          industries: [],
          trend: [],
        },
      }),
    });
  });
});

test("Injuries & Medical Conditions uses occupation-linked OSHA case characteristics", async ({ page }) => {
  await page.goto("/injuries-medical-conditions");
  await expect(page.getByRole("heading", { name: "Injuries & Medical Conditions" })).toBeVisible();
  await expect(page.getByTestId("injury-hologram")).toBeVisible();
  await expect(page.getByText("HOLOGRAPHIC INJURY ANATOMY")).toBeVisible();
  await expect(page.getByRole("button", { name: "ANTERIOR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "POSTERIOR" })).toBeVisible();
  await expect(page.getByLabel("Anterior CC0 human-mesh point-cloud hologram")).toBeVisible();

  await page.getByPlaceholder("Firefighter, electrician, truck driver…").fill("Firefighter");
  await page.getByRole("button", { name: "Build injury profile" }).click();

  await expect(page.getByRole("heading", { name: "Firefighters" })).toBeVisible();
  await expect(page.getByText("OSHA case-linked projection")).toBeVisible();
  await expect(page.getByText("128").first()).toBeVisible();
  await expect(page.getByText("Back · 31 coded cases (31.0%)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Low back reported case signal" })).toBeVisible();
  await expect(page.getByText("Overexertion and bodily reaction")).toBeVisible();
  await expect(page.getByText("Job-demand context — not an injury rate")).toBeVisible();

  await page.getByRole("button", { name: "POSTERIOR" }).click();
  await expect(page.getByLabel("Posterior CC0 human-mesh point-cloud hologram")).toBeVisible();
});

test("medical condition library is searchable across systems", async ({ page }) => {
  await page.goto("/injuries-medical-conditions");
  await page.getByRole("tab", { name: "Medical Conditions" }).click();
  await page.getByPlaceholder("Search diabetes, migraine, hearing, anticoagulation…").fill("hearing");
  await expect(page.getByRole("button", { name: "Hearing Loss / Tinnitus" })).toBeVisible();
  await page.getByRole("button", { name: "Hearing Loss / Tinnitus" }).click();
  await expect(page.getByRole("heading", { name: "Hearing Loss / Tinnitus" })).toBeVisible();
  await expect(page.getByText("What does the current audiogram show and is there a significant threshold shift?")).toBeVisible();
});
