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
import type { MedicalApplicabilityQuery, PublicHealthInput } from "../services/aor-intel/command-policy/medical-applicability";
import { resolveMedicalApplicabilityWithPublicHealth } from "../services/aor-intel/medical-public-health";
import { liveIntelDeps } from "./aor-country-intel";
import { buildAorDirectory, searchAorDirectory } from "../services/aor-intel/directory";
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

// The workspace's location directory: all registry locations (command, class, evidence class, polygon availability, reference point),
// the split ISO parents, and polygons that carry no record. `?q=` searches names, aliases, ISO codes and split parents.
router.get("/aor/directory", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const q = String(req.query.q ?? "").trim().slice(0, 120);
  if (q) return res.json({ ok: true, query: q, ...searchAorDirectory(q, Math.min(Number(req.query.limit) || 12, 50)) });
  return res.json({ ok: true, generatedAt: new Date().toISOString(), ...buildAorDirectory() });
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

// Unified, assignment-specific medical applicability. Composes the command, host-nation and caller-supplied public-health layers
// without merging them: every item carries its own authority layer and status (REQUIRED / RECOMMENDED / CONDITIONAL / NOT_APPLICABLE / UNKNOWN).
//   GET  /api/aor/medical-applicability?destination=Kuwait&population=dod_contractor&contractorAuthorization=caaf&stayDays=45
//   POST /api/aor/medical-applicability  (JSON body; accepts `publicHealth` guidance from the live CDC/WHO adapters)
const triState = (value: unknown): boolean | null => (value === true || value === "true" ? true : value === false || value === "false" ? false : null);
function medicalQueryFrom(source: Record<string, unknown>): MedicalApplicabilityQuery {
  const list = (value: unknown): string[] => (Array.isArray(value) ? value : typeof value === "string" && value ? value.split(",") : []).map((entry) => String(entry).trim()).filter(Boolean).slice(0, 40);
  const transit = Array.isArray(source.transit)
    ? (source.transit as Array<Record<string, unknown>>).map((leg) => ({ country: String(leg?.country ?? "").slice(0, 3).toUpperCase(), hours: Number(leg?.hours) })).filter((leg) => leg.country && Number.isFinite(leg.hours) && leg.hours >= 0).slice(0, 20)
    : [];
  const publicHealth: PublicHealthInput[] | null = Array.isArray(source.publicHealth)
    ? (source.publicHealth as Array<Record<string, unknown>>).filter((entry) => entry && entry.id && entry.recommendation && entry.url).map((entry) => ({
        id: String(entry.id), topic: String(entry.topic ?? entry.id), category: entry.category as PublicHealthInput["category"], authority: String(entry.authority ?? "Public-health guidance"),
        recommendation: String(entry.recommendation), url: String(entry.url), publishedAt: entry.publishedAt ? String(entry.publishedAt) : null, condition: entry.condition ? String(entry.condition) : null,
      })).slice(0, 60)
    : null;
  const permanent = source.permanentAssignmentIso3 === "NONE" ? "NONE" : source.permanentAssignmentIso3 ? iso3Of(source.permanentAssignmentIso3) : null;
  return {
    destination: String(source.destination ?? "").trim().slice(0, 120),
    installation: source.installation ? String(source.installation).slice(0, 80) : null,
    population: pick(source.population, POPULATIONS),
    civilianCategory: pick(source.civilianCategory, ["emergency_essential", "non_combat_essential", "expeditionary", "other"] as const),
    contractorAuthorization: pick(source.contractorAuthorization, ["caaf", "non_caaf"] as const),
    contractRequirementsApply: triState(source.contractRequirementsApply),
    permanentAssignmentIso3: permanent,
    onDeploymentOrders: triState(source.onDeploymentOrders),
    highRiskOrLiveFire: triState(source.highRiskOrLiveFire),
    stayDays: number(source.stayDays),
    travelKind: pick(source.travelKind, TRAVEL_KINDS),
    component: source.component ? String(source.component).slice(0, 40) : null,
    layoverInYfEndemicCountry: triState(source.layoverInYfEndemicCountry),
    arrivingFrom: source.arrivingFrom ? String(source.arrivingFrom).slice(0, 3).toUpperCase() : null,
    visitedCountries: list(source.visitedCountries).map((entry) => entry.toUpperCase()),
    transit,
    ageYears: number(source.ageYears),
    publicHealth,
    now: new Date(),
  };
}
async function medicalApplicability(source: Record<string, unknown>, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const query = medicalQueryFrom(source);
  if (!query.destination) return res.status(400).json({ ok: false, error: "destination must name a country, territory or constituent location" });
  // CDC / WHO guidance is retrieved through the existing live adapters (same cache and provenance as country-intel) unless disabled.
  const live = !(source.livePublicHealth === false || source.livePublicHealth === "false");
  let result;
  try {
    result = await resolveMedicalApplicabilityWithPublicHealth(query, live ? liveIntelDeps() : null, { livePublicHealth: live });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Medical applicability could not be assembled." });
  }
  return res.status(result.status === "LOCATION_NOT_FOUND" ? 404 : 200).json({ ok: result.status !== "LOCATION_NOT_FOUND", generatedAt: (query.now as Date).toISOString(), ...result });
}
router.get("/aor/medical-applicability", (req: Request, res: Response) => medicalApplicability(req.query as Record<string, unknown>, res));
router.post("/aor/medical-applicability", (req: Request, res: Response) => medicalApplicability((req.body ?? {}) as Record<string, unknown>, res));

export default router;
