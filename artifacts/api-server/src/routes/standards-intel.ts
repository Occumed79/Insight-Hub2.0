import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import type { FetchText } from "../services/standards-intel/adapters";
import { CATEGORY_LABELS } from "../services/standards-intel/classify";
import { STANDARDS_SOURCES } from "../services/standards-intel/registry";
import { describeSources, ingestionStatus, startRefresh, startStandardsScheduler, type ServiceDeps } from "../services/standards-intel/service";
import { createPgStandardsStore } from "../services/standards-intel/store-pg";
import type { DocFilter, StandardsDocument } from "../services/standards-intel/types";


const MAX_BYTES = 3_000_000;
const fetchText: FetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: "follow", signal: controller.signal,
      headers: { Accept: "application/rss+xml, application/atom+xml, application/json, application/xml;q=0.9, */*;q=0.5", "User-Agent": "Occu-Med-Insight-Hub/2.0 Standards Intelligence (official-source monitor)" },
    });
    return { status: response.status, body: (await response.text()).slice(0, MAX_BYTES), finalUrl: response.url || url };
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
    throw new Error(controller.signal.aborted ? "timed out after 20 s" : cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error)));
  } finally {
    clearTimeout(timer);
  }
};

export const liveDeps = (): ServiceDeps => ({ store: createPgStandardsStore(), fetchText, log: (fields, message) => logger.info(fields, message) });

const intParam = (value: unknown, fallback: number, max: number) => { const n = Number.parseInt(String(value ?? ""), 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback; };
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined);
const flag = (value: unknown) => value === "1" || value === "true";
const fail = (res: Response, error: unknown, what: string) => res.status(500).json({ ok: false, error: error instanceof Error ? error.message : `${what} failed.` });

function filterFrom(req: Request, defaults: Partial<DocFilter> = {}): DocFilter {
  const q = req.query;
  const sort = q.sort === "detected" || q.sort === "changed" || q.sort === "published" ? q.sort : defaults.sort ?? "published";
  return {
    q: text(q.q), category: text(q.category), industry: text(q.industry), jurisdiction: text(q.jurisdiction), country: text(q.country), sourceId: text(q.source), agency: text(q.agency),
    status: text(q.status), docClass: text(q.class), since: text(q.since), newlyDetectedOnly: flag(q.newOnly) || defaults.newlyDetectedOnly, includeIndex: flag(q.includeIndex) || defaults.includeIndex, sort,
    limit: Math.max(1, intParam(q.limit, 25, 100)), offset: intParam(q.offset, 0, 100_000),
  };
}

const NEW_DAYS = 7;
function present(doc: StandardsDocument, now = Date.now()) {
  const detectedRecently = now - Date.parse(doc.firstSeenAt) <= NEW_DAYS * 86_400_000;
  return {
    ...doc,
    categoryLabels: doc.categories.map((id) => ({ id, label: CATEGORY_LABELS[id] ?? id })),
    detection: doc.baseline
      ? { label: "Present when the source was first monitored", newlyObserved: false }
      : { label: detectedRecently ? "Newly observed publication" : "Observed after monitoring began", newlyObserved: detectedRecently },
  };
}

export function createStandardsIntelRouter(deps: ServiceDeps): Router {
  const router = Router();
  const store = deps.store;
  const standardsDeps = () => deps;

  router.get("/standards-intel", (_req, res) => {
    res.json({
      ok: true, name: "Standards Intelligence — regulatory and occupational-health change monitoring",
      notice: "A monitoring system for authoritative publications. It does not evaluate medical cases, score people, or determine fitness for duty. A published item never changes a medical requirement by itself.",
      endpoints: [
        { method: "GET", path: "/api/standards-intel/updates", purpose: "Recent regulatory and guidance updates, newest first.", query: "q, category, industry, jurisdiction, country, source, agency, status, class, since (YYYY-MM-DD), newOnly=1, includeIndex=1, sort=published|detected|changed, limit (≤100), offset" },
        { method: "GET", path: "/api/standards-intel/documents", purpose: "Search all monitored documents (same filters as /updates)." },
        { method: "GET", path: "/api/standards-intel/documents/:id", purpose: "One document with its version history, change events, and related documents." },
        { method: "GET", path: "/api/standards-intel/changes", purpose: "Change events. Verified only by default.", query: "document, source, kind, includeUnverified=1, since, limit, offset" },
        { method: "GET", path: "/api/standards-intel/agencies", purpose: "Issuing agencies and the sources that monitor them." },
        { method: "GET", path: "/api/standards-intel/sources", purpose: "Source registry with health. /sources/:id for one source.", query: "status, country" },
        { method: "GET", path: "/api/standards-intel/facets", purpose: "Categories, industries, jurisdictions, document classes and statuses with counts, plus the category definitions." },
        { method: "GET", path: "/api/standards-intel/status", purpose: "Source health summary, schedule, and last ingestion run." },
        { method: "GET", path: "/api/standards-intel/runs", purpose: "Recent ingestion runs. /runs/:runId for one." },
        { method: "POST", path: "/api/standards-intel/refresh", purpose: "Manual refresh. Body: { sourceIds?: string[], agency?: string, wait?: boolean }. 409 if a refresh is already running." },
      ],
    });
  });

  const listHandler = (defaults: Partial<DocFilter>) => async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const filter = filterFrom(req, defaults);
      const { total, documents } = await store.queryDocuments(filter);
      res.json({ ok: true, total, limit: filter.limit, offset: filter.offset, generatedAt: new Date().toISOString(), documents: documents.map((doc) => present(doc)) });
    } catch (error) { fail(res, error, "Standards listing"); }
  };
  router.get("/standards-intel/updates", listHandler({ sort: "published" }));
  router.get("/standards-intel/documents", listHandler({ sort: "published", includeIndex: false }));

  router.get("/standards-intel/documents/:id", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const doc = await store.getDocument(String(req.params.id));
      if (!doc) { res.status(404).json({ ok: false, error: "No document with that id." }); return; }
      const related = (await Promise.all([...new Set([...doc.relatedDocIds, ...doc.supersedes, ...doc.correctedBy, ...(doc.supersededBy ? [doc.supersededBy] : []), ...(doc.correctionOf ? [doc.correctionOf] : [])])].map((id) => store.getDocument(id))))
        .filter((entry): entry is StandardsDocument => !!entry).map((entry) => ({ docId: entry.docId, title: entry.title, issuer: entry.issuer, status: entry.status, publicationDate: entry.publicationDate, canonicalUrl: entry.canonicalUrl }));
      res.json({ ok: true, document: present(doc), versions: await store.listVersions(doc.docId), events: await store.eventsForDocument(doc.docId), related });
    } catch (error) { fail(res, error, "Document lookup"); }
  });

  router.get("/standards-intel/changes", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const filter = { docId: text(req.query.document), sourceId: text(req.query.source), kind: text(req.query.kind), verifiedOnly: !flag(req.query.includeUnverified), since: text(req.query.since), limit: Math.max(1, intParam(req.query.limit, 25, 100)), offset: intParam(req.query.offset, 0, 100_000) };
      const { total, events } = await store.listEvents(filter);
      res.json({ ok: true, total, verifiedOnly: filter.verifiedOnly, limit: filter.limit, offset: filter.offset, events });
    } catch (error) { fail(res, error, "Change events"); }
  });

  router.get("/standards-intel/sources", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const status = text(req.query.status); const country = text(req.query.country);
      const sources = (await describeSources(standardsDeps())).filter((source) => (!status || source.status === status) && (!country || source.country === country));
      res.json({ ok: true, count: sources.length, sources });
    } catch (error) { fail(res, error, "Source registry"); }
  });

  router.get("/standards-intel/sources/:id", async (req, res) => {
    try {
      const source = (await describeSources(standardsDeps())).find((entry) => entry.id === req.params.id);
      if (!source) { res.status(404).json({ ok: false, error: "No source with that id." }); return; }
      res.json({ ok: true, source });
    } catch (error) { fail(res, error, "Source lookup"); }
  });

  router.get("/standards-intel/agencies", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const sources = await describeSources(standardsDeps());
      const facets = await store.facets();
      const byAgency = new Map<string, typeof sources>();
      for (const source of sources) byAgency.set(source.agency, [...(byAgency.get(source.agency) ?? []), source]);
      res.json({
        ok: true,
        monitoredAgencies: [...byAgency.entries()].map(([agency, list]) => ({ agency, country: list[0]!.country, jurisdiction: list[0]!.jurisdiction, sources: list.map((s) => ({ id: s.id, status: s.status, method: s.method })) })),
        issuersWithDocuments: facets.agencies,
      });
    } catch (error) { fail(res, error, "Agencies"); }
  });

  router.get("/standards-intel/facets", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, ...(await store.facets()), categoryDefinitions: CATEGORY_LABELS, note: "Counts cover monitored documents only; publication-level index entries are excluded." });
    } catch (error) { fail(res, error, "Facets"); }
  });

  router.get("/standards-intel/status", async (_req, res) => {
    try { res.setHeader("Cache-Control", "no-store"); res.json({ ok: true, ...(await ingestionStatus(standardsDeps())) }); } catch (error) { fail(res, error, "Status"); }
  });

  router.get("/standards-intel/runs", async (req, res) => {
    try { res.setHeader("Cache-Control", "no-store"); res.json({ ok: true, runs: await store.listRuns(intParam(req.query.limit, 10, 50)) }); } catch (error) { fail(res, error, "Runs"); }
  });
  router.get("/standards-intel/runs/:runId", async (req, res) => {
    try {
      const run = await store.getRun(String(req.params.runId));
      if (!run) { res.status(404).json({ ok: false, error: "No run with that id." }); return; }
      res.json({ ok: true, run });
    } catch (error) { fail(res, error, "Run lookup"); }
  });

  router.post("/standards-intel/refresh", async (req, res) => {
    try {
      const body = (req.body ?? {}) as { sourceIds?: unknown; agency?: unknown; wait?: unknown };
      const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds.filter((id): id is string => typeof id === "string").slice(0, 50) : undefined;
      const unknown = (sourceIds ?? []).filter((id) => !STANDARDS_SOURCES.some((source) => source.id === id));
      if (unknown.length) { res.status(400).json({ ok: false, error: `Unknown source id(s): ${unknown.join(", ")}.` }); return; }
      const started = await startRefresh(standardsDeps(), { trigger: "manual", sourceIds, agency: typeof body.agency === "string" ? body.agency : undefined });
      if (!started.accepted) { res.status(409).json({ ok: false, error: started.reason, runningRunId: started.runningRunId }); return; }
      if (body.wait === false) { res.status(202).json({ ok: true, status: "running", runId: started.runId, poll: `/api/standards-intel/runs/${started.runId}` }); return; }
      const outcome = await Promise.race([started.done, new Promise<null>((resolve) => setTimeout(() => resolve(null), 40_000))]);
      if (!outcome) { res.status(202).json({ ok: true, status: "running", runId: started.runId, poll: `/api/standards-intel/runs/${started.runId}` }); return; }
      res.json({ ok: true, status: outcome.status, run: outcome });
    } catch (error) { fail(res, error, "Refresh"); }
  });


  return router;
}

let live: ServiceDeps | null = null;
const getLive = () => (live ??= liveDeps());
const router = Router();
let built: Router | null = null;
router.use((req, res, next) => (built ??= createStandardsIntelRouter(getLive()))(req, res, next));

/** Twice-daily refresh, independent of any open browser tab. Disabled with STANDARDS_INTEL_MONITOR=off. */
export function startStandardsIntelMonitor() {
  return startStandardsScheduler(getLive());
}

export default router;
