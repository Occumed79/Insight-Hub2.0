import { readFile } from "node:fs/promises";
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

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate PDF Report" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Occu-Med_PREVENT-ASCVD_\d{4}-\d{2}-\d{2}\.pdf$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const pdfBytes = await readFile(downloadPath!);
  const pdfText = pdfBytes.toString("latin1");
  expect(pdfText.startsWith("%PDF-1.4")).toBe(true);
  expect(pdfText).toContain("Clinical Calculator Report");
  expect(pdfText).toContain("PREVENT-ASCVD");
  expect(pdfText).toContain("9.2%");
  expect(pdfText).toContain("Age");
  expect(pdfText).toContain("50 years");
  expect(pdfText).toContain("AHA PREVENT");
  expect(pdfText.endsWith("%%EOF\n")).toBe(true);

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

const standardsSources = [
  ["centcom-mod18", "CENTCOM MOD 18", "Deployment", "automated-medical"],
  ["fmcsa", "FMCSA", "Transportation", "automated-medical"],
  ["faa", "FAA", "Aviation", "automated-medical"],
  ["nfpa1580", "NFPA 1580", "Emergency Response", "automated-medical"],
  ["osha-respiratory", "OSHA RESPIRATORY", "OSHA Medical Surveillance", "trigger-based"],
  ["osha-noise", "OSHA HEARING", "OSHA Medical Surveillance", "trigger-based"],
  ["osha-hazwoper", "OSHA HAZWOPER", "OSHA Medical Surveillance", "trigger-based"],
  ["osha-bloodborne", "OSHA BLOODBORNE", "OSHA Medical Surveillance", "trigger-based"],
  ["osha-lead", "OSHA LEAD", "OSHA Medical Surveillance", "trigger-based"],
  ["osha-asbestos", "OSHA ASBESTOS", "OSHA Medical Surveillance", "trigger-based"],
  ["osha-cadmium", "OSHA CADMIUM", "OSHA Medical Surveillance", "trigger-based"],
  ["dot-part40", "DOT PART 40", "Drug & Alcohol Testing", "trigger-based"],
].map(([id, shortLabel, category, coverage]) => ({
  id,
  shortLabel,
  title: `${shortLabel} controlling source`,
  edition: "Current edition",
  authority: id === "nfpa1580" ? "consensus-standard" : "regulation",
  category,
  sourceUrl: "https://example.com/official-standard",
  description: `${shortLabel} reviewer source`,
  currentAsOf: "Current",
  lastVerified: "2026-08-19",
  coverage,
  topics: id === "osha-noise" ? ["noise", "audiogram"] : id === "osha-respiratory" ? ["respirator", "medical evaluation"] : [],
}));

test("Standards Intelligence is API-backed, expands the source registry, and recommends work-context frameworks", async ({ page }) => {
  await page.route("**/api/standards/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        architectureVersion: "standards-api-v2",
        totalSources: standardsSources.length,
        automatedSources: standardsSources.length,
        categories: [...new Set(standardsSources.map((source) => source.category))],
        sources: standardsSources,
      }),
    });
  });

  await page.route("**/api/standards/evaluate", async (route) => {
    const body = route.request().postDataJSON() as { frameworks?: string[]; occupation?: string; respiratorRequired?: boolean; noiseTwaDba?: number };
    const frameworks = body.frameworks ?? [];
    const firefighter = (body.occupation ?? "").toLowerCase().includes("firefighter");
    const recommendations = firefighter ? [
      { standardId: "nfpa1580", reason: "Emergency-responder context" },
      { standardId: "osha-respiratory", reason: "SCBA / respirator use is common in emergency response" },
      { standardId: "osha-noise", reason: "Emergency-response work commonly includes hazardous-noise exposure" },
      { standardId: "osha-bloodborne", reason: "EMS / emergency-response bloodborne-exposure potential" },
    ] : [];
    const findings = [
      ...(frameworks.includes("centcom-mod18") ? [{ id: "mod18-core", standardId: "centcom-mod18", level: "info", title: "Deployment functional baseline", summary: "Deployment baseline.", action: "Review duties.", citation: "MOD 18", sourceUrl: "https://example.com/centcom", topics: ["deployment"], matchedBy: ["selected"] }] : []),
      ...(frameworks.includes("osha-respiratory") && body.respiratorRequired ? [{ id: "resp-core", standardId: "osha-respiratory", level: "review", title: "Respirator medical evaluation precedes required use", summary: "Required respirator use activates the medical-evaluation workflow.", action: "Confirm PLHCP evaluation.", citation: "29 CFR §1910.134(e)", sourceUrl: "https://example.com/respiratory", topics: ["respirator"], matchedBy: ["respirator required"] }] : []),
      ...(frameworks.includes("osha-noise") && (body.noiseTwaDba ?? 0) >= 85 ? [{ id: "noise-core", standardId: "osha-noise", level: "review", title: "85 dBA TWA hearing-conservation action level met", summary: "Hearing conservation applies.", action: "Review audiometric program.", citation: "29 CFR §1910.95(c)", sourceUrl: "https://example.com/noise", topics: ["noise"], matchedBy: ["noise TWA"] }] : []),
    ];
    findings.sort((a, b) => ({ info: 0, review: 1, waiver: 2, strict: 3 }[b.level as "info" | "review" | "waiver" | "strict"] - { info: 0, review: 1, waiver: 2, strict: 3 }[a.level as "info" | "review" | "waiver" | "strict"]));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        architectureVersion: "standards-api-v2",
        evaluatedAt: "2026-08-19T18:00:00.000Z",
        selectedSources: standardsSources.filter((source) => frameworks.includes(source.id)),
        findings,
        recommendations,
        coverage: { selected: frameworks.length, matched: new Set(findings.map((finding) => finding.standardId)).size, automatedSelected: frameworks.length, referenceSelected: 0 },
      }),
    });
  });

  await page.goto("/standards-intelligence");
  await expect(page.getByRole("heading", { name: "Standards Intelligence" })).toBeVisible();
  await expect(page.getByText("12 sources · standards-api-v2", { exact: true })).toBeVisible();
  await expect(page.getByText("OSHA RESPIRATORY", { exact: true })).toBeVisible();
  await expect(page.getByText("DOT PART 40", { exact: true })).toBeVisible();
  await expect(page.getByText("Trigger-based", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/2026-08-19/).first()).toBeVisible();

  await page.getByLabel("Occupation / context").fill("Firefighter emergency responder");
  await expect(page.getByText("Suggested standards", { exact: true })).toBeVisible();
  await expect(page.getByText("Emergency-responder context", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply suggested standards" }).click();
  await page.getByLabel("Required respirator / SCBA").check();
  await page.getByLabel("Noise TWA dBA").fill("90");

  await expect(page.getByText("Respirator medical evaluation precedes required use", { exact: true })).toBeVisible();
  await expect(page.getByText("85 dBA TWA hearing-conservation action level met", { exact: true })).toBeVisible();
  await expect(page.getByText(/Coverage is explicit/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
