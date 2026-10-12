/**
 * Standards Intelligence — regulatory and occupational-health change monitoring.
 * This is a monitoring system. It never scores a person, evaluates a medical case, or decides fitness for duty.
 */

export type SourceStatus = "active" | "degraded" | "unavailable" | "pending_verification";
export type IngestionMethod = "rss" | "atom" | "federal_register_api" | "ecfr_versioner_api" | "none";
export type DocClass = "binding_regulation" | "official_guidance" | "consensus_standard" | "research" | "announcement" | "index";
export type DocStatus = "proposed" | "final" | "amended" | "corrected" | "withdrawn" | "superseded" | "in_force" | "informational";
export type EventKind = "new_publication" | "amendment" | "status_change" | "corrected" | "superseded" | "withdrawn" | "possible_change";

export interface SourceDefinition {
  id: string;
  /** Issuing organisation, shown as the attribution on every record. */
  agency: string;
  country: string;
  region: string;
  jurisdiction: string;
  /** The endpoint actually requested. null = no machine-readable endpoint has been confirmed (nothing is fetched). */
  url: string | null;
  /** Human page that documents or lists the endpoint. */
  discoveryUrl: string;
  method: IngestionMethod;
  sourceType: string;
  authority: "official_government" | "intergovernmental" | "standards_body" | "professional_association";
  docClass: DocClass;
  categories: string[];
  authRequired: boolean;
  authNote: string;
  pollHours: number;
  /** "all" keeps every item. "occupational" keeps only items whose own text matches at least one occupational-health category. */
  relevance: "all" | "occupational";
  /** How the endpoint address was established. Never "guessed". */
  urlBasis: "listed_on_official_index" | "documented_api" | "documented_pattern" | "none_confirmed";
  /** Federal Register API query parameters. */
  fr?: { agency: string; term?: string; types?: string[] };
  /** eCFR parts monitored through the versioner API. */
  ecfr?: Array<{ title: number; part: number; label: string }>;
  /** Why an endpoint is not ingested, for sources without one. */
  pendingReason?: string;
}

export interface Classification {
  categories: string[];
  industries: string[];
  topic: string | null;
  evidence: Array<{ category: string; terms: string[] }>;
  classificationConfidence: number;
}

export interface RawItem {
  externalKey: string | null;
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  modifiedAt: string | null;
  docType: string | null;
  action: string | null;
  categories: string[];
  cfrRefs: string[];
  rins: string[];
  dockets: string[];
  correctionOf: string | null;
  /** Authoritative version marker (eCFR amendment date). */
  versionKey: string | null;
  /** Prior authoritative versions the issuer lists, oldest→newest, used to seed history without raising events. */
  priorVersions: string[];
  statusHint: DocStatus | null;
}

export interface SourceSnapshot { title: string; summary: string; status: DocStatus; effectiveDate: string | null; versionKey: string | null }
export interface SourceRef { sourceId: string; agency: string; url: string; firstSeenAt: string; lastSeenAt: string; fingerprint: string; snapshot: SourceSnapshot }

export interface StandardsDocument {
  docId: string;
  urlKey: string;
  externalKey: string | null;
  title: string;
  issuer: string;
  canonicalUrl: string;
  country: string;
  jurisdiction: string;
  docClass: DocClass;
  status: DocStatus;
  categories: string[];
  industries: string[];
  topic: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  modifiedDate: string | null;
  detectedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt: string;
  summary: string;
  occupationalMedicineRelevance: string;
  applicabilityNote: string;
  evidence: Array<{ category: string; terms: string[] }>;
  citations: Array<{ label: string; url: string }>;
  confidence: { classification: number; provenance: number };
  fingerprint: string;
  version: number;
  previousVersionId: string | null;
  supersedes: string[];
  supersededBy: string | null;
  correctedBy: string[];
  correctionOf: string | null;
  relatedDocIds: string[];
  rins: string[];
  dockets: string[];
  cfrRefs: string[];
  versionKey: string | null;
  baseline: boolean;
  confirmedChange: string | null;
  sources: SourceRef[];
}

export interface DocumentVersion { docId: string; version: number; fingerprint: string; observedAt: string; snapshot: Pick<StandardsDocument, "title" | "summary" | "status" | "effectiveDate" | "modifiedDate" | "versionKey">; reason: string }

export interface ChangeEvent {
  eventId: string;
  docId: string;
  sourceId: string;
  kind: EventKind;
  /** true only when the issuer's own structured metadata (version list, correction/RIN link, document type) establishes it. */
  verified: boolean;
  label: string;
  explanation: string;
  detectedAt: string;
  title: string;
  issuer: string;
  url: string;
  relatedDocId: string | null;
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface SourceState {
  sourceId: string;
  status: SourceStatus;
  statusReason: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastItemAt: string | null;
  latestItemTitle: string | null;
  lastError: string | null;
  httpStatus: number | null;
  consecutiveFailures: number;
  itemsSeen: number;
  baselineAt: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface RunSourceResult { sourceId: string; outcome: "ok" | "failed" | "skipped" | "not_ingestible"; reason: string | null; items: number; created: number; revised: number; events: number; filteredOut: number; durationMs: number; httpStatus: number | null }
export interface RunRecord { runId: string; trigger: "scheduled" | "manual" | "startup"; scope: string; startedAt: string; finishedAt: string | null; status: "running" | "completed" | "completed_with_errors" | "failed"; results: RunSourceResult[]; totals: { sources: number; ok: number; failed: number; skipped: number; created: number; revised: number; events: number } }

export interface DocFilter { q?: string; category?: string; industry?: string; jurisdiction?: string; country?: string; sourceId?: string; agency?: string; status?: string; docClass?: string; since?: string; newlyDetectedOnly?: boolean; includeIndex?: boolean; sort?: "published" | "detected" | "changed"; limit: number; offset: number }
export interface EventFilter { docId?: string; sourceId?: string; kind?: string; verifiedOnly: boolean; since?: string; limit: number; offset: number }

export interface Facets { categories: Array<{ id: string; count: number }>; industries: Array<{ id: string; count: number }>; jurisdictions: Array<{ id: string; country: string; count: number }>; docClasses: Array<{ id: string; count: number }>; statuses: Array<{ id: string; count: number }>; agencies: Array<{ id: string; count: number }> }

export interface StandardsStore {
  ensure(): Promise<void>;
  getSourceState(sourceId: string): Promise<SourceState | null>;
  listSourceStates(): Promise<SourceState[]>;
  saveSourceState(state: SourceState): Promise<void>;
  findDocument(keys: { urlKey?: string | null; externalKey?: string | null }): Promise<StandardsDocument | null>;
  findByRin(rin: string, excludeDocId: string): Promise<StandardsDocument[]>;
  getDocument(docId: string): Promise<StandardsDocument | null>;
  saveDocument(doc: StandardsDocument): Promise<void>;
  addVersion(version: DocumentVersion): Promise<boolean>;
  listVersions(docId: string): Promise<DocumentVersion[]>;
  /** Returns false when an event with the same deterministic id already exists (idempotent re-processing). */
  addEvent(event: ChangeEvent): Promise<boolean>;
  listEvents(filter: EventFilter): Promise<{ total: number; events: ChangeEvent[] }>;
  eventsForDocument(docId: string): Promise<ChangeEvent[]>;
  queryDocuments(filter: DocFilter): Promise<{ total: number; documents: StandardsDocument[] }>;
  facets(): Promise<Facets>;
  startRun(run: RunRecord): Promise<void>;
  finishRun(run: RunRecord): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  listRuns(limit: number): Promise<RunRecord[]>;
  lastFinishedRun(): Promise<RunRecord | null>;
  acquireLease(name: string, holder: string, ttlMs: number, now?: Date): Promise<boolean>;
  releaseLease(name: string, holder: string): Promise<void>;
}
