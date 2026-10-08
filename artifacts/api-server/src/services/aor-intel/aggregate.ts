import {
  cdcGuidanceAdapter, cdcNoticesAdapter, fcdoAdapter, gdacsAdapter, medicalAccessAdapter, nasaPowerAdapter,
  pendingAdapters, stateAdvisoryAdapter, usgsAdapter, whoOutbreaksAdapter,
} from "./adapters";
import { whoFluNetAdapter, whoGhoAdapter, whoImmunizationAdapter, yellowBookAdapter } from "./adapters-health";
import { createRuleSourceMonitor, entryRequirementsAdapter } from "./vaccine-rules/adapter";
import { openAqAdapter, reliefWebAdapter } from "./adapters-hazards";
import type { CacheStore } from "./cache";
import { synthesisProvider } from "./synthesis";
import { resolveCountry } from "./geo";
import { buildObservations, summarize } from "./rules";
import type { AdapterContext, AdapterResult, CountryIntelResponse } from "./types";
import { errorText } from "./util";

type Adapter = { id: string; run: (ctx: AdapterContext, store: CacheStore) => Promise<AdapterResult>; ttlMs: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ADAPTERS: Adapter[] = [
  { id: "cdc-travelers-health", run: cdcGuidanceAdapter, ttlMs: 6 * HOUR },
  { id: "cdc-travel-notices", run: cdcNoticesAdapter, ttlMs: 30 * MINUTE },
  { id: "who-don", run: whoOutbreaksAdapter, ttlMs: HOUR },
  { id: "gdacs", run: gdacsAdapter, ttlMs: 15 * MINUTE },
  { id: "usgs", run: usgsAdapter, ttlMs: 10 * MINUTE },
  { id: "state-travel-advisory", run: stateAdvisoryAdapter, ttlMs: HOUR },
  { id: "fcdo-travel-advice", run: fcdoAdapter, ttlMs: HOUR },
  { id: "nasa-power", run: nasaPowerAdapter, ttlMs: 30 * 24 * HOUR },
  { id: "aor-baseline-profile", run: medicalAccessAdapter, ttlMs: 24 * HOUR },
  { id: "destination-entry-requirements", run: entryRequirementsAdapter, ttlMs: 24 * HOUR },
  { id: "vaccine-rule-source-monitor", run: createRuleSourceMonitor(), ttlMs: 24 * HOUR },
  { id: "who-flunet", run: whoFluNetAdapter, ttlMs: 6 * HOUR },
  { id: "who-immunization", run: whoImmunizationAdapter, ttlMs: 24 * HOUR },
  { id: "who-gho", run: whoGhoAdapter, ttlMs: 7 * 24 * HOUR },
  { id: "openaq", run: openAqAdapter, ttlMs: 15 * MINUTE },
  { id: "reliefweb-ocha", run: reliefWebAdapter, ttlMs: HOUR },
];

const FAILURE = new Set(["source_unavailable", "not_configured"]);
const CACHEABLE = new Set(["ok", "no_current_matching_finding"]);

/** Newest source-stated update / publication date among the records. */
function newestSourceDate(records: AdapterResult["records"]): string | null {
  const dates = records.flatMap((record) => [record.updatedAt, record.publishedAt]).filter((value): value is string => Boolean(value)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Stamp the fetch state every external adapter must retain. */
function withFetchMeta(live: AdapterResult, now: Date, previous: AdapterResult | null, previousRetrievedAt: string | null): AdapterResult {
  const attempted = live.lastAttemptedFetch ?? now.toISOString();
  const succeeded = CACHEABLE.has(live.status);
  return {
    ...live,
    lastAttemptedFetch: attempted,
    lastSuccessfulFetch: succeeded ? live.lastSuccessfulFetch ?? attempted : live.lastSuccessfulFetch ?? previous?.lastSuccessfulFetch ?? previousRetrievedAt,
    sourceStatus: live.status,
    sourceError: succeeded ? null : live.sourceError ?? live.note,
    sourceUpdatedAt: newestSourceDate(live.records) ?? previous?.sourceUpdatedAt ?? null,
  };
}

async function runWithCache(adapter: Adapter, ctx: AdapterContext, store: CacheStore): Promise<AdapterResult> {
  const key = `aor-intel:v3:${adapter.id}:${ctx.country.iso2}`;
  const now = ctx.now();
  const cached = await store.get<AdapterResult>(key);
  if (cached && Date.parse(cached.expiresAt) > now.getTime()) return cached.payload;

  let live: AdapterResult;
  try {
    live = await adapter.run(ctx, store);
  } catch (error) {
    live = { sourceId: adapter.id, sourceName: adapter.id, sourceUrl: "", dimension: "multi", status: "source_unavailable", freshness: null, retrievedAt: now.toISOString(), note: errorText(error), records: [] };
  }
  live = withFetchMeta(live, now, cached?.payload ?? null, cached?.retrievedAt ?? null);

  if (CACHEABLE.has(live.status)) {
    await store.set(key, live, adapter.ttlMs, now);
    return live;
  }
  if (FAILURE.has(live.status) && cached) {
    // Live refresh failed: serve the previous copy, but never let it pass as current.
    const stale = cached.payload;
    const lastGood = stale.lastSuccessfulFetch ?? cached.retrievedAt;
    return {
      ...stale,
      status: "stale_cache",
      sourceStatus: live.status,
      sourceError: live.note || "source unavailable",
      lastAttemptedFetch: live.lastAttemptedFetch,
      lastSuccessfulFetch: lastGood,
      freshness: "STALE_CACHE",
      note: `Live refresh failed (${live.note || "source unavailable"}). Showing last-known data retrieved ${cached.retrievedAt}.`,
      records: stale.records.map((record) => ({ ...record, freshness: "STALE_CACHE" as const, extra: { ...record.extra, originalFreshness: record.freshness, cachedRetrievedAt: cached.retrievedAt, lastKnownData: true } })),
    };
  }
  return live;
}

export interface IntelDeps {
  store: CacheStore;
  internalJson: AdapterContext["internalJson"];
  externalJson: AdapterContext["externalJson"];
  env: AdapterContext["env"];
  probeUrl?: AdapterContext["probeUrl"];
  now?: () => Date;
}

export async function buildCountryIntel(iso2: string, deps: IntelDeps): Promise<CountryIntelResponse | null> {
  const country = resolveCountry(iso2);
  if (!country) return null;
  const now = deps.now ?? (() => new Date());
  const ctx: AdapterContext = { country, now, internalJson: deps.internalJson, externalJson: deps.externalJson, env: deps.env, probeUrl: deps.probeUrl };

  const live = await Promise.all(ADAPTERS.map((adapter) => runWithCache(adapter, ctx, deps.store)));
  // Stage 2: the Yellow Book reference attaches only to items the live sources already returned for this country.
  const reference = await yellowBookAdapter(ctx, live.flatMap((result) => result.records)).catch((error): AdapterResult => ({ sourceId: "yellow-book-reference", sourceName: "CDC Yellow Book 2026 (reference chapters)", sourceUrl: "https://www.cdc.gov/yellow-book/", dimension: "multi", status: "source_unavailable", freshness: null, retrievedAt: now().toISOString(), note: errorText(error), records: [] }));
  const results = [...live, reference, ...pendingAdapters(ctx)];
  const observations = buildObservations(country, results, now());
  const evidence = [...live, reference].flatMap((result) => result.records);

  return {
    ok: true,
    country,
    generatedAt: now().toISOString(),
    whatMattersNow: { method: "deterministic-rules", llmSynthesis: synthesisProvider(deps.env) ? "available" : "not_configured", summary: summarize(country, observations), observations },
    sources: results.map(({ records, ...rest }) => ({ ...rest, recordCount: records.length })),
    evidence,
    limitations: [
      "No finding does not mean no risk: check each source's status (no current matching finding, source returned no data, source unavailable, not evaluated).",
      "Recommendations (CDC/WHO) and legal entry requirements are separate evidence types and are never merged.",
      "Geography is drawn only as precisely as the source supports; text-only geography is listed, not mapped.",
      "Climatology is historical context at a reference point, not current weather. Influenza surveillance is weekly and reporting-lagged; immunization coverage and health-system indicators are annual national figures; air quality is the latest reading at individual stations.",
      "The summary is assembled by deterministic rules from retrieved evidence. The optional AI briefing may only restate cited evidence records; anything it cannot ground is discarded.",
    ],
  };
}
