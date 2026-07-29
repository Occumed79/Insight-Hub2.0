import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const SOURCE_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

type CachedGeometry = {
  value: unknown;
  expiresAt: number;
  staleUntil: number;
};

let cache: CachedGeometry | null = null;
let inFlight: Promise<unknown> | null = null;

async function readLimitedJson(): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(SOURCE_URL, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "application/json",
        "User-Agent": "Occu-Med Insight Hub/2.0 state-map geometry",
      },
    });
    if (!response.ok) throw new Error(`State geometry source returned HTTP ${response.status}`);

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 3_000_000) {
      throw new Error("State geometry response exceeded the safety limit");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 3_000_000) {
      throw new Error("State geometry response exceeded the safety limit");
    }

    const payload = JSON.parse(new TextDecoder().decode(buffer)) as Record<string, unknown>;
    const objects = payload?.objects as Record<string, unknown> | undefined;
    if (!payload || payload.type !== "Topology" || !objects?.states) {
      throw new Error("State geometry source returned an invalid topology");
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function loadGeometry(): Promise<{ value: unknown; stale: boolean }> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return { value: cache.value, stale: false };

  if (!inFlight) inFlight = readLimitedJson();
  try {
    const value = await inFlight;
    cache = {
      value,
      expiresAt: Date.now() + 24 * 60 * 60_000,
      staleUntil: Date.now() + 7 * 24 * 60 * 60_000,
    };
    return { value, stale: false };
  } catch (error) {
    if (cache && cache.staleUntil > now) return { value: cache.value, stale: true };
    throw error;
  } finally {
    inFlight = null;
  }
}

router.get("/core-intelligence/state-map-geometry", async (_req: Request, res: Response) => {
  try {
    const loaded = await loadGeometry();
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("X-Geometry-Cache", loaded.stale ? "stale" : "fresh");
    return res.json(loaded.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load state map geometry";
    return res.status(502).json({ error: message.slice(0, 240) });
  }
});

export default router;
