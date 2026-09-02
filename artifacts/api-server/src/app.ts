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

// AOR continues to use MapTiler. Keep its deployment key isolated from the
// WarCosts ArcGIS integration so the two map stacks can evolve independently.
app.get("/api/map-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const apiKey = process.env.MAP_TILER_API_KEY?.trim() ?? "";
  res.status(apiKey ? 200 : 503).json({
    configured: Boolean(apiKey),
    apiKey,
  });
});

// WarCosts uses ArcGIS Maps SDK + ArcGIS location services. The key is supplied
// by Render as ARCGIS_API_KEY and is exposed only through this no-store runtime
// config response; it is never baked into the frontend bundle.
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