// Tolerant, dependency-free parsing of RSS 2.0 / Atom feeds and of official HTML listing pages.
// Nothing here summarizes or interprets: it extracts the title, link, date and the source's own description.

export interface ParsedItem { title: string; url: string; summary: string; publishedAt: string | null }

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
  // Feeds often carry escaped markup (&lt;p&gt;...): strip real tags, decode, then strip the tags the decoding revealed.
  return dropTags(decodeEntities(dropTags(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")))).replace(/\s+/g, " ").trim();
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

export function parseFeed(body: string, base: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = [...body.matchAll(/<item[\s>][\s\S]*?<\/item>/gi), ...body.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  for (const block of blocks) {
    const title = stripMarkup(tagText(block, "title") ?? "");
    let href: string | null = null;
    const atomLink = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    if (atomLink) href = atomLink[1];
    if (!href) { const rssLink = tagText(block, "link"); if (rssLink) href = stripMarkup(rssLink); }
    if (!href) { const guid = tagText(block, "guid"); if (guid && /^https?:/i.test(stripMarkup(guid))) href = stripMarkup(guid); }
    const url = href ? safeUrl(href, base) : null;
    if (!title || !url) continue;
    const summary = stripMarkup(tagText(block, "description") ?? tagText(block, "summary") ?? tagText(block, "content") ?? "").slice(0, 400);
    const published = toIsoDate(stripMarkup(tagText(block, "pubDate") ?? tagText(block, "published") ?? tagText(block, "dc:date") ?? tagText(block, "updated") ?? ""));
    items.push({ title, url, summary, publishedAt: published });
  }
  return items;
}

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

const ARTICLE_PATH = /\/(news|article|articles|press-?release|press-?releases|media-gallery|newsroom|readout|publication|publications)\b/i;
const NAVIGATION_TEXT = /^(home|news|press releases?|media|more|read more|next|previous|page \d+|skip to|contact|about|search|menu|subscribe|rss)\b/i;

/** Fallback when a listing page offers no feed: anchors that point at article-like paths on the same site, with the link text as the title. */
export function parseListing(html: string, base: string): ParsedItem[] {
  const origin = new URL(base).hostname.replace(/^www\./, "");
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = safeUrl(href, base);
    if (!url) continue;
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host !== origin || !ARTICLE_PATH.test(new URL(url).pathname)) continue;
    if (/\/(Page=|index\.html$)/i.test(url) || new URL(url).pathname.replace(/\/+$/, "") === new URL(base).pathname.replace(/\/+$/, "")) continue;
    const title = stripMarkup(match[2]);
    if (title.length < 18 || NAVIGATION_TEXT.test(title) || seen.has(url)) continue;
    seen.add(url);
    items.push({ title, url, summary: "", publishedAt: null });
  }
  return items;
}

const HEALTH_TERMS = ["health", "medical", "medicine", "surgeon", "vaccin", "immuniz", "outbreak", "epidemic", "pandemic", "disease", "covid", "malaria", "dengue", "ebola", "cholera", "mpox", "hospital", "public health", "force health", "biological"];

/** Deterministic keyword match on the item's own title and description; a convenience filter, not a finding. */
export function healthTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return HEALTH_TERMS.filter((term) => lower.includes(term));
}
