import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/occupational-discovery/osha-overview", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ imported: true, latestYear: 2025, topEmployers: [{ total_cases: 42 }], topStates: [{ total_cases: 18 }], highRateEstablishments: [1, 2] }) });
  });
  await page.route("**/api/occupational-discovery/onet/profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          occupation: { title: "Firefighters", description: "Respond to emergencies, climb stairs, carry equipment, lift patients, use hand tools, and work while standing and reaching." },
          serviceMatches: [
            { id: "physical", label: "Physical demand", count: 5, description: "Lifting, carrying, climbing, standing, reaching, and manual tool use." },
            { id: "resp", label: "Respiratory protection", count: 2, description: "Respirator use and chest respiratory load in hazardous environments." },
          ],
        },
      }),
    });
  });
});

test("Injuries & Medical Conditions restores the reviewer holographic anatomy projection", async ({ page }) => {
  await page.goto("/injuries-medical-conditions");
  await expect(page.getByRole("heading", { name: "Injuries & Medical Conditions" })).toBeVisible();
  await expect(page.getByTestId("injury-hologram")).toBeVisible();
  await expect(page.getByText("HOLOGRAPHIC INJURY ANATOMY")).toBeVisible();
  await expect(page.getByRole("button", { name: "ANTERIOR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "POSTERIOR" })).toBeVisible();
  await expect(page.getByLabel("Anterior CC0 human-mesh point-cloud hologram")).toBeVisible();

  await page.getByPlaceholder("Firefighter, electrician, truck driver…").fill("Firefighter");
  await page.getByRole("button", { name: "Build occupation profile" }).click();
  await expect(page.getByRole("heading", { name: "Firefighters" })).toBeVisible();
  await expect(page.getByText("O*NET-linked projection")).toBeVisible();
  await expect(page.getByRole("button", { name: "Low back injury signal" })).toBeVisible();

  await page.getByRole("button", { name: "POSTERIOR" }).click();
  await expect(page.getByLabel("Posterior CC0 human-mesh point-cloud hologram")).toBeVisible();
});
