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

    // Recommendation and entry-requirement language must match the cited evidence types.
    const claimsRequirement = /\b(?:entry requirement|required for entry|proof of vaccination is required|must (?:show|present)|mandatory)\b/i.test(text);
    const claimsRecommendation = /\brecommend/i.test(text);
    if (claimsRequirement && !cited.some((record) => record.requirementType && record.requirementType !== "not_required")) { continue; }
    if (claimsRecommendation && !claimsRequirement && cited.every((record) => record.requirementType && !record.recommendationType)) { continue; }

    kept.push({ text, evidenceIds: cited.map((record) => record.id) });
    if (kept.length >= MAX_STATEMENTS) break;
  }
  return { statements: kept, discarded: list.length - kept.length };
}

function compactEvidence(evidence: EvidenceRecord[]) {
  return evidence.slice(0, 80).map((record) => ({
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
  "Keep vaccine recommendations (CDC/WHO guidance) and legal entry requirements strictly separate; never call a recommendation a requirement or vice versa.",
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

