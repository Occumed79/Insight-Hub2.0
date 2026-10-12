import { randomUUID } from "node:crypto";
import { fetchSource, SourceError, type FetchText } from "./adapters";
import { ingestItems } from "./engine";
import { isIngestible, STANDARDS_SOURCES } from "./registry";
import type { RawItem, RunRecord, RunSourceResult, SourceDefinition, SourceState, SourceStatus, StandardsStore } from "./types";

export const SCHEDULE_INTERVAL_MS = 12 * 60 * 60_000; // twice daily
export const SCHEDULED_MIN_GAP_MS = 6 * 60 * 60_000; // a scheduled pass skips a source fetched within the last 6 h (redeploy-storm protection)
export const MANUAL_COOLDOWN_MS = 5 * 60_000; // a source is never fetched more than once per 5 min, however often a refresh is requested
export const FAILED_RETRY_MS = 15 * 60_000;
const LEASE = "standards-intel-refresh";
const LEASE_TTL_MS = 25 * 60_000;
const HOST_DELAY_MS = 300;

export interface ServiceDeps {
  store: StandardsStore;
  fetchText: FetchText;
  sources?: SourceDefinition[];
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (fields: Record<string, unknown>, message: string) => void;
}

const nowOf = (deps: ServiceDeps) => (deps.now ?? (() => new Date()))();
const sleepOf = (deps: ServiceDeps) => deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const registry = (deps: ServiceDeps) => deps.sources ?? STANDARDS_SOURCES;

export function blankState(source: SourceDefinition, now: Date): SourceState {
  return {
    sourceId: source.id, status: "pending_verification", statusReason: source.pendingReason ?? "Not yet fetched.", lastAttemptAt: null, lastSuccessAt: null, lastItemAt: null, latestItemTitle: null,
    lastError: null, httpStatus: null, consecutiveFailures: 0, itemsSeen: 0, baselineAt: null, verifiedAt: null, updatedAt: now.toISOString(),
  };
}

function latestOf(items: RawItem[]): { at: string | null; title: string | null } {
  let best: RawItem | null = null;
  const key = (item: RawItem) => item.publishedAt ?? item.modifiedAt ?? "";
  for (const item of items) if (key(item) && (!best || key(item) > key(best))) best = item;
  return best ? { at: key(best), title: best.title } : { at: null, title: items[0]?.title ?? null };
}

export function applySuccess(state: SourceState, items: RawItem[], partialErrors: string[], now: Date): SourceState {
  const latest = latestOf(items);
  let status: SourceStatus = "active";
  let reason: string | null = null;
  if (partialErrors.length) { status = "degraded"; reason = `${partialErrors.length} part(s) of this source could not be read: ${partialErrors.slice(0, 3).join(" | ")}`; }
  else if (!items.length && state.itemsSeen > 0) { status = "degraded"; reason = `The endpoint parsed but returned no items; ${state.itemsSeen} were returned previously.`; }
  else if (!items.length) reason = "The endpoint parsed successfully but currently lists no items.";
  return {
    ...state, status, statusReason: reason, lastAttemptAt: now.toISOString(), lastSuccessAt: now.toISOString(), verifiedAt: state.verifiedAt ?? now.toISOString(),
    lastItemAt: latest.at ?? state.lastItemAt, latestItemTitle: latest.title ?? state.latestItemTitle, lastError: partialErrors.length ? partialErrors[0]! : null, consecutiveFailures: 0,
    itemsSeen: items.length, baselineAt: state.baselineAt ?? now.toISOString(), updatedAt: now.toISOString(),
  };
}

export function applyFailure(state: SourceState, error: unknown, now: Date): SourceState {
  const message = error instanceof Error ? error.message : String(error);
  const failures = state.consecutiveFailures + 1;
  const neverVerified = !state.lastSuccessAt;
  // A source that has worked before degrades first; one that has never been verified is reported unavailable straight away.
  const status: SourceStatus = neverVerified || failures >= 3 ? "unavailable" : "degraded";
  return {
    ...state, status, lastAttemptAt: now.toISOString(), lastError: message, httpStatus: error instanceof SourceError ? error.httpStatus : null, consecutiveFailures: failures,
    statusReason: neverVerified ? `Not verified: ${message}` : failures >= 3 ? `Unavailable after ${failures} consecutive failures: ${message}` : `Last attempt failed: ${message}`, updatedAt: now.toISOString(),
  };
}

async function withRetry<T>(deps: ServiceDeps, run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await run(); } catch (error) {
      lastError = error;
      const retryable = !(error instanceof SourceError) || error.retryable;
      if (!retryable || attempt === 1) break;
      await sleepOf(deps)(1500);
    }
  }
  throw lastError;
}

export interface RefreshOptions { trigger: RunRecord["trigger"]; sourceIds?: string[]; agency?: string; force?: boolean }

async function refreshSource(deps: ServiceDeps, source: SourceDefinition, opts: RefreshOptions): Promise<RunSourceResult> {
  const started = Date.now();
  const now = nowOf(deps);
  const base = { sourceId: source.id, items: 0, created: 0, revised: 0, events: 0, filteredOut: 0, httpStatus: null as number | null };
  const state = (await deps.store.getSourceState(source.id)) ?? blankState(source, now);

  if (!isIngestible(source)) {
    await deps.store.saveSourceState({ ...state, status: "pending_verification", statusReason: source.pendingReason ?? "No endpoint registered.", updatedAt: now.toISOString() });
    return { ...base, outcome: "not_ingestible", reason: source.pendingReason ?? "No endpoint registered.", durationMs: 0 };
  }
  if (state.lastAttemptAt) {
    const age = now.getTime() - Date.parse(state.lastAttemptAt);
    const failedLast = state.consecutiveFailures > 0;
    const gap = opts.trigger === "manual" ? MANUAL_COOLDOWN_MS : failedLast ? FAILED_RETRY_MS : SCHEDULED_MIN_GAP_MS;
    if (age < gap) {
      return { ...base, outcome: "skipped", reason: `Fetched ${Math.round(age / 1000)} s ago; the minimum interval is ${Math.round(gap / 60_000)} min.`, durationMs: 0 };
    }
  }
  try {
    const result = await withRetry(deps, () => fetchSource(source, deps.fetchText, now));
    const stats = await ingestItems(deps.store, { source, now, baseline: !state.baselineAt }, result.items);
    await deps.store.saveSourceState(applySuccess(state, result.items, result.partialErrors, now));
    return { ...base, outcome: "ok", reason: result.partialErrors.length ? result.partialErrors.join(" | ") : null, items: stats.items, created: stats.created, revised: stats.revised, events: stats.events, filteredOut: stats.filteredOut, httpStatus: result.httpStatus, durationMs: Date.now() - started };
  } catch (error) {
    await deps.store.saveSourceState(applyFailure(state, error, now));
    return { ...base, outcome: "failed", reason: error instanceof Error ? error.message : String(error), httpStatus: error instanceof SourceError ? error.httpStatus : null, durationMs: Date.now() - started };
  }
}

const hostOf = (source: SourceDefinition) => { try { return new URL(source.url ?? source.discoveryUrl).host; } catch { return source.id; } };

function totalsOf(results: RunSourceResult[]): RunRecord["totals"] {
  return {
    sources: results.length, ok: results.filter((r) => r.outcome === "ok").length, failed: results.filter((r) => r.outcome === "failed").length, skipped: results.filter((r) => r.outcome === "skipped" || r.outcome === "not_ingestible").length,
    created: results.reduce((sum, r) => sum + r.created, 0), revised: results.reduce((sum, r) => sum + r.revised, 0), events: results.reduce((sum, r) => sum + r.events, 0),
  };
}

export function selectSources(deps: ServiceDeps, opts: Pick<RefreshOptions, "sourceIds" | "agency">): SourceDefinition[] {
  let list = registry(deps);
  if (opts.sourceIds?.length) list = list.filter((source) => opts.sourceIds!.includes(source.id));
  if (opts.agency) { const needle = opts.agency.toLowerCase(); list = list.filter((source) => source.agency.toLowerCase().includes(needle) || source.id.startsWith(needle)); }
  return list;
}

export type StartResult = { accepted: true; runId: string; done: Promise<RunRecord> } | { accepted: false; reason: string; runningRunId: string | null };

/** Starts a refresh pass. Only one pass runs at a time across all instances (database lease); a source failing never stops the others. */
export async function startRefresh(deps: ServiceDeps, opts: RefreshOptions): Promise<StartResult> {
  await deps.store.ensure();
  const holder = randomUUID();
  if (!(await deps.store.acquireLease(LEASE, holder, LEASE_TTL_MS, nowOf(deps)))) {
    const running = (await deps.store.listRuns(5)).find((run) => run.status === "running");
    return { accepted: false, reason: "A refresh is already running; no second pass was started.", runningRunId: running?.runId ?? null };
  }
  const selected = selectSources(deps, opts);
  const run: RunRecord = {
    runId: `run_${randomUUID().slice(0, 12)}`, trigger: opts.trigger, scope: opts.sourceIds?.length ? `sources:${opts.sourceIds.join(",")}` : opts.agency ? `agency:${opts.agency}` : "all",
    startedAt: nowOf(deps).toISOString(), finishedAt: null, status: "running", results: [], totals: totalsOf([]),
  };
  await deps.store.startRun(run);

  const done = (async () => {
    try {
      const groups = new Map<string, SourceDefinition[]>();
      for (const source of selected) groups.set(hostOf(source), [...(groups.get(hostOf(source)) ?? []), source]);
      const queue = [...groups.values()];
      const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
        for (let group = queue.shift(); group; group = queue.shift()) {
          for (const source of group) {
            const result = await refreshSource(deps, source, opts).catch((error): RunSourceResult => ({ sourceId: source.id, outcome: "failed", reason: error instanceof Error ? error.message : String(error), items: 0, created: 0, revised: 0, events: 0, filteredOut: 0, durationMs: 0, httpStatus: null }));
            run.results.push(result);
            deps.log?.({ source: source.id, outcome: result.outcome, items: result.items, created: result.created, events: result.events, http: result.httpStatus, error: result.outcome === "failed" ? result.reason : null }, "Standards Intelligence source");
            if (result.outcome === "ok" || result.outcome === "failed") await sleepOf(deps)(HOST_DELAY_MS);
          }
        }
      });
      await Promise.all(workers);
      run.totals = totalsOf(run.results);
      run.status = run.totals.failed === 0 ? "completed" : run.totals.ok === 0 && run.totals.failed > 0 ? "failed" : "completed_with_errors";
    } catch (error) {
      run.status = "failed";
      deps.log?.({ error: error instanceof Error ? error.message : String(error) }, "Standards Intelligence refresh failed");
    } finally {
      run.finishedAt = nowOf(deps).toISOString();
      await deps.store.finishRun(run).catch(() => undefined);
      await deps.store.releaseLease(LEASE, holder).catch(() => undefined);
    }
    return run;
  })();
  return { accepted: true, runId: run.runId, done };
}

// ── Reporting ───────────────────────────────────────────────────────────────

export interface SourceReport {
  id: string; agency: string; country: string; region: string; jurisdiction: string; url: string | null; discoveryUrl: string; method: string; sourceType: string; authority: string; docClass: string;
  categories: string[]; authRequired: boolean; authNote: string; pollHours: number; urlBasis: string; ingestible: boolean; relevanceFilter: string;
  status: SourceStatus; statusReason: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null; lastItemAt: string | null; latestItemTitle: string | null; lastError: string | null; httpStatus: number | null; consecutiveFailures: number; itemsSeen: number; verifiedAt: string | null;
}

export async function describeSources(deps: ServiceDeps): Promise<SourceReport[]> {
  await deps.store.ensure();
  const states = new Map((await deps.store.listSourceStates()).map((state) => [state.sourceId, state]));
  const now = nowOf(deps);
  return registry(deps).map((source) => {
    const state = states.get(source.id) ?? blankState(source, now);
    const ingestible = isIngestible(source);
    return {
      id: source.id, agency: source.agency, country: source.country, region: source.region, jurisdiction: source.jurisdiction, url: source.url, discoveryUrl: source.discoveryUrl, method: source.method, sourceType: source.sourceType,
      authority: source.authority, docClass: source.docClass, categories: source.categories, authRequired: source.authRequired, authNote: source.authNote, pollHours: source.pollHours, urlBasis: source.urlBasis, ingestible, relevanceFilter: source.relevance,
      status: ingestible ? state.status : "pending_verification", statusReason: ingestible ? state.statusReason : source.pendingReason ?? state.statusReason,
      lastAttemptAt: state.lastAttemptAt, lastSuccessAt: state.lastSuccessAt, lastItemAt: state.lastItemAt, latestItemTitle: state.latestItemTitle, lastError: state.lastError, httpStatus: state.httpStatus,
      consecutiveFailures: state.consecutiveFailures, itemsSeen: state.itemsSeen, verifiedAt: state.verifiedAt,
    };
  });
}

export async function ingestionStatus(deps: ServiceDeps) {
  const sources = await describeSources(deps);
  const now = nowOf(deps);
  const runs = await deps.store.listRuns(30);
  const lastScheduled = runs.find((run) => run.trigger !== "manual" && run.finishedAt) ?? null;
  const ingestible = sources.filter((source) => source.ingestible);
  const byStatus = (status: SourceStatus) => sources.filter((source) => source.status === status).length;
  return {
    generatedAt: now.toISOString(),
    schedule: { description: "Automatic refresh every 12 hours (twice daily), run by the API server itself; no browser tab is needed.", intervalHours: 12, lastScheduledRunAt: lastScheduled?.finishedAt ?? null, nextDueAt: lastScheduled?.finishedAt ? new Date(Date.parse(lastScheduled.finishedAt) + SCHEDULE_INTERVAL_MS).toISOString() : "on next scheduler check" },
    sources: { registered: sources.length, ingestible: ingestible.length, notIngestible: sources.length - ingestible.length, active: byStatus("active"), degraded: byStatus("degraded"), unavailable: byStatus("unavailable"), pendingVerification: byStatus("pending_verification"), verifiedOperational: ingestible.filter((s) => (s.status === "active" || s.status === "degraded") && s.lastSuccessAt).length },
    lastRun: runs[0] ?? null,
    running: runs.find((run) => run.status === "running") ?? null,
    unavailableSources: sources.filter((s) => s.status === "unavailable").map((s) => ({ id: s.id, agency: s.agency, reason: s.statusReason })),
    pendingSources: sources.filter((s) => !s.ingestible).map((s) => ({ id: s.id, agency: s.agency, reason: s.statusReason })),
  };
}

// ── Scheduler ───────────────────────────────────────────────────────────────

export function startStandardsScheduler(deps: ServiceDeps, options: { checkEveryMs?: number; firstDelayMs?: number } = {}): () => void {
  const tick = async (startup: boolean) => {
    try {
      const runs = await deps.store.listRuns(30);
      const last = runs.find((run) => run.trigger !== "manual" && run.finishedAt);
      const due = !last || nowOf(deps).getTime() - Date.parse(last.finishedAt!) >= SCHEDULE_INTERVAL_MS - 5 * 60_000;
      if (!due) return;
      const started = await startRefresh(deps, { trigger: startup && !last ? "startup" : "scheduled" });
      if (started.accepted) await started.done;
    } catch (error) {
      deps.log?.({ error: error instanceof Error ? error.message : String(error) }, "Standards Intelligence scheduler tick failed");
    }
  };
  const first = setTimeout(() => void tick(true), options.firstDelayMs ?? 45_000);
  const interval = setInterval(() => void tick(false), options.checkEveryMs ?? 15 * 60_000);
  first.unref?.(); interval.unref?.();
  return () => { clearTimeout(first); clearInterval(interval); };
}
