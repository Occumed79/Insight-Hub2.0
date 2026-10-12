import { expect, test, type Page } from "@playwright/test";
import { routeAorBackend } from "./helpers/aor-backend";

// Official command news / publications in the AOR command panel. The news service is stubbed with responses shaped exactly like
// GET /api/aor/command-news (the real service, its parsing, caching and monitoring are covered by api-server/aor-command-news.test.ts).

const NOW = "2026-10-11T12:00:00.000Z";
const COMMANDS = ["NORTHCOM", "SOUTHCOM", "EUCOM", "AFRICOM", "CENTCOM", "INDOPACOM"] as const;

const report = (command: string, overrides: Record<string, unknown> = {}) => ({
  sourceId: `${command.toLowerCase()}-press-releases`, sourceName: `US${command} press releases`, command, kind: "press_release",
  listingUrl: `https://www.${command.toLowerCase()}.mil/press-releases`, officialSite: `https://www.${command.toLowerCase()}.mil/`, urlBasis: "found_in_official_search",
  status: "ok", method: "discovered_feed", feedUrl: `https://www.${command.toLowerCase()}.mil/rss.xml`, httpStatus: 200, itemCount: 3,
  lastAttemptedFetch: NOW, lastSuccessfulFetch: NOW, sourceError: null, note: null, lastKnownData: false, ...overrides,
});

const item = (command: string, n: number, overrides: Record<string, unknown> = {}) => ({
  id: `${command}-${n}`, command, sourceId: `${command.toLowerCase()}-press-releases`, sourceName: `US${command} press releases`, kind: "press_release",
  title: `${command} item ${n}`, url: `https://www.${command.toLowerCase()}.mil/press-release/${n}`, summary: `Description ${n}`, publishedAt: `2026-10-0${n}T10:00:00.000Z`,
  retrievedAt: NOW, freshness: "CURRENT_NOTICE", lastKnownData: false, healthTerms: [], ...overrides,
});

const LIMITATIONS = [
  "These are the command's own public communications. They are context for review, not medical requirements, and they never change a REQUIRED / RECOMMENDED / CONDITIONAL status.",
  "Only the sources listed here are monitored. An empty list means nothing was retrieved from them, not that the command published nothing.",
];

function response(command: string, partial: Record<string, unknown> = {}) {
  return {
    ok: true, command, generatedAt: NOW, coverage: "all_sources_ok",
    items: [item(command, 3, { healthTerms: ["health", "vaccin"], title: `${command} force health protection update` }), item(command, 2), item(command, 1, { publishedAt: null })],
    sources: [report(command)], limitations: LIMITATIONS, ...partial,
  };
}

async function openNews(page: Page, handler: (command: string, refresh: boolean) => { status?: number; body?: unknown; contentType?: string }) {
  const requests: Array<{ command: string; refresh: boolean }> = [];
  await routeAorBackend(page);
  await page.route("**/api/aor/cesium-config", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ configured: false, token: "", requiredEnv: "CESIUM_ION_ACCESS_TOKEN" }) }));
  await page.route("**/api/aor/global-watch", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, earthquakes: [], disasters: [] }) }));
  await page.route("**/api/aor/command-news**", (route) => {
    const url = new URL(route.request().url());
    const command = url.searchParams.get("command") ?? "";
    const refresh = url.searchParams.get("refresh") === "1";
    requests.push({ command, refresh });
    const out = handler(command, refresh);
    return route.fulfill({ status: out.status ?? 200, contentType: out.contentType ?? "application/json", body: typeof out.body === "string" ? out.body : JSON.stringify(out.body ?? response(command)) });
  });
  await page.goto("/aor-factors");
  await expect(page.getByTestId("aor-flat-map")).toBeVisible();
  await expect(page.getByTestId("aor-command-chips").getByRole("button")).toHaveCount(6);
  return requests;
}

const openCommandNews = async (page: Page, command: string) => {
  await page.getByTestId(`aor-chip-${command}`).click();
  await page.getByTestId("aor-command-tab-news").click();
};

test("News & publications is a tab on the command panel; Locations remains the default and nothing is fetched until News is opened", async ({ page }) => {
  const requests = await openNews(page, (command) => ({ body: response(command) }));
  await page.getByTestId("aor-chip-EUCOM").click();
  await expect(page.getByTestId("aor-command-tab-locations")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("aor-command-location").first()).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByTestId("aor-command-tab-news").click();
  await expect(page.getByTestId("aor-news")).toBeVisible();
  expect(requests).toEqual([{ command: "EUCOM", refresh: false }]);
  await page.getByTestId("aor-command-tab-locations").click();
  await expect(page.getByTestId("aor-command-location").first()).toBeVisible();
});

test("items link out to the official page, undated items say so, health-related items are marked, and the context-only disclaimer is visible", async ({ page }) => {
  await openNews(page, (command) => ({ body: response(command) }));
  await openCommandNews(page, "EUCOM");
  await expect(page.getByTestId("aor-news-disclaimer")).toContainText("never change a REQUIRED / RECOMMENDED / CONDITIONAL status");
  const items = page.getByTestId("aor-news-item");
  await expect(items).toHaveCount(3);
  const first = items.first();
  await expect(first.getByRole("link")).toHaveAttribute("href", "https://www.eucom.mil/press-release/3");
  await expect(first.getByRole("link")).toHaveAttribute("target", "_blank");
  await expect(first).toContainText("Mentions health, vaccin");
  await expect(first).toContainText("Oct 3, 2026");
  await expect(items.nth(2)).toContainText("No date stated by the source");
  await page.getByTestId("aor-news-health-filter").click();
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId("aor-news-health-filter")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("aor-news-health-filter").click();
  await expect(items).toHaveCount(3);
});

test("source monitoring shows status as text with icon, fetch method, last successful fetch, and the official page link", async ({ page }) => {
  await openNews(page, (command) => ({ body: response(command, { sources: [report(command)] }) }));
  await openCommandNews(page, "AFRICOM");
  const row = page.getByTestId("aor-news-source").first();
  await expect(row).toHaveAttribute("data-status", "ok");
  await expect(row).toContainText("Reachable");
  await expect(row).toContainText("RSS/Atom feed (advertised by the page)");
  await expect(row).toContainText("last successful fetch Oct 11, 2026");
  await expect(row.getByRole("link", { name: /Open the official page/ })).toHaveAttribute("href", "https://www.africom.mil/press-releases");
  await expect(page.getByTestId("aor-news-coverage")).toContainText("1 of 1 USAFRICOM sources returned items");
});

test("partial failure: an unavailable source shows its error, a stale source shows last-known items, and nothing is hidden", async ({ page }) => {
  await openNews(page, (command) => ({
    body: response(command, {
      coverage: "some_sources_unavailable",
      items: [item(command, 2, { lastKnownData: true, freshness: "STALE_CACHE", sourceId: `${command.toLowerCase()}-news`, sourceName: `US${command} news` })],
      sources: [
        report(command, { sourceId: `${command.toLowerCase()}-press-releases`, status: "source_unavailable", httpStatus: 403, itemCount: 0, method: null, feedUrl: null, lastSuccessfulFetch: null, sourceError: "Source returned HTTP 403" }),
        report(command, { sourceId: `${command.toLowerCase()}-news`, sourceName: `US${command} news`, status: "stale_cache", itemCount: 1, lastSuccessfulFetch: "2026-10-09T08:00:00.000Z", sourceError: "Request failed: socket hang up", note: "The latest refresh failed; these are the last items successfully retrieved.", lastKnownData: true }),
      ],
    }),
  }));
  await openCommandNews(page, "INDOPACOM");
  const rows = page.getByTestId("aor-news-source");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("data-status", "source_unavailable");
  await expect(rows.nth(0)).toContainText("Unavailable");
  await expect(rows.nth(0)).toContainText("Source returned HTTP 403");
  await expect(rows.nth(0)).toContainText("last successful fetch never");
  await expect(rows.nth(1)).toHaveAttribute("data-status", "stale_cache");
  await expect(rows.nth(1)).toContainText("Showing last-known items");
  await expect(rows.nth(1)).toContainText("last successful fetch Oct 9, 2026");
  await expect(page.getByTestId("aor-news-item")).toContainText("Last-known item");
});

test("all sources down: no items are invented, the page says that is not evidence of silence, and the official page links remain", async ({ page }) => {
  await openNews(page, (command) => ({
    body: response(command, { coverage: "no_source_available", items: [], sources: [report(command, { status: "source_unavailable", itemCount: 0, method: null, feedUrl: null, lastSuccessfulFetch: null, sourceError: "Request failed: fetch failed" })] }),
  }));
  await openCommandNews(page, "CENTCOM");
  await expect(page.getByTestId("aor-news-none")).toContainText("does not mean the command has published nothing");
  await expect(page.getByTestId("aor-news-item")).toHaveCount(0);
  await expect(page.getByTestId("aor-news-source").getByRole("link", { name: /Open the official page/ })).toHaveAttribute("href", "https://www.centcom.mil/press-releases");
});

test("an unconfirmed page address is labeled as unconfirmed", async ({ page }) => {
  await openNews(page, (command) => ({ body: response(command, { coverage: "no_source_available", items: [], sources: [report(command, { status: "source_unavailable", urlBasis: "expected_not_yet_confirmed", itemCount: 0, method: null, sourceError: "Source returned HTTP 404" })] }) }));
  await openCommandNews(page, "NORTHCOM");
  await expect(page.getByTestId("aor-news-source")).toContainText("has not been confirmed by a response yet");
});

test("service failure: an error (or a non-JSON response) shows an explicit message and Try again recovers", async ({ page }) => {
  let healthy = false;
  const requests = await openNews(page, (command) => (healthy ? { body: response(command) } : { status: 200, contentType: "text/html", body: "<html>SPA fallback</html>" }));
  await openCommandNews(page, "SOUTHCOM");
  await expect(page.getByTestId("aor-news-error")).toContainText("could not be reached");
  await expect(page.getByTestId("aor-news-error")).toContainText("says nothing about what the command has published");
  await expect(page.getByTestId("aor-news-item")).toHaveCount(0);
  healthy = true;
  await page.getByTestId("aor-news-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("aor-news-item")).toHaveCount(3);
  expect(requests.length).toBe(2);
});

test("all six commands load their own news; switching command while News is open reloads; Refresh requests a refresh", async ({ page }) => {
  const requests = await openNews(page, (command) => ({ body: response(command) }));
  await openCommandNews(page, "NORTHCOM");
  for (const command of COMMANDS) {
    await page.getByTestId(`aor-chip-${command}`).click();
    await expect(page.getByTestId("aor-news-item").first()).toContainText(`${command} force health protection update`);
    await expect(page.getByTestId("aor-news-coverage")).toContainText(`US${command} sources`);
  }
  expect([...new Set(requests.map((entry) => entry.command))].sort()).toEqual([...COMMANDS].sort());
  const before = requests.length;
  await page.getByTestId("aor-news-refresh").click();
  await expect.poll(() => requests.length).toBe(before + 1);
  expect(requests[requests.length - 1]).toEqual({ command: "INDOPACOM", refresh: true });
});
