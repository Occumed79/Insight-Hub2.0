// Mirrors artifacts/api-server/src/services/aor-intel/command-news/service.ts (response shape only).
import type { CommandId } from "./aor-directory";
import type { Freshness } from "./aor-intel-types";

export type NewsKind = "news" | "press_release" | "publication";
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
  publishedAt: string | null;
  retrievedAt: string;
  freshness: Freshness;
  lastKnownData: boolean;
  healthTerms: string[];
}

export interface NewsSourceReport {
  sourceId: string;
  sourceName: string;
  command: CommandId;
  kind: NewsKind;
  listingUrl: string;
  officialSite: string;
  urlBasis: "found_in_official_search" | "expected_not_yet_confirmed";
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

export interface CommandNewsResponse {
  ok: true;
  command: CommandId;
  generatedAt: string;
  coverage: "all_sources_ok" | "some_sources_unavailable" | "no_source_available";
  items: NewsItem[];
  sources: NewsSourceReport[];
  limitations: string[];
}

export const NEWS_KIND_LABEL: Record<NewsKind, string> = { news: "News", press_release: "Press release", publication: "Publication" };
export const NEWS_STATUS_LABEL: Record<NewsSourceStatus, string> = {
  ok: "Reachable",
  source_returned_no_data: "Returned no readable items",
  source_unavailable: "Unavailable",
  stale_cache: "Showing last-known items",
};
export const NEWS_METHOD_LABEL: Record<NewsMethod, string> = { feed: "RSS/Atom feed", discovered_feed: "RSS/Atom feed (advertised by the page)", html_listing: "Listing page (no feed offered)" };
