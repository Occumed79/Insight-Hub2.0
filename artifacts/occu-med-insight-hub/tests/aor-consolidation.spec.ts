import { expect, test } from "@playwright/test";

test("AOR Factors is a clean blank workspace for the rebuild", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/aor-factors");

  const canvas = page.getByTestId("aor-factors-reset-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("AOR Factors", { exact: true }).first()).toBeVisible();

  for (const legacyText of [
    "Country mode",
    "AOR mode",
    "Command operating picture",
    "Map-linked intelligence inspector",
    "Country baseline",
    "Operational watch",
    "Health & outbreak intelligence",
    "Country health readiness",
    "WHO Immunization Intelligence",
    "Work conditions",
    "Medical condition × deployment context",
    "Map rendering failed",
  ]) {
    await expect(page.getByText(legacyText, { exact: false })).toHaveCount(0);
  }

  await expect(page.locator(".maplibregl-map")).toHaveCount(0);
  await expect(page.getByTestId("aor-orb-overlay")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
