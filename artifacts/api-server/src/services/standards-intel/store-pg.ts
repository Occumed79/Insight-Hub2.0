import type { ChangeEvent, DocFilter, DocumentVersion, EventFilter, Facets, RunRecord, SourceState, StandardsDocument, StandardsStore } from "./types";

type Pool = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS si_sources (
     source_id text PRIMARY KEY, status text NOT NULL, status_reason text, last_attempt_at timestamptz, last_success_at timestamptz, last_item_at timestamptz,
     latest_item_title text, last_error text, http_status int, consecutive_failures int NOT NULL DEFAULT 0, items_seen int NOT NULL DEFAULT 0,
     baseline_at timestamptz, verified_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS si_documents (
     doc_id text PRIMARY KEY, url_key text NOT NULL UNIQUE, external_key text, issuer text NOT NULL, country text, jurisdiction text, doc_class text NOT NULL, status text NOT NULL,
     categories jsonb NOT NULL DEFAULT '[]', industries jsonb NOT NULL DEFAULT '[]', source_ids jsonb NOT NULL DEFAULT '[]', rins jsonb NOT NULL DEFAULT '[]',
     publication_date text, sort_published text NOT NULL, first_seen_at timestamptz NOT NULL, last_changed_at timestamptz NOT NULL, baseline boolean NOT NULL DEFAULT false,
     search text NOT NULL DEFAULT '', data jsonb NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS si_documents_external_key ON si_documents (external_key)`,
  `CREATE INDEX IF NOT EXISTS si_documents_sort ON si_documents (sort_published DESC, first_seen_at DESC)`,
  `CREATE INDEX IF NOT EXISTS si_documents_rins ON si_documents USING gin (rins)`,
  `CREATE TABLE IF NOT EXISTS si_document_versions (doc_id text NOT NULL, version int NOT NULL, fingerprint text NOT NULL, observed_at timestamptz NOT NULL, data jsonb NOT NULL, PRIMARY KEY (doc_id, version))`,
  `CREATE TABLE IF NOT EXISTS si_change_events (event_id text PRIMARY KEY, doc_id text NOT NULL, related_doc_id text, source_id text NOT NULL, kind text NOT NULL, verified boolean NOT NULL, detected_at timestamptz NOT NULL, data jsonb NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS si_change_events_detected ON si_change_events (detected_at DESC)`,
  `CREATE INDEX IF NOT EXISTS si_change_events_doc ON si_change_events (doc_id)`,
  `CREATE TABLE IF NOT EXISTS si_ingestion_runs (run_id text PRIMARY KEY, trigger text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz, status text NOT NULL, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS si_leases (name text PRIMARY KEY, holder text NOT NULL, locked_until timestamptz NOT NULL)`,
];

const iso = (value: unknown): string | null => (value instanceof Date ? value.toISOString() : value ? new Date(String(value)).toISOString() : null);

export function createPgStandardsStore(poolProvider?: () => Promise<Pool>): StandardsStore {
  let pool: Pool | null = null;
  let ready: Promise<void> | null = null;
  const getPool = async (): Promise<Pool> => {
    if (pool) return pool;
    pool = poolProvider ? await poolProvider() : ((await import("@workspace/db")).pool as unknown as Pool);
    return pool;
  };
  const q = async (text: string, values?: unknown[]) => { await store.ensure(); return (await getPool()).query(text, values); };

  const store: StandardsStore = {
    async ensure() {
      if (!ready) ready = (async () => { const p = await getPool(); for (const statement of SCHEMA) await p.query(statement); })().catch((error) => { ready = null; throw error; });
      return ready;
    },
    async getSourceState(sourceId) {
      const { rows } = await q(`SELECT * FROM si_sources WHERE source_id = $1`, [sourceId]);
      return rows[0] ? toState(rows[0]) : null;
    },
    async listSourceStates() { return (await q(`SELECT * FROM si_sources`)).rows.map(toState); },
    async saveSourceState(s) {
      await q(`INSERT INTO si_sources (source_id,status,status_reason,last_attempt_at,last_success_at,last_item_at,latest_item_title,last_error,http_status,consecutive_failures,items_seen,baseline_at,verified_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
        ON CONFLICT (source_id) DO UPDATE SET status=EXCLUDED.status,status_reason=EXCLUDED.status_reason,last_attempt_at=EXCLUDED.last_attempt_at,last_success_at=EXCLUDED.last_success_at,last_item_at=EXCLUDED.last_item_at,
          latest_item_title=EXCLUDED.latest_item_title,last_error=EXCLUDED.last_error,http_status=EXCLUDED.http_status,consecutive_failures=EXCLUDED.consecutive_failures,items_seen=EXCLUDED.items_seen,baseline_at=EXCLUDED.baseline_at,verified_at=EXCLUDED.verified_at,updated_at=now()`,
        [s.sourceId, s.status, s.statusReason, s.lastAttemptAt, s.lastSuccessAt, s.lastItemAt, s.latestItemTitle, s.lastError, s.httpStatus, s.consecutiveFailures, s.itemsSeen, s.baselineAt, s.verifiedAt]);
    },
    async findDocument({ urlKey, externalKey }) {
      const { rows } = await q(`SELECT data FROM si_documents WHERE ($1::text IS NOT NULL AND url_key = $1) OR ($2::text IS NOT NULL AND external_key = $2) ORDER BY (url_key = $1) DESC NULLS LAST LIMIT 1`, [urlKey ?? null, externalKey ?? null]);
      return rows[0]?.data ?? null;
    },
    async findByRin(rin, excludeDocId) { return (await q(`SELECT data FROM si_documents WHERE rins ? $1 AND doc_id <> $2`, [rin, excludeDocId])).rows.map((row) => row.data); },
    async getDocument(docId) { return (await q(`SELECT data FROM si_documents WHERE doc_id = $1`, [docId])).rows[0]?.data ?? null; },
    async saveDocument(d) {
      await q(`INSERT INTO si_documents (doc_id,url_key,external_key,issuer,country,jurisdiction,doc_class,status,categories,industries,source_ids,rins,publication_date,sort_published,first_seen_at,last_changed_at,baseline,search,data)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19::jsonb)
        ON CONFLICT (doc_id) DO UPDATE SET external_key=EXCLUDED.external_key,issuer=EXCLUDED.issuer,doc_class=EXCLUDED.doc_class,status=EXCLUDED.status,categories=EXCLUDED.categories,industries=EXCLUDED.industries,
          source_ids=EXCLUDED.source_ids,rins=EXCLUDED.rins,publication_date=EXCLUDED.publication_date,sort_published=EXCLUDED.sort_published,last_changed_at=EXCLUDED.last_changed_at,baseline=EXCLUDED.baseline,search=EXCLUDED.search,data=EXCLUDED.data`,
        [d.docId, d.urlKey, d.externalKey, d.issuer, d.country, d.jurisdiction, d.docClass, d.status, JSON.stringify(d.categories), JSON.stringify(d.industries), JSON.stringify(d.sources.map((s) => s.sourceId)), JSON.stringify(d.rins),
          d.publicationDate, d.publicationDate ?? d.firstSeenAt.slice(0, 10), d.firstSeenAt, d.lastChangedAt, d.baseline, `${d.title} ${d.summary} ${d.issuer}`.toLowerCase(), JSON.stringify(d)]);
    },
    async addVersion(v) {
      const r = await q(`INSERT INTO si_document_versions (doc_id,version,fingerprint,observed_at,data) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`, [v.docId, v.version, v.fingerprint, v.observedAt, JSON.stringify(v)]);
      return (r.rowCount ?? 0) > 0;
    },
    async listVersions(docId) { return (await q(`SELECT data FROM si_document_versions WHERE doc_id = $1 ORDER BY version`, [docId])).rows.map((row) => row.data as DocumentVersion); },
    async addEvent(e) {
      const r = await q(`INSERT INTO si_change_events (event_id,doc_id,related_doc_id,source_id,kind,verified,detected_at,data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (event_id) DO NOTHING`, [e.eventId, e.docId, e.relatedDocId, e.sourceId, e.kind, e.verified, e.detectedAt, JSON.stringify(e)]);
      return (r.rowCount ?? 0) > 0;
    },
    async listEvents(f: EventFilter) {
      const where: string[] = []; const values: unknown[] = [];
      const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace("#", `$${values.length}`)); };
      if (f.docId) add("doc_id = #", f.docId);
      if (f.sourceId) add("source_id = #", f.sourceId);
      if (f.kind) add("kind = #", f.kind);
      if (f.verifiedOnly) where.push("verified = true");
      if (f.since) add("detected_at >= #", f.since);
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const total = Number((await q(`SELECT count(*)::int AS n FROM si_change_events ${clause}`, values)).rows[0].n);
      const rows = (await q(`SELECT data FROM si_change_events ${clause} ORDER BY detected_at DESC, event_id LIMIT ${Math.max(1, f.limit)} OFFSET ${Math.max(0, f.offset)}`, values)).rows;
      return { total, events: rows.map((row) => row.data as ChangeEvent) };
    },
    async eventsForDocument(docId) { return (await q(`SELECT data FROM si_change_events WHERE doc_id = $1 OR related_doc_id = $1 ORDER BY detected_at DESC`, [docId])).rows.map((row) => row.data as ChangeEvent); },
    async queryDocuments(f: DocFilter) {
      const where: string[] = []; const values: unknown[] = [];
      const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace(/#/g, `$${values.length}`)); };
      if (!f.includeIndex) where.push("doc_class <> 'index'");
      if (f.q) for (const term of f.q.toLowerCase().split(/\s+/).filter(Boolean)) add("search LIKE #", `%${term.replace(/[%_\\]/g, "\\$&")}%`);
      if (f.category) add("categories ? #", f.category);
      if (f.industry) add("industries ? #", f.industry);
      if (f.jurisdiction) add("jurisdiction = #", f.jurisdiction);
      if (f.country) add("country = #", f.country);
      if (f.sourceId) add("source_ids ? #", f.sourceId);
      if (f.agency) add("lower(issuer) LIKE #", `%${f.agency.toLowerCase()}%`);
      if (f.status) add("status = #", f.status);
      if (f.docClass) add("doc_class = #", f.docClass);
      if (f.since) add("sort_published >= #", f.since);
      if (f.newlyDetectedOnly) where.push("baseline = false");
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const order = f.sort === "detected" ? "first_seen_at DESC" : f.sort === "changed" ? "last_changed_at DESC" : "sort_published DESC, first_seen_at DESC";
      // jsonb "?" is a Postgres operator; node-pg only treats $n as parameters, so the literal "?" is safe.
      const total = Number((await q(`SELECT count(*)::int AS n FROM si_documents ${clause}`, values)).rows[0].n);
      const rows = (await q(`SELECT data FROM si_documents ${clause} ORDER BY ${order}, doc_id LIMIT ${Math.max(1, f.limit)} OFFSET ${Math.max(0, f.offset)}`, values)).rows;
      return { total, documents: rows.map((row) => row.data as StandardsDocument) };
    },
    async facets(): Promise<Facets> {
      const base = `FROM si_documents WHERE doc_class <> 'index'`;
      const list = async (sql: string) => (await q(sql)).rows.map((row) => ({ id: String(row.id), count: Number(row.n) }));
      const jurisdictions = (await q(`SELECT jurisdiction AS id, max(country) AS country, count(*)::int AS n ${base} GROUP BY jurisdiction ORDER BY n DESC`)).rows.map((row) => ({ id: String(row.id), country: String(row.country ?? ""), count: Number(row.n) }));
      return {
        categories: await list(`SELECT c AS id, count(*)::int AS n ${base.replace("FROM si_documents", "FROM si_documents, jsonb_array_elements_text(categories) c")} GROUP BY c ORDER BY n DESC, c`),
        industries: await list(`SELECT c AS id, count(*)::int AS n ${base.replace("FROM si_documents", "FROM si_documents, jsonb_array_elements_text(industries) c")} GROUP BY c ORDER BY n DESC, c`),
        jurisdictions,
        docClasses: await list(`SELECT doc_class AS id, count(*)::int AS n ${base} GROUP BY doc_class ORDER BY n DESC`),
        statuses: await list(`SELECT status AS id, count(*)::int AS n ${base} GROUP BY status ORDER BY n DESC`),
        agencies: await list(`SELECT issuer AS id, count(*)::int AS n ${base} GROUP BY issuer ORDER BY n DESC`),
      };
    },
    async startRun(r) { await q(`INSERT INTO si_ingestion_runs (run_id,trigger,started_at,finished_at,status,data) VALUES ($1,$2,$3,NULL,$4,$5::jsonb) ON CONFLICT (run_id) DO NOTHING`, [r.runId, r.trigger, r.startedAt, r.status, JSON.stringify(r)]); },
    async finishRun(r) { await q(`UPDATE si_ingestion_runs SET finished_at=$2, status=$3, data=$4::jsonb WHERE run_id=$1`, [r.runId, r.finishedAt, r.status, JSON.stringify(r)]); },
    async getRun(runId) { return (await q(`SELECT data FROM si_ingestion_runs WHERE run_id = $1`, [runId])).rows[0]?.data ?? null; },
    async listRuns(limit) { return (await q(`SELECT data FROM si_ingestion_runs ORDER BY started_at DESC LIMIT ${Math.max(1, Math.min(limit, 100))}`)).rows.map((row) => row.data as RunRecord); },
    async lastFinishedRun() { return (await q(`SELECT data FROM si_ingestion_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`)).rows[0]?.data ?? null; },
    async acquireLease(name, holder, ttlMs, now = new Date()) {
      const r = await q(`INSERT INTO si_leases (name,holder,locked_until) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET holder=EXCLUDED.holder, locked_until=EXCLUDED.locked_until WHERE si_leases.locked_until < $4 OR si_leases.holder = EXCLUDED.holder`,
        [name, holder, new Date(now.getTime() + ttlMs).toISOString(), now.toISOString()]);
      return (r.rowCount ?? 0) > 0;
    },
    async releaseLease(name, holder) { await q(`DELETE FROM si_leases WHERE name = $1 AND holder = $2`, [name, holder]); },
    async clearLease(name) { await q(`DELETE FROM si_leases WHERE name = $1`, [name]); },
  };
  return store;
}

function toState(row: any): SourceState {
  return {
    sourceId: row.source_id, status: row.status, statusReason: row.status_reason, lastAttemptAt: iso(row.last_attempt_at), lastSuccessAt: iso(row.last_success_at), lastItemAt: iso(row.last_item_at),
    latestItemTitle: row.latest_item_title, lastError: row.last_error, httpStatus: row.http_status, consecutiveFailures: Number(row.consecutive_failures ?? 0), itemsSeen: Number(row.items_seen ?? 0),
    baselineAt: iso(row.baseline_at), verifiedAt: iso(row.verified_at), updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}
