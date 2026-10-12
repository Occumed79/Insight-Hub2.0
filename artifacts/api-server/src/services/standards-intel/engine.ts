import { createHash } from "node:crypto";
import { canonicalUrl } from "../aor-intel/command-news/parse";
import { APPLICABILITY_NOTE, classify, docClassFor, isOccupationallyRelevant, relevanceStatement } from "./classify";
import type { ChangeEvent, DocStatus, DocumentVersion, EventKind, RawItem, SourceDefinition, SourceRef, StandardsDocument, StandardsStore } from "./types";

export const NEW_WINDOW_DAYS = 21;
const DAY = 86_400_000;

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const norm = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Normalised fingerprint of the substantive text. Publication/modified timestamps, markup, whitespace, case and punctuation are excluded so cosmetic changes never register. */
export function fingerprintOf(snapshot: { title: string; summary: string; status: DocStatus; effectiveDate: string | null; versionKey: string | null }): string {
  return sha(JSON.stringify([norm(snapshot.title), norm(snapshot.summary), snapshot.status, snapshot.effectiveDate ?? "", snapshot.versionKey ?? ""]));
}

/** Status is taken from the issuer's own structured field when present, otherwise only from explicit wording in the issuer's title. */
export function inferStatus(item: RawItem, source: SourceDefinition): DocStatus {
  if (item.statusHint) return item.statusHint;
  const title = item.title;
  if (/\bwithdraw(?:al|n)\b/i.test(title)) return "withdrawn";
  if (/\bcorrect(?:ion|ions|ing)\b/i.test(title)) return "corrected";
  if (/\bsuperseded|\brescind(?:ed|s)?\b/i.test(title)) return "superseded";
  if (/\bproposed (?:rule|rulemaking|amendment)|notice of proposed/i.test(title)) return "proposed";
  if (/\bfinal rule\b|\bfinal (?:amendment|regulation)\b/i.test(title)) return "final";
  if (/\bamend(?:ment|ed|s)?\b/i.test(title) && source.docClass === "binding_regulation") return "amended";
  return "informational";
}

const parseDay = (value: string | null) => (value ? Date.parse(`${value}T00:00:00Z`) : NaN);

export interface IngestContext { source: SourceDefinition; now: Date; baseline: boolean }
export interface IngestStats { items: number; created: number; revised: number; events: number; unchanged: number; filteredOut: number }

function makeEvent(doc: StandardsDocument, source: SourceDefinition, now: Date, kind: EventKind, verified: boolean, label: string, explanation: string, discriminator: string, extra: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    eventId: `ev_${sha([doc.docId, kind, discriminator, extra.relatedDocId ?? ""].join("|")).slice(0, 24)}`,
    docId: doc.docId, sourceId: source.id, kind, verified, label, explanation, detectedAt: now.toISOString(),
    title: doc.title, issuer: doc.issuer, url: doc.canonicalUrl, relatedDocId: null, changedFields: [], before: null, after: null, ...extra,
  };
}

const provenanceFor = (source: SourceDefinition, item: RawItem) =>
  Number(Math.max(0.5, ({ official_government: 0.95, intergovernmental: 0.9, standards_body: 0.85, professional_association: 0.8 }[source.authority]) - (item.publishedAt || item.modifiedAt ? 0 : 0.1)).toFixed(2));

export async function ingestItems(store: StandardsStore, ctx: IngestContext, items: RawItem[]): Promise<IngestStats> {
  const { source, now } = ctx;
  const nowIso = now.toISOString();
  const stats: IngestStats = { items: items.length, created: 0, revised: 0, events: 0, unchanged: 0, filteredOut: 0 };
  const record = async (event: ChangeEvent) => { if (await store.addEvent(event)) stats.events += 1; };

  for (const item of items) {
    const classification = classify({ title: item.title, summary: item.summary, categories: item.categories, cfrRefs: item.cfrRefs, source });
    if (source.relevance === "occupational" && !isOccupationallyRelevant(classification)) { stats.filteredOut += 1; continue; }

    const urlKey = canonicalUrl(item.url);
    const status = inferStatus(item, source);
    const snapshot = { title: item.title, summary: item.summary, status, effectiveDate: item.effectiveAt, versionKey: item.versionKey };
    const fingerprint = fingerprintOf(snapshot);
    const existing = await store.findDocument({ urlKey, externalKey: item.externalKey });

    if (!existing) {
      const doc = await createDocument(store, ctx, item, classification, urlKey, status, snapshot, fingerprint, record);
      stats.created += 1;
      void doc;
      continue;
    }

    const ref = existing.sources.find((entry) => entry.sourceId === source.id);
    const isPrimary = existing.sources[0]?.sourceId === source.id;
    // Another feed has now published a document already held: provenance is added, nothing is raised.
    if (!ref) {
      existing.sources.push({ sourceId: source.id, agency: source.agency, url: item.url, firstSeenAt: nowIso, lastSeenAt: nowIso, fingerprint, snapshot });
      existing.lastSeenAt = nowIso;
      existing.externalKey = existing.externalKey ?? item.externalKey;
      fillMissing(existing, item);
      await store.saveDocument(existing);
      stats.unchanged += 1;
      continue;
    }

    ref.lastSeenAt = nowIso;
    existing.lastSeenAt = nowIso;
    existing.externalKey = existing.externalKey ?? item.externalKey;
    if (ref.fingerprint === fingerprint) {
      fillMissing(existing, item);
      if (isPrimary && item.modifiedAt && item.modifiedAt !== existing.modifiedDate) existing.modifiedDate = item.modifiedAt;
      await store.saveDocument(existing);
      stats.unchanged += 1;
      continue;
    }

    // ── The issuer's own observation of this document has changed ──
    const before = ref.snapshot;
    const changedFields = (["title", "summary", "status", "effectiveDate", "versionKey"] as const).filter((field) => norm(String(before[field] ?? "")) !== norm(String(snapshot[field] ?? "")));
    const discriminator = fingerprint;
    let kind: EventKind;
    let verified: boolean;
    let label: string;
    let explanation: string;
    if (item.versionKey && before.versionKey && before.versionKey !== item.versionKey) {
      kind = "amendment"; verified = true; label = "Amendment recorded by the issuer's version list";
      explanation = `The eCFR version list now shows an amendment dated ${item.versionKey}; the previous most recent amendment was dated ${before.versionKey}. ${item.summary}`;
    } else if (changedFields.includes("status") && source.method !== "rss" && source.method !== "atom") {
      kind = "status_change"; verified = true; label = `Status changed from ${before.status} to ${status}`;
      explanation = `The issuer's structured record now lists this document as ${status} (previously ${before.status}).`;
    } else if (changedFields.length) {
      kind = "possible_change"; verified = false; label = "Unverified possible change";
      explanation = `The issuer's published ${changedFields.join(", ")} differs from the previously observed text. No authoritative revision marker accompanies this, so it is not confirmed that the document was amended.`;
    } else {
      // Only formatting differed after normalisation (cannot happen when fingerprints differ) — keep the reference current and move on.
      ref.fingerprint = fingerprint; ref.snapshot = snapshot;
      await store.saveDocument(existing);
      stats.unchanged += 1;
      continue;
    }
    ref.fingerprint = fingerprint;
    ref.snapshot = snapshot;
    if (isPrimary) {
      existing.title = item.title; existing.summary = item.summary; if (!existing.supersededBy && existing.status !== "withdrawn") existing.status = status; existing.effectiveDate = item.effectiveAt ?? existing.effectiveDate;
      existing.modifiedDate = item.modifiedAt ?? existing.modifiedDate; existing.versionKey = item.versionKey ?? existing.versionKey;
      existing.fingerprint = fingerprint; existing.version += 1; existing.lastChangedAt = nowIso; existing.confirmedChange = verified ? explanation : null;
      const version: DocumentVersion = { docId: existing.docId, version: existing.version, fingerprint, observedAt: nowIso, snapshot: { title: item.title, summary: item.summary, status, effectiveDate: existing.effectiveDate, modifiedDate: existing.modifiedDate, versionKey: existing.versionKey }, reason: label };
      await store.addVersion(version);
    }
    await store.saveDocument(existing);
    stats.revised += 1;
    await record(makeEvent(existing, source, now, kind, verified, label, explanation, discriminator, { changedFields, before: { ...before }, after: { ...snapshot } }));
  }
  return stats;
}

function fillMissing(doc: StandardsDocument, item: RawItem) {
  doc.publicationDate = doc.publicationDate ?? item.publishedAt;
  doc.effectiveDate = doc.effectiveDate ?? item.effectiveAt;
  for (const rin of item.rins) if (!doc.rins.includes(rin)) doc.rins.push(rin);
  for (const docket of item.dockets) if (!doc.dockets.includes(docket)) doc.dockets.push(docket);
  for (const ref of item.cfrRefs) if (!doc.cfrRefs.includes(ref)) doc.cfrRefs.push(ref);
}

async function createDocument(
  store: StandardsStore, ctx: IngestContext, item: RawItem, classification: ReturnType<typeof classify>, urlKey: string, status: DocStatus,
  snapshot: SourceRef["snapshot"], fingerprint: string, record: (event: ChangeEvent) => Promise<void>,
): Promise<StandardsDocument> {
  const { source, now, baseline } = ctx;
  const nowIso = now.toISOString();
  const issuer = (source.method === "federal_register_api" && item.categories[0]) || source.agency;
  const doc: StandardsDocument = {
    docId: `sd_${sha(item.externalKey ?? urlKey).slice(0, 20)}`, urlKey, externalKey: item.externalKey,
    title: item.title, issuer, canonicalUrl: item.url, country: source.country, jurisdiction: source.jurisdiction,
    docClass: docClassFor(source, item.docType, `${item.title} ${item.summary}`), status,
    categories: classification.categories, industries: classification.industries, topic: classification.topic,
    publicationDate: item.publishedAt, effectiveDate: item.effectiveAt, modifiedDate: item.modifiedAt,
    detectedAt: nowIso, firstSeenAt: nowIso, lastSeenAt: nowIso, lastChangedAt: nowIso,
    summary: item.summary, occupationalMedicineRelevance: relevanceStatement(classification), applicabilityNote: APPLICABILITY_NOTE,
    evidence: classification.evidence,
    citations: [{ label: `${issuer} — original publication`, url: item.url }, { label: `Retrieved from ${source.agency} (${source.sourceType})`, url: source.discoveryUrl }],
    confidence: { classification: classification.classificationConfidence, provenance: provenanceFor(source, item) },
    fingerprint, version: item.priorVersions.length + 1, previousVersionId: null, supersedes: [], supersededBy: null, correctedBy: [], correctionOf: null, relatedDocIds: [],
    rins: [...item.rins], dockets: [...item.dockets], cfrRefs: [...item.cfrRefs], versionKey: item.versionKey, baseline,
    confirmedChange: null,
    sources: [{ sourceId: source.id, agency: source.agency, url: item.url, firstSeenAt: nowIso, lastSeenAt: nowIso, fingerprint, snapshot }],
  };

  // History the issuer itself lists (eCFR amendment dates) is stored as versions without raising events.
  const seeded: DocumentVersion[] = item.priorVersions.map((date, index) => ({
    docId: doc.docId, version: index + 1, fingerprint: sha(`${doc.docId}|${date}`), observedAt: nowIso,
    snapshot: { title: doc.title, summary: "", status, effectiveDate: null, modifiedDate: date, versionKey: date }, reason: "Amendment date listed in the issuer's version history",
  }));
  for (const version of seeded) await store.addVersion(version);
  await store.addVersion({ docId: doc.docId, version: doc.version, fingerprint, observedAt: nowIso, snapshot: { title: doc.title, summary: doc.summary, status, effectiveDate: doc.effectiveDate, modifiedDate: doc.modifiedDate, versionKey: doc.versionKey }, reason: baseline ? "First observed (source baseline)" : "First observed" });

  // New-publication events: only for genuinely recent publications, never for a source's baseline pass or a CFR part first listed.
  if (!baseline && item.docType !== "CFR_PART" && doc.docClass !== "index") {
    const published = parseDay(item.publishedAt);
    const recent = Number.isFinite(published) && now.getTime() - published <= NEW_WINDOW_DAYS * DAY;
    if (recent) {
      await record(makeEvent(doc, source, now, "new_publication", true, `New ${status === "proposed" ? "proposed rule" : status === "final" ? "final rule" : "publication"} observed`, `${doc.issuer} published this on ${item.publishedAt}; Insight Hub first observed it on ${nowIso.slice(0, 10)}.`, "new"));
    } else if (!Number.isFinite(published)) {
      await record(makeEvent(doc, source, now, "new_publication", false, "Newly observed publication (date not supplied)", "The issuer's feed did not supply a publication date, so it cannot be confirmed that this is newly published rather than newly discovered.", "new"));
    }
  }

  await relate(store, doc, item, source, now, baseline, record);
  await store.saveDocument(doc);
  return doc;
}

/** Document relationships come only from identifiers the issuer supplies: the Federal Register correction link and the shared Regulation Identifier Number. */
async function relate(store: StandardsStore, doc: StandardsDocument, item: RawItem, source: SourceDefinition, now: Date, baseline: boolean, record: (event: ChangeEvent) => Promise<void>) {
  const nowIso = now.toISOString();
  if (item.correctionOf) {
    const target = await store.findDocument({ externalKey: item.correctionOf });
    if (target) {
      doc.correctionOf = target.docId; doc.previousVersionId = target.docId; doc.relatedDocIds.push(target.docId);
      if (!target.correctedBy.includes(doc.docId)) { target.correctedBy.push(doc.docId); target.lastChangedAt = nowIso; await store.saveDocument(target); }
      doc.confirmedChange = `Issuer-marked correction of "${target.title}".`;
      if (!baseline) await record(makeEvent(target, source, now, "corrected", true, "Correction published", `The Federal Register lists "${doc.title}" (${doc.externalKey}) as a correction of this document.`, doc.docId, { relatedDocId: doc.docId }));
    } else {
      doc.confirmedChange = `The issuer marks this as a correction of ${item.correctionOf}; the corrected document has not been observed by Insight Hub.`;
      if (!baseline) await record(makeEvent(doc, source, now, "corrected", true, "Correction published", doc.confirmedChange, "self"));
    }
  }
  if (!item.rins.length) return;
  const related = new Map<string, StandardsDocument>();
  for (const rin of item.rins) for (const other of await store.findByRin(rin, doc.docId)) related.set(other.docId, other);
  const docDate = parseDay(doc.publicationDate);
  for (const other of related.values()) {
    if (!doc.relatedDocIds.includes(other.docId)) doc.relatedDocIds.push(other.docId);
    if (!other.relatedDocIds.includes(doc.docId)) other.relatedDocIds.push(doc.docId);
    const otherDate = parseDay(other.publicationDate);
    const later = Number.isFinite(docDate) && Number.isFinite(otherDate) && docDate >= otherDate;
    const earlier = Number.isFinite(docDate) && Number.isFinite(otherDate) && otherDate >= docDate;
    const finalizing = doc.status === "final" && !doc.correctionOf && other.status === "proposed" && later && !other.supersededBy;
    const withdrawing = doc.status === "withdrawn" && (other.status === "proposed" || other.status === "final") && later;
    const alreadyFinalised = doc.status === "proposed" && other.status === "final" && !other.correctionOf && earlier;
    const alreadyWithdrawn = doc.status === "proposed" && other.status === "withdrawn" && earlier;
    if (finalizing) {
      other.status = "superseded"; other.supersededBy = doc.docId; other.lastChangedAt = nowIso; doc.supersedes.push(other.docId); doc.previousVersionId = doc.previousVersionId ?? other.docId;
      doc.confirmedChange = `Final rule carrying the same Regulation Identifier Number (${item.rins.join(", ")}) as the proposed rule "${other.title}".`;
      if (!baseline) await record(makeEvent(other, source, now, "superseded", true, "Proposed rule superseded by a final rule", `"${doc.title}" shares Regulation Identifier Number ${item.rins.join(", ")} with this proposed rule.`, doc.docId, { relatedDocId: doc.docId }));
    } else if (withdrawing) {
      other.status = "withdrawn"; other.lastChangedAt = nowIso;
      doc.confirmedChange = `Withdrawal notice carrying the same Regulation Identifier Number (${item.rins.join(", ")}) as "${other.title}".`;
      if (!baseline) await record(makeEvent(other, source, now, "withdrawn", true, "Withdrawn by the issuer", `"${doc.title}" shares Regulation Identifier Number ${item.rins.join(", ")} and is a withdrawal.`, doc.docId, { relatedDocId: doc.docId }));
    } else if (alreadyFinalised) {
      doc.status = "superseded"; doc.supersededBy = other.docId; doc.confirmedChange = `Superseded by the final rule "${other.title}" (same Regulation Identifier Number).`;
    } else if (alreadyWithdrawn) {
      doc.status = "withdrawn"; doc.confirmedChange = `Withdrawn by "${other.title}" (same Regulation Identifier Number).`;
    }
    await store.saveDocument(other);
  }
}
