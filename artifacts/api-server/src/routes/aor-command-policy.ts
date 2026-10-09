import { Router, type IRouter, type Request, type Response } from "express";
import { resolveCountry } from "../services/aor-intel/geo";
import { assignmentStats, countriesForCommand } from "../services/aor-intel/command-policy/assignments";
import { describeCommandCountry, evaluateCommandTraveler, policyQualifiers } from "../services/aor-intel/command-policy/engine";
import { COMMAND_POLICIES } from "../services/aor-intel/command-policy/policies-data";
import type { CommandId, CommandQuery, Population, TravelKind } from "../services/aor-intel/command-policy/types";

// Combatant Command medical policy is its own rule class. These routes never read host-nation vaccine rules or CDC/WHO guidance.
const router: IRouter = Router();

const POPULATIONS: Population[] = ["us_military", "dod_civilian", "dod_contractor", "dependent", "volunteer", "interagency", "tcn", "local_national", "working_dog"];
const TRAVEL_KINDS: TravelKind[] = ["official_tdy_deployment", "pcs", "leisure", "contingency"];
const COMMANDS: CommandId[] = ["CENTCOM", "AFRICOM", "EUCOM", "INDOPACOM", "SOUTHCOM", "NORTHCOM"];

/** Accepts ISO2 (resolved through the AOR country table) or ISO3. */
function iso3Of(value: unknown): string | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(text)) return text;
  if (/^[A-Z]{2}$/.test(text)) return resolveCountry(text)?.iso3 || null;
  return null;
}
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | null => (allowed.includes(String(value ?? "").toLowerCase() as T) ? (String(value).toLowerCase() as T) : null);
const number = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

// Traveler-scenario evaluation. Pure rule engine: no network, no generated text.
//   /api/aor/command-policy?destination=KW&population=dod_contractor&stayDays=45&component=CJTF-HOA
router.get("/aor/command-policy", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const iso3 = iso3Of(req.query.destination);
  if (!iso3) return res.status(400).json({ ok: false, error: "destination must be a two- or three-letter country code" });
  const now = new Date();
  const query: CommandQuery = {
    iso3,
    population: pick(req.query.population, POPULATIONS),
    stayDays: number(req.query.stayDays),
    travelKind: pick(req.query.travelKind, TRAVEL_KINDS),
    component: req.query.component ? String(req.query.component).slice(0, 40) : null,
    now,
  };
  const { resolution, evaluations, shortStayNote } = evaluateCommandTraveler(query);
  return res.json({
    ok: true,
    generatedAt: now.toISOString(),
    ruleClass: "combatant_command",
    separation: "Combatant Command deployment policy only. Host-nation entry law and CDC/WHO recommendations are separate and are not included here.",
    query,
    answers: describeCommandCountry(iso3, now),
    assignment: resolution.assignment,
    assignmentHistory: resolution.history,
    policy: resolution.policy,
    supersededPolicies: resolution.supersededPolicies,
    commandMedicalPolicyStatus: resolution.commandMedicalPolicyStatus,
    note: resolution.note,
    shortStayNote,
    evaluations: evaluations.map(({ rule, applicability, reasons, missingInputs }) => ({
      ruleId: rule.id,
      domain: rule.domain,
      kind: rule.kind,
      scope: rule.scope,
      title: rule.title,
      applicability,
      reasons,
      missingInputs,
      status: rule.status,
      conditionOrRequirement: rule.conditionOrRequirement,
      thresholdOrRule: rule.thresholdOrRule,
      waiverAuthority: rule.waiverAuthority,
      sourceGaps: rule.sourceGaps,
      sourceSection: rule.sourceSection,
      sourceUrl: rule.sourceUrl,
      verificationStatus: rule.verificationStatus,
    })),
    notice: "'unknown' means an input was missing. A rule that is not triggered is not evidence that the command has no requirement; SOURCE_GAP fields were not extracted from the source.",
  });
});

router.get("/aor/command-policy/registry", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const now = new Date();
  res.json({
    ok: true,
    generatedAt: now.toISOString(),
    ...assignmentStats(),
    commands: COMMANDS.map((command) => ({
      command,
      countries: countriesForCommand(command, true).map((entry) => ({ iso3: entry.iso3, name: entry.name, entityType: entry.entityType, verification: entry.verification })),
      policies: COMMAND_POLICIES.filter((policy) => policy.command === command).map((policy) => ({ ...policy, qualifiers: policyQualifiers(policy, now) })),
    })),
  });
});

export default router;
