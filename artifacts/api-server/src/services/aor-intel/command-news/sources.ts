// Official public-communications sources for the six geographic combatant commands.
//
// These are the commands' own websites. Items from them are context for a reviewer ("what has the command said lately"); they are never
// a medical requirement, never change a REQUIRED / RECOMMENDED / CONDITIONAL status, and never replace the command-policy engine.
//
// `urlBasis` states how well each listing URL is established. "found_in_official_search" means the page address was returned by a web search
// of the command's own domain when this registry was written. "expected_not_yet_confirmed" means the address follows the command's site
// pattern but has not been confirmed by a response; the monitor will report it as unavailable if it is wrong. No RSS address is guessed:
// feeds are auto-discovered from the listing page (<link rel="alternate" type="application/rss+xml">) at fetch time and the discovered
// address is shown in the monitor.

import type { CommandId } from "../command-policy/assignments-rows";

export type NewsKind = "news" | "press_release" | "publication";
export type UrlBasis = "found_in_official_search" | "expected_not_yet_confirmed";

export interface CommandNewsSource {
  id: string;
  command: CommandId;
  label: string;
  kind: NewsKind;
  /** Official page that lists items. Fetched, then inspected for a feed; parsed as a listing when no feed is offered. */
  listingUrl: string;
  /** Feed addresses known in advance (none are guessed). Tried before discovery. */
  feedUrls: string[];
  urlBasis: UrlBasis;
  officialSite: string;
}

export const COMMAND_NEWS_COMMANDS: CommandId[] = ["NORTHCOM", "SOUTHCOM", "EUCOM", "AFRICOM", "CENTCOM", "INDOPACOM"];

export const COMMAND_NEWS_SOURCES: CommandNewsSource[] = [
  { id: "northcom-newsroom", command: "NORTHCOM", label: "USNORTHCOM / NORAD newsroom", kind: "news", listingUrl: "https://www.northcom.mil/Newsroom/", feedUrls: [], urlBasis: "expected_not_yet_confirmed", officialSite: "https://www.northcom.mil/" },
  { id: "southcom-press-releases", command: "SOUTHCOM", label: "USSOUTHCOM press releases", kind: "press_release", listingUrl: "https://www.southcom.mil/Media/PressReleases/", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.southcom.mil/" },
  { id: "southcom-news-articles", command: "SOUTHCOM", label: "USSOUTHCOM news articles", kind: "news", listingUrl: "https://www.southcom.mil/MEDIA/NEWS-ARTICLES/", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.southcom.mil/" },
  { id: "eucom-press-releases", command: "EUCOM", label: "USEUCOM press releases", kind: "press_release", listingUrl: "https://www.eucom.mil/media-gallery/press-releases", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.eucom.mil/" },
  { id: "africom-press-releases", command: "AFRICOM", label: "USAFRICOM press releases", kind: "press_release", listingUrl: "https://www.africom.mil/media-gallery/press-releases", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.africom.mil/" },
  { id: "centcom-press-releases", command: "CENTCOM", label: "USCENTCOM press releases", kind: "press_release", listingUrl: "https://www.centcom.mil/MEDIA/PRESS-RELEASES/", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.centcom.mil/" },
  { id: "indopacom-press-releases", command: "INDOPACOM", label: "USINDOPACOM press releases and readouts", kind: "press_release", listingUrl: "https://www.pacom.mil/Media/Press-Releases-and-Readouts/", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.pacom.mil/" },
  { id: "indopacom-news", command: "INDOPACOM", label: "USINDOPACOM news", kind: "news", listingUrl: "https://www.pacom.mil/Media/NEWS/", feedUrls: [], urlBasis: "found_in_official_search", officialSite: "https://www.pacom.mil/" },
];

export const sourcesForCommand = (command: CommandId) => COMMAND_NEWS_SOURCES.filter((source) => source.command === command);
