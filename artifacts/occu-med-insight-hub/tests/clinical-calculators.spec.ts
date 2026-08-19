import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflowing).toBe(false);
}

test("Clinical Calculators are medical-only and reproduce validated risk reference values", async ({ page }) => {
  await page.goto("/clinical-calculators");
  await expect(page.getByRole("heading", { name: "Clinical Calculators" })).toBeVisible();

  await expect(page.getByText("Heat Index", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Wind Chill", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Walking METs", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Maximum Predicted HR", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Target Heart Rate", { exact: true })).toHaveCount(0);

  await expect(page.getByText("PREVENT-ASCVD", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Age · years").fill("50");
  await page.getByLabel("Sex used by equation").selectOption("female");
  await page.getByLabel("Systolic BP · mmHg").fill("160");
  await page.getByLabel("Total cholesterol · mg/dL").fill("200");
  await page.getByLabel("HDL cholesterol · mg/dL").fill("45");
  await page.getByLabel("eGFR · mL/min/1.73m²").fill("90");
  await page.getByLabel("BP treatment").selectOption("yes");
  await page.getByLabel("Statin therapy").selectOption("no");
  await page.getByLabel("Diabetes").selectOption("yes");
  await page.getByLabel("Current smoking").selectOption("no");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("9.2%", { exact: true })).toBeVisible();
  await expect(page.getByText("Intermediate", { exact: true })).toBeVisible();
  await expect(page.getByText("35.4%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Seizure Recurrence", exact: true }).click();
  await page.getByLabel("Neurological deficit").selectOption("no");
  await page.getByLabel("Seizure type").selectOption("generalized");
  await page.getByLabel("EEG result").selectOption("normal");
  await page.getByLabel("CT / MRI result").selectOption("normal");
  await page.getByLabel("Antiseizure treatment").selectOption("delayed");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("35.1%", { exact: true })).toBeVisible();
  await expect(page.getByText("46.2%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Recurrent Stroke · Essen", exact: true }).click();
  await page.getByLabel("Age · years").fill("60");
  for (const label of ["Hypertension", "Diabetes", "Previous MI", "Other cardiovascular disease", "Peripheral artery disease", "Current / recent smoking", "Prior TIA / ischemic stroke before qualifying event"]) {
    await page.getByLabel(label).selectOption("no");
  }
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("0 / 9", { exact: true })).toBeVisible();
  await expect(page.getByText("10.3%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "STOP-Bang", exact: true }).click();
  for (const label of ["Loud snoring", "Daytime tiredness", "Observed apnea", "High blood pressure"]) {
    await page.getByLabel(label).selectOption("no");
  }
  await page.getByLabel("BMI · kg/m²").fill("24");
  await page.getByLabel("Age · years").fill("40");
  await page.getByLabel("Neck circumference · cm").fill("38");
  await page.getByLabel("Sex").selectOption("female");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("0 / 8", { exact: true })).toBeVisible();
  await expect(page.getByText(/Low screening risk/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
