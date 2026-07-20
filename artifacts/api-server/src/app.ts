import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const requestBodyLimit = process.env["REQUEST_BODY_LIMIT"] || "25mb";

app.set("trust proxy", 1);

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

const configuredOrigins = new Set(
  String(process.env["CORS_ALLOWED_ORIGINS"] || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
);

if (process.env.NODE_ENV !== "production") {
  configuredOrigins.add("http://localhost:3000");
  configuredOrigins.add("http://localhost:4173");
  configuredOrigins.add("http://localhost:5173");
}

app.use((req, res, next) => {
  const origin = String(req.get("origin") || "").replace(/\/$/, "");
  if (!origin) {
    next();
    return;
  }

  const forwardedProto = String(req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
  const allowed = origin === requestOrigin || configuredOrigins.has(origin);

  if (!allowed) {
    res.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", error: "This origin is not allowed." });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(cookieParser());
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "insight-hub-2", awake: true });
});

app.head("/api/health", (_req, res) => {
  res.status(200).end();
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
