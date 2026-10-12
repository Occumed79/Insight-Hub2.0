// Collects official command news / press releases / publications, caches them, and reports per-source monitoring state.
//
// Every source is evaluated independently: one command site being down never hides the others. A failed refresh with cached data
// serves the last-known items labeled STALE_CACHE together with the time of the last successful fetch. Absence of items is
// reported as "source returned no data", never as "nothing happened".

import { createHash } from "node:crypto";
import type { CacheStore } from "../cache";
import type { CommandId } from "../command-policy/assignments-rows";
import type { Freshness } from "../types";
import { COMMAND_NEWS_COMMANDS, COMMAND_NEWS_SOURCES, sourcesForCommand, type CommandNewsSource, type NewsKind, type UrlBasis } from "./sources";
import { discoverFeedUrls, healthTerms, looksLikeFeed, parseFeed, parseListing, type ParsedItem } from "./parse";

export type NewsSourceStatus = "ok" | "source_returned_no_data" | "source_unavailable" | "stale_cache";
export type NewsMethod = "feed" | "discovered_feed" | "html_listing";

export interface NewsItem {
  id: string;
  command: CommandId;
  sourceId: string;
  sourceName: string;
  kind: NewsKind;
  title: string;
  url: string;
  summary: string;
  /** null when the source did not state a date (HTML listings often do not). */
  publishedAt: string | null;
  retrievedAt: string;
  freshness: Freshness;
  lastKnownData: boolean;
  /** Keyword matches in the item's own title/description; a convenience filter, not a finding. */
  healthTerms: string[];
}

export interface NewsSourceReport {
  sourceId: string;
  sourceName: string;
  command: CommandId;
  kind: NewsKind;
  listingUrl: string;
  officialSite: string;
  urlBasis: UrlBasis;
  status: NewsSourceStatus;
  method: NewsMethod | null;
  feedUrl: string | null;
  httpStatus: number | null;
  itemCount: number;
  lastAttemptedFetch: string | null;
  lastSuccessfulFetch: string | null;
  sourceError: string | null;
  note: string | null;
  lastKnownData: boolean;
}

export interface FetchedText { status: number; body: string; finalUrl: string }
export type FetchText = (url: string) => Promise<FetchedText>;

export interface NewsDeps {
  store: CacheStore;
  fetchText: FetchText;
  now?: () => Date;
}

interface Stored { items: NewsItem[]; report: NewsSourceReport }

const FRESH_MS = 30 * 60_000;
const FAILURE_RETRY_MS = 5 * 60_000;
const MIN_REFRESH_MS = 60_000;
const KEEP_MS = 30 * 24 * 3_600_000;
const MAX_ITEMS_PER_SOURCE = 25;

class SourceFailure extends Error {
  constructor(message: string, readonly httpStatus: number | null = null) { super(message); }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const ageMs = (iso: string | null, now: Date) => (iso ? now.getTime() - Date.parse(iso) : Number.POSITIVE_INFINITY);
const itemId = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

async function getText(deps: NewsDeps, url: string): Promise<FetchedText> {
  let fetched: FetchedText;
  try {
    fetched = await deps.fetchText(url);
  } catch (error) {
    throw new SourceFailure(`Request failed: ${errorText(error)}`);
  }
  if (fetched.status >= 400) throw new SourceFailure(`Source returned HTTP ${fetched.status}`, fetched.status);
  return fetched;
}

async function attempt(source: CommandNewsSource, deps: NewsDeps): Promise<{ items: ParsedItem[]; method: NewsMethod; feedUrl: string | null; httpStatus: number }> {
  for (const feedUrl of source.feedUrls) {
    try {
      const feed = await getText(deps, feedUrl);
      const items = parseFeed(feed.body, feed.finalUrl);
      if (items.length) return { items, method: "feed", feedUrl, httpStatus: feed.status };
    } catch { /* fall through to the listing page */ }
  }
  const listing = await getText(deps, source.listingUrl);
  if (looksLikeFeed(listing.body)) return { items: parseFeed(listing.body, listing.finalUrl), method: "feed", feedUrl: listing.finalUrl, httpStatus: listing.status };
  for (const feedUrl of discoverFeedUrls(listing.body, listing.finalUrl)) {
    try {
      const feed = await getText(deps, feedUrl);
      const items = parseFeed(feed.body, feed.finalUrl);
      if (items.length) return { items, method: "discovered_feed", feedUrl, httpStatus: feed.status };
    } catch { /* try the next advertised feed, then the listing itself */ }
  }
  return { items: parseListing(listing.body, listing.finalUrl), method: "html_listing", feedUrl: null, httpStatus: listing.status };
}

const baseReport = (source: CommandNewsSource): Omit<NewsSourceReport, "status" | "method" | "feedUrl" | "httpStatus" | "itemCount" | "lastAttemptedFetch" | "lastSuccessfulFetch" | "sourceError" | "note" | "lastKnownData"> => ({
  sourceId: source.id, sourceName: source.label, command: source.command, kind: source.kind, listingUrl: source.listingUrl, officialSite: source.officialSite, urlBasis: source.urlBasis,
});

function toItems(source: CommandNewsSource, parsed: ParsedItem[], retrievedAt: string): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const entry of parsed) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    out.push({
      id: itemId(entry.url), command: source.command, sourceId: source.id, sourceName: source.label, kind: source.kind,
      title: entry.title, url: entry.url, summary: entry.summary, publishedAt: entry.publishedAt, retrievedAt,
      freshness: "CURRENT_NOTICE", lastKnownData: false, healthTerms: healthTerms(`${entry.title} ${entry.summary}`),
    });
    if (out.length >= MAX_ITEMS_PER_SOURCE) break;
  }
  return out;
}

export async function collectSource(source: CommandNewsSource, deps: NewsDeps, options: { refresh?: boolean } = {}): Promise<Stored> {
  const now = (deps.now ?? (() => new Date()))();
  const key = `command-news:v1:${source.id}`;
  const cached = (await deps.store.get<Stored>(key).catch(() => null))?.payload ?? null;
  if (cached) {
    const since = ageMs(cached.report.lastAttemptedFetch, now);
    const limit = options.refresh ? MIN_REFRESH_MS : cached.report.status === "source_unavailable" ? FAILURE_RETRY_MS : FRESH_MS;
    if (since < limit) return cached;
  }
  const stamp = now.toISOString();
  let stored: Stored;
  try {
    const found = await attempt(source, deps);
    const items = toItems(source, found.items, stamp);
    const noData = items.length === 0;
    stored = {
      items,
      report: {
        ...baseReport(source), status: noData ? "source_returned_no_data" : "ok", method: found.method, feedUrl: found.feedUrl, httpStatus: found.httpStatus, itemCount: items.length,
        lastAttemptedFetch: stamp, lastSuccessfulFetch: noData ? cached?.report.lastSuccessfulFetch ?? null : stamp, sourceError: null,
        note: noData
          ? "The page answered but no items could be read from it. This is not evidence that the command published nothing."
          : found.method === "html_listing" ? "No feed was offered by the page; items were read from the listing page and carry no published date unless the page states one." : null,
        lastKnownData: false,
      },
    };
  } catch (error) {
    const message = errorText(error);
    const httpStatus = error instanceof SourceFailure ? error.httpStatus : null;
    if (cached?.items.length) {
      stored = {
        items: cached.items.map((item) => ({ ...item, freshness: "STALE_CACHE" as Freshness, lastKnownData: true })),
        report: { ...cached.report, status: "stale_cache", httpStatus, lastAttemptedFetch: stamp, sourceError: message, note: "The latest refresh failed; these are the last items successfully retrieved.", lastKnownData: true },
      };
    } else {
      stored = {
        items: [],
        report: { ...baseReport(source), status: "source_unavailable", method: null, feedUrl: null, httpStatus, itemCount: 0, lastAttemptedFetch: stamp, lastSuccessfulFetch: cached?.report.lastSuccessfulFetch ?? null, sourceError: message, note: null, lastKnownData: false },
      };
    }
  }
  await deps.store.set(key, stored, KEEP_MS, now).catch(() => undefined);
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
  limitations: string[];
}

export const NEWS_LIMITATIONS = [
  "These are the command's own public communications. They are context for review, not medical requirements, and they never change a REQUIRED / RECOMMENDED / CONDITIONAL status.",
  "Only the sources listed here are monitored. An empty list means nothing was retrieved from them, not that the command published nothing.",
  "Items are shown exactly as the source states them; titles and descriptions are not summarized or interpreted.",
];

const byRecency = (a: NewsItem, b: NewsItem) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

export async function getCommandNews(command: CommandId, deps: NewsDeps, options: { refresh?: boolean } = {}): Promise<CommandNewsResponse> {
  const sources = sourcesForCommand(command);
  const collected = await Promise.all(sources.map((source) => collectSource(source, deps, options)));
  const seen = new Set<string>();
  const items = collected.flatMap((entry) => entry.items).filter((item) => (seen.has(item.url) ? false : (seen.add(item.url), true))).sort(byRecency);
  const reports = collected.map((entry) => entry.report);
  const usable = reports.filter((report) => report.status === "ok" || report.status === "stale_cache" || report.status === "source_returned_no_data").length;
  const healthy = reports.filter((report) => report.status === "ok").length;
  const coverage: NewsCoverage = healthy === reports.length ? "all_sources_ok" : usable === 0 ? "no_source_available" : "some_sources_unavailable";
  const limitations = [...NEWS_LIMITATIONS];
  if (items.some((item) => item.publishedAt === null)) limitations.push("Some items have no published date because the source page did not state one; they are listed after dated items.");
  return { ok: true, command, generatedAt: (deps.now ?? (() => new Date()))().toISOString(), coverage, items, sources: reports, limitations };
}

export interface NewsMonitorResponse {
  ok: true;
  checkedAt: string;
  commands: Array<{ command: CommandId; sourceCount: number; ok: number; unavailable: number; stale: number; noData: number; neverFetched: number }>;
  sources: Array<NewsSourceReport | (ReturnType<typeof baseReport> & { status: "not_evaluated"; lastAttemptedFetch: null; lastSuccessfulFetch: null; note: string })>;
}

/** Monitoring view of every source. Reads cached state only unless `refresh` is set, in which case each source is re-fetched (rate limited). */
export async function getNewsMonitor(deps: NewsDeps, options: { refresh?: boolean } = {}): Promise<NewsMonitorResponse> {
  const rows = await Promise.all(COMMAND_NEWS_SOURCES.map(async (source) => {
    if (options.refresh) return (await collectSource(source, deps, { refresh: true })).report;
    const cached = (await deps.store.get<Stored>(`command-news:v1:${source.id}`).catch(() => null))?.payload ?? null;
    return cached?.report ?? { ...baseReport(source), status: "not_evaluated" as const, lastAttemptedFetch: null, lastSuccessfulFetch: null, note: "Not fetched yet since the server started." };
  }));
  const commands = COMMAND_NEWS_COMMANDS.map((command) => {
    const own = rows.filter((row) => row.command === command);
    return {
      command, sourceCount: own.length,
      ok: own.filter((row) => row.status === "ok").length, unavailable: own.filter((row) => row.status === "source_unavailable").length,
      stale: own.filter((row) => row.status === "stale_cache").length, noData: own.filter((row) => row.status === "source_returned_no_data").length,
      neverFetched: own.filter((row) => row.status === "not_evaluated").length,
    };
  });
  return { ok: true, checkedAt: (deps.now ?? (() => new Date()))().toISOString(), commands, sources: rows };
}
