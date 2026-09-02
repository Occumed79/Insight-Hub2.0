import { createHash } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const SITE_ORIGIN = "https://www.warcosts.org";
const USER_AGENT = "Occu-Med Insight Hub 2.0 WarCosts page-evidence ingestion";
const DEFAULT_MAX_PAGES = 3_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_EVIDENCE_CHARS = 120_000;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type PageSnapshot = {
  path: string;
  url: string;
  pageType: string;
  title: string;
  description: string;
  headings: string[];
  evidenceText: string;
  charCount: number;
  linkCount: number;
  contentHash: string;
  fetchedAt: string;
};

type CrawlStatus = {
  running: boolean;
  startedAt?: string;
  completedAt?: string;
  pagesVisited: number;
  pagesStored: number;
  pagesFailed: number;
  queueSize: number;
  lastError?: string;
};

const SEED_PATHS = [
  "/",
  "/analysis",
  "/search",
  "/timeline",
  "/states",
  "/countries",
  "/arms-sales",
  "/arms-sales/countries",
  "/bases/directory",
  "/contractors/directory",
  "/weapons",
  "/foreign-aid",
  "/military-aid",
  "/pentagon-audit",
  "/revolving-door",
  "/cost-overruns",
  "/cost-per-kill",
  "/private-war",
  "/media-coverage",
  "/the-other-side",
  "/methodology",
  "/sources",
  "/about",
  "/faq",
  "/glossary",
];

let persistenceReady: Promise<void> | null = null;
let crawlPromise: Promise<CrawlStatus> | null = null;
let crawlStatus: CrawlStatus = {
  running: false,
  pagesVisited: 0,
  pagesStored: 0,
  pagesFailed: 0,
  queueSize: SEED_PATHS.length,
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code) || 32));
}

function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagText(html: string, tag: string): string[] {
  const matches = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))];
  return matches.map((match) => cleanText(match[1] ?? "")).filter(Boolean);
}

function metaDescription(html: string): string {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function normalizePath(input: string): string | null {
  try {
    const url = new URL(input, SITE_ORIGIN);
    if (!["www.warcosts.org", "warcosts.org"].includes(url.hostname.toLowerCase())) return null;
    if (url.protocol !== "https:") return null;
    url.hash = "";
    url.search = "";
    let path = url.pathname.replace(/\/+$/, "") || "/";
    try { path = decodeURIComponent(path); } catch { /* keep encoded path */ }
    if (path.startsWith("/data/") || path.startsWith("/api/") || path.startsWith("/_next/") || path.startsWith("/cdn-cgi/")) return null;
    if (/\.(?:json|xml|txt|css|js|map|png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|woff2?|ttf|mp4|webm)$/i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}

function pageType(path: string): string {
  if (path === "/" || path === "/search") return "index";
  if (path.startsWith("/conflicts/")) return "conflict";
  if (path.startsWith("/countries/")) return "country";
  if (path.startsWith("/states/")) return "state";
  if (path.startsWith("/bases/")) return "base";
  if (path.startsWith("/contractors/")) return "contractor";
  if (path.startsWith("/weapons/")) return "weapon";
  if (path.startsWith("/arms-sales/")) return "arms-sales";
  if (path.startsWith("/analysis/")) return "analysis";
  if (path.startsWith("/tools/")) return "tool";
  if (["/private-war", "/media-coverage", "/the-other-side", "/veterans-voices", "/allied-costs", "/military-families"].includes(path)) return "perspective";
  if (["/methodology", "/sources", "/about", "/faq", "/glossary"].includes(path)) return "methodology";
  return "data-page";
}

function extractLinks(html: string): string[] {
  const output = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)(?:#[^"']*)?["']/gi)) {
    const path = normalizePath(match[1] ?? "");
    if (path) output.add(path);
  }
  return [...output];
}

function snapshotFromHtml(path: string, html: string): PageSnapshot {
  const title = tagText(html, "title")[0] ?? tagText(html, "h1")[0] ?? path;
  const headings = ["h1", "h2", "h3"].flatMap((tag) => tagText(html, tag)).slice(0, 200);
  const evidenceText = cleanText(html).slice(0, MAX_EVIDENCE_CHARS);
  const links = extractLinks(html);
  return {
    path,
    url: `${SITE_ORIGIN}${path === "/" ? "" : path}`,
    pageType: pageType(path),
    title,
    description: metaDescription(html),
    headings,
    evidenceText,
    charCount: evidenceText.length,
    linkCount: links.length,
    contentHash: createHash("sha256").update(evidenceText).digest("hex"),
    fetchedAt: new Date().toISOString(),
  };
}

async function ensurePersistence(): Promise<void> {
  if (persistenceReady) return persistenceReady;
  persistenceReady = (async () => {
    if (!process.env.DATABASE_URL) return;
    const { pool } = await import("@workspace/db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warcosts_page_snapshots (
        path TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        page_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        headings JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence_text TEXT NOT NULL DEFAULT '',
        char_count INTEGER NOT NULL DEFAULT 0,
        link_count INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS warcosts_page_snapshots_type_idx ON warcosts_page_snapshots (page_type, fetched_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS warcosts_page_snapshots_fetched_idx ON warcosts_page_snapshots (fetched_at DESC)`);
  })().catch((error) => {
    persistenceReady = null;
    console.warn("WarCosts page persistence initialization failed", error);
  });
  return persistenceReady;
}

async function persistSnapshot(snapshot: PageSnapshot): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await ensurePersistence();
  const { pool } = await import("@workspace/db");
  await pool.query(
    `INSERT INTO warcosts_page_snapshots
       (path, url, page_type, title, description, headings, evidence_text, char_count, link_count, content_hash, fetched_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::timestamptz,NOW())
     ON CONFLICT (path) DO UPDATE SET
       url = EXCLUDED.url,
       page_type = EXCLUDED.page_type,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       headings = EXCLUDED.headings,
       evidence_text = EXCLUDED.evidence_text,
       char_count = EXCLUDED.char_count,
       link_count = EXCLUDED.link_count,
       content_hash = EXCLUDED.content_hash,
       fetched_at = EXCLUDED.fetched_at,
       updated_at = NOW()`,
    [snapshot.path, snapshot.url, snapshot.pageType, snapshot.title, snapshot.description, JSON.stringify(snapshot.headings), snapshot.evidenceText, snapshot.charCount, snapshot.linkCount, snapshot.contentHash, snapshot.fetchedAt],
  );
}

async function fetchPage(path: string): Promise<{ snapshot: PageSnapshot; links: string[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${SITE_ORIGIN}${path === "/" ? "" : path}`, {
      headers: { Accept: "text/html", "User-Agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!type.includes("text/html")) throw new Error(`Unsupported content type: ${type || "unknown"}`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) throw new Error("HTML response exceeded mirror safety limit");
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new Error("HTML response exceeded mirror safety limit");
    return { snapshot: snapshotFromHtml(path, html), links: extractLinks(html) };
  } finally {
    clearTimeout(timer);
  }
}

function configuredPageLimit(): number {
  const value = Number(process.env.WARCOSTS_PAGE_MIRROR_MAX || DEFAULT_MAX_PAGES);
  return Number.isFinite(value) ? Math.max(100, Math.min(5_000, Math.floor(value))) : DEFAULT_MAX_PAGES;
}

async function refreshPageMirror(force = false): Promise<CrawlStatus> {
  if (crawlPromise && !force) return crawlPromise;
  const task = (async () => {
    const maxPages = configuredPageLimit();
    const queue: Array<{ path: string; depth: number }> = SEED_PATHS.map((path) => ({ path, depth: 0 }));
    const queued = new Set(queue.map((item) => item.path));
    const visited = new Set<string>();
    const status: CrawlStatus = {
      running: true,
      startedAt: new Date().toISOString(),
      pagesVisited: 0,
      pagesStored: 0,
      pagesFailed: 0,
      queueSize: queue.length,
    };
    crawlStatus = status;

    let cursor = 0;
    const maxDepth = 4;
    const concurrency = 6;
    while (cursor < queue.length && visited.size < maxPages) {
      const batch: Array<{ path: string; depth: number }> = [];
      while (cursor < queue.length && batch.length < concurrency && visited.size + batch.length < maxPages) {
        const item = queue[cursor++];
        if (!visited.has(item.path)) batch.push(item);
      }
      if (!batch.length) continue;

      const results = await Promise.all(batch.map(async (item) => {
        visited.add(item.path);
        try {
          const result = await fetchPage(item.path);
          await persistSnapshot(result.snapshot);
          return { item, links: result.links, ok: true as const };
        } catch (error) {
          return { item, links: [] as string[], ok: false as const, error: error instanceof Error ? error.message : "fetch failed" };
        }
      }));

      for (const result of results) {
        status.pagesVisited += 1;
        if (result.ok) status.pagesStored += 1;
        else {
          status.pagesFailed += 1;
          status.lastError = `${result.item.path}: ${result.error}`;
        }
        if (result.ok && result.item.depth < maxDepth) {
          for (const path of result.links) {
            if (queued.size >= maxPages || queued.has(path)) continue;
            queued.add(path);
            queue.push({ path, depth: result.item.depth + 1 });
          }
        }
      }
      status.queueSize = queue.length;
      crawlStatus = { ...status };
    }

    const completed: CrawlStatus = { ...status, running: false, completedAt: new Date().toISOString(), queueSize: queue.length };
    crawlStatus = completed;
    return completed;
  })();

  crawlPromise = task;
  try {
    return await task;
  } finally {
    if (crawlPromise === task) crawlPromise = null;
  }
}

async function pageSummary(): Promise<{ total: number; byType: Record<string, number>; latestFetchedAt?: string }> {
  if (!process.env.DATABASE_URL) return { total: 0, byType: {} };
  await ensurePersistence();
  const { pool } = await import("@workspace/db");
  const [counts, latest] = await Promise.all([
    pool.query<{ page_type: string; count: string }>(`SELECT page_type, COUNT(*)::text AS count FROM warcosts_page_snapshots GROUP BY page_type ORDER BY page_type`),
    pool.query<{ fetched_at: Date | string }>(`SELECT fetched_at FROM warcosts_page_snapshots ORDER BY fetched_at DESC LIMIT 1`),
  ]);
  const byType = Object.fromEntries(counts.rows.map((row) => [row.page_type, Number(row.count)]));
  const latestValue = latest.rows[0]?.fetched_at;
  const latestFetchedAt = latestValue ? (latestValue instanceof Date ? latestValue.toISOString() : new Date(latestValue).toISOString()) : undefined;
  return { total: Object.values(byType).reduce((sum, count) => sum + count, 0), byType, latestFetchedAt };
}

router.get("/war-costs/pages/overview", async (_req: Request, res: Response) => {
  try {
    const summary = await pageSummary();
    if (summary.total === 0 && !crawlStatus.running) void refreshPageMirror(false).catch((error) => console.warn("Initial WarCosts page mirror failed", error));
    return res.json({
      ok: true,
      source: "WarCosts.org public site pages",
      attribution: "Source: warcosts.org",
      mirrorPurpose: "Captures page-specific evidence and analysis facts that are not separately packaged in the downloadable JSON catalog.",
      summary,
      crawl: crawlStatus,
      maxPages: configuredPageLimit(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts page mirror overview failed" });
  }
});

router.get("/war-costs/pages/catalog", async (req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) return res.json({ ok: true, pages: [], total: 0 });
  try {
    await ensurePersistence();
    const { pool } = await import("@workspace/db");
    const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const limitRaw = Number(req.query.limit || 500);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2_000, Math.floor(limitRaw))) : 500;
    const result = type
      ? await pool.query<{ path: string; url: string; page_type: string; title: string; description: string; char_count: number; fetched_at: Date | string }>(
          `SELECT path, url, page_type, title, description, char_count, fetched_at FROM warcosts_page_snapshots WHERE page_type = $1 ORDER BY title LIMIT $2`, [type, limit])
      : await pool.query<{ path: string; url: string; page_type: string; title: string; description: string; char_count: number; fetched_at: Date | string }>(
          `SELECT path, url, page_type, title, description, char_count, fetched_at FROM warcosts_page_snapshots ORDER BY page_type, title LIMIT $1`, [limit]);
    return res.json({ ok: true, total: result.rows.length, pages: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts page catalog failed" });
  }
});

router.get("/war-costs/pages/evidence", async (req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, error: "Database is not configured" });
  const path = typeof req.query.path === "string" ? normalizePath(req.query.path) : null;
  if (!path) return res.status(400).json({ ok: false, error: "A valid WarCosts path is required" });
  try {
    await ensurePersistence();
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `SELECT path, url, page_type, title, description, headings, evidence_text, char_count, link_count, content_hash, fetched_at
       FROM warcosts_page_snapshots WHERE path = $1 LIMIT 1`, [path]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ ok: false, error: "WarCosts page has not been mirrored yet" });
    return res.json({ ok: true, source: "WarCosts.org", attribution: "Source: warcosts.org", page: row });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts page evidence failed" });
  }
});

router.get("/war-costs/pages/search", async (req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) return res.json({ ok: true, query: "", results: [] });
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2) return res.status(400).json({ ok: false, error: "q must be at least 2 characters" });
  try {
    await ensurePersistence();
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `SELECT path, url, page_type, title, description,
              LEFT(evidence_text, 4000) AS evidence_excerpt,
              fetched_at
       FROM warcosts_page_snapshots
       WHERE POSITION(LOWER($1) IN LOWER(title || ' ' || description || ' ' || evidence_text)) > 0
       ORDER BY CASE WHEN POSITION(LOWER($1) IN LOWER(title)) > 0 THEN 0 ELSE 1 END, title
       LIMIT 100`, [query]);
    return res.json({ ok: true, query, total: result.rows.length, results: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts page search failed" });
  }
});

router.post("/war-costs/pages/refresh", async (_req: Request, res: Response) => {
  if (crawlStatus.running) return res.status(202).json({ ok: true, alreadyRunning: true, crawl: crawlStatus });
  void refreshPageMirror(true).catch((error) => {
    crawlStatus = { ...crawlStatus, running: false, completedAt: new Date().toISOString(), lastError: error instanceof Error ? error.message : "crawl failed" };
  });
  return res.status(202).json({ ok: true, started: true, crawl: { ...crawlStatus, running: true } });
});

// Keep page-only WarCosts evidence current without burdening the 5-minute structured-data refresh path.
const initialPageMirror = setTimeout(() => void refreshPageMirror(false).catch((error) => console.warn("WarCosts page mirror startup refresh failed", error)), 5_000);
initialPageMirror.unref?.();
const pageMirrorTimer = setInterval(() => void refreshPageMirror(false).catch((error) => console.warn("WarCosts page mirror scheduled refresh failed", error)), REFRESH_INTERVAL_MS);
pageMirrorTimer.unref?.();

export default router;
