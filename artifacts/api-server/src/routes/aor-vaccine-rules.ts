import { Router, type IRouter, type Request, type Response } from "express";
import { resolveCountry } from "../services/aor-intel/geo";
import { describeCountry, evaluateTraveler, freshnessQualifiers, rulesDueForRevalidation } from "../services/aor-intel/vaccine-rules/engine";
import { VACCINE_RULES } from "../services/aor-intel/vaccine-rules/rules-data";
import { registryStats } from "../services/aor-intel/vaccine-rules/source-registry";
import type { TravelerQuery } from "../services/aor-intel/vaccine-rules/types";

const router: IRouter = Router();
const ISO2 = /^[A-Z]{2}$/;

const code = (value: unknown): string | null => {
  const text = String(value ?? "").trim().toUpperCase();
  return ISO2.test(text) ? text : null;
};
const codes = (value: unknown): string[] => String(value ?? "").split(",").map(code).filter((entry): entry is string => Boolean(entry));
const number = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** transit=KE:14,AE:3 → [{country:"KE",hours:14},{country:"AE",hours:3}] */
function transitLegs(value: unknown): Array<{ country: string; hours: number }> {
  return String(value ?? "").split(",").flatMap((part) => {
    const [country, hours] = part.split(":");
    const iso = code(country);
    const parsed = number(hours);
    return iso && parsed !== null ? [{ country: iso, hours: parsed }] : [];
  });
}

// Traveler-scenario evaluation. Pure rule engine: no network, no generated text.
//   /api/aor/vaccine-rules?destination=SG&arrivingFrom=KE&transit=KE:14&age=34&residentOf=US
router.get("/aor/vaccine-rules", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const destination = code(req.query.destination);
  if (!destination || !resolveCountry(destination)) return res.status(400).json({ ok: false, error: "destination must be a two-letter country code" });
  const now = new Date();
  const query: TravelerQuery = {
    destination,
    arrivingFrom: code(req.query.arrivingFrom),
    visitedCountries: codes(req.query.visited),
    transit: transitLegs(req.query.transit),
    residentOf: code(req.query.residentOf),
    departingFrom: code(req.query.departingFrom),
    ageYears: number(req.query.age),
    stayDays: number(req.query.stayDays),
    event: req.query.event ? String(req.query.event).slice(0, 40) : null,
    seasonalWorker: String(req.query.seasonalWorker ?? "") === "true",
    now,
  };
  const { evaluations, conflicts } = evaluateTraveler(query);
  return res.json({
    ok: true,
    generatedAt: now.toISOString(),
    query,
    answers: describeCountry(destination, now),
    evaluations: evaluations.map(({ rule, applicability, reasons, missingInputs }) => ({
      ruleId: rule.id,
      vaccine: rule.vaccine,
      ruleType: rule.ruleType,
      legalForce: rule.legalForce,
      applicability,
      reasons,
      missingInputs,
      normalizedRule: rule.normalizedRule,
      verificationStatus: rule.verificationStatus,
      qualifiers: freshnessQualifiers(rule, now),
      sourceAuthority: rule.sourceAuthority,
      sourceUrl: rule.sourceUrl,
      sourcePublishedAt: rule.sourcePublishedAt,
      lastVerifiedAt: rule.lastVerifiedAt,
    })),
    conflicts,
    notice: "Evaluations cover only rules on file. 'unknown' means an input was missing or the authority did not state the condition; it is never a statement that no requirement applies.",
  });
});

router.get("/aor/vaccine-rules/coverage", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const now = new Date();
  const byTier: Record<string, number> = {};
  for (const rule of VACCINE_RULES) byTier[rule.verificationStatus] = (byTier[rule.verificationStatus] ?? 0) + 1;
  res.json({
    ok: true,
    generatedAt: now.toISOString(),
    ruleCount: VACCINE_RULES.length,
    byVerificationStatus: byTier,
    registry: registryStats(),
    dueForRevalidation: rulesDueForRevalidation(now).map((rule) => ({ id: rule.id, authority: rule.sourceAuthority, sourceUrl: rule.sourceUrl, lastVerifiedAt: rule.lastVerifiedAt, revalidateAfterDays: rule.revalidateAfterDays })),
  });
});

export default router;
