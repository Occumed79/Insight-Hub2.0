// Tolerant, dependency-free parsing of RSS 2.0 / Atom feeds and of official HTML listing pages.
// Nothing here summarizes or interprets: it extracts the title, link, date and the source's own description.

export interface ParsedItem { title: string; url: string; summary: string; publishedAt: string | null; updatedAt: string | null; categories: string[] }

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
    if (parsed.pathname.replace(/\/+$/, "") === baseUrl.pathname.replace(/\/+$/, "") && !parsed.search) return;
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
  const rssKeys = new Set(found.filter((entry) => entry.format === "rss").map((entry) => entry.url.replace(/\/rss\//i, "/atom/")));
  return found.filter((entry) => !(entry.format === "atom" && rssKeys.has(entry.url))).slice(0, limit);
}

const ARTICLE_PATH = /\/(news|article|articles|press-?release|press-?releases|media-gallery|newsroom|readout|publication|publications)\b/i;
const NAVIGATION_TEXT = /^(home|news|press releases?|media|more|read more|next|previous|page \d+|skip to|contact|about|search|menu|subscribe|rss)\b/i;

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const TEXT_DATE = new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i");

/** A date a listing page states next to an item: a <time datetime>, or "Oct. 10, 2025" text, found between this link and the next article link. */
export function nearbyDate(segment: string): string | null {
  const time = segment.match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1];
  if (time) { const iso = toIsoDate(time); if (iso) return iso; }
  const text = stripMarkup(segment).match(TEXT_DATE);
  if (text) { const iso = toIsoDate(`${text[1].replace(/\./, "")} ${text[2]}, ${text[3]} 12:00:00 UTC`); if (iso) return iso; }
  return null;
}

/** Fallback when a listing page offers no feed: anchors that point at article-like paths on the same site, with the link text as the title. */
export function parseListing(html: string, base: string): ParsedItem[] {
  const origin = new URL(base).hostname.replace(/^www\./, "");
  const basePath = new URL(base).pathname.replace(/\/+$/, "");
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  const articleAt: Array<{ index: number; url: string }> = [];
  for (const match of anchors) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
    const url = href ? safeUrl(href, base) : null;
    if (!url) continue;
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") === origin && ARTICLE_PATH.test(parsed.pathname) && parsed.pathname.replace(/\/+$/, "") !== basePath && !/\/(Page=|index\.html$)/i.test(url)) articleAt.push({ index: match.index ?? 0, url });
  }
  for (const match of anchors) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = safeUrl(href, base);
    if (!url) continue;
    const start = match.index ?? 0;
    if (!articleAt.some((entry) => entry.index === start)) continue;
    const title = stripMarkup(match[2]);
    if (title.length < 18 || NAVIGATION_TEXT.test(title) || seen.has(url)) continue;
    seen.add(url);
    const end = start + match[0].length;
    const next = articleAt.find((entry) => entry.index > start && entry.url !== url)?.index ?? end + 600;
    items.push({ title, url, summary: "", publishedAt: nearbyDate(html.slice(end, Math.min(next, end + 600))), updatedAt: null, categories: [] });
  }
  return items;
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
