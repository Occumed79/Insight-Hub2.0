// Tolerant, dependency-free parsing of RSS 2.0 / Atom feeds and of official HTML listing pages.
// Nothing here summarizes or interprets: it extracts the title, link, date and the source's own description.

export interface ParsedItem { title: string; url: string; summary: string; publishedAt: string | null; updatedAt: string | null; categories: string[];
  /** Listing pages only: a sort position (never shown as a date) derived from the page's own order, for items whose date the page does not state. */
  orderHint?: string | null }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function stripMarkup(value: string): string {
  const dropTags = (text: string) => text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  const raw = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Feeds often carry escaped markup (&lt;p&gt;...): strip real tags, decode, then strip the tags the decoding revealed.
  let text = decodeEntities(dropTags(raw));
  // Markup escaped twice (&amp;lt;p&amp;gt;, &amp;#39;) is decoded once more, but only when the source itself escaped the ampersand.
  if (/&amp;/i.test(raw) && /&(?:#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/i.test(text)) text = decodeEntities(text);
  return dropTags(text).replace(/\s+/g, " ").trim();
}

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value.trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/** Only http(s) links are kept; relative links are resolved against the page they came from. */
export function safeUrl(href: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const tagText = (block: string, tag: string): string | null => {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1] : null;
};

export function looksLikeFeed(body: string): boolean {
  return /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));
}

/** The item's link: Atom <link rel="alternate" href> (or an unlabelled one), then RSS <link>, then a permalink GUID. rel="self"/"enclosure"/"related" links are never the article. */
function itemHref(block: string): string | null {
  for (const match of block.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!rel || rel === "alternate") return href;
  }
  const rssLink = tagText(block, "link");
  if (rssLink && stripMarkup(rssLink)) return stripMarkup(rssLink);
  const guid = tagText(block, "guid");
  if (guid && /^https?:/i.test(stripMarkup(guid))) return stripMarkup(guid);
  return null;
}

function itemCategories(block: string): string[] {
  const out: string[] = [];
  for (const match of block.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>|<category\b([^>]*?)\/>/gi)) {
    const text = match[2] !== undefined ? stripMarkup(match[2]) : (match[3]?.match(/\b(?:term|label)=["']([^"']+)["']/i)?.[1] ?? "");
    const clean = decodeEntities(text).trim();
    if (clean && clean.length <= 80 && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/** RSS 2.0 (<item>) and Atom 1.0 (<entry>), including namespaced elements (dc:date, content:encoded, dcterms:modified). */
export function parseFeed(body: string, base: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = [...body.matchAll(/<item[\s>][\s\S]*?<\/item>/gi), ...body.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  for (const block of blocks) {
    const title = stripMarkup(tagText(block, "title") ?? "");
    const href = itemHref(block);
    const url = href ? safeUrl(href, base) : null;
    if (!title || !url) continue;
    const summary = stripMarkup(tagText(block, "description") ?? tagText(block, "summary") ?? tagText(block, "content:encoded") ?? tagText(block, "content") ?? "").slice(0, 400);
    const published = toIsoDate(stripMarkup(tagText(block, "pubDate") ?? tagText(block, "published") ?? tagText(block, "dc:date") ?? tagText(block, "dcterms:issued") ?? ""));
    const updated = toIsoDate(stripMarkup(tagText(block, "updated") ?? tagText(block, "atom:updated") ?? tagText(block, "dcterms:modified") ?? ""));
    items.push({ title, url, summary, publishedAt: published, updatedAt: updated, categories: itemCategories(block) });
  }
  return items;
}

/** One address per publication: scheme and host lower-cased, "www." kept (it is part of the official host), fragment, tracking parameters, index.html and trailing slashes removed. */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.protocol = "https:";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/index\.(html?|aspx?)$/i, "/").replace(/\/{2,}/g, "/");
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return raw;
  }
}

export const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** <link rel="alternate" type="application/rss+xml|atom+xml" href="..."> declared by the page itself. */
export function discoverFeedUrls(html: string, base: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/rel=["']?alternate/i.test(tag) || !/type=["']application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    const url = href ? safeUrl(href, base) : null;
    if (url && !found.includes(url)) found.push(url);
  }
  return found;
}

export type FeedKind = "news" | "press_release" | "publication" | "transcript";

/** Classifies a discovered feed from its own label / address. Anything that does not say otherwise is "news". */
export function classifyFeedKind(text: string): FeedKind {
  const lower = text.toLowerCase();
  if (/transcript/.test(lower)) return "transcript";
  if (/press[\s_-]*release|readout|statement/.test(lower)) return "press_release";
  if (/document|directive|publication|instruction|policy|fact[\s_-]*sheet|report|memorand|guidance/.test(lower)) return "publication";
  return "news";
}

export interface DiscoveredFeed { url: string; label: string; kind: FeedKind; format: "rss" | "atom" }

const FEED_HREF = /(\.rss(?:$|[?#])|\.xml(?:$|[?#])|\/rss(?:[/.?]|$)|rss\.ashx|syndication-feed|\/atom(?:[/.?]|$)|\/feed(?:[/.?]|$)|[?&]format=(?:rss|atom))/i;

/**
 * Feeds listed on an official RSS directory page: every same-site link that looks like a feed address, labelled with its own link text.
 * An Atom address is dropped when its RSS twin (/atom/ ↔ /rss/) is also listed, so one publication stream is not read twice.
 */
export function discoverDirectoryFeeds(html: string, base: string, limit = 16): DiscoveredFeed[] {
  const baseUrl = new URL(base);
  const host = baseUrl.hostname.replace(/^www\./, "");
  const found: DiscoveredFeed[] = [];
  const add = (href: string | undefined, label: string) => {
    const url = href ? safeUrl(href, base) : null;
    if (!url) return;
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") !== host || !FEED_HREF.test(parsed.pathname + parsed.search)) return;
    if (/sitemap/i.test(parsed.pathname) || (parsed.pathname.replace(/\/+$/, "") === baseUrl.pathname.replace(/\/+$/, "") && !parsed.search)) return;
    if (found.some((entry) => entry.url === url)) return;
    const format = /atom/i.test(parsed.pathname + parsed.search) ? "atom" : "rss";
    const clean = label.trim();
    found.push({ url, label: clean, kind: classifyFeedKind(`${clean} ${parsed.pathname}${parsed.search}`), format });
  };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) add(match[1].match(/href=["']([^"']+)["']/i)?.[1], stripMarkup(match[2]) || stripMarkup(match[1].match(/title=["']([^"']+)["']/i)?.[1] ?? ""));
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (/rel=["']?alternate/i.test(tag) && /type=["']application\/(rss|atom)\+xml/i.test(tag)) add(tag.match(/href=["']([^"']+)["']/i)?.[1], tag.match(/title=["']([^"']+)["']/i)?.[1] ?? "");
  }
  // Addresses carried by other attributes (data-href, <option value>, <input value>) or written out as text.
  for (const match of html.matchAll(/\b(?:data-[\w-]+|value|content|data-url|data-feed)=["']([^"']+)["']/gi)) add(match[1], "");
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>)]+/gi)) add(match[0].replace(/[.,;]+$/, ""), "");
  const rssKeys = new Set(found.filter((entry) => entry.format === "rss").map((entry) => entry.url.replace(/\/rss\//i, "/atom/")));
  return found.filter((entry) => !(entry.format === "atom" && rssKeys.has(entry.url))).slice(0, limit);
}

const ARTICLE_PATH = /\/(news|article|articles|press-?release|press-?releases|media-gallery|newsroom|readout|publication|publications)\b/i;
const NAVIGATION_TEXT = /^(home|news|press releases?|media|more|read more|next|previous|page \d+|skip to|contact|about|search|menu|subscribe|rss)\b/i;

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_FIRST = new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i");
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})\\.?,?\\s+(\\d{4})\\b`, "i");
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const ISO_DAY = /\b(\d{4})-(\d{2})-(\d{2})\b/;

/** A date a listing page states next to an item: a <time datetime>, "Oct. 10, 2026", "10 Oct 2026", "10/10/2026" or "2026-10-10", found between this link and the next article link. */
export function nearbyDate(segment: string): string | null {
  const time = segment.match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1];
  if (time) { const iso = toIsoDate(time); if (iso) return iso; }
  const text = stripMarkup(segment);
  const at = (value: string) => toIsoDate(`${value} 12:00:00 UTC`);
  let match = text.match(MONTH_FIRST);
  if (match) { const iso = at(`${match[1].replace(/\./, "")} ${match[2]}, ${match[3]}`); if (iso) return iso; }
  match = text.match(DAY_FIRST);
  if (match) { const iso = at(`${match[2].replace(/\./, "")} ${match[1]}, ${match[3]}`); if (iso) return iso; }
  match = text.match(ISO_DAY);
  if (match) { const iso = at(`${match[1]}-${match[2]}-${match[3]}`); if (iso) return iso; }
  match = text.match(NUMERIC);
  if (match && Number(match[1]) <= 12 && Number(match[2]) <= 31) { const iso = at(`${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`); if (iso) return iso; }
  return null;
}

/** Article views on the command sites' publishing platform: /Article/<number>/<slug>. Listings use these for stories; month archives, biographies and notices do not match. */
const PLATFORM_ARTICLE = /\/Article\/(?:Article\/)?\d{4,}\//i;
const NOT_NEWS_SECTION = /\/(Contact|Directory|Biography|Biographies|Leadership|About|Staff|Careers|Images?|Videos?|Photos?|Year)(\/|$)/i;

/**
 * Fallback when a listing page offers no feed: story links on the same site, with the link text as the title. When the page uses the platform's
 * /Article/<id>/ addresses only those are kept (month archives, biographies and site notices are not stories). Each item carries the date the page
 * states beside it; items the page leaves undated get an `orderHint` from their neighbours so the stream keeps the page's own order. No date is invented.
 */
export function parseListing(html: string, base: string): ParsedItem[] {
  const origin = new URL(base).hostname.replace(/^www\./, "");
  const basePath = new URL(base).pathname.replace(/\/+$/, "");
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const candidates: Array<{ index: number; end: number; url: string; text: string }> = [];
  for (const match of anchors) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
    const url = href ? safeUrl(href, base) : null;
    if (!url) continue;
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") !== origin || !ARTICLE_PATH.test(parsed.pathname)) continue;
    if (parsed.pathname.replace(/\/+$/, "") === basePath || /\/(Page=|index\.html$)/i.test(url) || NOT_NEWS_SECTION.test(parsed.pathname)) continue;
    candidates.push({ index: match.index ?? 0, end: (match.index ?? 0) + match[0].length, url, text: stripMarkup(match[2]) });
  }
  const platform = candidates.filter((entry) => PLATFORM_ARTICLE.test(new URL(entry.url).pathname));
  const kept = platform.length ? platform : candidates;

  // One item per address, titled by the longest link text found for it (image and caption links repeat the address with shorter text).
  const order: string[] = [];
  const byUrl = new Map<string, { title: string; first: number; dates: Array<string | null> }>();
  kept.forEach((entry, position) => {
    const next = kept.slice(position + 1).find((other) => other.url !== entry.url)?.index ?? entry.end + 600;
    const date = nearbyDate(html.slice(entry.end, Math.min(next, entry.end + 600)));
    const existing = byUrl.get(entry.url);
    if (!existing) { byUrl.set(entry.url, { title: entry.text, first: entry.index, dates: [date] }); order.push(entry.url); return; }
    if (entry.text.length > existing.title.length) existing.title = entry.text;
    existing.dates.push(date);
  });
  const items: ParsedItem[] = [];
  for (const url of order) {
    const found = byUrl.get(url)!;
    if (found.title.length < 18 || NAVIGATION_TEXT.test(found.title)) continue;
    items.push({ title: found.title, url, summary: "", publishedAt: found.dates.find(Boolean) ?? null, updatedAt: null, categories: [], orderHint: null });
  }
  // Undated items inherit a position from the nearest dated item below them (listings run newest first), a minute apart so the page's order is kept.
  for (let i = 0; i < items.length; i++) {
    if (items[i].publishedAt) continue;
    let end = i;
    while (end < items.length && !items[end].publishedAt) end++;
    const below = items[end]?.publishedAt ?? null;
    const above = i > 0 ? items[i - 1].publishedAt ?? items[i - 1].orderHint ?? null : null;
    for (let j = i; j < end; j++) {
      const base = below ? Date.parse(below) + (end - j) * 60_000 : above ? Date.parse(above) - (j - i + 1) * 60_000 : null;
      items[j].orderHint = base === null ? null : new Date(base).toISOString();
    }
    i = end - 1;
  }
  return items;
}

/** What a directory page held, for the monitor when no feed could be read from it. */
export function describeDirectoryPage(html: string, base: string): string {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) => safeUrl(match[1], base)).filter((url): url is string => Boolean(url));
  const mentioning = links.filter((url) => /rss|feed|xml|atom|syndic/i.test(url));
  const scripts = (html.match(/<script\b/gi) ?? []).length;
  return `The page answered (${html.length} characters, ${links.length} links, ${scripts} scripts) but lists no feed address that could be read${mentioning.length ? `; links that mention a feed: ${mentioning.slice(0, 3).join(", ")}` : " and none of its links mention a feed"}. If the list is built by script, it is not visible to this monitor.`;
}

const HEALTH_TERMS = ["health", "medical", "medicine", "surgeon", "vaccin", "immuniz", "outbreak", "epidemic", "pandemic", "disease", "covid", "malaria", "dengue", "ebola", "cholera", "mpox", "hospital", "public health", "force health", "biological", "quarantine", "clinic", "tricare"];

/** Wording that points at medical *policy* (as opposed to a medical event or exercise): a convenience flag, never a requirement. */
const POLICY_TERMS = ["force health protection", "health protection condition", "hpcon", "medical clearance", "medical screening", "vaccination requirement", "immunization requirement", "restriction of movement", "medical evaluation", "theater entry", "deployment health", "quarantine", "public health emergency", "travel restriction", "medical directive", "medical policy"];

/** Deterministic keyword match on the item's own title and description; a convenience filter, not a finding. */
export function healthTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return [...new Set([...HEALTH_TERMS.filter((term) => lower.includes(term)), ...POLICY_TERMS.filter((term) => lower.includes(term))])];
}

export function policyTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return POLICY_TERMS.filter((term) => lower.includes(term));
}
