import { OCR_SOURCE_DOCUMENT_REGISTRY } from "../services/aor-intel/command-policy/ocr-source-documents";
import { Router, type IRouter, type Request, type Response } from "express";
import { resolveCountry } from "../services/aor-intel/geo";
import { assignmentStats, countriesForCommand, resolveLocation } from "../services/aor-intel/command-policy/assignments";
import { AOR_COUNTRY_PROFILES } from "../data/aor-country-profiles";
import { auditRegistry } from "../services/aor-intel/command-policy/audit";
import { gapSummary } from "../services/aor-intel/command-policy/source-gaps";
import { describeCommandCountry, evaluateCommandTraveler, policyQualifiers } from "../services/aor-intel/command-policy/engine";
import { RESEARCH_EVIDENCE, DSCA_SECURITY_COOPERATION } from "../services/aor-intel/command-policy/verified-research";
import { COMMAND_POLICIES } from "../services/aor-intel/command-policy/policies-data";
import type { CommandId, CommandQuery, Population, TravelKind } from "../services/aor-intel/command-policy/types";

// Combatant Command medical policy is its own rule class. These routes never read host-nation vaccine rules or CDC/WHO guidance.
const router: IRouter = Router();

const POPULATIONS: Population[] = ["us_military", "dod_civilian", "dod_contractor", "dependent", "volunteer", "interagency", "tcn", "local_national", "working_dog"];
const TRAVEL_KINDS: TravelKind[] = ["official_tdy_deployment", "pcs", "leisure", "contingency"];
const COMMANDS: CommandId[] = ["CENTCOM", "AFRICOM", "EUCOM", "INDOPACOM", "SOUTHCOM", "NORTHCOM"];

/** Accepts ISO2 (resolved through the AOR country table), ISO3, or a directory record id / constituent name (e.g. "GEO:UNITED_STATES_HAWAII", "Hawaii"). */
function iso3Of(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const text = raw.toUpperCase();
  if (/^[A-Z]{3}$/.test(text)) return text;
  if (/^[A-Z]{2}$/.test(text)) return resolveCountry(text)?.iso3 || null;
  const found = raw ? resolveLocation(raw) : null;
  return found && found.status === "resolved" ? found.record.iso3 : null;
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
    civilianCategory: pick(req.query.civilianCategory, ["emergency_essential", "non_combat_essential", "expeditionary", "other"] as const),
    contractorAuthorization: pick(req.query.contractorAuthorization, ["caaf", "non_caaf"] as const),
    contractRequirementsApply: req.query.contractRequirementsApply === "true" ? true : req.query.contractRequirementsApply === "false" ? false : null,
    permanentAssignmentIso3: req.query.permanentAssignmentIso3 === "NONE" ? "NONE" : iso3Of(req.query.permanentAssignmentIso3),
    onDeploymentOrders: req.query.onDeploymentOrders === "true" ? true : req.query.onDeploymentOrders === "false" ? false : null,
    highRiskOrLiveFire: req.query.highRiskOrLiveFire === "true" ? true : req.query.highRiskOrLiveFire === "false" ? false : null,
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
      issuingAuthority: rule.issuingAuthority,
      lastRetrievedAt: rule.lastRetrievedAt,
      sourceDate: rule.sourceDate,
      sourceDocumentId: rule.sourceDocumentId,
      caveats: rule.caveats,
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
    researchEvidence: RESEARCH_EVIDENCE,
    securityCooperation: DSCA_SECURITY_COOPERATION,
    ocrSourceDocuments: OCR_SOURCE_DOCUMENT_REGISTRY,
    commands: COMMANDS.map((command) => ({
      command,
      countries: countriesForCommand(command, true).map((entry) => ({ iso3: entry.iso3, name: entry.name, entityType: entry.entityType, verification: entry.verification, geographicClass: entry.geographicClass, evidenceClass: entry.directory?.evidenceClass ?? null, provisional: entry.directory?.provisional ?? false })),
      policies: COMMAND_POLICIES.filter((policy) => policy.command === command).map((policy) => ({ ...policy, qualifiers: policyQualifiers(policy, now) })),
    })),
  });
});

// Geographic location lookup: one location → one primary geographic AOR. A split ISO parent (US, UM, TF) returns its constituents, never a command.
//   /api/aor/command-policy/location?q=Hawaii
router.get("/aor/command-policy/location", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const q = String(req.query.q ?? "").trim().slice(0, 120);
  if (!q) return res.status(400).json({ ok: false, error: "q must name a country, territory or constituent location" });
  const found = resolveLocation(q);
  if (found.status === "resolved") {
    const record = found.record;
    return res.json({ ok: true, status: "resolved", via: found.via, location: { id: record.iso3, name: record.name, command: record.command, geographicClass: record.geographicClass, evidenceClass: record.directory?.evidenceClass ?? null, provisional: record.directory?.provisional ?? false, parentIso3: record.directory?.parentIso3 ?? null }, assignment: record });
  }
  if (found.status === "ambiguous_parent") return res.status(200).json({ ok: true, status: "ambiguous_parent", message: found.ambiguity.message, parent: { iso2: found.ambiguity.parentIso2, iso3: found.ambiguity.parentIso3, name: found.ambiguity.parentName }, constituents: found.ambiguity.constituents });
  return res.status(404).json({ ok: false, status: "not_found", error: "No directory location matches. Supply a more specific country, territory or island name." });
});

// Registry integrity audit: unique current counts, duplicates, history, unmapped places.
router.get("/aor/command-policy/audit", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, generatedAt: new Date().toISOString(), ...auditRegistry(AOR_COUNTRY_PROFILES.map((entry) => ({ iso3: entry.iso3, country: entry.country }))) });
});

// Source-gap ledger: what the original sources resolved and what stays LIVE VERIFY.
router.get("/aor/command-policy/gaps", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, generatedAt: new Date().toISOString(), ...gapSummary() });
});

export default router;
