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

// The AOR workspace uses the MapTiler browser SDK. Keep the deployment key in
// Render and expose it only through this no-store config route, matching the
// Exam Reviewer implementation the key was transferred from.
app.get("/api/map-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const apiKey = process.env.MAP_TILER_API_KEY?.trim() ?? "";
  res.status(apiKey ? 200 : 503).json({
    configured: Boolean(apiKey),
    apiKey,
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
