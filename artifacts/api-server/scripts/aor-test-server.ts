// Minimal API for browser tests: the real AOR command-policy router (location directory, medical applicability) and nothing else.
// Started by artifacts/occu-med-insight-hub/playwright.config.ts so the UI is exercised against the real registry and medical engine.
import express from "express";
import router from "../src/routes/aor-command-policy";
import { countryBoundaries } from "../src/services/aor-intel/geo";

const port = Number(process.env.AOR_TEST_API_PORT ?? 4180);
const app = express();
app.use(express.json());
app.use("/api", router);
app.get("/api/aor/boundaries", (_req, res) => { res.type("application/geo+json").send(JSON.stringify(countryBoundaries)); });
app.get("/health", (_req, res) => { res.json({ ok: true }); });
app.listen(port, "127.0.0.1", () => console.log(`AOR test API on ${port}`));
