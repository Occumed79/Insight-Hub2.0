// Collects official command news / press releases / documents / transcripts, tracks them durably, and reports per-source and per-feed health.
//
// Every source is evaluated independently: one command site being down never hides the others. A failed refresh with tracked records serves
// the last-known items labeled STALE_CACHE together with the time of the last successful fetch. Absence of items is reported as
// "source returned no data", never as "nothing happened". Nothing here interprets an item or touches a medical requirement.
//
// Durable state lives in the existing AOR cache store (Neon-backed, with an in-process layer): per source, one tracked record per publication with
// first-seen / last-seen / last-changed times and a change log, so "new" and "updated" mean something even after a restart.

import { createHash } from "node:crypto";
import type { CacheStore } from "../cache";
import type { CommandId } from "../command-policy/assignments-rows";
import type { Freshness } from "../types";
import { COMMAND_NEWS_COMMANDS, COMMAND_NEWS_SOURCES, sourcesForCommand, type CommandNewsSource, type NewsKind, type UrlBasis } from "./sources";
import { canonicalUrl, describeDirectoryPage, discoverDirectoryFeeds, discoverFeedUrls, healthTerms, looksLikeFeed, normalizeTitle, parseFeed, parseListing, policyTerms, classifyFeedKind, type ParsedItem } from "./parse";
import { countryTags, type CountryTag } from "./countries";

export type NewsSourceStatus = "ok" | "source_returned_no_data" | "source_unavailable" | "stale_cache";
export type NewsMethod = "feed" | "atom_feed" | "discovered_feed" | "html_listing";
export type FeedRole = "rss" | "atom" | "discovered" | "listing_advertised" | "directory" | "listing";
export type FeedStatus = "ok" | "no_items" | "unavailable" | "not_needed";

export interface FeedAttempt {
  url: string;
  role: FeedRole;
  kind: NewsKind | null;
  label: string | null;
  status: FeedStatus;
  httpStatus: number | null;
  itemCount: number;
  error: string | null;
  attemptedAt: string;
}

export interface NewsProvenance { sourceId: string; sourceName: string; kind: NewsKind; feedUrls: string[] }
export interface NewsChange { at: string; fields: string[] }

export interface NewsItem {
  id: string;
  command: CommandId;
  /** The source that first reported the item, kept for compatibility; `sources` lists every source it was seen in. */
  sourceId: string;
  sourceName: string;
  kind: NewsKind;
  title: string;
  url: string;
  summary: string;
  /** null when the source did not state a date (HTML listings often do not). */
  publishedAt: string | null;
  /** The source's own "updated" stamp (Atom <updated>), when it gave one. */
  updatedAt: string | null;
  /** Where an undated listing item sits in the stream (from the page's own order). Not a date; never displayed as one. */
  orderHint: string | null;
  /** First time this monitor saw the item. */
  firstSeenAt: string;
  lastSeenAt: string;
  /** Last time the item's title, description or dates changed in the source. null when never observed to change. */
  lastChangedAt: string | null;
  changeCount: number;
  lastChange: NewsChange | null;
  /** True when the item was already on the source the first time this monitor read it, so "first seen" says nothing about when it was published. */
  baseline: boolean;
  /** Same as lastSeenAt; kept for compatibility. */
  retrievedAt: string;
  freshness: Freshness;
  lastKnownData: boolean;
  /** Keyword matches in the item's own title/description; a convenience filter, not a finding. */
  healthTerms: string[];
  /** Subset of healthTerms that is medical-policy wording (force health protection, medical clearance …); still not a requirement. */
  policyTerms: string[];
  /** Countries the item's own words name (title, description, source category) within this command; empty = command-wide. */
  countries: CountryTag[];
  sources: NewsProvenance[];
}

export interface NewsSourceReport {
  sourceId: string;
  sourceName: string;
  command: CommandId;
  kind: NewsKind | "mixed";
  listingUrl: string;
  officialSite: string;
  urlBasis: UrlBasis;
  status: NewsSourceStatus;
  method: NewsMethod | null;
  /** First feed that produced items (kept for compatibility); every address tried is in `feeds`. */
  feedUrl: string | null;
  httpStatus: number | null;
  itemCount: number;
  trackedCount: number;
  lastAttemptedFetch: string | null;
  lastSuccessfulFetch: string | null;
  sourceError: string | null;
  note: string | null;
  lastKnownData: boolean;
  feeds: FeedAttempt[];
}

export interface FetchedText { status: number; body: string; finalUrl: string }
export type FetchText = (url: string) => Promise<FetchedText>;

export interface NewsDeps {
  store: CacheStore;
  fetchText: FetchText;
  now?: () => Date;
}

interface TrackedRecord {
  id: string;
  url: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  updatedAt: string | null;
  kind: NewsKind;
  categories: string[];
  feedUrls: string[];
  hash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt: string | null;
  changes: NewsChange[];
  baseline: boolean;
  inFeed: boolean;
  /** Sort position for listing items whose date the page does not state; never displayed as a date. */
  orderHint?: string | null;
}

interface Stored { v: 2; records: TrackedRecord[]; report: NewsSourceReport }

const FRESH_MS = 30 * 60_000;
const FAILURE_RETRY_MS = 5 * 60_000;
const MIN_REFRESH_MS = 60_000;
/** A site that refused every address (401/403) is not retried for this long, even on a forced refresh: the block will not clear in minutes, and re-requesting every run only invites a harder block. */
const BLOCKED_RETRY_MS = 6 * 3_600_000;
const BLOCKED_NOTE = "The site refused automated requests from this server (HTTP 401/403). It is retried every 6 hours, not on every refresh.";

/** Every address failed, at least one with 401/403, and the rest only with 401/403 or a network error (no 404 or parse failure). */
function refusedByOperator(feeds: Array<{ status: string; httpStatus: number | null }>): boolean {
  const refused = (code: number | null) => code === 401 || code === 403;
  return feeds.length > 0 && feeds.every((feed) => feed.status === "unavailable" && (refused(feed.httpStatus) || feed.httpStatus === null)) && feeds.some((feed) => refused(feed.httpStatus));
}
const KEEP_MS = 90 * 24 * 3_600_000;
const FORGET_MS = 60 * 24 * 3_600_000;
const MAX_TRACKED_PER_SOURCE = 200;
const MAX_FEEDS_PER_SOURCE = 16;
const FEED_CONCURRENCY = 4;
const MAX_CHANGES = 5;

class SourceFailure extends Error {
  constructor(message: string, readonly httpStatus: number | null = null) { super(message); }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const ageMs = (iso: string | null, now: Date) => (iso ? now.getTime() - Date.parse(iso) : Number.POSITIVE_INFINITY);
const itemId = (url: string) => createHash("sha1").update(canonicalUrl(url)).digest("hex").slice(0, 16);
const hashOf = (item: Pick<ParsedItem, "title" | "summary" | "publishedAt" | "updatedAt">) => createHash("sha1").update(JSON.stringify([item.title, item.summary, item.publishedAt, item.updatedAt])).digest("hex").slice(0, 16);

// When one publication appears in several feeds (an article that is also a press release), the most specific type wins.
const KIND_PRIORITY: NewsKind[] = ["transcript", "press_release", "publication", "news"];
const moreSpecific = (a: NewsKind, b: NewsKind) => (KIND_PRIORITY.indexOf(a) <= KIND_PRIORITY.indexOf(b) ? a : b);

async function getText(deps: NewsDeps, url: string): Promise<FetchedText> {
  let fetched: FetchedText;
  try {
    fetched = await deps.fetchText(url);
  } catch (error) {
    throw new SourceFailure(`Request failed: ${errorText(error)}`);
  }
  if (fetched.status >= 400) throw new SourceFailure(`Source returned HTTP ${fetched.status}${fetched.status === 401 || fetched.status === 403 ? " (the site refused this automated request)" : ""}`, fetched.status);
  return fetched;
}

interface Gathered { item: ParsedItem; kind: NewsKind; feedUrl: string | null }
interface Attempt { gathered: Gathered[]; feeds: FeedAttempt[]; methods: NewsMethod[]; pageStatus: number | null }

async function runPool<T>(tasks: Array<() => Promise<T>>, size: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (next < tasks.length) { const index = next++; out[index] = await tasks[index](); }
  }));
  return out;
}

async function readFeed(deps: NewsDeps, url: string, role: FeedRole, kind: NewsKind | null, label: string | null, at: string): Promise<{ attempt: FeedAttempt; items: ParsedItem[] }> {
  try {
    const feed = await getText(deps, url);
    if (!looksLikeFeed(feed.body)) return { attempt: { url, role, kind, label, status: "unavailable", httpStatus: feed.status, itemCount: 0, error: "The address answered with something that is not an RSS/Atom feed.", attemptedAt: at }, items: [] };
    const items = parseFeed(feed.body, feed.finalUrl);
    return { attempt: { url, role, kind, label, status: items.length ? "ok" : "no_items", httpStatus: feed.status, itemCount: items.length, error: null, attemptedAt: at }, items };
  } catch (error) {
    return { attempt: { url, role, kind, label, status: "unavailable", httpStatus: error instanceof SourceFailure ? error.httpStatus : null, itemCount: 0, error: errorText(error), attemptedAt: at }, items: [] };
  }
}

async function attempt(source: CommandNewsSource, deps: NewsDeps, at: string): Promise<Attempt> {
  const out: Attempt = { gathered: [], feeds: [], methods: [], pageStatus: null };
  const fixedKind: NewsKind = source.kind === "mixed" ? "news" : source.kind;

  // 1. Supplied feeds: RSS first, its Atom equivalent only when the RSS address fails or is empty.
  for (let i = 0; i < source.feedUrls.length; i++) {
    const rss = await readFeed(deps, source.feedUrls[i], "rss", fixedKind, null, at);
    out.feeds.push(rss.attempt);
    if (rss.attempt.status === "ok") { out.methods.push("feed"); out.gathered.push(...rss.items.map((item) => ({ item, kind: fixedKind, feedUrl: source.feedUrls[i] }))); continue; }
    const atomUrl = source.atomUrls[i];
    if (!atomUrl) continue;
    const atom = await readFeed(deps, atomUrl, "atom", fixedKind, null, at);
    out.feeds.push(atom.attempt);
    if (atom.attempt.status === "ok") { out.methods.push("atom_feed"); out.gathered.push(...atom.items.map((item) => ({ item, kind: fixedKind, feedUrl: atomUrl }))); }
  }

  // 2. An official RSS directory: discover each listed feed, then read them.
  if (source.directoryUrl) {
    try {
      const directory = await getText(deps, source.directoryUrl);
      const feeds = discoverDirectoryFeeds(directory.body, directory.finalUrl, MAX_FEEDS_PER_SOURCE);
      out.pageStatus = directory.status;
      out.feeds.push({ url: source.directoryUrl, role: "directory", kind: null, label: "RSS directory", status: feeds.length ? "ok" : "no_items", httpStatus: directory.status, itemCount: feeds.length, error: feeds.length ? null : describeDirectoryPage(directory.body, directory.finalUrl), attemptedAt: at });
      const results = await runPool(feeds.map((feed) => () => readFeed(deps, feed.url, "discovered", feed.kind, feed.label || null, at)), FEED_CONCURRENCY);
      results.forEach((result, index) => {
        out.feeds.push(result.attempt);
        if (result.attempt.status === "ok") { out.methods.push("discovered_feed"); out.gathered.push(...result.items.map((item) => ({ item, kind: feeds[index].kind, feedUrl: feeds[index].url }))); }
      });
    } catch (error) {
      out.feeds.push({ url: source.directoryUrl, role: "directory", kind: null, label: "RSS directory", status: "unavailable", httpStatus: error instanceof SourceFailure ? error.httpStatus : null, itemCount: 0, error: errorText(error), attemptedAt: at });
    }
  }

  // 3. The listing page: a feed it advertises, else (when allowed) the page itself as a monitored listing. Not needed when feeds already produced items.
  if (!out.gathered.length && source.listingUrl && !source.directoryUrl) {
    try {
      const listing = await getText(deps, source.listingUrl);
      out.pageStatus = listing.status;
      if (looksLikeFeed(listing.body)) {
        const items = parseFeed(listing.body, listing.finalUrl);
        out.feeds.push({ url: source.listingUrl, role: "listing", kind: fixedKind, label: null, status: items.length ? "ok" : "no_items", httpStatus: listing.status, itemCount: items.length, error: null, attemptedAt: at });
        if (items.length) { out.methods.push("feed"); out.gathered.push(...items.map((item) => ({ item, kind: fixedKind, feedUrl: source.listingUrl }))); }
      } else {
        // DVIDS advertises a site-wide /rss/news feed on unit pages, NOT a filtered unit feed.
        // Following it would falsely attribute unrelated global DoD news to this combatant command.
        // DVIDS command-unit sources must parse only the actual unit listing; native command feeds still use discovery.
        if (!source.id.startsWith("dvids-")) {
          for (const feedUrl of discoverFeedUrls(listing.body, listing.finalUrl)) {
            const advertised = await readFeed(deps, feedUrl, "listing_advertised", fixedKind, null, at);
            out.feeds.push(advertised.attempt);
            if (advertised.attempt.status === "ok") { out.methods.push("discovered_feed"); out.gathered.push(...advertised.items.map((item) => ({ item, kind: fixedKind, feedUrl }))); break; }
          }
        }
        if (!out.gathered.length && source.listingFallback) {
          const items = parseListing(listing.body, listing.finalUrl);
          out.feeds.push({ url: source.listingUrl, role: "listing", kind: fixedKind, label: "page listing", status: items.length ? "ok" : "no_items", httpStatus: listing.status, itemCount: items.length, error: null, attemptedAt: at });
          if (items.length) { out.methods.push("html_listing"); out.gathered.push(...items.map((item) => ({ item, kind: fixedKind, feedUrl: null }))); }
        }
      }
    } catch (error) {
      out.feeds.push({ url: source.listingUrl, role: "listing", kind: fixedKind, label: "page listing", status: "unavailable", httpStatus: error instanceof SourceFailure ? error.httpStatus : null, itemCount: 0, error: errorText(error), attemptedAt: at });
    }
  }
  return out;
}

const pageUrl = (source: CommandNewsSource) => source.listingUrl ?? source.directoryUrl ?? source.officialSite;

const baseReport = (source: CommandNewsSource): Pick<NewsSourceReport, "sourceId" | "sourceName" | "command" | "kind" | "listingUrl" | "officialSite" | "urlBasis"> => ({
  sourceId: source.id, sourceName: source.label, command: source.command, kind: source.kind, listingUrl: pageUrl(source), officialSite: source.officialSite, urlBasis: source.urlBasis,
});

const METHOD_ORDER: NewsMethod[] = ["feed", "atom_feed", "discovered_feed", "html_listing"];

/** Folds one fetch into the tracked records: new items get first-seen stamps; known items are compared by content hash to detect changes. */
export function track(previous: TrackedRecord[], gathered: Gathered[], now: Date, baseline: boolean, markAbsent: boolean): TrackedRecord[] {
  const stamp = now.toISOString();
  const byId = new Map(previous.map((record) => [record.id, { ...record }]));
  const current = new Map<string, { item: ParsedItem; kind: NewsKind; feedUrls: Set<string> }>();
  for (const entry of gathered) {
    const id = itemId(entry.item.url);
    const existing = current.get(id);
    if (!existing) current.set(id, { item: entry.item, kind: entry.kind, feedUrls: new Set(entry.feedUrl ? [entry.feedUrl] : []) });
    else {
      existing.kind = moreSpecific(existing.kind, entry.kind);
      if (entry.feedUrl) existing.feedUrls.add(entry.feedUrl);
      if (entry.item.summary.length > existing.item.summary.length) existing.item = { ...existing.item, summary: entry.item.summary };
      if (!existing.item.publishedAt && entry.item.publishedAt) existing.item = { ...existing.item, publishedAt: entry.item.publishedAt };
      if (!existing.item.updatedAt && entry.item.updatedAt) existing.item = { ...existing.item, updatedAt: entry.item.updatedAt };
    }
  }
  for (const [id, { item, kind, feedUrls }] of current) {
    const hash = hashOf(item);
    const known = byId.get(id);
    if (!known) {
      byId.set(id, { id, url: canonicalUrl(item.url), title: item.title, summary: item.summary, publishedAt: item.publishedAt, updatedAt: item.updatedAt, kind, categories: item.categories, feedUrls: [...feedUrls], hash, firstSeenAt: stamp, lastSeenAt: stamp, lastChangedAt: null, changes: [], baseline, inFeed: true, orderHint: item.orderHint ?? null });
      continue;
    }
    const fields: string[] = [];
    if (known.title !== item.title) fields.push("title");
    if (known.summary !== item.summary) fields.push("description");
    // A listing page that did not state a date this time must not erase a date an earlier read found.
    const publishedAt = item.publishedAt ?? known.publishedAt;
    if (known.publishedAt !== publishedAt) fields.push("published date");
    const updatedAt = item.updatedAt ?? known.updatedAt;
    if (known.updatedAt !== updatedAt) fields.push("updated date");
    known.kind = moreSpecific(known.kind, kind);
    known.feedUrls = [...new Set([...known.feedUrls, ...feedUrls])];
    known.categories = item.categories.length ? item.categories : known.categories;
    known.lastSeenAt = stamp;
    known.inFeed = true;
    known.orderHint = item.orderHint ?? known.orderHint ?? null;
    if (fields.length) {
      known.title = item.title; known.summary = item.summary; known.publishedAt = publishedAt; known.updatedAt = updatedAt; known.hash = hash;
      known.lastChangedAt = stamp;
      known.changes = [{ at: stamp, fields }, ...known.changes].slice(0, MAX_CHANGES);
    }
  }
  const records = [...byId.values()];
  if (markAbsent) for (const record of records) if (!current.has(record.id)) record.inFeed = false;
  const fresh = records.filter((record) => now.getTime() - Date.parse(record.lastSeenAt) < FORGET_MS);
  const sortKey = (record: TrackedRecord) => record.publishedAt ?? record.updatedAt ?? record.orderHint ?? record.firstSeenAt;
  return fresh.sort((a, b) => sortKey(b).localeCompare(sortKey(a))).slice(0, MAX_TRACKED_PER_SOURCE);
}

const inflight = new Map<string, Promise<Stored>>();

export function collectSource(source: CommandNewsSource, deps: NewsDeps, options: { refresh?: boolean } = {}): Promise<Stored> {
  const running = inflight.get(source.id);
  if (running) return running;
  const promise = collectSourceNow(source, deps, options).finally(() => inflight.delete(source.id));
  inflight.set(source.id, promise);
  return promise;
}

// Unit sources previously followed DVIDS's unfiltered, global /rss/news advert.
// Start them in an isolated namespace so global stories cannot survive as command news
 // from the earlier incorrect cache; retain existing cache history for all native feeds.
const storageKey = (source: CommandNewsSource) => `command-news:${source.id.startsWith("dvids-") ? "v3" : "v2"}:${source.id}`;

async function loadStored(source: CommandNewsSource, deps: NewsDeps): Promise<Stored | null> {
  const payload = (await deps.store.get<Stored>(storageKey(source)).catch(() => null))?.payload ?? null;
  return payload && payload.v === 2 && Array.isArray(payload.records) && payload.report ? payload : null;
}

async function collectSourceNow(source: CommandNewsSource, deps: NewsDeps, options: { refresh?: boolean }): Promise<Stored> {
  const now = (deps.now ?? (() => new Date()))();
  const cached = await loadStored(source, deps);
  if (cached) {
    const since = ageMs(cached.report.lastAttemptedFetch, now);
    const blocked = (cached.report.status === "source_unavailable" || cached.report.status === "stale_cache") && refusedByOperator(cached.report.feeds);
    const limit = blocked ? BLOCKED_RETRY_MS : options.refresh ? MIN_REFRESH_MS : cached.report.status === "source_unavailable" ? FAILURE_RETRY_MS : FRESH_MS;
    if (since < limit) return cached;
  }
  const stamp = now.toISOString();
  const found = await attempt(source, deps, stamp);
  const failed = found.feeds.filter((feed) => feed.status === "unavailable");
  const reachable = found.feeds.some((feed) => feed.status === "ok" || feed.status === "no_items");
  const previousRecords = cached?.records ?? [];
  const everSucceeded = Boolean(cached?.report.lastSuccessfulFetch);
  let stored: Stored;

  if (found.gathered.length) {
    const records = track(previousRecords, found.gathered, now, !everSucceeded, failed.length === 0);
    const used = METHOD_ORDER.find((method) => found.methods.includes(method)) ?? null;
    const firstFeed = found.feeds.find((feed) => feed.status === "ok" && feed.role !== "directory" && feed.role !== "listing") ?? found.feeds.find((feed) => feed.status === "ok") ?? null;
    const unreadable = failed.length;
    const totalFeeds = found.feeds.filter((feed) => feed.role !== "directory").length;
    stored = {
      v: 2, records,
      report: {
        ...baseReport(source), status: "ok", method: used, feedUrl: firstFeed?.url ?? null, httpStatus: firstFeed?.httpStatus ?? found.pageStatus, itemCount: records.filter((record) => record.inFeed).length, trackedCount: records.length,
        lastAttemptedFetch: stamp, lastSuccessfulFetch: stamp, sourceError: unreadable ? failed.map((feed) => `${feed.url}: ${feed.error}`).join("; ").slice(0, 600) : null,
        note: used === "html_listing"
          ? "No feed was available; items were read from the official listing page and carry a date only where the page states one."
          : unreadable ? `${unreadable} of ${totalFeeds} feed ${totalFeeds === 1 ? "address" : "addresses"} could not be read this time; items from the others are shown.` : null,
        lastKnownData: false, feeds: found.feeds,
      },
    };
  } else if (reachable) {
    stored = {
      v: 2, records: previousRecords,
      report: {
        ...baseReport(source), status: "source_returned_no_data", method: null, feedUrl: null, httpStatus: found.pageStatus ?? found.feeds.find((feed) => feed.httpStatus)?.httpStatus ?? null, itemCount: 0, trackedCount: previousRecords.length,
        lastAttemptedFetch: stamp, lastSuccessfulFetch: cached?.report.lastSuccessfulFetch ?? null,
        sourceError: failed.length ? failed.map((feed) => `${feed.url}: ${feed.error}`).join("; ").slice(0, 600) : null,
        note: "The source answered but no items could be read from it. This is not evidence that the command published nothing.",
        lastKnownData: previousRecords.length > 0, feeds: found.feeds,
      },
    };
  } else {
    const message = found.feeds.length ? found.feeds.map((feed) => `${feed.error ?? "failed"}`).filter((text, index, all) => all.indexOf(text) === index).join("; ").slice(0, 400) : "No address is registered for this source.";
    const httpStatus = found.feeds.find((feed) => feed.httpStatus)?.httpStatus ?? null;
    const blockedNote = refusedByOperator(found.feeds) ? BLOCKED_NOTE : null;
    stored = previousRecords.length
      ? {
        v: 2, records: previousRecords,
        report: { ...cached!.report, status: "stale_cache", httpStatus, itemCount: previousRecords.length, trackedCount: previousRecords.length, lastAttemptedFetch: stamp, sourceError: message, note: `The latest refresh failed; these are the last items successfully retrieved.${blockedNote ? ` ${blockedNote}` : ""}`, lastKnownData: true, feeds: found.feeds },
      }
      : {
        v: 2, records: [],
        report: { ...baseReport(source), status: "source_unavailable", method: null, feedUrl: null, httpStatus, itemCount: 0, trackedCount: 0, lastAttemptedFetch: stamp, lastSuccessfulFetch: cached?.report.lastSuccessfulFetch ?? null, sourceError: message, note: blockedNote, lastKnownData: false, feeds: found.feeds },
      };
  }
  await deps.store.set(storageKey(source), stored, KEEP_MS, now).catch(() => undefined);
  return stored;
}

export type NewsCoverage = "all_sources_ok" | "some_sources_unavailable" | "no_source_available";

export interface CommandNewsResponse {
  ok: true;
  command: CommandId;
  generatedAt: string;
  coverage: NewsCoverage;
  items: NewsItem[];
  sources: NewsSourceReport[];
  counts: { total: number; byKind: Record<NewsKind, number>; duplicatesMerged: number; health: number; countrySpecific: number };
  limitations: string[];
}

export const NEWS_LIMITATIONS = [
  "These are the command's own public communications. They are context for review, not medical requirements, and they never change a REQUIRED / RECOMMENDED / CONDITIONAL status.",
  "Only the sources listed here are monitored. An empty list means nothing was retrieved from them, not that the command published nothing.",
  "Items are shown exactly as the source states them; titles and descriptions are not summarized or interpreted.",
  "A country is attached to an item only when the item's own title, description or source category names it. Every other item is command-wide.",
];

const sortKey = (item: NewsItem) => item.publishedAt ?? item.updatedAt ?? item.orderHint ?? "";
const byRecency = (a: NewsItem, b: NewsItem) => sortKey(b).localeCompare(sortKey(a)) || b.firstSeenAt.localeCompare(a.firstSeenAt);

function toItem(record: TrackedRecord, source: CommandNewsSource, command: CommandId, stale: boolean): NewsItem {
  const text = `${record.title} ${record.summary} ${record.categories.join(" ")}`;
  return {
    id: record.id, command, sourceId: source.id, sourceName: source.label, kind: record.kind, title: record.title, url: record.url, summary: record.summary,
    publishedAt: record.publishedAt, updatedAt: record.updatedAt, orderHint: record.orderHint ?? null, firstSeenAt: record.firstSeenAt, lastSeenAt: record.lastSeenAt, lastChangedAt: record.lastChangedAt,
    changeCount: record.changes.length, lastChange: record.changes[0] ?? null, baseline: record.baseline, retrievedAt: record.lastSeenAt,
    freshness: stale ? "STALE_CACHE" : "CURRENT_NOTICE", lastKnownData: stale,
    healthTerms: healthTerms(text), policyTerms: policyTerms(text), countries: countryTags(command, { title: record.title, summary: record.summary, categories: record.categories }),
    sources: [{ sourceId: source.id, sourceName: source.label, kind: record.kind, feedUrls: record.feedUrls }],
  };
}

function merge(into: NewsItem, other: NewsItem): NewsItem {
  const sources = [...into.sources];
  for (const entry of other.sources) {
    const same = sources.find((existing) => existing.sourceId === entry.sourceId);
    if (same) same.feedUrls = [...new Set([...same.feedUrls, ...entry.feedUrls])];
    else sources.push(entry);
  }
  const richer = other.summary.length > into.summary.length ? other : into;
  const changed = [into, other].filter((item) => item.lastChange).sort((a, b) => b.lastChange!.at.localeCompare(a.lastChange!.at))[0];
  return {
    ...into, kind: moreSpecific(into.kind, other.kind), title: richer.title, summary: richer.summary,
    publishedAt: into.publishedAt ?? other.publishedAt, orderHint: into.orderHint ?? other.orderHint, updatedAt: [into.updatedAt, other.updatedAt].filter(Boolean).sort().pop() ?? null,
    firstSeenAt: into.firstSeenAt < other.firstSeenAt ? into.firstSeenAt : other.firstSeenAt,
    lastSeenAt: into.lastSeenAt > other.lastSeenAt ? into.lastSeenAt : other.lastSeenAt,
    lastChangedAt: changed?.lastChangedAt ?? null, changeCount: Math.max(into.changeCount, other.changeCount), lastChange: changed?.lastChange ?? null,
    baseline: into.baseline && other.baseline, retrievedAt: into.lastSeenAt > other.lastSeenAt ? into.lastSeenAt : other.lastSeenAt,
    freshness: into.freshness === "CURRENT_NOTICE" || other.freshness === "CURRENT_NOTICE" ? "CURRENT_NOTICE" : "STALE_CACHE",
    lastKnownData: into.lastKnownData && other.lastKnownData, sources,
    healthTerms: [...new Set([...into.healthTerms, ...other.healthTerms])], policyTerms: [...new Set([...into.policyTerms, ...other.policyTerms])],
    countries: [...new Map([...into.countries, ...other.countries].map((tag) => [tag.id, tag])).values()],
  };
}

/**
 * Cross-feed deduplication. First by canonical address (the same publication in the articles and press-release feeds, or in a feed and a listing),
 * then by identical title and identical stated publication date within the command (the same story under two addresses).
 */
export function dedupe(items: NewsItem[]): { items: NewsItem[]; merged: number } {
  const byId = new Map<string, NewsItem>();
  let merged = 0;
  for (const item of items) {
    const existing = byId.get(item.id);
    if (existing) { byId.set(item.id, merge(existing, item)); merged++; } else byId.set(item.id, item);
  }
  const byStory = new Map<string, NewsItem>();
  const out: NewsItem[] = [];
  for (const item of byId.values()) {
    const key = item.publishedAt ? `${normalizeTitle(item.title)}|${item.publishedAt.slice(0, 10)}` : null;
    const twin = key ? byStory.get(key) : undefined;
    if (twin) { const index = out.indexOf(twin); const combined = merge(twin, item); out[index] = combined; byStory.set(key!, combined); merged++; continue; }
    out.push(item);
    if (key) byStory.set(key, item);
  }
  return { items: out, merged };
}

export async function getCommandNews(command: CommandId, deps: NewsDeps, options: { refresh?: boolean } = {}): Promise<CommandNewsResponse> {
  const sources = sourcesForCommand(command);
  const collected = await Promise.all(sources.map(async (source) => ({ source, stored: await collectSource(source, deps, options) })));
  const all = collected.flatMap(({ source, stored }) => stored.records.map((record) => toItem(record, source, command, stored.report.status === "stale_cache")));
  const { items: merged, merged: duplicatesMerged } = dedupe(all);
  const items = merged.sort(byRecency).slice(0, 250);
  const reports = collected.map(({ stored }) => stored.report);
  const usable = reports.filter((report) => report.status === "ok" || report.status === "stale_cache" || report.status === "source_returned_no_data").length;
  const healthy = reports.filter((report) => report.status === "ok").length;
  const coverage: NewsCoverage = healthy === reports.length ? "all_sources_ok" : usable === 0 ? "no_source_available" : "some_sources_unavailable";
  const limitations = [...NEWS_LIMITATIONS];
  if (items.some((item) => item.publishedAt === null && item.updatedAt === null)) limitations.push("Some items have no date because the source page did not state one; they are placed by their position on the official listing page (newest first) and are shown as undated.");
  if (items.some((item) => item.baseline)) limitations.push("“First seen” is when this monitor first read an item. Items that were already on a source when monitoring began are marked as such and are not called new.");
  const byKind: Record<NewsKind, number> = { news: 0, press_release: 0, publication: 0, transcript: 0 };
  for (const item of items) byKind[item.kind]++;
  return {
    ok: true, command, generatedAt: (deps.now ?? (() => new Date()))().toISOString(), coverage, items, sources: reports,
    counts: { total: items.length, byKind, duplicatesMerged, health: items.filter((item) => item.healthTerms.length).length, countrySpecific: items.filter((item) => item.countries.length).length },
    limitations,
  };
}

type MonitorRow = NewsSourceReport | (ReturnType<typeof baseReport> & { status: "not_evaluated"; lastAttemptedFetch: null; lastSuccessfulFetch: null; note: string; feeds: FeedAttempt[]; itemCount: 0; trackedCount: 0 });

export interface NewsMonitorResponse {
  ok: true;
  checkedAt: string;
  commands: Array<{ command: CommandId; sourceCount: number; ok: number; unavailable: number; stale: number; noData: number; neverFetched: number; feedsOk: number; feedsFailed: number }>;
  sources: MonitorRow[];
}

/** Monitoring view of every source. Reads stored state only unless `refresh` is set, in which case each source is re-fetched (rate limited). */
export async function getNewsMonitor(deps: NewsDeps, options: { refresh?: boolean } = {}): Promise<NewsMonitorResponse> {
  const rows: MonitorRow[] = await Promise.all(COMMAND_NEWS_SOURCES.map(async (source) => {
    if (options.refresh) return (await collectSource(source, deps, { refresh: true })).report;
    const cached = await loadStored(source, deps);
    return cached?.report ?? { ...baseReport(source), status: "not_evaluated" as const, lastAttemptedFetch: null, lastSuccessfulFetch: null, note: "Not fetched yet since the server started.", feeds: [], itemCount: 0 as const, trackedCount: 0 as const };
  }));
  const commands = COMMAND_NEWS_COMMANDS.map((command) => {
    const own = rows.filter((row) => row.command === command);
    const feeds = own.flatMap((row) => row.feeds).filter((feed) => feed.role !== "directory");
    return {
      command, sourceCount: own.length,
      ok: own.filter((row) => row.status === "ok").length, unavailable: own.filter((row) => row.status === "source_unavailable").length,
      stale: own.filter((row) => row.status === "stale_cache").length, noData: own.filter((row) => row.status === "source_returned_no_data").length,
      neverFetched: own.filter((row) => row.status === "not_evaluated").length,
      feedsOk: feeds.filter((feed) => feed.status === "ok").length, feedsFailed: feeds.filter((feed) => feed.status === "unavailable").length,
    };
  });
  return { ok: true, checkedAt: (deps.now ?? (() => new Date()))().toISOString(), commands, sources: rows };
}

export { classifyFeedKind };
