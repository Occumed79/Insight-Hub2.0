import type { Page, Route } from "@playwright/test";

// The browser tests run against the real AOR command-policy router (see api-server/scripts/aor-test-server.ts, started by
// playwright.config.ts). Calls the page makes to /api/aor/directory, /api/aor/boundaries and /api/aor/medical-applicability are
// forwarded to it, so the UI is tested against the real 285-location registry, the real boundary polygons and the real medical engine
// rather than hand-written fixtures. CDC / WHO live retrieval is switched off here (no network in tests); that path is covered by the
// api-server tests. `publicHealth` lets a test hand the real engine CDC-style guidance exactly as the live adapters would supply it.

export const AOR_TEST_API = `http://127.0.0.1:${process.env.AOR_TEST_API_PORT ?? 4180}`;
export type AorCalls = { medical: string[]; directory: string[] };
type Options = { publicHealth?: Array<Record<string, unknown>> };

export async function routeAorBackend(page: Page, options: Options = {}): Promise<AorCalls> {
  const calls: AorCalls = { medical: [], directory: [] };
  const forward = async (route: Route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${AOR_TEST_API}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  };
  await page.route("**/api/aor/directory**", async (route) => { calls.directory.push(new URL(route.request().url()).search); await forward(route); });
  await page.route("**/api/aor/boundaries", (route) => forward(route));
  await page.route("**/api/aor/medical-applicability**", async (route) => {
    const url = new URL(route.request().url());
    calls.medical.push(url.search);
    if (options.publicHealth) {
      const body: Record<string, unknown> = Object.fromEntries(url.searchParams.entries());
      body.livePublicHealth = false;
      body.publicHealth = options.publicHealth;
      const response = await route.fetch({ url: `${AOR_TEST_API}/api/aor/medical-applicability`, method: "POST", headers: { "content-type": "application/json" }, postData: JSON.stringify(body) });
      await route.fulfill({ response });
      return;
    }
    const response = await route.fetch({ url: `${AOR_TEST_API}${url.pathname}${url.search}&livePublicHealth=false` });
    await route.fulfill({ response });
  });
  return calls;
}
