import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/reviewer-tools/rxnorm?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, candidates: [{ rxcui: "25480", name: "gabapentin 300 MG Oral Capsule", score: 100 }] }),
    });
  });

  await page.route("**/api/reviewer-tools/pubchem?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        molecule: { CID: 3446, MolecularFormula: "C9H17NO2", MolecularWeight: "171.24", XLogP: -1.1, TPSA: 63.3 },
        pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/3446",
      }),
    });
  });

  await page.route("**/api/reviewer-tools/pubchem-conformer?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        cid: 3446,
        recordType: "3d",
        atoms: [
          { id: 1, element: 6, x: -2.1, y: 0.0, z: 0.2 },
          { id: 2, element: 6, x: -1.1, y: 1.0, z: -0.3 },
          { id: 3, element: 6, x: 0.2, y: 0.6, z: 0.2 },
          { id: 4, element: 6, x: 0.4, y: -0.8, z: -0.2 },
          { id: 5, element: 6, x: -1.0, y: -1.2, z: 0.3 },
          { id: 6, element: 7, x: 1.6, y: 1.0, z: 0.6 },
          { id: 7, element: 8, x: 2.4, y: -0.5, z: -0.4 },
          { id: 8, element: 8, x: 1.9, y: -1.5, z: 0.5 },
          { id: 9, element: 1, x: -2.8, y: 0.7, z: 0.7 },
          { id: 10, element: 1, x: -2.5, y: -0.9, z: -0.5 },
        ],
        bonds: [
          { a: 1, b: 2, order: 1 },
          { a: 2, b: 3, order: 1 },
          { a: 3, b: 4, order: 1 },
          { a: 4, b: 5, order: 1 },
          { a: 5, b: 1, order: 1 },
          { a: 3, b: 6, order: 1 },
          { a: 4, b: 7, order: 1 },
          { a: 4, b: 8, order: 2 },
          { a: 1, b: 9, order: 1 },
          { a: 1, b: 10, order: 1 },
        ],
      }),
    });
  });
});

test("Drug Checker renders the real compound as a transparent cinematic aurora conformer", async ({ page }) => {
  await page.goto("/drug-checker");
  await page.getByPlaceholder("Gabapentin, Eliquis, metoprolol…").fill("gabapentin");
  await page.getByRole("button", { name: /gabapentin 300 MG Oral Capsule/ }).click();

  await expect(page.getByText("C9H17NO2")).toBeVisible();
  const renderer = page.getByTestId("aurora-molecule-renderer");
  await expect(renderer).toBeVisible();
  await expect(renderer).toHaveAttribute("data-record-type", "3d");
  await expect(page.getByLabel(/Cinematic aurora rendering of the PubChem molecular conformer/)).toBeVisible();
  await expect(page.locator(".rh-molecule-stage img")).toHaveCount(0);
  await expect(page.getByText(/stock white image canvas/i)).toHaveCount(0);

  const canvas = renderer.locator("canvas");
  await page.waitForTimeout(120);
  const metrics = await canvas.evaluate((element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const data = element.getContext("2d")?.getImageData(0, 0, Math.min(element.width, 80), Math.min(element.height, 80)).data;
    let alpha = 0;
    if (data) for (let index = 3; index < data.length; index += 4) alpha += data[index];
    return { width: rect.width, height: rect.height, alpha };
  });
  expect(metrics.width).toBeGreaterThan(250);
  expect(metrics.height).toBeGreaterThan(250);
  expect(metrics.alpha).toBeGreaterThan(0);
});
