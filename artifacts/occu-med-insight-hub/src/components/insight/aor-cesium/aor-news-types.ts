// Mirrors artifacts/api-server/src/services/aor-intel/command-news/service.ts (response shape only).
import type { CommandId } from "./aor-directory";
import type { Freshness } from "./aor-intel-types";

export type NewsKind = "news" | "press_release" | "publication" | "transcript";
export type NewsSourceStatus = "ok" | "source_returned_no_data" | "source_unavailable" | "stale_cache";
export type NewsMethod = "feed" | "atom_feed" | "discovered_feed" | "html_listing";
export type FeedRole = "rss" | "atom" | "discovered" | "listing_advertised" | "directory" | "listing";
export type FeedStatus = "ok" | "no_items" | "unavailable" | "not_needed";

export interface CountryTag { id: string; name: string; iso2: string | null; mentionedIn: Array<"title" | "summary" | "category"> }
export interface NewsProvenance { sourceId: string; sourceName: string; kind: NewsKind; feedUrls: string[] }

export interface NewsItem {
  id: string;
  command: CommandId;
  sourceId: string;
  sourceName: string;
  kind: NewsKind;
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  updatedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt: string | null;
  changeCount: number;
  lastChange: { at: string; fields: string[] } | null;
  baseline: boolean;
  retrievedAt: string;
  freshness: Freshness;
  lastKnownData: boolean;
  healthTerms: string[];
  policyTerms: string[];
  countries: CountryTag[];
  sources: NewsProvenance[];
}

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

export interface NewsSourceReport {
  sourceId: string;
  sourceName: string;
  command: CommandId;
  kind: NewsKind | "mixed";
  listingUrl: string;
  officialSite: string;
  urlBasis: "supplied_feed" | "supplied_listing" | "found_in_official_search" | "expected_not_yet_confirmed";
  status: NewsSourceStatus;
  method: NewsMethod | null;
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

export interface CommandNewsResponse {
  ok: true;
  command: CommandId;
  generatedAt: string;
  coverage: "all_sources_ok" | "some_sources_unavailable" | "no_source_available";
  items: NewsItem[];
  sources: NewsSourceReport[];
  counts: { total: number; byKind: Record<NewsKind, number>; duplicatesMerged: number; health: number; countrySpecific: number };
  limitations: string[];
}

export const NEWS_KINDS: NewsKind[] = ["news", "press_release", "publication", "transcript"];
export const NEWS_KIND_LABEL: Record<NewsKind, string> = { news: "News", press_release: "Press release", publication: "Official document", transcript: "Transcript" };
export const NEWS_KIND_PLURAL: Record<NewsKind, string> = { news: "News", press_release: "Press releases", publication: "Documents", transcript: "Transcripts" };
export const NEWS_STATUS_LABEL: Record<NewsSourceStatus, string> = {
  ok: "Reachable",
  source_returned_no_data: "Returned no readable items",
  source_unavailable: "Unavailable",
  stale_cache: "Showing last-known items",
};
export const NEWS_METHOD_LABEL: Record<NewsMethod, string> = {
  feed: "RSS feed",
  atom_feed: "Atom feed (RSS unavailable)",
  discovered_feed: "RSS/Atom feed (listed or advertised by the official page)",
  html_listing: "Listing page (no feed available)",
};
export const FEED_STATUS_LABEL: Record<FeedStatus, string> = { ok: "Readable", no_items: "Readable, no items", unavailable: "Unavailable", not_needed: "Not needed" };
export const FEED_ROLE_LABEL: Record<FeedRole, string> = { rss: "RSS", atom: "Atom", discovered: "Feed from directory", listing_advertised: "Feed advertised by page", directory: "RSS directory page", listing: "Listing page" };
export const URL_BASIS_NOTE: Record<NewsSourceReport["urlBasis"], string | null> = {
  supplied_feed: null,
  supplied_listing: null,
  found_in_official_search: null,
  expected_not_yet_confirmed: "This page address follows the command site's pattern but has not been confirmed by a response yet.",
};
