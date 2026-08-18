import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/reviewer-tools/rxnorm?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, candidates: [{ rxcui: "25480", name: "gabapentin 300 MG Oral Capsule", score: 100 }] }) });
  });
  await page.route("**/api/reviewer-tools/pubchem?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true,
      molecule: { CID: 3446, MolecularFormula: "C9H17NO2", MolecularWeight: "171.24", XLogP: -1.1, TPSA: 63.3 },
      pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/3446",
    }) });
  });
  await page.route("**/api/reviewer-tools/pubchem-structure?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true,
      source: "NIH PubChem PUG REST",
      cid: 3446,
      model: {
        source: "3d",
        atoms: [
          { id: 1, element: 6, x: -2.4, y: 0.1, z: -0.3 },
          { id: 2, element: 6, x: -1.5, y: 1.1, z: 0.2 },
          { id: 3, element: 6, x: -0.2, y: 0.7, z: 0.6 },
          { id: 4, element: 6, x: -0.2, y: -0.7, z: 0.5 },
          { id: 5, element: 6, x: -1.5, y: -1.1, z: 0.0 },
          { id: 6, element: 6, x: 1.1, y: 0.0, z: 0.2 },
          { id: 7, element: 6, x: 2.2, y: 0.7, z: -0.1 },
          { id: 8, element: 7, x: 3.3, y: 1.3, z: 0.4 },
          { id: 9, element: 6, x: 2.1, y: -0.8, z: -0.5 },
          { id: 10, element: 8, x: 3.1, y: -1.5, z: -0.2 },
          { id: 11, element: 8, x: 1.0, y: -1.5, z: -0.8 },
        ],
        bonds: [
          { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 }, { a: 3, b: 4, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 5, b: 1, order: 1 },
          { a: 3, b: 6, order: 1 }, { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 6, b: 9, order: 1 }, { a: 9, b: 10, order: 2 }, { a: 9, b: 11, order: 1 },
        ],
      },
    }) });
  });
});

test("Drug Checker renders the real compound as a transparent native aurora molecule", async ({ page }) => {
  await page.goto("/drug-checker");
  await page.getByPlaceholder("Gabapentin, Eliquis, metoprolol…").fill("gabapentin");
  await page.getByRole("button", { name: /gabapentin 300 MG Oral Capsule/ }).click();

  const hero = page.locator(".rh-molecule-stage");
  const molecule = page.getByTestId("aurora-molecule");
  await expect(molecule).toBeVisible();
  await expect(molecule.getByRole("img", { name: /PubChem 3D structure for gabapentin/i })).toBeVisible();
  await expect(molecule.locator("circle")).toHaveCount(33);
  await expect(molecule.locator("line.aurora-bond-core")).toHaveCount(12);
  await expect(hero.locator("img")).toHaveCount(0);
  await expect(page.getByText("PUBCHEM 3D COORDINATES")).toBeVisible();
  await expect(page.getByText("C9H17NO2")).toBeVisible();

  const stageBackground = await hero.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(stageBackground).not.toContain("rgb(255, 255, 255)");
});
