// Connects the existing live CDC / WHO adapters to the medical-applicability resolver.
//
// Nothing here collects data or writes recommendations. It maps the evidence records the existing adapters already produce
// (cdc-travelers-health, cdc-travel-notices, who-don) into the resolver's public-health input, carrying each record's source
// wording, URL, freshness and fetch metadata. Records that are not recommendations (for example per-disease exposure context)
// are counted, not converted. Public-health guidance never becomes REQUIRED and never replaces a command-policy rule.

import { collectPublicHealthSources, type IntelDeps } from "./aggregate";
import { resolveCountry } from "./geo";
import { resolveLocation } from "./command-policy/assignments";
import {
  resolveMedicalApplicability,
  type MedicalApplicabilityQuery, type MedicalApplicabilityResult, type PublicHealthInput, type PublicHealthSourceReport,
} from "./command-policy/medical-applicability";
import type { AdapterResult, EvidenceRecord } from "./types";

const MAX_NOTICES = 8;
const MAX_OUTBREAKS = 5;

const newest = (a: EvidenceRecord, b: EvidenceRecord) => (b.publishedAt ?? b.updatedAt ?? "").localeCompare(a.publishedAt ?? a.updatedAt ?? "");

function provenance(record: EvidenceRecord, result: AdapterResult): Partial<PublicHealthInput> {
  return {
    provenance: "live_adapter",
    adapterSourceId: result.sourceId,
    evidenceRecordId: record.id,
    freshness: record.freshness,
    retrievedAt: record.retrievedAt,
    sourceUpdatedAt: record.updatedAt ?? result.sourceUpdatedAt ?? null,
    lastSuccessfulFetch: result.lastSuccessfulFetch ?? null,
    sourceStatus: result.status,
    lastKnownData: result.status === "stale_cache" || record.extra?.lastKnownData === true,
    evidenceText: record.evidence,
    geographyNote: record.geographyNote,
  };
}

/** Maps one adapter record to a public-health input, or null when the record is not a recommendation / notice. */
export function publicHealthInputFromRecord(record: EvidenceRecord, result: AdapterResult): PublicHealthInput | null {
  const base = { id: record.id, authority: record.sourceName, url: record.sourceUrl, publishedAt: record.publishedAt ?? record.updatedAt, ...provenance(record, result) };

  if (record.category === "routine_vaccine" || record.category === "travel_vaccine") {
    if (!record.recommendationType) return null;
    return { ...base, topic: record.title, category: "immunization", kind: "recommendation", recommendation: record.evidence || record.summary, recommendationType: record.recommendationType };
  }
  if (record.category === "entry_requirement") {
    // CDC quotes requirement language for entry; the destination government's own rule is what establishes it.
    return { ...base, topic: record.title, category: "immunization", kind: "entry_requirement_language", recommendation: record.evidence || record.summary, condition: "the destination government's own rule confirms the entry requirement this guidance describes" };
  }
  if (record.category === "malaria") {
    const model = (record.extra?.malaria ?? {}) as { riskScope?: string };
    const scope = model.riskScope;
    return {
      ...base, topic: record.title, category: "malaria_chemoprophylaxis", kind: "recommendation", recommendation: record.evidence || record.summary,
      recommendationType: record.recommendationType,
      sourceStatesNoRisk: scope === "none_stated",
      condition: scope === "parts_of_country" ? "travel to the malaria-risk areas the source names" : scope === "unspecified" ? "the source text did not state the risk area; confirm against the source" : null,
    };
  }
  if (record.category === "travel_health_notice") {
    return { ...base, topic: record.title, category: "other", kind: "notice", recommendation: `${record.severity ? `${record.severity}. ` : ""}${record.evidence || record.summary}`, condition: "the notice's affected area or event applies to the itinerary (the notice may concern only part of the country)" };
  }
  if (record.category === "disease_outbreak_news") {
    return { ...base, topic: record.title, category: "other", kind: "outbreak", recommendation: record.evidence || record.summary, condition: "the outbreak's affected area or event applies to the itinerary (matched to the country by text)" };
  }
  return null; // destination_disease_risk and other context records are exposure context, not recommendations
}

export function publicHealthFromAdapterResults(results: AdapterResult[]): { inputs: PublicHealthInput[]; sources: PublicHealthSourceReport[] } {
  const inputs: PublicHealthInput[] = [];
  const sources: PublicHealthSourceReport[] = [];
  for (const result of results) {
    let records = result.records;
    if (result.sourceId === "cdc-travel-notices") records = [...records].sort(newest).slice(0, MAX_NOTICES);
    if (result.sourceId === "who-don") records = [...records].sort(newest).slice(0, MAX_OUTBREAKS);
    const mapped = records.map((record) => publicHealthInputFromRecord(record, result)).filter((value): value is PublicHealthInput => value !== null);
    inputs.push(...mapped);
    sources.push({
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      sourceUrl: result.sourceUrl,
      status: result.status,
      freshness: result.freshness,
      retrievedAt: result.retrievedAt ?? null,
      lastAttemptedFetch: result.lastAttemptedFetch ?? null,
      lastSuccessfulFetch: result.lastSuccessfulFetch ?? null,
      sourceUpdatedAt: result.sourceUpdatedAt ?? null,
      sourceError: result.sourceError ?? null,
      note: result.note,
      recordCount: result.records.length,
      itemsMapped: mapped.length,
      recordsNotMapped: result.records.length - mapped.length,
    });
  }
  return { inputs, sources };
}

export interface LiveMedicalOptions {
  /** Defaults to true. When false, only caller-supplied public-health input is used. */
  livePublicHealth?: boolean;
  timeoutMs?: number;
}

/**
 * The unified resolver plus automatically supplied CDC / WHO guidance. Caller-supplied `publicHealth` items are kept (and win on id
 * collisions); live items are added. If an adapter is unavailable the layer reports it explicitly and evaluation continues.
 */
export async function resolveMedicalApplicabilityWithPublicHealth(
  query: MedicalApplicabilityQuery, deps: IntelDeps | null, options: LiveMedicalOptions = {},
): Promise<MedicalApplicabilityResult> {
  const supplied = query.publicHealth ?? [];
  const located = resolveLocation(query.destination);
  const iso2 = located.status === "resolved" ? located.record.directory?.iso2 ?? null : null;
  if (options.livePublicHealth === false || !deps || !iso2) return resolveMedicalApplicability(query);

  let sources: PublicHealthSourceReport[];
  let live: PublicHealthInput[] = [];
  if (!resolveCountry(iso2)) {
    sources = [{ sourceId: "public-health-adapters", sourceName: "CDC / WHO adapters", sourceUrl: "", status: "not_evaluated", freshness: null, retrievedAt: null, lastAttemptedFetch: null, lastSuccessfulFetch: null, sourceUpdatedAt: null, sourceError: null, note: `No country mapping for ${iso2} in the public-health adapters.`, recordCount: 0, itemsMapped: 0, recordsNotMapped: 0 }];
  } else {
    let results: AdapterResult[] | null = null;
    let failure: string | null = null;
    try {
      results = await collectPublicHealthSources(iso2, deps, { timeoutMs: options.timeoutMs });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (results) {
      const mapped = publicHealthFromAdapterResults(results);
      live = mapped.inputs;
      sources = mapped.sources;
    } else {
      sources = [{ sourceId: "public-health-adapters", sourceName: "CDC / WHO adapters", sourceUrl: "", status: "source_unavailable", freshness: null, retrievedAt: null, lastAttemptedFetch: null, lastSuccessfulFetch: null, sourceUpdatedAt: null, sourceError: failure ?? "adapters returned nothing", note: null, recordCount: 0, itemsMapped: 0, recordsNotMapped: 0 }];
    }
  }
  const have = new Set(supplied.map((input) => input.id));
  const merged = [...supplied.map((input) => ({ ...input, provenance: input.provenance ?? ("caller_supplied" as const) })), ...live.filter((input) => !have.has(input.id))];
  return resolveMedicalApplicability({ ...query, publicHealth: merged, publicHealthSources: sources });
}
