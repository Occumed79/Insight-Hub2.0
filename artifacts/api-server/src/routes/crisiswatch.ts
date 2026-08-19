import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const FEED_URL = "https://www.crisisgroup.org/rss/crisiswatch";
const SOURCE_URL = "https://www.crisisgroup.org/crisiswatch";
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type CacheState = "fresh" | "refreshed" | "stale";
type FeedItem = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  sourceUrl: string;
  categories: string[];
};

type CacheEntry = {
  items: FeedItem[];
  expiresAt: number;
  staleUntil: number;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<FeedItem[]> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 900): string {
  const compact = cleanText(value);
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function extractTag(block: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractLink(block: string): string {
  const rssLink = cleanText(extractTag(block, ["link"]));
  if (rssLink) return rssLink;

  const atomLink = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  return decodeEntities(atomLink).trim();
}

function allowedSourceUrl(value: string): string {
  try {
    const parsed = new URL(value, "https://www.crisisgroup.org");
    if (parsed.protocol !== "https:") return SOURCE_URL;
    if (parsed.hostname !== "www.crisisgroup.org" && parsed.hostname !== "crisisgroup.org") return SOURCE_URL;
    return parsed.toString();
  } catch {
    return SOURCE_URL;
  }
}

function parseFeed(xml: string): FeedItem[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi)
    || xml.match(/<entry\b[\s\S]*?<\/entry>/gi)
    || [];

  const items = itemBlocks.map((block, index) => {
    const categories = Array.from(block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi))
      .map((match) => cleanText(match[1] || ""))
      .filter(Boolean);
    const title = cleanText(extractTag(block, ["title"]));
    const sourceUrl = allowedSourceUrl(extractLink(block));
    const publishedAt = cleanText(extractTag(block, ["pubDate", "published", "updated", "dc:date"]));
    const summary = truncate(extractTag(block, ["description", "summary", "content:encoded", "content"]));
    const id = cleanText(extractTag(block, ["guid", "id"])) || sourceUrl || `${title}-${publishedAt}-${index}`;

    return {
      id,
      title: title || "CrisisWatch update",
      summary,
      publishedAt,
      sourceUrl,
      categories,
    };
  }).filter((item) => item.title || item.summary);

  if (items.length === 0) {
    throw new Error("CrisisWatch returned no readable RSS entries.");
  }

  return items;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "The CrisisWatch feed timed out. Please retry.";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .slice(0, 320);
}

async function readLimitedBody(response: globalThis.Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("CrisisWatch response exceeded the safety limit.");
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error("CrisisWatch response exceeded the safety limit.");
  }
  return new TextDecoder().decode(buffer);
}

async function fetchFeed(): Promise<FeedItem[]> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch(FEED_URL, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, text/html;q=0.4",
          "User-Agent": "Occu-Med Insight Hub/2.0 conflict-risk research",
        },
      });

      if (TRANSIENT_STATUSES.has(response.status) && attempt < 2) {
        await sleep(450 * (2 ** attempt));
        continue;
      }
      if (!response.ok) throw new Error(`CrisisWatch returned HTTP ${response.status}.`);

      const body = await readLimitedBody(response, 2_500_000);
      return parseFeed(body);
    } catch (error) {
      lastError = error;
      if (attempt >= 2) throw error;
      await sleep(450 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("CrisisWatch request failed.");
}

async function loadFeed(): Promise<{ items: FeedItem[]; cacheState: CacheState }> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return { items: cache.items, cacheState: "fresh" };

  if (!inFlight) inFlight = fetchFeed();
  try {
    const items = await inFlight;
    cache = {
      items,
      expiresAt: Date.now() + 30 * 60_000,
      staleUntil: Date.now() + 24 * 60 * 60_000,
    };
    return { items, cacheState: "refreshed" };
  } catch (error) {
    if (cache && cache.staleUntil > now) return { items: cache.items, cacheState: "stale" };
    throw error;
  } finally {
    inFlight = null;
  }
}

function matchesCountry(country: string, item: FeedItem): boolean {
  const needle = normalize(country);
  if (!needle) return false;
  const haystack = normalize([item.title, item.summary, ...item.categories].join(" "));
  return haystack === needle
    || haystack.startsWith(`${needle} `)
    || haystack.includes(` ${needle} `)
    || haystack.endsWith(` ${needle}`);
}

router.get("/aor/crisiswatch", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const country = String(req.query.country || "").trim();
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  if (country.length > 100) return res.status(400).json({ ok: false, error: "country must be 100 characters or fewer" });

  try {
    const loaded = await loadFeed();
    const directMatches = loaded.items.filter((item) => matchesCountry(country, item));
    const selected = directMatches.slice(0, 20);

    return res.json({
      ok: true,
      configured: true,
      country,
      directMatches: directMatches.length,
      fallbackUsed: false,
      unrelatedItemsOmitted: Math.max(0, loaded.items.length - directMatches.length),
      updates: selected.map((item) => ({
        ...item,
        matchedCountry: matchesCountry(country, item),
      })),
      cacheState: loaded.cacheState,
      source: "International Crisis Group CrisisWatch",
      sourceUrl: SOURCE_URL,
      feedUrl: FEED_URL,
      limitation: "CrisisWatch is qualitative early-warning analysis rather than event-level incident data. Country matching is text-based; unrelated global feed items are intentionally omitted when the selected country has no direct match, and cross-border conflicts may appear under regional names.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: safeError(error) });
  }
});

export default router;
