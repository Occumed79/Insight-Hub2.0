import { createHash } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { buildCountryIntel } from "../services/aor-intel/aggregate";
import { createNeonBackedStore } from "../services/aor-intel/cache";
import { countryBoundaries } from "../services/aor-intel/geo";
import { synthesizeCountry } from "../services/aor-intel/synthesis";
import { probeOfficialUrl } from "../services/aor-intel/vaccine-rules/probe";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const store = createNeonBackedStore((error) => logger.warn({ err: error instanceof Error ? error.message : String(error) }, "AOR intel cache store unavailable; using in-process cache"));

const CESIUM_TOKEN_ENV_NAMES = ["CESIUM_ION_ACCESS_TOKEN", "CESIUM_ION_TOKEN", "VITE_CESIUM_ION_TOKEN"] as const;

async function fetchWithTimeout(url: string, init: { headers?: Record<string, string>; timeoutMs?: number; method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 AOR Factors", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function internalJson(path: string): Promise<unknown> {
  const port = process.env.PORT;
  if (!port) throw new Error("PORT is not set; cannot reach internal AOR routes.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(body.error || body.sourceNotice || `Internal route returned HTTP ${response.status}`));
    return body;
  } finally {
    clearTimeout(timer);
  }
}

router.get("/aor/cesium-config", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const found = CESIUM_TOKEN_ENV_NAMES.map((name) => ({ name, value: process.env[name]?.trim() ?? "" })).find((entry) => entry.value);
  res.status(found ? 200 : 503).json({
    configured: Boolean(found),
    token: found?.value ?? "",
    provider: "Cesium ion",
    requiredEnv: "CESIUM_ION_ACCESS_TOKEN",
    ...(found ? {} : { error: "Cesium ion access token is not configured. Set CESIUM_ION_ACCESS_TOKEN on the API service (a public ion token with access to Cesium World Terrain and imagery)." }),
  });
});

let boundaryBody: string | null = null;
let boundaryEtag = "";
router.get("/aor/boundaries", (req: Request, res: Response) => {
  if (!boundaryBody) {
    boundaryBody = JSON.stringify(countryBoundaries);
    boundaryEtag = `"${createHash("sha1").update(boundaryBody).digest("hex")}"`;
  }
  res.setHeader("ETag", boundaryEtag);
  res.setHeader("Cache-Control", "public, max-age=86400");
  if (req.headers["if-none-match"] === boundaryEtag) return res.status(304).end();
  return res.type("application/geo+json").send(boundaryBody);
});

router.get("/aor/country-intel", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const iso2 = String(req.query.iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) return res.status(400).json({ ok: false, error: "iso2 must be a two-letter country code" });
  try {
    const payload = await buildCountryIntel(iso2, { store, internalJson, externalJson: fetchWithTimeout, env: (key) => process.env[key], probeUrl: probeOfficialUrl });
    if (!payload) return res.status(404).json({ ok: false, error: `Unknown country code ${iso2}` });
    return res.json(payload);
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error), iso2 }, "AOR country intel failed");
    return res.status(500).json({ ok: false, error: "Country intelligence could not be assembled." });
  }
});

// AI briefing: runs after the evidence is assembled (cached adapters make this cheap) and is
// validated so that every statement cites evidence records it is actually grounded in.
router.get("/aor/country-intel/synthesis", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const iso2 = String(req.query.iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) return res.status(400).json({ ok: false, error: "iso2 must be a two-letter country code" });
  try {
    const env = (key: string) => process.env[key];
    const intel = await buildCountryIntel(iso2, { store, internalJson, externalJson: fetchWithTimeout, env, probeUrl: probeOfficialUrl });
    if (!intel) return res.status(404).json({ ok: false, error: `Unknown country code ${iso2}` });
    return res.json(await synthesizeCountry(intel.country, intel.evidence, intel.whatMattersNow.observations, { externalJson: fetchWithTimeout, env, store }));
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error), iso2 }, "AOR country synthesis failed");
    return res.status(500).json({ ok: false, error: "The AI briefing could not be produced." });
  }
});

export default router;
