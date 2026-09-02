import { createHash } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const ORIGIN = "https://www.warcosts.org";
const CACHE_MS = 30 * 60 * 1000;
const MAX_HTML_BYTES = 2_000_000;

export const WARCOSTS_PRIORITY_PATHS = [
  "/explorer",
  "/war-map",
  "/war-clock",
  "/modern-wars",
  "/conflicts",
  "/us-wars-list",
  "/military-spending",
  "/deployments",
  "/regime-changes",
  "/sanctions",
  "/presidents",
  "/cost-of-war-by-president",
  "/global-reactions",
  "/media-coverage",
  "/private-war",
  "/veterans-voices",
  "/allied-costs",
  "/military-families",
  "/conflicts/iran-2026",
  "/analysis/iran-2026",
  "/analysis/iran-day-by-day",
  "/analysis/iran-cost-per-second",
  "/analysis/civilian-toll-iran-2026",
  "/tools/compare-wars",
  "/tools/timeline-explorer",
  "/tools/inflation-calculator",
  "/tools/iran-vs-iraq",
] as const;

const ALLOWED = new Set<string>(WARCOSTS_PRIORITY_PATHS);

type StructuredTable = { headers: string[]; rows: string[][] };
type StructuredPage = {
  path: string;
  url: string;
  title: string;
  headings: string[];
  text: string;
  tables: StructuredTable[];
  contentHash: string;
  fetchedAt: string;
  source: "live" | "database";
};

type CacheEntry = { page: StructuredPage; expiresAt: number };
const cache = new Map<string, CacheEntry>();
let persistenceReady: Promise<void> | null = null;

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
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => cleanText(match[1] ?? ""))
    .filter(Boolean);
}

function extractTables(html: string): StructuredTable[] {
  const tables: StructuredTable[] = [];
  for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const body = tableMatch[1] ?? "";
    const parsedRows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) => {
      const rowHtml = rowMatch[1] ?? "";
      return [...rowHtml.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => cleanText(cell[2] ?? ""));
    }).filter((row) => row.length > 0);
    if (!parsedRows.length) continue;
    const headerCells = [...body.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => cleanText(match[1] ?? ""));
    const headers = headerCells.length ? headerCells.slice(0, parsedRows[0].length) : parsedRows[0].map((_cell, index) => `Column ${index + 1}`);
    const firstIsHeader = headerCells.length > 0 || parsedRows[0].every((cell) => headers.includes(cell));
    tables.push({ headers, rows: (firstIsHeader ? parsedRows.slice(1) : parsedRows).slice(0, 2_000) });
  }
  return tables;
}

function normalizedPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input, ORIGIN);
    if (!["warcosts.org", "www.warcosts.org"].includes(url.hostname.toLowerCase())) return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return ALLOWED.has(path) ? path : null;
  } catch {
    return null;
  }
}

async function ensurePersistence(): Promise<void> {
  if (persistenceReady) return persistenceReady;
  persistenceReady = (async () => {
    if (!process.env.DATABASE_URL) return;
    const { pool } = await import("@workspace/db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warcosts_priority_page_structures (
        path TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        headings JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence_text TEXT NOT NULL DEFAULT '',
        tables JSONB NOT NULL DEFAULT '[]'::jsonb,
        content_hash TEXT NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // The priority mirror also writes the common page-snapshot table used by Site Evidence,
    // guaranteeing that high-value WarCosts hubs survive navigation/link-depth changes.
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
  })().catch((error) => {
    persistenceReady = null;
    throw error;
  });
  return persistenceReady;
}

function classify(path: string): string {
  if (path.startsWith("/conflicts/")) return "conflict";
  if (path.startsWith("/analysis/")) return "analysis";
  if (path.startsWith("/tools/")) return "tool";
  if (["/private-war", "/media-coverage", "/veterans-voices", "/allied-costs", "/military-families"].includes(path)) return "perspective";
  return "data-page";
}

async function persist(page: StructuredPage): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await ensurePersistence();
  const { pool } = await import("@workspace/db");
  await pool.query(
    `INSERT INTO warcosts_priority_page_structures (path,url,title,headings,evidence_text,tables,content_hash,fetched_at,updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8::timestamptz,NOW())
     ON CONFLICT (path) DO UPDATE SET url=EXCLUDED.url,title=EXCLUDED.title,headings=EXCLUDED.headings,evidence_text=EXCLUDED.evidence_text,tables=EXCLUDED.tables,content_hash=EXCLUDED.content_hash,fetched_at=EXCLUDED.fetched_at,updated_at=NOW()`,
    [page.path, page.url, page.title, JSON.stringify(page.headings), page.text, JSON.stringify(page.tables), page.contentHash, page.fetchedAt],
  );
  await pool.query(
    `INSERT INTO warcosts_page_snapshots (path,url,page_type,title,description,headings,evidence_text,char_count,link_count,content_hash,fetched_at,updated_at)
     VALUES ($1,$2,$3,$4,'',$5::jsonb,$6,$7,0,$8,$9::timestamptz,NOW())
     ON CONFLICT (path) DO UPDATE SET url=EXCLUDED.url,page_type=EXCLUDED.page_type,title=EXCLUDED.title,headings=EXCLUDED.headings,evidence_text=EXCLUDED.evidence_text,char_count=EXCLUDED.char_count,content_hash=EXCLUDED.content_hash,fetched_at=EXCLUDED.fetched_at,updated_at=NOW()`,
    [page.path, page.url, classify(page.path), page.title, JSON.stringify(page.headings), page.text, page.text.length, page.contentHash, page.fetchedAt],
  );
}

async function databasePage(path: string): Promise<StructuredPage | null> {
  if (!process.env.DATABASE_URL) return null;
  await ensurePersistence();
  const { pool } = await import("@workspace/db");
  const result = await pool.query<{ path:string; url:string; title:string; headings:unknown; evidence_text:string; tables:unknown; content_hash:string; fetched_at:Date|string }>(
    `SELECT path,url,title,headings,evidence_text,tables,content_hash,fetched_at FROM warcosts_priority_page_structures WHERE path=$1 LIMIT 1`, [path]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    path: row.path,
    url: row.url,
    title: row.title,
    headings: Array.isArray(row.headings) ? row.headings.filter((item): item is string => typeof item === "string") : [],
    text: row.evidence_text,
    tables: Array.isArray(row.tables) ? row.tables as StructuredTable[] : [],
    contentHash: row.content_hash,
    fetchedAt: row.fetched_at instanceof Date ? row.fetched_at.toISOString() : new Date(row.fetched_at).toISOString(),
    source: "database",
  };
}

async function livePage(path: string): Promise<StructuredPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${ORIGIN}${path}`, {
      headers: { Accept: "text/html", "User-Agent": "Occu-Med Insight Hub 2.0 WarCosts priority mirror" },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`WarCosts returned HTTP ${response.status}`);
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new Error("WarCosts page exceeded mirror safety limit");
    const text = cleanText(html).slice(0, 150_000);
    const title = tagText(html, "title")[0] ?? tagText(html, "h1")[0] ?? path;
    const page: StructuredPage = {
      path,
      url: `${ORIGIN}${path}`,
      title,
      headings: ["h1", "h2", "h3"].flatMap((tag) => tagText(html, tag)).slice(0, 250),
      text,
      tables: extractTables(html),
      contentHash: createHash("sha256").update(text).digest("hex"),
      fetchedAt: new Date().toISOString(),
      source: "live",
    };
    await persist(page);
    return page;
  } finally {
    clearTimeout(timer);
  }
}

async function readPage(path: string, force = false): Promise<StructuredPage> {
  const hit = cache.get(path);
  if (!force && hit && hit.expiresAt > Date.now()) return hit.page;
  try {
    const page = await livePage(path);
    cache.set(path, { page, expiresAt: Date.now() + CACHE_MS });
    return page;
  } catch (error) {
    const fallback = await databasePage(path);
    if (fallback) return fallback;
    throw error;
  }
}

router.get("/war-costs/priority-pages", (_req: Request, res: Response) => {
  return res.json({ ok: true, paths: WARCOSTS_PRIORITY_PATHS, count: WARCOSTS_PRIORITY_PATHS.length, cacheMinutes: CACHE_MS / 60_000 });
});

router.get("/war-costs/page-structure", async (req: Request, res: Response) => {
  const path = normalizedPath(req.query.path);
  if (!path) return res.status(400).json({ ok: false, error: "path must be an approved priority WarCosts page" });
  try {
    const page = await readPage(path, req.query.refresh === "1");
    return res.json({ ok: true, attribution: "Source: warcosts.org", page });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts structured page failed" });
  }
});

router.post("/war-costs/priority-pages/refresh", async (_req: Request, res: Response) => {
  const results = await Promise.all(WARCOSTS_PRIORITY_PATHS.map(async (path) => {
    try { const page = await readPage(path, true); return { path, ok: true, tables: page.tables.length }; }
    catch (error) { return { path, ok: false, error: error instanceof Error ? error.message : "refresh failed" }; }
  }));
  return res.json({ ok: results.every((item) => item.ok), results });
});

// Explicit priority refreshes complement the recursive crawler. Keep them out of test/CI.
if (process.env.NODE_ENV !== "test") {
  const startup = setTimeout(() => {
    void Promise.all(WARCOSTS_PRIORITY_PATHS.map((path) => readPage(path, false).catch(() => null)));
  }, 20_000);
  startup.unref?.();
}

export default router;
