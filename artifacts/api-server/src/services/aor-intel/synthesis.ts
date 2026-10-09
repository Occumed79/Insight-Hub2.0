import { createHash } from "node:crypto";
import type { CacheStore } from "./cache";
import type { AdapterContext, CountryRef, EvidenceRecord, Observation, SynthesisResponse, SynthesisStatement } from "./types";
import { errorText } from "./util";

// AI synthesis runs LAST, over already-normalized evidence. The model may only restate
// what the cited records say. Everything it returns is validated; anything that is not
// grounded in cited evidence is discarded. If nothing survives, the UI keeps the
// deterministic summary and says so.

const HOUR = 3_600_000;
const MAX_STATEMENTS = 8;
const REQUIRING = new Set(["entry_required", "entry_required_after_transit", "entry_required_conditional", "exit_required"]);
const REQUIREMENT_WORDS = /\b(?:entry requirement|exit requirement|required for entry|is required|are required|must be (?:vaccinated|immuni[sz]ed)|requires? (?:proof|vaccination|a (?:valid )?certificate)|proof of vaccination is required|must (?:show|present|have|receive)|mandatory|compulsory|obligatory)\b/i;
const ABSENCE_WORDS = /\b(?:not required|no (?:entry |vaccine |vaccination )?requirements?|requirements? (?:was|were|is|are) (?:removed|withdrawn|lifted)|no longer (?:required|mandatory))\b/i;
// Combatant Command deployment policy is its own rule class. These records carry no host-nation requirementType.
const isCommand = (record: EvidenceRecord) => record.extra?.ruleClass === "combatant_command" || record.dimension === "command_policy";
const commandKind = (record: EvidenceRecord) => (record.extra?.commandRule as { kind?: string } | undefined)?.kind ?? null;
const COMMAND_ABSENCE = /\b(?:has|have|there (?:is|are)|with) no (?:\w+[- ]){0,3}(?:polic(?:y|ies)|requirements?|standards?)\b|\bdoes not (?:have|impose|publish) (?:a |any )?(?:\w+[- ]){0,3}(?:polic(?:y|ies)|requirements?)\b/i;
const FORBIDDEN = /\b(?:no risk|risk[- ]free|safe|low[- ]risk|minimal risk|risk score|rated \d|out of (?:10|100))\b/i;

export function synthesisProvider(env: AdapterContext["env"]): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = env("CEREBRAS_API_KEY")?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env("CEREBRAS_BASE_URL") || "https://api.cerebras.ai/v1").replace(/\/$/, ""),
    model: env("CEREBRAS_MODEL") || "gpt-oss-120b",
  };
}

function recordText(record: EvidenceRecord): string {
  return [record.title, record.summary, record.evidence, record.severity, JSON.stringify(record.extra ?? {})].filter(Boolean).join(" ").replace(/,(?=\d{3}\b)/g, "");
}

function numbersIn(text: string): string[] {
  return text.replace(/,(?=\d{3}\b)/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
}

/** Pure validator: returns the statements that are demonstrably grounded in the evidence they cite. */
export function validateStatements(raw: unknown, evidence: EvidenceRecord[]): { statements: SynthesisStatement[]; discarded: number } {
  const byId = new Map(evidence.map((record) => [record.id, record]));
  const list = Array.isArray((raw as { statements?: unknown })?.statements) ? ((raw as { statements: unknown[] }).statements) : [];
  const kept: SynthesisStatement[] = [];
  for (const item of list) {
    const text = typeof (item as { text?: unknown })?.text === "string" ? (item as { text: string }).text.trim() : "";
    const ids = Array.isArray((item as { evidenceIds?: unknown })?.evidenceIds) ? ((item as { evidenceIds: unknown[] }).evidenceIds.filter((id) => typeof id === "string") as string[]) : [];
    const cited = [...new Set(ids)].map((id) => byId.get(id)).filter((record): record is EvidenceRecord => Boolean(record));
    if (!text || text.length > 420 || !cited.length || cited.length !== new Set(ids).size || FORBIDDEN.test(text)) { continue; }

    // Every number must appear in the cited records.
    const haystack = cited.map(recordText).join(" ");
    const haystackNumbers = new Set(numbersIn(haystack));
    if (numbersIn(text).some((value) => !haystackNumbers.has(value))) { continue; }

    // Recommendation and legal-requirement language must match the cited evidence types, in both directions.
    const claimsRequirement = REQUIREMENT_WORDS.test(text);
    const claimsRecommendation = /\brecommend|\badvis(?:e|ed)\b|\bencourag/i.test(text);
    const claimsAbsence = ABSENCE_WORDS.test(text);
    const commandCited = cited.filter(isCommand);
    const otherCited = cited.filter((record) => !isCommand(record));
    // Host-nation law, CDC/WHO guidance and Combatant Command policy are separate rule classes: one statement may not blend them.
    if (commandCited.length && otherCited.some((record) => record.requirementType || record.recommendationType || record.dimension === "health_vaccines" || record.dimension === "malaria") && (claimsRequirement || claimsRecommendation || claimsAbsence)) { continue; }
    if (commandCited.length && COMMAND_ABSENCE.test(text)) { continue; }
    if (commandCited.length && !otherCited.length) {
      // Command-only statement: "required" needs a command requirement; "recommended" needs a command recommendation.
      if (claimsRequirement && !commandCited.some((record) => commandKind(record) === "requirement")) { continue; }
      if (claimsRecommendation && !claimsRequirement && !commandCited.some((record) => commandKind(record) === "recommendation")) { continue; }
    }
    if (claimsRequirement && !commandCited.length && !cited.some((record) => record.requirementType && REQUIRING.has(record.requirementType))) { continue; }
    if (claimsRecommendation && !claimsRequirement && !commandCited.length && cited.every((record) => record.requirementType && !record.recommendationType)) { continue; }
    // "Not required" / "no requirement" only when an authority explicitly said so; a missing record is never evidence of absence.
    if (claimsAbsence && !cited.some((record) => record.requirementType === "not_required")) { continue; }
    // A WHO/IHR recommendation to a State must not be restated as a requirement on travelers.
    if (claimsRequirement && !commandCited.length && cited.every((record) => record.category === "ihr_temporary_recommendation" || (record.recommendationType && !record.requirementType))) { continue; }
    // Low-authority sources (baseline compilations, unverified records) cannot be described as verified or current rules.
    if (/\b(?:verified|confirmed|current requirement)\b/i.test(text) && cited.every((record) => record.requirementType === "not_evaluated" || /OLDER GLOBAL BASELINE|NOT CURRENTLY VERIFIED/.test(String(record.extra?.verificationStatus ?? "")))) { continue; }

    kept.push({ text, evidenceIds: cited.map((record) => record.id) });
    if (kept.length >= MAX_STATEMENTS) break;
  }
  return { statements: kept, discarded: list.length - kept.length };
}

const MAX_COMMAND_RULE_RECORDS = 14;

function compactEvidence(evidence: EvidenceRecord[]) {
  // Keep every command policy / assignment / source-check record, but cap the per-rule detail so it cannot crowd out other sources.
  let commandRules = 0;
  const selected = evidence.filter((record) => record.category !== "command_rule" || (commandRules += 1) <= MAX_COMMAND_RULE_RECORDS);
  return selected.slice(0, 80).map((record) => ({
    ruleClass: record.extra?.ruleClass ?? null,
    commandRuleKind: commandKind(record),
    id: record.id,
    dimension: record.dimension,
    title: record.title.slice(0, 140),
    summary: record.summary.slice(0, 320),
    source: record.sourceName,
    freshness: record.freshness,
    recommendationType: record.recommendationType,
    requirementType: record.requirementType,
    severity: record.severity,
    geography: record.geographyLevel,
    publishedAt: record.publishedAt,
  }));
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["statements"],
  properties: {
    statements: {
      type: "array",
      maxItems: MAX_STATEMENTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidenceIds"],
        properties: { text: { type: "string" }, evidenceIds: { type: "array", minItems: 1, items: { type: "string" } } },
      },
    },
  },
} as const;

const SYSTEM = [
  "You write a short occupational-health briefing for a reviewer, using ONLY the evidence records provided.",
  "Rules: every statement must cite one or more evidence ids from the input in evidenceIds. Do not add facts, numbers, dates, places or causes that are not in the cited records.",
  "Keep vaccine recommendations (CDC/WHO guidance, including WHO IHR temporary recommendations addressed to States) and legal entry/exit requirements strictly separate; never call a recommendation a requirement or vice versa. Say 'no requirement' or 'not required' only when a cited record's requirementType is not_required; when records say 'No current authoritative requirement verified', report exactly that and never convert it to 'not required'.",
  "Records with ruleClass 'combatant_command' are U.S. Combatant Command deployment medical policy for DoD-affiliated travelers: a third class, separate from host-nation entry law and from CDC/WHO guidance. Never combine them in one statement. Name the command and policy; call something required only when commandRuleKind is 'requirement', and report 'NOT PUBLICLY VERIFIED' exactly as written, never as 'no policy'.",
  "Name the freshness of each point in plain words (for example 'weekly surveillance', 'climatological', 'structural reference'). Never describe climatology or annual coverage as current conditions.",
  "Never produce a risk score, rating, ranking, or reassurance such as 'safe' or 'low risk'. Do not infer medical capability from facility counts or national indicators.",
  "Write 3 to 8 statements of at most 45 words each, most decision-relevant first. If the evidence is thin, write fewer statements. Return JSON only.",
].join(" ");

export async function synthesizeCountry(
  country: CountryRef,
  evidence: EvidenceRecord[],
  observations: Observation[],
  deps: { externalJson: AdapterContext["externalJson"]; env: AdapterContext["env"]; store: CacheStore; now?: () => Date },
): Promise<SynthesisResponse> {
  const now = (deps.now ?? (() => new Date()))();
  const base = { ok: true as const, iso2: country.iso2, generatedAt: now.toISOString(), statements: [] as SynthesisStatement[], discarded: 0 };
  const provider = synthesisProvider(deps.env);
  if (!provider) return { ...base, status: "not_configured", model: null, note: "No language-model provider is configured (CEREBRAS_API_KEY). The deterministic evidence-linked summary is shown instead." };
  if (!evidence.length) return { ...base, status: "rejected", model: provider.model, note: "There is no evidence to synthesize." };

  const compact = compactEvidence(evidence);
  const key = `aor-intel:synthesis:v1:${country.iso2}:${createHash("sha1").update(JSON.stringify(compact)).update(provider.model).digest("hex")}`;
  const cached = await deps.store.get<SynthesisResponse>(key);
  if (cached && Date.parse(cached.expiresAt) > now.getTime()) return cached.payload;

  let content: unknown;
  try {
    const payload = (await deps.externalJson(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      timeoutMs: 45_000,
      headers: { Authorization: `Bearer ${provider.apiKey}`, "X-Cerebras-Version-Patch": "2" },
      body: {
        model: provider.model,
        temperature: 0.1,
        reasoning_effort: "low",
        max_completion_tokens: 3000,
        response_format: { type: "json_schema", json_schema: { name: "aor_country_briefing", strict: true, schema: SCHEMA } },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify({ country: country.name, observations: observations.map((o) => ({ kind: o.kind, headline: o.headline, evidenceIds: o.evidenceIds })), evidence: compact }) },
        ],
      },
    })) as { choices?: Array<{ message?: { content?: string } }> };
    content = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
  } catch (error) {
    return { ...base, status: "failed", model: provider.model, note: `Synthesis request failed (${errorText(error)}). The deterministic summary is shown instead.` };
  }

  const { statements, discarded } = validateStatements(content, evidence);
  const response: SynthesisResponse = statements.length
    ? { ...base, status: "applied", model: provider.model, statements, discarded, note: `Generated by ${provider.model} from the cited evidence records only; ${discarded} unsupported statement${discarded === 1 ? "" : "s"} discarded. Verify at the source links.` }
    : { ...base, status: "rejected", model: provider.model, discarded, note: "The model's output failed evidence validation (missing citations, ungrounded numbers, or mixed recommendation/requirement language) and was discarded. The deterministic summary is shown instead." };
  if (response.status === "applied") await deps.store.set(key, response, 6 * HOUR, now);
  return response;
}

