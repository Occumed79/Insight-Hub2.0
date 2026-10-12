import type { ChangeEvent, DocFilter, DocumentVersion, EventFilter, Facets, RunRecord, SourceState, StandardsDocument, StandardsStore } from "./types";

const published = (doc: StandardsDocument) => doc.publicationDate ?? doc.firstSeenAt.slice(0, 10);

export function matchesFilter(doc: StandardsDocument, filter: DocFilter): boolean {
  if (!filter.includeIndex && doc.docClass === "index") return false;
  if (filter.q) {
    const haystack = `${doc.title} ${doc.summary} ${doc.issuer}`.toLowerCase();
    if (!filter.q.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term))) return false;
  }
  if (filter.category && !doc.categories.includes(filter.category)) return false;
  if (filter.industry && !doc.industries.includes(filter.industry)) return false;
  if (filter.jurisdiction && doc.jurisdiction !== filter.jurisdiction) return false;
  if (filter.country && doc.country !== filter.country) return false;
  if (filter.sourceId && !doc.sources.some((source) => source.sourceId === filter.sourceId)) return false;
  if (filter.agency && !doc.issuer.toLowerCase().includes(filter.agency.toLowerCase())) return false;
  if (filter.status && doc.status !== filter.status) return false;
  if (filter.docClass && doc.docClass !== filter.docClass) return false;
  if (filter.since && published(doc) < filter.since) return false;
  if (filter.newlyDetectedOnly && doc.baseline) return false;
  return true;
}

export function sortDocuments(docs: StandardsDocument[], sort: DocFilter["sort"]): StandardsDocument[] {
  const key = (doc: StandardsDocument) => (sort === "detected" ? doc.firstSeenAt : sort === "changed" ? doc.lastChangedAt : `${published(doc)}|${doc.firstSeenAt}`);
  return [...docs].sort((a, b) => key(b).localeCompare(key(a)));
}

const count = <T>(values: T[], keyOf: (value: T) => string[]) => {
  const map = new Map<string, number>();
  for (const value of values) for (const key of new Set(keyOf(value))) map.set(key, (map.get(key) ?? 0) + 1);
  return [...map.entries()].map(([id, total]) => ({ id, count: total })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
};

export function computeFacets(docs: StandardsDocument[]): Facets {
  const visible = docs.filter((doc) => doc.docClass !== "index");
  const jurisdictions = new Map<string, { country: string; count: number }>();
  for (const doc of visible) { const entry = jurisdictions.get(doc.jurisdiction) ?? { country: doc.country, count: 0 }; entry.count += 1; jurisdictions.set(doc.jurisdiction, entry); }
  return {
    categories: count(visible, (doc) => doc.categories), industries: count(visible, (doc) => doc.industries),
    jurisdictions: [...jurisdictions.entries()].map(([id, entry]) => ({ id, ...entry })).sort((a, b) => b.count - a.count),
    docClasses: count(visible, (doc) => [doc.docClass]), statuses: count(visible, (doc) => [doc.status]), agencies: count(visible, (doc) => [doc.issuer]),
  };
}

/** In-memory implementation of the store contract, used by the tests and as the reference behaviour for the SQL store. */
export function createMemoryStandardsStore(): StandardsStore & { documents: Map<string, StandardsDocument> } {
  const documents = new Map<string, StandardsDocument>();
  const versions = new Map<string, DocumentVersion[]>();
  const events = new Map<string, ChangeEvent>();
  const states = new Map<string, SourceState>();
  const runs = new Map<string, RunRecord>();
  const leases = new Map<string, { holder: string; until: number }>();
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  return {
    documents,
    async ensure() {},
    async getSourceState(id) { return states.has(id) ? clone(states.get(id)!) : null; },
    async listSourceStates() { return [...states.values()].map(clone); },
    async saveSourceState(state) { states.set(state.sourceId, clone(state)); },
    async findDocument({ urlKey, externalKey }) {
      for (const doc of documents.values()) if ((urlKey && doc.urlKey === urlKey) || (externalKey && doc.externalKey === externalKey)) return clone(doc);
      return null;
    },
    async findByRin(rin, excludeDocId) { return [...documents.values()].filter((doc) => doc.docId !== excludeDocId && doc.rins.includes(rin)).map(clone); },
    async getDocument(docId) { return documents.has(docId) ? clone(documents.get(docId)!) : null; },
    async saveDocument(doc) { documents.set(doc.docId, clone(doc)); },
    async addVersion(version) {
      const list = versions.get(version.docId) ?? [];
      if (list.some((entry) => entry.version === version.version)) return false;
      list.push(clone(version)); versions.set(version.docId, list); return true;
    },
    async listVersions(docId) { return clone((versions.get(docId) ?? []).sort((a, b) => a.version - b.version)); },
    async addEvent(event) { if (events.has(event.eventId)) return false; events.set(event.eventId, clone(event)); return true; },
    async listEvents(filter: EventFilter) {
      const rows = [...events.values()].filter((event) => (!filter.docId || event.docId === filter.docId) && (!filter.sourceId || event.sourceId === filter.sourceId) && (!filter.kind || event.kind === filter.kind) && (!filter.verifiedOnly || event.verified) && (!filter.since || event.detectedAt >= filter.since))
        .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || a.eventId.localeCompare(b.eventId));
      return { total: rows.length, events: clone(rows.slice(filter.offset, filter.offset + filter.limit)) };
    },
    async eventsForDocument(docId) { return clone([...events.values()].filter((event) => event.docId === docId || event.relatedDocId === docId).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))); },
    async queryDocuments(filter) {
      const rows = sortDocuments([...documents.values()].filter((doc) => matchesFilter(doc, filter)), filter.sort);
      return { total: rows.length, documents: clone(rows.slice(filter.offset, filter.offset + filter.limit)) };
    },
    async facets() { return computeFacets([...documents.values()]); },
    async startRun(run) { runs.set(run.runId, clone(run)); },
    async finishRun(run) { runs.set(run.runId, clone(run)); },
    async getRun(runId) { return runs.has(runId) ? clone(runs.get(runId)!) : null; },
    async listRuns(limit) { return clone([...runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit)); },
    async lastFinishedRun() {
      const done = [...runs.values()].filter((run) => run.finishedAt).sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!));
      return done[0] ? clone(done[0]) : null;
    },
    async acquireLease(name, holder, ttlMs, now = new Date()) {
      const current = leases.get(name);
      if (current && current.until > now.getTime() && current.holder !== holder) return false;
      leases.set(name, { holder, until: now.getTime() + ttlMs }); return true;
    },
    async releaseLease(name, holder) { if (leases.get(name)?.holder === holder) leases.delete(name); },
  };
}
