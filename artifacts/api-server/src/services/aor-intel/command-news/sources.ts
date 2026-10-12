// Official public-communications sources for the six geographic combatant commands.
//
// These are the commands' own websites. Items from them are context for a reviewer ("what has the command said lately"); they are never
// a medical requirement, never change a REQUIRED / RECOMMENDED / CONDITIONAL status, and never replace the command-policy engine.
//
// How each address is established (`urlBasis`):
//  - "supplied_feed"            a feed address supplied by the project owner from the command's own site. It is registered as given; whether it
//                               answers is reported by the monitor, never assumed.
//  - "supplied_listing"         an official page address supplied by the project owner (a listing or an RSS directory page).
//  - "found_in_official_search" an address returned by a web search of the command's own domain when the registry was written.
//  - "expected_not_yet_confirmed" follows the site's pattern but no response has confirmed it.
// No feed address is invented. Individual feeds are either supplied (above), discovered from an official RSS directory page or from the
// <link rel="alternate"> tags a page advertises, or not used at all (the page is then parsed as a monitored listing).

import type { CommandId } from "../command-policy/assignments-rows";

export type NewsKind = "news" | "press_release" | "publication" | "transcript";
export type UrlBasis = "supplied_feed" | "supplied_listing" | "found_in_official_search" | "expected_not_yet_confirmed";

export interface CommandNewsSource {
  id: string;
  command: CommandId;
  label: string;
  /** What this source publishes. "mixed" is a feed directory whose individual feeds are classified from their own labels. */
  kind: NewsKind | "mixed";
  /** Official page that lists items for a person to open; also parsed as a listing when no feed produced items and `listingFallback` is set. */
  listingUrl: string | null;
  listingFallback: boolean;
  /** Feed addresses supplied in advance (RSS). Tried first. */
  feedUrls: string[];
  /** Atom equivalents of `feedUrls` (same order). Used only when the RSS address fails or returns no items, so one publication is not recorded twice. */
  atomUrls: string[];
  /** An official page that lists the command's feeds; individual feeds are discovered from it. */
  directoryUrl: string | null;
  urlBasis: UrlBasis;
  officialSite: string;
}

export const COMMAND_NEWS_COMMANDS: CommandId[] = ["NORTHCOM", "SOUTHCOM", "EUCOM", "AFRICOM", "CENTCOM", "INDOPACOM"];

const FEED_TYPES: Array<{ slug: string; kind: NewsKind; label: string }> = [
  { slug: "articles", kind: "news", label: "news articles" },
  { slug: "press-releases", kind: "press_release", label: "press releases" },
  { slug: "documents", kind: "publication", label: "official documents" },
  { slug: "transcripts", kind: "transcript", label: "transcripts" },
];

/** EUCOM and AFRICOM publish four syndication feeds each, in RSS and Atom (the Atom address replaces /rss/ with /atom/). */
function syndicated(command: CommandId, host: string, name: string, listingUrls: Partial<Record<string, string>>): CommandNewsSource[] {
  return FEED_TYPES.map(({ slug, kind, label }) => ({
    id: `${command.toLowerCase()}-${slug}`, command, label: `${name} ${label}`, kind,
    listingUrl: listingUrls[slug] ?? null, listingFallback: Boolean(listingUrls[slug]),
    feedUrls: [`https://${host}/syndication-feed/rss/${slug}`], atomUrls: [`https://${host}/syndication-feed/atom/${slug}`],
    directoryUrl: null, urlBasis: "supplied_feed" as const, officialSite: `https://${host}/`,
  }));
}

export const COMMAND_NEWS_SOURCES: CommandNewsSource[] = [
  ...syndicated("EUCOM", "www.eucom.mil", "USEUCOM", { "press-releases": "https://www.eucom.mil/media-gallery/press-releases" }),
  ...syndicated("AFRICOM", "www.africom.mil", "USAFRICOM", { "press-releases": "https://www.africom.mil/media-gallery/press-releases" }),
  {
    id: "centcom-rss-directory", command: "CENTCOM", label: "USCENTCOM RSS directory (feeds discovered)", kind: "mixed", listingUrl: "https://www.centcom.mil/rss/", listingFallback: false,
    feedUrls: [], atomUrls: [], directoryUrl: "https://www.centcom.mil/rss/", urlBasis: "supplied_listing", officialSite: "https://www.centcom.mil/",
  },
  {
    id: "centcom-press-releases", command: "CENTCOM", label: "USCENTCOM press releases", kind: "press_release", listingUrl: "https://www.centcom.mil/MEDIA/PRESS-RELEASES/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "found_in_official_search", officialSite: "https://www.centcom.mil/",
  },
  {
    id: "southcom-rss-directory", command: "SOUTHCOM", label: "USSOUTHCOM RSS directory (feeds discovered)", kind: "mixed", listingUrl: "https://www.southcom.mil/RSS/", listingFallback: false,
    feedUrls: [], atomUrls: [], directoryUrl: "https://www.southcom.mil/RSS/", urlBasis: "supplied_listing", officialSite: "https://www.southcom.mil/",
  },
  {
    id: "southcom-press-releases", command: "SOUTHCOM", label: "USSOUTHCOM press releases", kind: "press_release", listingUrl: "https://www.southcom.mil/Media/PressReleases/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "found_in_official_search", officialSite: "https://www.southcom.mil/",
  },
  {
    id: "southcom-news-articles", command: "SOUTHCOM", label: "USSOUTHCOM news articles", kind: "news", listingUrl: "https://www.southcom.mil/MEDIA/NEWS-ARTICLES/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "found_in_official_search", officialSite: "https://www.southcom.mil/",
  },
  {
    id: "indopacom-news", command: "INDOPACOM", label: "USINDOPACOM news", kind: "news", listingUrl: "https://www.pacom.mil/Media/NEWS/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "supplied_listing", officialSite: "https://www.pacom.mil/",
  },
  {
    id: "indopacom-press-releases", command: "INDOPACOM", label: "USINDOPACOM press releases and readouts", kind: "press_release", listingUrl: "https://www.pacom.mil/Media/Press-Releases-and-Readouts/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "supplied_listing", officialSite: "https://www.pacom.mil/",
  },
  {
    id: "northcom-news-archive", command: "NORTHCOM", label: "USNORTHCOM / NORAD news archive", kind: "news", listingUrl: "https://www.northcom.mil/Newsroom/News/News-Archive/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "supplied_listing", officialSite: "https://www.northcom.mil/",
  },
  {
    id: "northcom-press-releases", command: "NORTHCOM", label: "USNORTHCOM / NORAD press releases", kind: "press_release", listingUrl: "https://www.northcom.mil/Newsroom/Press-Releases/", listingFallback: true,
    feedUrls: [], atomUrls: [], directoryUrl: null, urlBasis: "supplied_listing", officialSite: "https://www.northcom.mil/",
  },
];

export const sourcesForCommand = (command: CommandId) => COMMAND_NEWS_SOURCES.filter((source) => source.command === command);
