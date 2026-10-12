import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import { federalRegisterNumber, fetchSource, parseEcfrVersions, parseFederalRegister, parseFeedItems, SourceError, type FetchText } from "../standards-intel/adapters";
import { classify, docClassFor, isOccupationallyRelevant } from "../standards-intel/classify";
import { fingerprintOf, ingestItems, inferStatus } from "../standards-intel/engine";
import { isIngestible, STANDARDS_SOURCES } from "../standards-intel/registry";
import { createStandardsIntelRouter } from "../../routes/standards-intel";
import { applyFailure, applySuccess, blankState, describeSources, ingestionStatus, startRefresh, type ServiceDeps } from "../standards-intel/service";
import { createMemoryStandardsStore } from "../standards-intel/store-memory";
import type { RawItem, SourceDefinition } from "../standards-intel/types";

// ---- Format fixtures -----------------------------------------------------------------------------------------------------------------
// Written to the published RSS 2.0, Atom 1.0, Federal Register API and eCFR versioner JSON formats. They prove the parsers and the engine; they do NOT
// prove any live endpoint works. Live reachability is reported by the source health recorded at run time.

const RSS = (items: string) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>OSHA</title>${items}</channel></rss>`;
const rssItem = (title: string, link: string, pub: string, desc = "") => `<item><title>${title}</title><link>${link}</link><pubDate>${pub}</pubDate><description><![CDATA[${desc}]]></description></item>`;
const ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>HSE</title>
  <entry><title>Control of respirable crystalline silica: updated guidance</title><link rel="alternate" href="https://www.gov.uk/guidance/silica"/><link rel="self" href="https://www.gov.uk/x.atom"/><published>2026-10-01T09:00:00Z</published><updated>2026-10-02T09:00:00Z</updated><summary>Revised health surveillance guidance for workers exposed to silica.</summary></entry></feed>`;

const NOW = new Date("2026-10-12T12:00:00Z");
const sourceOf = (id: string) => STANDARDS_SOURCES.find((s) => s.id === id)!;
const osha = sourceOf("osha-interpretations");
const frOsha = sourceOf("fr-osha");
const ecfr = sourceOf("ecfr-versions");

const item = (over: Partial<RawItem> = {}): RawItem => ({
  externalKey: null, title: "Respirator medical evaluation questionnaire", url: "https://www.osha.gov/laws-regs/standardinterpretations/2026-10-05", summary: "OSHA clarifies medical evaluation before respirator use.",
  publishedAt: "2026-10-05", effectiveAt: null, modifiedAt: null, docType: null, action: null, categories: [], cfrRefs: [], rins: [], dockets: [], correctionOf: null, versionKey: null, priorVersions: [], statusHint: null, ...over,
});

const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

// ---- Registry ------------------------------------------------------------------------------------------------------------------------

test("registry: unique ids, complete fields, attribution kept", () => {
  assert.equal(new Set(STANDARDS_SOURCES.map((s) => s.id)).size, STANDARDS_SOURCES.length);
  for (const s of STANDARDS_SOURCES) {
    for (const field of ["agency", "country", "region", "jurisdiction", "discoveryUrl", "sourceType", "authority", "docClass", "authNote"] as const) assert.ok(s[field], `${s.id}.${field}`);
    assert.ok(s.categories.length > 0 && s.pollHours > 0, s.id);
    assert.equal(typeof s.authRequired, "boolean");
  }
});

test("registry: never an invented or homepage endpoint — sources without a confirmed endpoint fetch nothing", () => {
  for (const s of STANDARDS_SOURCES) {
    if (isIngestible(s)) {
      const url = new URL(s.url!);
      assert.ok(url.pathname.length > 1, `${s.id} points at a bare homepage`);
      assert.notEqual(s.urlBasis, "none_confirmed", s.id);
    } else {
      assert.equal(s.url, null, s.id);
      assert.equal(s.method, "none");
      assert.ok(s.pendingReason, s.id);
    }
  }
  assert.ok(STANDARDS_SOURCES.filter(isIngestible).length >= 25);
  assert.ok(STANDARDS_SOURCES.some((s) => s.id === "eu-osha" && !isIngestible(s)));
});

test("registry: no key-requiring source is registered", () => assert.ok(STANDARDS_SOURCES.every((s) => !s.authRequired)));

// ---- Parsing -------------------------------------------------------------------------------------------------------------------------

test("parse: RSS 2.0 items become dated records and Federal Register numbers are recognised", () => {
  const items = parseFeedItems(RSS(rssItem("Final rule: Heat injury and illness prevention", "https://www.federalregister.gov/documents/2026/10/03/2026-20111/heat-injury", "Fri, 03 Oct 2026 08:00:00 GMT", "<p>OSHA &amp; heat</p>")), "https://www.osha.gov/x.xml");
  assert.equal(items.length, 1);
  assert.equal(items[0]!.publishedAt, "2026-10-03");
  assert.equal(items[0]!.externalKey, "fr:2026-20111");
  assert.equal(items[0]!.summary, "OSHA & heat");
  assert.equal(federalRegisterNumber("https://www.federalregister.gov/d/2026-20111"), "2026-20111");
  assert.equal(federalRegisterNumber("https://www.osha.gov/news/newsreleases/1"), null);
});

test("parse: Atom keeps the alternate link, the published date and records 'updated' only as a modified date", () => {
  const [entry] = parseFeedItems(ATOM, "https://www.gov.uk/x.atom");
  assert.equal(entry!.url, "https://www.gov.uk/guidance/silica");
  assert.equal(entry!.publishedAt, "2026-10-01");
  assert.equal(entry!.modifiedAt, "2026-10-02");
});

test("parse: an HTML page or garbage is rejected as a feed, not parsed as empty", () => {
  assert.throws(() => parseFeedItems("<!doctype html><html><body>Access denied</body></html>", "https://x.gov/rss"), /HTML page/);
  assert.throws(() => parseFeedItems("hello", "https://x.gov/rss"), SourceError);
  assert.deepEqual(parseFeedItems(RSS(""), "https://x.gov/rss"), []);
});

const FR_JSON = JSON.stringify({ count: 5, results: [
  { document_number: "2026-20111", title: "Heat Injury and Illness Prevention; Proposed Rule", type: "Proposed Rule", abstract: "OSHA proposes a heat standard.", html_url: "https://www.federalregister.gov/documents/2026/09/01/2026-20111/heat", publication_date: "2026-09-01", effective_on: null, regulation_id_numbers: ["1218-AD64"], docket_ids: ["OSHA-2021-0009"], cfr_references: [{ title: 29, part: 1910 }], correction_of: null, agencies: [{ name: "Occupational Safety and Health Administration" }] },
  { document_number: "2026-29999", title: "Heat Injury and Illness Prevention; Final Rule", type: "Rule", abstract: "OSHA finalizes a heat standard.", html_url: "https://www.federalregister.gov/documents/2026/10/08/2026-29999/heat", publication_date: "2026-10-08", effective_on: "2026-12-08", regulation_id_numbers: ["1218-AD64"], agencies: [{ name: "Occupational Safety and Health Administration" }] },
  { document_number: "2026-30500", title: "Heat Injury and Illness Prevention; Correction", type: "Rule", abstract: "Corrects a table.", html_url: "https://www.federalregister.gov/documents/2026/10/10/2026-30500/heat-correction", publication_date: "2026-10-10", correction_of: "https://www.federalregister.gov/api/v1/documents/2026-29999.json", regulation_id_numbers: ["1218-AD64"], agencies: [{ name: "Occupational Safety and Health Administration" }] },
  { document_number: "2026-31000", title: "Withdrawal of Proposed Rule on Medical Removal", type: "Proposed Rule", abstract: "OSHA withdraws.", html_url: "https://www.federalregister.gov/documents/2026/10/11/2026-31000/withdrawal", publication_date: "2026-10-11", regulation_id_numbers: ["1218-ZZ01"], agencies: [{ name: "Occupational Safety and Health Administration" }] },
] });

test("parse: Federal Register type, effective date, RIN, CFR reference and correction link are read from structured fields", () => {
  // The API names types "Rule" / "Proposed Rule" / "Notice"; the adapter accepts the API's own codes too.
  const raw = JSON.parse(FR_JSON); for (const r of raw.results) r.type = r.type === "Rule" ? "RULE" : r.type === "Proposed Rule" ? "PRORULE" : r.type;
  const items = parseFederalRegister(JSON.stringify(raw));
  const [proposed, final, correction, withdrawal] = items;
  assert.equal(proposed!.statusHint, "proposed");
  assert.equal(final!.statusHint, "final");
  assert.equal(final!.effectiveAt, "2026-12-08");
  assert.deepEqual(proposed!.cfrRefs, ["29 CFR 1910"]);
  assert.equal(correction!.statusHint, "corrected");
  assert.equal(correction!.correctionOf, "fr:2026-29999");
  assert.equal(withdrawal!.statusHint, "withdrawn");
  assert.throws(() => parseFederalRegister("<html>"), /not valid JSON/);
  assert.throws(() => parseFederalRegister("{}"), /no results/);
});

test("parse: eCFR versions group by amendment date and expose the issuer's own history", () => {
  const body = JSON.stringify({ content_versions: [
    { amendment_date: "2024-05-01", issue_date: "2024-05-03", substantive: true }, { amendment_date: "2025-01-10", issue_date: "2025-01-12", substantive: false },
    { amendment_date: "2025-01-10", issue_date: "2025-01-12", substantive: true }, { amendment_date: "2026-08-20", issue_date: "2026-08-22", substantive: true },
  ] });
  const parsed = parseEcfrVersions(body, { title: 29, part: 1910, label: "OSHA General Industry" });
  assert.equal(parsed.versionKey, "2026-08-20");
  assert.deepEqual(parsed.priorVersions, ["2024-05-01", "2025-01-10"]);
  assert.equal(parsed.externalKey, "ecfr:t29:p1910");
  assert.throws(() => parseEcfrVersions("{}", { title: 29, part: 1, label: "x" }), /content_versions/);
});

test("fetchSource: non-2xx answers become explicit, classified errors", async () => {
  const respond = (status: number): FetchText => async () => ({ status, body: "", finalUrl: "" });
  await assert.rejects(fetchSource(osha, respond(403), NOW), (e: SourceError) => e.httpStatus === 403 && /refused/.test(e.message));
  await assert.rejects(fetchSource(osha, respond(404), NOW), (e: SourceError) => e.httpStatus === 404 && !e.retryable);
  await assert.rejects(fetchSource(osha, respond(503), NOW), (e: SourceError) => e.retryable);
  await assert.rejects(fetchSource(sourceOf("eu-osha"), respond(200), NOW), /No keyless/);
});

test("fetchSource: Federal Register falls back to default fields when the field list is rejected", async () => {
  const urls: string[] = [];
  const fetchText: FetchText = async (url) => { urls.push(url); return url.includes("fields%5B%5D") ? { status: 400, body: "bad", finalUrl: url } : { status: 200, body: FR_JSON, finalUrl: url }; };
  const result = await fetchSource(frOsha, fetchText, NOW);
  assert.equal(urls.length, 2);
  assert.equal(result.items.length, 4);
  assert.match(urls[0]!, /conditions%5Bagencies%5D%5B%5D=occupational-safety-and-health-administration/);
});

test("fetchSource: eCFR reports unreadable parts without losing the readable ones", async () => {
  const good = JSON.stringify({ content_versions: [{ amendment_date: "2026-01-01", issue_date: "2026-01-02" }] });
  const fetchText: FetchText = async (url) => (url.includes("title-49") ? { status: 500, body: "", finalUrl: url } : { status: 200, body: good, finalUrl: url });
  const result = await fetchSource(ecfr, fetchText, NOW);
  assert.ok(result.items.length >= 6);
  assert.ok(result.partialErrors.some((e) => /49 CFR 391/.test(e)));
});

// ---- Classification & normalisation --------------------------------------------------------------------------------------------------

test("classify: categories are evidence-based, multi-valued, and absent when the text gives none", () => {
  const c = classify({ title: "Respiratory protection: medical evaluation and fit testing for firefighters", summary: "Employers must provide a medical evaluation before a respirator is used.", source: osha });
  assert.ok(c.categories.includes("respiratory") && c.categories.includes("occupational_medicine") && c.categories.includes("emergency_response"));
  assert.ok(c.evidence.every((e) => e.terms.length > 0));
  assert.ok(c.industries.includes("emergency_services"));
  const none = classify({ title: "Quarterly budget hearing schedule", summary: "Calendar of committee meetings.", source: osha });
  assert.deepEqual(none.categories, []);
  assert.equal(isOccupationallyRelevant(none), false);
  assert.equal(none.classificationConfidence, 0);
});

test("classify: a bare mention of WHO is not occupational relevance; document class never upgrades an announcement into a regulation", () => {
  const who = classify({ title: "WHO releases statement on new publication", summary: "", source: sourceOf("who-news") });
  assert.equal(isOccupationallyRelevant(who), false);
  assert.equal(docClassFor(sourceOf("osha-news-releases"), null, "OSHA cites employer"), "announcement");
  assert.equal(docClassFor(frOsha, "NOTICE", "Notice of meeting"), "announcement");
  assert.equal(docClassFor(frOsha, "RULE", "x"), "binding_regulation");
  assert.equal(docClassFor(sourceOf("govinfo-lsa"), null, "x"), "index");
});

test("fingerprint: markup, case, punctuation, whitespace do not change it; wording does", () => {
  const base = { title: "Silica  Standard", summary: "<p>Medical surveillance applies.</p>", status: "final" as const, effectiveDate: null, versionKey: null };
  assert.equal(fingerprintOf(base), fingerprintOf({ ...base, title: "SILICA standard!", summary: "Medical   surveillance applies" }));
  assert.notEqual(fingerprintOf(base), fingerprintOf({ ...base, summary: "Medical surveillance no longer applies." }));
  assert.notEqual(fingerprintOf(base), fingerprintOf({ ...base, status: "proposed" }));
});

test("status is taken from the issuer's structured field, else only from explicit title wording", () => {
  assert.equal(inferStatus(item({ title: "Proposed Rule: Silica" }), osha), "proposed");
  assert.equal(inferStatus(item({ title: "Withdrawal of the proposed rule" }), osha), "withdrawn");
  assert.equal(inferStatus(item({ title: "Correction to final rule" }), osha), "corrected");
  assert.equal(inferStatus(item({ title: "Respirator FAQ" }), osha), "informational");
  assert.equal(inferStatus(item({ statusHint: "final", title: "Anything" }), osha), "final");
});

// ---- Change detection ----------------------------------------------------------------------------------------------------------------

async function engine() {
  const store = createMemoryStandardsStore();
  const ingest = (source: SourceDefinition, items: RawItem[], at: Date, baseline: boolean) => ingestItems(store, { source, now: at, baseline }, items);
  const events = async (verifiedOnly = false) => (await store.listEvents({ verifiedOnly, limit: 100, offset: 0 })).events;
  return { store, ingest, events };
}

test("baseline pass records documents without claiming anything is new", async () => {
  const { ingest, events, store } = await engine();
  const stats = await ingest(osha, [item()], NOW, true);
  assert.equal(stats.created, 1);
  assert.equal((await events()).length, 0);
  const { documents } = await store.queryDocuments({ limit: 10, offset: 0 });
  assert.equal(documents[0]!.baseline, true);
  assert.match(documents[0]!.occupationalMedicineRelevance, /Respiratory|Occupational medicine/);
  assert.match(documents[0]!.applicabilityNote, /has not been determined/);
});

test("a recent publication after baseline is a verified new publication; an old document that is merely newly discovered is not", async () => {
  const { ingest, events } = await engine();
  await ingest(osha, [item({ url: "https://www.osha.gov/a" })], NOW, true);
  await ingest(osha, [item({ url: "https://www.osha.gov/new", title: "New hearing conservation interpretation", summary: "Hearing conservation audiometric testing.", publishedAt: "2026-10-10" }), item({ url: "https://www.osha.gov/old", title: "Old silica letter", summary: "silica", publishedAt: "2019-03-01" })], days(1), false);
  const list = await events();
  assert.equal(list.length, 1);
  assert.equal(list[0]!.kind, "new_publication");
  assert.equal(list[0]!.verified, true);
  assert.match(list[0]!.explanation, /2026-10-10/);
});

test("an item with no publication date is labelled an unverified newly observed publication", async () => {
  const { ingest, events } = await engine();
  await ingest(osha, [item({ url: "https://www.osha.gov/a" })], NOW, true);
  await ingest(osha, [item({ url: "https://www.osha.gov/undated", publishedAt: null })], days(1), false);
  const [event] = await events();
  assert.equal(event!.verified, false);
  assert.match(event!.label, /Newly observed publication/);
  assert.equal((await events(true)).length, 0);
});

test("processing is idempotent: identical data creates no events, versions or duplicates", async () => {
  const { ingest, events, store } = await engine();
  const feed = [item({ url: "https://www.osha.gov/a" })];
  await ingest(osha, feed, NOW, true);
  await ingest(osha, [item({ url: "https://www.osha.gov/b", publishedAt: "2026-10-11" })], days(1), false);
  const first = (await events()).length;
  for (let i = 2; i < 5; i += 1) {
    const stats = await ingest(osha, [...feed, item({ url: "https://www.osha.gov/b", publishedAt: "2026-10-11" })], days(i), false);
    assert.equal(stats.created, 0); assert.equal(stats.revised, 0); assert.equal(stats.events, 0);
  }
  assert.equal((await events()).length, first);
  const { documents, total } = await store.queryDocuments({ limit: 10, offset: 0 });
  assert.equal(total, 2);
  assert.ok(documents.every((d) => d.version === 1));
});

test("dedupe: the same URL (tracking parameters, trailing slash, case) from two feeds is one document with both sources recorded", async () => {
  const { ingest, store } = await engine();
  const a = item({ url: "https://www.osha.gov/laws-regs/x/?utm_source=rss" });
  const b = item({ url: "https://WWW.osha.gov/laws-regs/x" });
  await ingest(osha, [a], NOW, true);
  await ingest(sourceOf("osha-directives"), [b], NOW, true);
  const { documents, total } = await store.queryDocuments({ limit: 10, offset: 0 });
  assert.equal(total, 1);
  assert.deepEqual(documents[0]!.sources.map((s) => s.sourceId).sort(), ["osha-directives", "osha-interpretations"]);
});

test("dedupe: a Federal Register document seen in a feed and in the API is one document, and the other source's wording never raises a change", async () => {
  const { ingest, events, store } = await engine();
  const viaFeed = item({ externalKey: "fr:2026-20111", url: "https://www.osha.gov/laws-regs/federalregister/2026-20111", title: "Heat rule", summary: "Short feed text." });
  const viaApi = item({ externalKey: "fr:2026-20111", url: "https://www.federalregister.gov/documents/2026/09/01/2026-20111/heat", title: "Heat Injury and Illness Prevention; Proposed Rule", summary: "Long abstract from the API.", statusHint: "proposed" });
  await ingest(sourceOf("osha-federal-register"), [viaFeed], NOW, true);
  await ingest(frOsha, [viaApi], NOW, true);
  await ingest(sourceOf("osha-federal-register"), [viaFeed], days(1), false);
  await ingest(frOsha, [viaApi], days(1), false);
  assert.equal((await store.queryDocuments({ limit: 10, offset: 0 })).total, 1);
  assert.equal((await events()).length, 0);
});

test("a changed feed text is an UNVERIFIED possible change with before/after, never a claimed amendment", async () => {
  const { ingest, events, store } = await engine();
  await ingest(osha, [item()], NOW, true);
  await ingest(osha, [item({ summary: "OSHA clarifies that no medical evaluation is needed before respirator use." })], days(1), false);
  const [event] = await events();
  assert.equal(event!.kind, "possible_change");
  assert.equal(event!.verified, false);
  assert.deepEqual(event!.changedFields, ["summary"]);
  assert.match(event!.explanation, /not confirmed/);
  assert.equal((await events(true)).length, 0);
  const doc = (await store.queryDocuments({ limit: 1, offset: 0 })).documents[0]!;
  assert.equal(doc.version, 2);
  assert.equal(doc.confirmedChange, null);
  const versions = await store.listVersions(doc.docId);
  assert.deepEqual(versions.map((v) => v.version), [1, 2]);
  assert.notEqual(versions[0]!.fingerprint, versions[1]!.fingerprint);
});

test("cosmetic differences — markup, whitespace, case, a newer 'updated' timestamp — raise nothing", async () => {
  const { ingest, events, store } = await engine();
  await ingest(osha, [item()], NOW, true);
  const stats = await ingest(osha, [item({ title: "RESPIRATOR  medical evaluation questionnaire!", summary: "<p>OSHA clarifies   medical evaluation before respirator use.</p>", modifiedAt: "2026-10-12" })], days(1), false);
  assert.equal(stats.revised, 0);
  assert.equal((await events()).length, 0);
  const doc = (await store.queryDocuments({ limit: 1, offset: 0 })).documents[0]!;
  assert.equal(doc.version, 1);
  assert.equal(doc.modifiedDate, "2026-10-12");
});

test("eCFR: a new amendment date is a verified amendment with the issuer's history preserved; the first listing is not an event", async () => {
  const { ingest, events, store } = await engine();
  const part = (latest: string) => item({ externalKey: "ecfr:t29:p1910", url: "https://www.ecfr.gov/current/title-29/part-1910", title: "29 CFR Part 1910 — OSHA General Industry", summary: `Most recent amendment date listed by the eCFR: ${latest}.`, publishedAt: null, modifiedAt: latest, versionKey: latest, priorVersions: ["2024-05-01", "2025-01-10"], docType: "CFR_PART", statusHint: "in_force" });
  await ingest(ecfr, [part("2026-08-20")], NOW, true);
  assert.equal((await events()).length, 0);
  let doc = (await store.queryDocuments({ limit: 1, offset: 0 })).documents[0]!;
  assert.equal(doc.version, 3);
  assert.equal((await store.listVersions(doc.docId)).length, 3);
  await ingest(ecfr, [{ ...part("2026-10-01"), priorVersions: ["2024-05-01", "2025-01-10", "2026-08-20"] }], days(1), false);
  const [event] = await events(true);
  assert.equal(event!.kind, "amendment");
  assert.equal(event!.verified, true);
  assert.match(event!.explanation, /2026-10-01/);
  assert.match(event!.explanation, /2026-08-20/);
  doc = (await store.getDocument(doc.docId))!;
  assert.equal(doc.version, 4);
  assert.equal(doc.modifiedDate, "2026-10-01");
  assert.match(doc.confirmedChange ?? "", /amendment dated 2026-10-01/);
});

// ---- Status & relationships ----------------------------------------------------------------------------------------------------------

const frItems = () => {
  const raw = JSON.parse(FR_JSON); for (const r of raw.results) r.type = r.type === "Rule" ? "RULE" : r.type === "Proposed Rule" ? "PRORULE" : r.type;
  return parseFederalRegister(JSON.stringify(raw));
};

test("a final rule with the same Regulation Identifier Number supersedes the proposed rule — verified, with both directions linked", async () => {
  const { ingest, events, store } = await engine();
  const [proposed, final] = frItems();
  await ingest(frOsha, [proposed!], days(-30), true);
  await ingest(frOsha, [final!], NOW, false);
  const ev = (await events(true)).find((e) => e.kind === "superseded")!;
  assert.ok(ev, "superseded event");
  assert.match(ev.explanation, /1218-AD64/);
  const docs = (await store.queryDocuments({ limit: 10, offset: 0 })).documents;
  const p = docs.find((d) => d.externalKey === "fr:2026-20111")!;
  const f = docs.find((d) => d.externalKey === "fr:2026-29999")!;
  assert.equal(p.status, "superseded"); assert.equal(p.supersededBy, f.docId);
  assert.deepEqual(f.supersedes, [p.docId]); assert.equal(f.previousVersionId, p.docId);
  assert.equal(f.status, "final");
  assert.equal(f.effectiveDate, "2026-12-08");
});

test("order of arrival does not matter: a proposed rule seen after its final rule is marked superseded without a false event", async () => {
  const { ingest, events, store } = await engine();
  const [proposed, final] = frItems();
  await ingest(frOsha, [final!], NOW, true);
  await ingest(frOsha, [proposed!], NOW, true);
  const p = (await store.findDocument({ externalKey: "fr:2026-20111" }))!;
  assert.equal(p.status, "superseded");
  assert.equal((await events()).length, 0);
});

test("a correction marks the corrected document and records a verified event; the correction itself has status 'corrected'", async () => {
  const { ingest, events, store } = await engine();
  const items = frItems();
  await ingest(frOsha, [items[1]!], days(-5), true);
  await ingest(frOsha, [items[2]!], NOW, false);
  const target = (await store.findDocument({ externalKey: "fr:2026-29999" }))!;
  const correction = (await store.findDocument({ externalKey: "fr:2026-30500" }))!;
  assert.deepEqual(target.correctedBy, [correction.docId]);
  assert.equal(correction.status, "corrected"); assert.equal(correction.correctionOf, target.docId);
  const ev = (await events(true)).find((e) => e.kind === "corrected" && e.docId === target.docId)!;
  assert.equal(ev.relatedDocId, correction.docId);
  assert.ok((await store.eventsForDocument(target.docId)).length >= 1);
});

test("a withdrawal notice sharing the Regulation Identifier Number withdraws the earlier proposed rule; unrelated numbers do not", async () => {
  const { ingest, store } = await engine();
  const [proposed, , , withdrawal] = frItems();
  const earlier = { ...proposed!, externalKey: "fr:2026-10000", url: "https://www.federalregister.gov/documents/2026/08/01/2026-10000/med-removal", title: "Medical Removal; Proposed Rule", publishedAt: "2026-08-01", rins: ["1218-ZZ01"] };
  await ingest(frOsha, [earlier, proposed!], days(-40), true);
  await ingest(frOsha, [withdrawal!], NOW, false);
  assert.equal((await store.findDocument({ externalKey: "fr:2026-10000" }))!.status, "withdrawn");
  assert.equal((await store.findDocument({ externalKey: "fr:2026-20111" }))!.status, "proposed");
});

// ---- Service: health, verification, scheduling ---------------------------------------------------------------------------------------

function deps(fetchText: FetchText, store = createMemoryStandardsStore(), now: () => Date = () => NOW): ServiceDeps & { store: ReturnType<typeof createMemoryStandardsStore> } {
  return { store, fetchText, now, sleep: async () => undefined, sources: [osha, sourceOf("osha-directives"), sourceOf("bls-osh"), sourceOf("who-news"), sourceOf("eu-osha")] };
}
const okFeed = RSS(rssItem("Respirator medical evaluation", "https://www.osha.gov/i/1", "Mon, 05 Oct 2026 08:00:00 GMT", "medical evaluation"));

test("verification: a source becomes active only after a successful fetch AND parse; unverified sources stay pending, failures are unavailable", async () => {
  const d = deps(async (url) => (url.includes("interpretations") ? { status: 200, body: okFeed, finalUrl: url } : url.includes("directives") ? { status: 200, body: "<html>nope</html>", finalUrl: url } : { status: 403, body: "", finalUrl: url }));
  const before = await describeSources(d);
  assert.ok(before.every((s) => s.status === "pending_verification"));
  const started = await startRefresh(d, { trigger: "manual" });
  assert.ok(started.accepted);
  const run = await (started as { done: Promise<import("../standards-intel/types").RunRecord> }).done;
  const byId = Object.fromEntries((await describeSources(d)).map((s) => [s.id, s]));
  assert.equal(byId["osha-interpretations"]!.status, "active");
  assert.ok(byId["osha-interpretations"]!.verifiedAt && byId["osha-interpretations"]!.lastSuccessAt);
  assert.equal(byId["osha-interpretations"]!.latestItemTitle, "Respirator medical evaluation");
  assert.equal(byId["osha-directives"]!.status, "unavailable");
  assert.match(byId["osha-directives"]!.lastError!, /HTML page/);
  assert.equal(byId["bls-osh"]!.status, "unavailable");
  assert.equal(byId["bls-osh"]!.httpStatus, 403);
  assert.equal(byId["eu-osha"]!.status, "pending_verification");
  assert.equal(run.results.find((r) => r.sourceId === "eu-osha")!.outcome, "not_ingestible");
  assert.equal(run.status, "completed_with_errors");
  const summary = await ingestionStatus(d);
  assert.equal(summary.sources.verifiedOperational, 1);
  assert.equal(summary.sources.unavailable, 3);
  assert.equal(summary.sources.ingestible, 4);
  assert.equal(summary.sources.registered, 5);
});

test("a failing source never blocks healthy ones, and sources without an endpoint are never fetched", async () => {
  const requested: string[] = [];
  const d = deps(async (url) => { requested.push(url); if (url.includes("osha.gov/laws-regs")) throw new Error("ECONNRESET"); return { status: 200, body: okFeed, finalUrl: url }; });
  const started = await startRefresh(d, { trigger: "manual" });
  const run = await (started as { done: Promise<import("../standards-intel/types").RunRecord> }).done;
  assert.equal(run.results.find((r) => r.sourceId === "osha-interpretations")!.outcome, "failed");
  assert.equal(run.results.find((r) => r.sourceId === "osha-directives")!.outcome, "ok");
  assert.ok(requested.every((u) => !u.includes("osha.europa.eu")));
});

test("a transient failure is retried once; a persistent failure is not hammered", async () => {
  let calls = 0;
  const flaky = deps(async (url) => { calls += 1; if (calls === 1) throw new Error("ETIMEDOUT"); return { status: 200, body: okFeed, finalUrl: url }; });
  flaky.sources = [osha];
  await (await startRefresh(flaky, { trigger: "manual" }) as { done: Promise<unknown> }).done;
  assert.equal(calls, 2);
  assert.equal((await describeSources(flaky))[0]!.status, "active");
  let hard = 0;
  const gone = deps(async (url) => { hard += 1; return { status: 404, body: "", finalUrl: url }; });
  gone.sources = [osha];
  await (await startRefresh(gone, { trigger: "manual" }) as { done: Promise<unknown> }).done;
  assert.equal(hard, 1);
});

test("health transitions: active → degraded on the first failure → unavailable after three, and recovery returns to active", () => {
  let state = applySuccess(blankState(osha, NOW), parseFeedItems(okFeed, "https://x.gov"), [], NOW);
  assert.equal(state.status, "active");
  state = applyFailure(state, new Error("boom"), NOW); assert.equal(state.status, "degraded"); assert.ok(state.lastSuccessAt);
  state = applyFailure(state, new Error("boom"), NOW); assert.equal(state.status, "degraded");
  state = applyFailure(state, new Error("boom"), NOW); assert.equal(state.status, "unavailable"); assert.equal(state.consecutiveFailures, 3);
  state = applySuccess(state, parseFeedItems(okFeed, "https://x.gov"), [], NOW);
  assert.equal(state.status, "active"); assert.equal(state.lastError, null); assert.equal(state.consecutiveFailures, 0);
  const empty = applySuccess(state, [], [], NOW);
  assert.equal(empty.status, "degraded");
  assert.equal(applySuccess(blankState(osha, NOW), [], [], NOW).status, "active");
  assert.equal(applySuccess(blankState(osha, NOW), parseFeedItems(okFeed, "https://x.gov"), ["49 CFR 391: HTTP 500"], NOW).status, "degraded");
});

test("excessive requests are prevented: a second pass inside the interval fetches nothing", async () => {
  let calls = 0;
  const d = deps(async (url) => { calls += 1; return { status: 200, body: okFeed, finalUrl: url }; });
  d.sources = [osha];
  await (await startRefresh(d, { trigger: "scheduled" }) as { done: Promise<unknown> }).done;
  const afterFirst = calls;
  const second = await (await startRefresh(d, { trigger: "manual" }) as { done: Promise<import("../standards-intel/types").RunRecord> }).done;
  assert.equal(calls, afterFirst);
  assert.equal(second.results[0]!.outcome, "skipped");
  assert.match(second.results[0]!.reason ?? "", /minimum interval/);
});

test("concurrent refreshes are refused rather than duplicated", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const d = deps(async (url) => { await gate; return { status: 200, body: okFeed, finalUrl: url }; });
  d.sources = [osha];
  const first = await startRefresh(d, { trigger: "manual" });
  const second = await startRefresh(d, { trigger: "manual" });
  assert.ok(first.accepted); assert.equal(second.accepted, false);
  assert.ok(!second.accepted && second.runningRunId === (first as { runId: string }).runId);
  release();
  await (first as { done: Promise<unknown> }).done;
  assert.ok((await startRefresh(d, { trigger: "manual" })).accepted);
});

test("persistence: a broad feed keeps only occupationally relevant items and the first pass is a baseline", async () => {
  const who = RSS(rssItem("WHO publishes guidance on workers' exposure to silica and medical surveillance", "https://www.who.int/news/1", "Mon, 05 Oct 2026 08:00:00 GMT", "occupational health") + rssItem("WHO statement on football tournament", "https://www.who.int/news/2", "Mon, 05 Oct 2026 08:00:00 GMT", ""));
  const d = deps(async (url) => ({ status: 200, body: who, finalUrl: url }));
  d.sources = [sourceOf("who-news")];
  const run = await (await startRefresh(d, { trigger: "manual" }) as { done: Promise<import("../standards-intel/types").RunRecord> }).done;
  assert.equal(run.results[0]!.created, 1);
  assert.equal(run.results[0]!.filteredOut, 1);
  assert.equal((await d.store.listEvents({ verifiedOnly: false, limit: 10, offset: 0 })).total, 0);
});

// ---- HTTP endpoints ------------------------------------------------------------------------------------------------------------------

test("endpoints: every documented route answers with real data from the store, filters work, and refresh reports results", async () => {
  const feeds: Record<string, string> = { "osha-interpretations": okFeed };
  const d = deps(async (url) => ({ status: 200, body: url.includes("interpretations") ? okFeed : RSS(rssItem("Heat illness prevention final rule", "https://www.osha.gov/d/9", "Tue, 06 Oct 2026 08:00:00 GMT", "heat stress medical surveillance")), finalUrl: url }));
  void feeds;
  d.sources = [osha, sourceOf("osha-directives"), sourceOf("eu-osha")];
  const app = express(); app.use(express.json()); app.use("/api", createStandardsIntelRouter(d));
  const server: Server = await new Promise((resolve) => { const s = createServer(app).listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/standards-intel`;
  const get = async (path: string) => { const r = await fetch(`${base}${path}`); const raw = await r.text(); let body: any = null; try { body = JSON.parse(raw); } catch { /* an HTML 404 from express has no JSON body */ } return { status: r.status, body }; };
  try {
    assert.ok((await get("")).body.endpoints.length >= 9);
    const refresh = await fetch(`${base}/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const refreshed = await refresh.json() as any;
    assert.equal(refresh.status, 200);
    assert.equal(refreshed.run.totals.ok, 2);
    assert.equal((await fetch(`${base}/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceIds: ["nope"] }) })).status, 400);
    const updates = await get("/updates");
    assert.equal(updates.body.total, 2);
    assert.equal(updates.body.documents[0].detection.newlyObserved, false);
    assert.equal((await get("/updates?category=respiratory")).body.total, 1);
    assert.equal((await get("/updates?q=heat")).body.total, 1);
    assert.equal((await get("/updates?source=osha-directives")).body.total, 1);
    assert.equal((await get("/documents?jurisdiction=Nowhere")).body.total, 0);
    const id = updates.body.documents[0].docId;
    const detail = await get(`/documents/${id}`);
    assert.equal(detail.body.versions.length, 1);
    assert.ok(detail.body.document.citations.length >= 1);
    assert.equal((await get("/documents/missing")).status, 404);
    assert.equal((await get("/changes")).body.verifiedOnly, true);
    assert.equal((await get("/changes?includeUnverified=1")).body.verifiedOnly, false);
    const facets = (await get("/facets")).body;
    assert.ok(facets.categories.length > 0 && facets.jurisdictions[0].id === "United States (federal)" && facets.categoryDefinitions.respiratory);
    const sources = (await get("/sources")).body;
    assert.equal(sources.count, 3);
    assert.equal((await get("/sources?status=active")).body.count, 2);
    assert.equal((await get("/sources/eu-osha")).body.source.status, "pending_verification");
    assert.ok((await get("/agencies")).body.monitoredAgencies.length >= 2);
    const status = (await get("/status")).body;
    assert.equal(status.sources.verifiedOperational, 2);
    assert.equal(status.lastRun.trigger, "manual");
    const runs = await get("/runs");
    assert.equal(runs.body.runs.length, 1);
    assert.equal((await get(`/runs/${runs.body.runs[0].runId}`)).status, 200);
    // The retired evaluator must not exist under the new router either.
    assert.equal((await get("/evaluate")).status, 404);
    assert.equal((await get("/catalog")).status, 404);
  } finally {
    server.close();
  }
});

// ---- Regressions found against the live endpoints ------------------------------------------------------------------------------------

test("Federal Register: a query that matches nothing ({\"count\":0} with no results key) is an empty, valid answer", () => {
  assert.deepEqual(parseFederalRegister(JSON.stringify({ count: 0, description: "No documents", total_pages: 0 })), []);
  assert.throws(() => parseFederalRegister(JSON.stringify({ count: 3 })), /no results/);
});

test("eCFR: a part with no amendments inside the date window is read again without the window instead of failing", async () => {
  const calls: string[] = [];
  const history = JSON.stringify({ content_versions: [{ amendment_date: "2023-12-01", issue_date: "2023-12-03" }] });
  const fetchText: FetchText = async (url) => { calls.push(url); return { status: 200, body: url.includes("issue_date") ? JSON.stringify({ content_versions: [] }) : history, finalUrl: url }; };
  const one = { ...ecfr, ecfr: [{ title: 29, part: 1904, label: "OSHA Recording and Reporting" }] };
  const result = await fetchSource(one, fetchText, NOW);
  assert.equal(result.items[0]!.versionKey, "2023-12-01");
  assert.equal(result.partialErrors.length, 0);
  assert.equal(calls.length, 2);
});

test("a source that never answers is cut off at its deadline and reported, and the other sources still complete", async () => {
  const d = deps(async (url) => (url.includes("interpretations") ? new Promise<never>(() => undefined) : { status: 200, body: okFeed, finalUrl: url }));
  d.sources = [osha, sourceOf("osha-directives")];
  d.sourceTimeoutMs = 40;
  const started = await startRefresh(d, { trigger: "manual" });
  const run = await (started as { done: Promise<import("../standards-intel/types").RunRecord> }).done;
  const stuck = run.results.find((r) => r.sourceId === "osha-interpretations")!;
  assert.equal(stuck.outcome, "failed");
  assert.match(stuck.reason ?? "", /did not finish within/);
  assert.equal(run.results.find((r) => r.sourceId === "osha-directives")!.outcome, "ok");
  assert.equal(run.status, "completed_with_errors");
});

test("a run left 'running' by a replaced instance is closed as failed and a stale lease is cleared at start-up", async () => {
  const d = deps(async (url) => ({ status: 200, body: okFeed, finalUrl: url }));
  d.sources = [osha];
  await d.store.startRun({ runId: "run_dead", trigger: "scheduled", scope: "all", startedAt: "2026-10-12T10:00:00Z", finishedAt: null, status: "running", results: [], totals: { sources: 0, ok: 0, failed: 0, skipped: 0, created: 0, revised: 0, events: 0 } });
  await d.store.acquireLease("standards-intel-refresh", "dead-instance", 60_000, NOW);
  assert.equal((await startRefresh(d, { trigger: "manual" })).accepted, false);
  await d.store.clearLease("standards-intel-refresh");
  const started = await startRefresh(d, { trigger: "manual" });
  assert.ok(started.accepted);
  await (started as { done: Promise<unknown> }).done;
  const dead = await d.store.getRun("run_dead");
  assert.equal(dead!.status, "failed");
  assert.ok(dead!.finishedAt);
});

test("registry: NIOSH is not registered as its own Federal Register agency (it is not one) and no unconfirmed blog feed is fetched", () => {
  assert.ok(!STANDARDS_SOURCES.some((s) => s.id === "fr-niosh"));
  assert.equal(sourceOf("niosh-publications").url, null);
  const c = classify({ title: "NIOSH respirator approval", summary: "", source: sourceOf("fr-cdc") });
  assert.ok(c.categories.includes("occupational_medicine") && c.categories.includes("respiratory"));
});
