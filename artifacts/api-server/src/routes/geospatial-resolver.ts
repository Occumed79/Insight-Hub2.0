import { Router, type IRouter } from "express";
import { geospatialCache, geospatialCacheAvailable } from "../services/geospatial-cache";
import {
  getGeospatialResolverStatus,
  resolveGeospatialBatch,
  resolveGeospatialLocation,
  type GeospatialResolveRequest,
} from "../services/geospatial-resolver";

const router: IRouter = Router();
const KINDS = new Set(["country", "city", "site", "installation", "event"]);

function parseRequest(value: unknown): GeospatialResolveRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const kind = String(input.kind || "").trim();
  const query = String(input.query || "").trim();
  const source = input.sourceCoordinates;
  const sourceCoordinates = source && typeof source === "object" && !Array.isArray(source)
    ? { lat: Number((source as Record<string, unknown>).lat), lon: Number((source as Record<string, unknown>).lon) }
    : undefined;
  if (!KINDS.has(kind) || (!query && !sourceCoordinates)) return null;
  return {
    query,
    kind: kind as GeospatialResolveRequest["kind"],
    expectedCountry: typeof input.expectedCountry === "string" ? input.expectedCountry : undefined,
    expectedIso2: typeof input.expectedIso2 === "string" ? input.expectedIso2 : undefined,
    expectedRegion: typeof input.expectedRegion === "string" ? input.expectedRegion : undefined,
    city: typeof input.city === "string" ? input.city : undefined,
    sourceCoordinates,
    sourceId: typeof input.sourceId === "string" ? input.sourceId : undefined,
    sourceName: typeof input.sourceName === "string" ? input.sourceName : undefined,
    forceRefresh: input.forceRefresh === true,
  };
}

router.post("/geospatial/resolve", async (req, res) => {
  const request = parseRequest(req.body);
  if (!request) {
    res.status(400).json({ ok: false, error: "A valid geospatial request is required." });
    return;
  }
  try {
    const resolution = await resolveGeospatialLocation(request, { cache: geospatialCache });
    res.status(200).json({ ok: true, resolution });
  } catch (error) {
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : "Geospatial resolver failed." });
  }
});

router.post("/geospatial/resolve-batch", async (req, res) => {
  const raw = Array.isArray(req.body?.requests) ? req.body.requests : [];
  if (!raw.length || raw.length > 250) {
    res.status(400).json({ ok: false, error: "Batch requests must contain between 1 and 250 items." });
    return;
  }
  const requests = raw.map(parseRequest);
  if (requests.some((item) => !item)) {
    res.status(400).json({ ok: false, error: "Every batch item must be a valid geospatial request." });
    return;
  }
  try {
    const resolutions = await resolveGeospatialBatch(requests as GeospatialResolveRequest[], { cache: geospatialCache });
    res.status(200).json({ ok: true, resolutions });
  } catch (error) {
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : "Geospatial batch resolver failed." });
  }
});

router.get("/geospatial/status", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    ...getGeospatialResolverStatus(),
    cache: { available: await geospatialCacheAvailable() },
  });
});

export default router;
