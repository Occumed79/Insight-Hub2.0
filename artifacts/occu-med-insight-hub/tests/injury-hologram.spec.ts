import { expect as baseExpect, test, type Page } from "@playwright/test";

// Software-rendered WebGL (CI / headless) stalls the main thread for seconds, so poll patiently.
const expect = baseExpect.configure({ timeout: 20_000 });

type Part = { name: string; code: string; count: number };

/** Realistic OIICS-style body-part categories. 100 cases have a coded body part; 128 were reported. */
const MIXED_PARTS: Part[] = [
  { name: "Back, including spine, spinal cord", code: "32", count: 22 },
  { name: "Shoulder(s)", code: "41", count: 8 },
  { name: "Hand(s)", code: "44", count: 10 },
  { name: "Knee(s)", code: "53", count: 9 },
  { name: "Upper extremities, multiple", code: "49", count: 6 },
  { name: "Trunk", code: "30", count: 7 },
  { name: "Leg(s)", code: "50", count: 7 },
  { name: "Body systems", code: "60", count: 3 },
  { name: "Other / unclassified", code: "99", count: 4 },
  { name: "Chest", code: "31", count: 6 },
  { name: "Abdomen", code: "33", count: 4 },
];

/** Only broad categories: no shoulder, no lower-back category at all. */
const BROAD_PARTS: Part[] = [
  { name: "Upper extremities", code: "40", count: 24 },
  { name: "Back, including spine, spinal cord", code: "32", count: 31 },
  { name: "Lower extremities", code: "50", count: 19 },
];

/**
 * Mocks O*NET + OSHA. With `hold: true` the API calls stay pending until `release()` is called,
 * so a test can observe the processing state deterministically.
 */
async function mockApis(page: Page, options: { parts?: Part[]; hold?: boolean } = {}) {
  const parts = options.parts ?? MIXED_PARTS;
  let release: () => void = () => {};
  const gate = options.hold ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();

  await page.route("**/api/occupational-discovery/onet/profile?**", async (route) => {
    await gate;
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
          oiicsYear: 2024,
          totalCases: 128,
          codedBodyPartCases: 100,
          codedNatureCases: 108,
          codedEventCases: 104,
          codedSourceCases: 99,
          totalDaysAway: 846,
          totalRestrictedDays: 392,
          outcomes: [],
          bodyParts: parts.map((part) => ({ ...part, share: part.count })),
          natures: [],
          events: [],
          sources: [],
          industries: [],
          trend: [],
        },
      }),
    });
  });

  return { release };
}

/** Collects console/page errors and same-origin failures for the whole test. */
function watchErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(text)) return; // external, sandbox network
    if (/Failed to load resource/.test(text) && !/health\//.test(text)) return;
    problems.push(`console: ${text}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(page.url() || "http://127.0.0.1:4173").origin && response.status() >= 400 && !url.pathname.startsWith("/api/")) {
      problems.push(`http ${response.status()}: ${url.pathname}`);
    }
  });
  return problems;
}

// Software-rendered WebGL (CI / headless) is slow, so give each test room.
test.beforeEach(() => { test.setTimeout(120_000); });

const scan = (page: Page) => page.getByTestId("health-body-scan");
const sphere = (page: Page) => page.getByTestId("health-scan-sphere");
const occupationInput = (page: Page) => page.getByLabel("OCCUPATION");

/** The route is lazy-loaded: wait for the page, then for the boot sequence to hand over to standby. */
async function waitForBootToFinish(page: Page) {
  await expect(page.getByRole("heading", { name: "Injuries & Medical Conditions" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status")).toContainText(/standby/i, { timeout: 20_000 });
  await expect(scan(page)).toHaveCount(0, { timeout: 45_000 });
  await expect(sphere(page)).toHaveCount(0, { timeout: 45_000 });
}

async function runOccupation(page: Page) {
  await occupationInput(page).fill("Firefighter");
  await page.getByRole("button", { name: /Build injury profile/i }).click();
}

test.describe("scan lifecycle", () => {
  test("initial load: sphere + coordinated scan run, then both disappear", async ({ page }) => {
    const problems = watchErrors(page);
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");

    await expect(sphere(page)).toBeVisible();
    await expect(scan(page)).toBeVisible();
    // One shared sweep band (not two unrelated ribbons) plus a beam from the sphere to each head.
    await expect(page.locator(".hs-scan-band")).toHaveCount(1);
    await expect(page.locator(".hs-scan-beam")).toHaveCount(2);
    await expect(page.getByRole("status")).toContainText(/calibrating|mapping|linking/i);

    await waitForBootToFinish(page);
    await expect(page.locator(".hs-stage canvas")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(/standby/i);
    expect(problems).toEqual([]);
  });

  test("the sphere sits between the heads and the scan stays on the bodies", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await expect(sphere(page)).toBeVisible();

    const stage = (await page.getByTestId("health-hologram").boundingBox())!;
    const orb = (await sphere(page).boundingBox())!;
    expect(orb.x + orb.width / 2).toBeCloseTo(stage.x + stage.width / 2, -1);
    expect(orb.y).toBeGreaterThanOrEqual(stage.y);

    for (const view of ["front", "back"]) {
      const head = (await page.locator(`.hs-hit[data-group="head"][data-view="${view}"]`).boundingBox())!;
      const overlaps = orb.x < head.x + head.width && orb.x + orb.width > head.x && orb.y < head.y + head.height && orb.y + orb.height > head.y;
      expect(overlaps, `sphere overlaps ${view} head`).toBe(false);
    }

    // The scan layer is clipped to the derived silhouette mask, so no energy exists off the bodies.
    const mask = await page.locator(".hs-scan-clip").evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
    expect(mask).toMatch(/hologram-silhouette\.png/);

    // The temporary scanner uses CSS/SVG, so it does not allocate WebGL contexts.
    await expect(page.locator(".hs-stage canvas")).toHaveCount(0);
  });

  test("submitting an occupation runs a temporary scan that ends when the lookup completes", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);

    const gate = await mockApis(page, { hold: true });
    await runOccupation(page);
    await expect(sphere(page)).toBeVisible();
    await expect(scan(page)).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/resolving occupation/i);

    gate.release();
    await expect(page.getByTestId("region-readout")).toContainText(/coded cases/i, { timeout: 45_000 });
    await expect(scan(page)).toHaveCount(0, { timeout: 45_000 });
    await expect(sphere(page)).toHaveCount(0);
    await expect(page.locator(".hs-stage canvas")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(/OSHA case-linked evidence/i);
  });

  test("selecting a medical condition runs the same temporary scan, then clears", async ({ page }) => {
    // Controlled clock: the scan must last exactly as long as the mapping step, regardless of render speed.
    await page.clock.install({ time: new Date("2026-01-01T09:00:00Z") });
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await expect(page.getByRole("heading", { name: "Injuries & Medical Conditions" })).toBeVisible({ timeout: 20_000 });
    await expect(scan(page)).toBeVisible();
    await page.clock.pauseAt(new Date("2026-01-01T09:01:00Z")); // boot timers fire, then time stands still
    await expect(page.getByRole("status")).toContainText(/standby/i);
    await page.clock.fastForward(500); // exit fade
    await waitForBootToFinish(page);

    await page.getByRole("tab", { name: "Medical Conditions" }).click();
    await expect(scan(page)).toHaveCount(0);
    await page.getByLabel("MEDICAL CONDITION").fill("diab");
    await page.getByRole("button", { name: "Diabetes", exact: true }).click();

    await expect(scan(page)).toBeVisible();
    await expect(sphere(page)).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/mapping condition/i);
    await expect(page.getByLabel("Evidence index")).toHaveCount(0); // nothing is shown as a finding mid-processing

    await page.clock.fastForward(1_700); // mapping completes
    await expect(page.getByRole("status")).toContainText(/endocrine/i);
    await page.clock.fastForward(500); // exit fade
    await expect(scan(page)).toHaveCount(0);
    await expect(sphere(page)).toHaveCount(0);
    await expect(page.locator(".hs-stage canvas")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(/endocrine/i);
    await expect(page.getByLabel("Evidence index")).toBeVisible();
  });

  test("hovering, selecting and keyboard focus never restart the scan or leave motion on the bodies", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await runOccupation(page);
    await expect(page.getByTestId("region-readout")).toContainText(/coded cases/i, { timeout: 45_000 });
    await expect(scan(page)).toHaveCount(0, { timeout: 45_000 });

    for (const group of ["chest", "knees", "head", "lowBack"]) {
      const zone = page.locator(`.hs-hit[data-group="${group}"]`).first();
      await zone.hover();
      await expect(scan(page)).toHaveCount(0);
      await zone.click();
      await expect(scan(page)).toHaveCount(0);
    }
    await page.locator(`.hs-hit[data-group="shoulders"]`).first().focus();
    await expect(scan(page)).toHaveCount(0);
    await expect(sphere(page)).toHaveCount(0);

    // Idle for a while: still no scanner, no canvases, no loader effects.
    await page.waitForTimeout(3500);
    await expect(scan(page)).toHaveCount(0);
    await expect(page.locator(".hs-stage canvas, .hs-scan-band, .hs-scan-beam, .hi-loading-orb")).toHaveCount(0);
  });
});

test.describe("OSHA mapping and statistics", () => {
  test("every row uses the coded-case denominator and keeps its source category name", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await runOccupation(page);
    const index = page.getByLabel("Evidence index");
    await expect(index).toBeVisible({ timeout: 45_000 });

    // Totals are distinct and consistent: 128 reported, 100 coded, 28 not coded.
    const summary = page.getByLabel("Analysis summary");
    await expect(summary).toContainText("128");
    await expect(summary).toContainText("100");
    await expect(summary).toContainText("28");

    const rows = index.locator("ol > li > button");
    expect(await rows.count()).toBe(MIXED_PARTS.length);
    for (let i = 0; i < MIXED_PARTS.length; i++) {
      const part = [...MIXED_PARTS].sort((a, b) => b.count - a.count)[i];
      const text = (await rows.nth(i).innerText()).replace(/\s+/g, " ");
      expect(text).toContain(part.name); // source label never relabelled
      expect(text).toContain(`${part.count} of 100 coded cases`); // count + denominator shown
      expect(text).toContain(`${part.count.toFixed(1)}%`); // share of the same denominator
    }
    // Source categories are never silently renamed to a narrower region.
    await expect(index).not.toContainText(/lower back/i);
    await expect(index).not.toContainText(/abdomen \/ gut/i);
  });

  test("general back is not lower back, trunk/chest stay separate, and broad categories say so", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await runOccupation(page);
    const readout = page.getByTestId("region-readout");
    await expect(readout).toContainText(/coded cases/i, { timeout: 45_000 });

    // The strongest row is the general Back category; it is described as broad, not as lower back.
    await expect(readout).toContainText("Back, including spine, spinal cord");
    await expect(readout).toContainText(/not lower-back evidence/i);
    await expect(readout).toContainText(/Broad source category/i);

    // The lower-back region lists the broad category and says the level is not coded.
    await page.locator('.hs-hit[data-group="lowBack"]').first().hover();
    await expect(readout).toContainText("Lower back");
    await expect(readout).toContainText(/level of the back is not coded/i);

    // Chest evidence is chest only: the abdomen region has its own category and its own count.
    await page.locator('.hs-hit[data-group="chest"][data-view="front"]').hover();
    await expect(readout).toContainText("Chest");
    await expect(readout).toContainText("6 of 100 coded cases");
    await page.locator('.hs-hit[data-group="gut"]').first().hover();
    await expect(readout).toContainText("Abdomen");
    await expect(readout).toContainText("4 of 100 coded cases");

    // Multiple / body-system / unclassified categories stay identified, not reclassified.
    const index = page.getByLabel("Evidence index");
    await expect(index).toContainText("Body systems");
    await expect(index).toContainText(/Multiple \/ nonspecific/i);
    await expect(index).toContainText("Other / unclassified");
    await expect(index).toContainText(/not mapped to a region/i);
    await expect(index).toContainText(/broad category/i);
  });

  test("upper extremities is not read as shoulder, and a missing shoulder category is not 'no injuries'", async ({ page }) => {
    await mockApis(page, { parts: BROAD_PARTS });
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await runOccupation(page);
    const readout = page.getByTestId("region-readout");
    await expect(readout).toContainText(/coded cases/i, { timeout: 45_000 });

    await page.locator('.hs-hit[data-group="shoulders"]').first().hover();
    await expect(readout).toContainText("Shoulders");
    await expect(readout).toContainText("Upper extremities");
    await expect(readout).toContainText(/not specific to the shoulder/i);
    await expect(readout).toContainText(/Shown across a wider region|shown across/i);

    // A region no category covers gets an honest, non-clinical statement (never "No signal").
    await page.locator('.hs-hit[data-group="head"]').first().hover();
    await expect(readout).toContainText(/No source category in this evidence is coded specifically to this region/i);
    await expect(readout).toContainText(/not evidence that no injuries occurred/i);
    await expect(page.locator("body")).not.toContainText(/no signal/i);
  });

  test("evidence rows focus their regions and the readout stays in the viewport", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await runOccupation(page);
    const index = page.getByLabel("Evidence index");
    await expect(index).toBeVisible({ timeout: 45_000 });

    await index.locator("ol > li > button").nth(2).hover();
    const readout = page.getByTestId("region-readout");
    await expect(readout).toContainText(/coded cases/i);
    const viewport = page.viewportSize()!;
    const box = (await readout.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  });
});

test.describe("Medical Conditions workflow", () => {
  test("neutral before selection, primary and secondary clearly distinguished after", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await page.getByRole("tab", { name: "Medical Conditions" }).click();

    // Empty state is neutral: no evidence callout, no "No signal", full selectable list.
    await expect(page.getByLabel("Evidence index")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Condition suggestions" }).getByRole("button")).toHaveCount(26);
    await page.locator('.hs-hit[data-group="gut"]').first().hover();
    await expect(page.getByTestId("region-readout")).toContainText(/search an occupation or select a condition/i);
    await expect(page.locator("body")).not.toContainText(/no signal/i);

    await page.getByLabel("MEDICAL CONDITION").fill("diab");
    await expect(page.getByRole("group", { name: "Condition suggestions" }).getByRole("button")).toHaveCount(1);
    await page.getByRole("button", { name: "Diabetes", exact: true }).click();
    const index = page.getByLabel("Evidence index");
    await expect(index).toBeVisible({ timeout: 45_000 });

    const first = index.locator("ol > li > button").first();
    await expect(first).toContainText("Abdomen / gut");
    await expect(first).toContainText("Primary");
    const secondary = index.locator("ol > li > button", { hasText: "Secondary" }).first();
    await expect(secondary).toContainText(/not a confirmed finding/i);

    await secondary.hover();
    await expect(page.getByTestId("region-readout")).toContainText(/not a confirmed clinical finding/i);
    await expect(page.getByLabel("Region readout")).not.toContainText(/primary anatomical association/i);
    await expect(page.locator("body")).not.toContainText(/no signal/i);
  });

  test("condition suggestions never overlap the figures, captions or footer", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await waitForBootToFinish(page);
    await page.getByRole("tab", { name: "Medical Conditions" }).click();

    const list = (await page.getByRole("group", { name: "Condition suggestions" }).boundingBox())!;
    const stage = (await page.getByTestId("health-hologram").boundingBox())!;
    const footer = (await page.locator(".hi-bar").boundingBox())!;
    const artLeft = stage.x + stage.width * 0.178;
    const artRight = stage.x + stage.width * 0.824;
    const viewport = page.viewportSize()!;

    if (viewport.width >= 1280) {
      expect(list.x + list.width).toBeLessThanOrEqual(artLeft + 2);
    } else {
      expect(list.y + list.height).toBeLessThanOrEqual(stage.y + 1); // stacked above the stage
    }
    expect(list.y + list.height).toBeLessThanOrEqual(footer.y + 1);
    expect(artRight).toBeGreaterThan(artLeft);
    for (const caption of await page.locator(".hs-cap").all()) {
      const cap = (await caption.boundingBox())!;
      const overlaps = cap.x < list.x + list.width && cap.x + cap.width > list.x && cap.y < list.y + list.height && cap.y + cap.height > list.y;
      expect(overlaps).toBe(false);
    }
  });
});

test.describe("accuracy of interface claims and assets", () => {
  test("no misleading volumetric / live-model claims, exact image + overlay assets load", async ({ page }) => {
    const problems = watchErrors(page);
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    await expect(page.getByRole("heading", { name: "Injuries & Medical Conditions" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/volumetric|point cloud|active scan|live model/i);
    await expect(page.getByRole("tab", { name: "Injury Intelligence" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Medical Conditions" })).toBeVisible();

    const body = page.locator("img.hs-body");
    await expect(body).toHaveAttribute("src", /health\/hologram-body\.png/);
    expect(await body.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1536);
    const silhouette = await page.request.get("/health/hologram-silhouette.png");
    expect(silhouette.status()).toBe(200);
    await waitForBootToFinish(page);
    expect(problems).toEqual([]);
  });

  test("hit regions are anatomically placed (head over head, knees over knees, hands over hands)", async ({ page }) => {
    await mockApis(page);
    await page.goto("/injuries-medical-conditions");
    const stage = (await page.getByTestId("health-hologram").boundingBox())!;
    const centre = async (selector: string) => {
      const box = (await page.locator(selector).first().boundingBox())!;
      return { x: (box.x + box.width / 2 - stage.x) / stage.width, y: (box.y + box.height / 2 - stage.y) / stage.height };
    };
    // Expected centres as a fraction of the 1536 x 1024 artwork (measured against the image).
    const expectations: Array<[string, number, number]> = [
      ['.hs-hit[data-group="head"][data-view="front"]', 490 / 1536, 88 / 1024],
      ['.hs-hit[data-group="neck"][data-view="back"]', 1050 / 1536, 168 / 1024],
      ['.hs-hit[data-group="knees"][data-view="front"]', 432 / 1536, 762 / 1024],
      ['.hs-hit[data-group="feet"][data-view="back"]', 955 / 1536, 960 / 1024],
      ['.hs-hit[data-group="lowBack"]', 1050 / 1536, 405 / 1024],
      ['.hs-hit[data-group="gut"]', 490 / 1536, 400 / 1024],
    ];
    for (const [selector, x, y] of expectations) {
      const c = await centre(selector);
      expect(Math.abs(c.x - x), selector).toBeLessThan(0.01);
      expect(Math.abs(c.y - y), selector).toBeLessThan(0.01);
    }
    // Lower back exists only on the posterior figure; abdomen only on the anterior.
    await expect(page.locator('.hs-hit[data-group="lowBack"][data-view="front"]')).toHaveCount(0);
    await expect(page.locator('.hs-hit[data-group="gut"][data-view="back"]')).toHaveCount(0);
  });
});

test.describe("responsive layout", () => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1100, height: 800 },
    { width: 820, height: 900 },
  ]) {
    test(`no overlap, clipping or horizontal overflow at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      const problems = watchErrors(page);
      await mockApis(page);
      await page.goto("/injuries-medical-conditions");
      await waitForBootToFinish(page);
      await runOccupation(page);
      await expect(page.getByLabel("Evidence index")).toBeVisible({ timeout: 45_000 });
      await page.locator('.hs-hit[data-group="lowBack"]').first().hover();
      await expect(page.getByTestId("region-readout")).toContainText("Lower back");

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      const stage = (await page.getByTestId("health-hologram").boundingBox())!;
      const stacked = size.width < 1280;
      const artLeft = stage.x + stage.width * 0.178;
      const artRight = stage.x + stage.width * 0.824;

      for (const selector of [".hi-rail-left", ".hi-rail-right"]) {
        const rail = (await page.locator(selector).boundingBox())!;
        expect(rail.x, `${selector} left edge`).toBeGreaterThanOrEqual(0);
        expect(rail.x + rail.width, `${selector} right edge`).toBeLessThanOrEqual(size.width + 1);
        if (stacked) {
          const separate = rail.y + rail.height <= stage.y + 1 || rail.y >= stage.y + stage.height - 1;
          expect(separate, `${selector} overlaps stage when stacked`).toBe(true);
        }
      }
      if (!stacked) {
        const left = (await page.locator(".hi-rail-left").boundingBox())!;
        const right = (await page.locator(".hi-rail-right").boundingBox())!;
        expect(left.x + left.width).toBeLessThanOrEqual(artLeft + 2);
        expect(right.x).toBeGreaterThanOrEqual(artRight - 2);
      }

      // Every piece of readable text lives inside the viewport horizontally.
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(".hi-rail *, .hi-bar *")) {
          if (!el.childNodes.length || getComputedStyle(el).visibility === "hidden") continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
          if (!own) continue;
          const r = el.getBoundingClientRect();
          if (r.width && (r.left < -1 || r.right > window.innerWidth + 1)) out.push(`${el.tagName}:${(el.textContent || "").slice(0, 30)}`);
        }
        return out;
      });
      expect(clipped).toEqual([]);

      // Header, tabs, status, note and form do not overlap each other.
      const regions = [".hi-top", ".hi-form", ".hi-telemetry", ".hi-evidence", ".hi-readout", ".hi-status", ".hi-note"];
      const boxes: Array<{ name: string; x: number; y: number; w: number; h: number }> = [];
      for (const selector of regions) {
        const box = await page.locator(selector).first().boundingBox();
        if (box) boxes.push({ name: selector, x: box.x, y: box.y, w: box.width, h: box.height });
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlap = a.x + 1 < b.x + b.w && a.x + a.w - 1 > b.x && a.y + 1 < b.y + b.h && a.y + a.h - 1 > b.y;
          expect(overlap, `${a.name} overlaps ${b.name}`).toBe(false);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});


test("a stalled occupation request ends processing and allows another search", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const gate = await mockApis(page, { hold: true });
  await page.goto("/injuries-medical-conditions");
  await waitForBootToFinish(page);
  await runOccupation(page);
  await expect(page.getByRole("status")).toContainText(/resolving occupation/i);
  await page.clock.fastForward(45_000);
  await expect(page.getByRole("status")).toContainText(/timed out/i);
  await expect(page.getByRole("button", { name: /Build injury profile/i })).toBeEnabled();
  await page.clock.fastForward(500);
  await expect(scan(page)).toHaveCount(0);
  gate.release();
});

test("switching health modes cancels the previous mode's processing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const gate = await mockApis(page, { hold: true });
  await page.goto("/injuries-medical-conditions");
  await waitForBootToFinish(page);
  await runOccupation(page);
  await page.getByRole("tab", { name: "Medical Conditions" }).click();
  await page.getByLabel("MEDICAL CONDITION").fill("diab");
  await page.getByRole("button", { name: "Diabetes", exact: true }).click();
  await page.getByRole("tab", { name: "Injury Intelligence" }).click();
  await page.clock.fastForward(500);
  await expect(page.getByRole("status")).toContainText(/standby/i);
  await expect(scan(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Build injury profile/i })).toBeEnabled();
  gate.release();
});
