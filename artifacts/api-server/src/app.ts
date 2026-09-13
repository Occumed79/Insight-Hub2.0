import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

// Serper has been retired from Insight Hub 2. Clear any stale Render value so
// older provider code cannot reactivate it accidentally.
delete process.env.SERPER_API_KEY;

// Exa and Tavily are intentionally scoped to company-location discovery only.
// Copy their Render-provided values to internal location-only names, then remove
// the public env names so legacy/general intelligence code cannot consume them.
const locationOnlyKeyNames = [
  "EXA_API_KEY",
  "EXA_API_KEY_2",
  "EXA_API_KEY_3",
  "EXA_API_KEY_4",
  "TAVILY_API_KEY",
  "TAVILY_API_KEY_2",
  "TAVILY_API_KEY_3",
  "TAVILY_API_KEY_4",
] as const;

for (const keyName of locationOnlyKeyNames) {
  const value = process.env[keyName]?.trim();
  if (value) process.env[`LOCATION_${keyName}`] = value;
  delete process.env[keyName];
}

const app: Express = express();
const requestBodyLimit = process.env["REQUEST_BODY_LIMIT"] || "25mb";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "insight-hub-2", awake: true });
});

app.head("/api/health", (_req, res) => {
  res.status(200).end();
});

// AOR uses its own MapTiler key so health/risk mapping can be managed
// independently from the Defense globe.
app.get("/api/map-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const apiKey = process.env.MAP_TILER_API_KEY?.trim() ?? "";
  res.status(apiKey ? 200 : 503).json({
    configured: Boolean(apiKey),
    apiKey,
    sdkVersion: "4.0.2",
    provider: "MapTiler",
  });
});

// Defense 3D/globe rendering uses the separately provisioned second MapTiler
// key. Keep this runtime-only so the credential is never baked into a bundle.
app.get("/api/war-costs/map-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const apiKey = process.env.MAP_TILER_API_KEY_2?.trim() ?? "";
  res.status(apiKey ? 200 : 503).json({
    configured: Boolean(apiKey),
    apiKey,
    sdkVersion: "4.0.2",
    provider: "MapTiler",
  });
});

// Keep the existing ArcGIS 2D renderer available as the Defense map's flat
// operational view while the MapTiler globe provides the 3D spatial view.
app.get("/api/war-costs/arcgis-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const apiKey = process.env.ARCGIS_API_KEY?.trim() ?? "";
  res.status(apiKey ? 200 : 503).json({
    configured: Boolean(apiKey),
    apiKey,
    sdkVersion: "5.1",
    provider: "ArcGIS",
  });
});

app.use("/api", router);

// Serve the built React frontend for all non-API routes
const frontendPath = path.resolve(
  fileURLToPath(new URL("../../occu-med-insight-hub/dist/public", import.meta.url)),
);

if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((_req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

export default app;