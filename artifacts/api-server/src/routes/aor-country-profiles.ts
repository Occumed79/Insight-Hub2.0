import { Router, type IRouter, type Request, type Response } from "express";
import {
  AOR_COUNTRY_PROFILE_SOURCE,
  AOR_COUNTRY_PROFILES,
  getAorCountryProfileByIso2,
} from "../data/aor-country-profiles";
import {
  deriveAorBaselineSignals,
  evaluateDeploymentConditionLens,
} from "../services/aor-country-factor-service";

const router: IRouter = Router();

const BASELINE_LIMITATION =
  "Baseline reviewer orientation from the reviewed country-profile dataset; not a live advisory, meteorology/AQI feed, facility-capacity measure, pharmacy inventory, or evacuation-time estimate.";

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function iso2(value: unknown): string {
  const normalized = text(value, 8).toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

router.get("/aor/country-profile", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const code = iso2(req.query.iso2);
  if (!code) return res.status(400).json({ ok: false, error: "A valid two-letter iso2 value is required." });

  const profile = getAorCountryProfileByIso2(code);
  if (!profile) return res.status(404).json({ ok: false, error: `No reviewed AOR baseline profile exists for ${code}.` });

  return res.json({
    ok: true,
    profile,
    baselineSignals: deriveAorBaselineSignals(profile),
    source: AOR_COUNTRY_PROFILE_SOURCE,
    limitation: BASELINE_LIMITATION,
  });
});

router.get("/aor/country-profiles", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    ok: true,
    profiles: AOR_COUNTRY_PROFILES.map((profile) => ({
      ...profile,
      baselineSignals: deriveAorBaselineSignals(profile),
    })),
    source: AOR_COUNTRY_PROFILE_SOURCE,
    limitation: BASELINE_LIMITATION,
  });
});

router.post("/aor/country-condition-lens", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const code = iso2(req.body?.iso2);
  if (!code) return res.status(400).json({ ok: false, error: "A valid two-letter iso2 value is required." });

  const condition = text(req.body?.condition, 180);
  const medication = text(req.body?.medication, 180);
  const workContext = text(req.body?.workContext, 260);
  if (!condition && !medication && !workContext) {
    return res.status(400).json({ ok: false, error: "Provide condition, medication, or workContext." });
  }

  const profile = getAorCountryProfileByIso2(code);
  if (!profile) return res.status(404).json({ ok: false, error: `No reviewed AOR baseline profile exists for ${code}.` });

  return res.json({
    ok: true,
    iso2: profile.iso2,
    country: profile.country,
    classification: "Reviewer consideration — not a determination",
    considerations: evaluateDeploymentConditionLens({ profile, condition, medication, workContext }),
    source: AOR_COUNTRY_PROFILE_SOURCE,
    limitation: BASELINE_LIMITATION,
  });
});

export default router;
