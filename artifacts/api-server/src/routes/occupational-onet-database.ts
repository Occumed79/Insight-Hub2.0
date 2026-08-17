import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const ONET_BASE = "https://api-v2.onetcenter.org";

type TableEntry = { table_id?: string; title?: string; description?: string; info?: string; rows?: string };

function key(): string | undefined { return process.env.ONET_API_KEY?.trim() || undefined; }
function clean(value: unknown, max = 300): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function clamp(value: unknown, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback; }

async function getJson(path: string): Promise<unknown> {
  const apiKey = key();
  if (!apiKey) throw new Error("ONET_API_KEY is not configured.");
  const response = await fetch(`${ONET_BASE}${path}`, { headers: { "X-API-Key": apiKey, Accept: "application/json" } });
  if (!response.ok) throw new Error(`O*NET returned HTTP ${response.status}.`);
  return response.json();
}

async function tableList(): Promise<TableEntry[]> {
  const payload = await getJson("/database/");
  return Array.isArray(payload) ? payload as TableEntry[] : [];
}

async function validTable(tableId: string): Promise<TableEntry | undefined> {
  return (await tableList()).find((table) => clean(table.table_id, 200) === tableId);
}

router.get("/occupational-source-browser/onet/database/tables", async (_req: Request, res: Response) => {
  try {
    const tables = await tableList();
    return res.json({ ok: true, total: tables.length, tables, source: "O*NET Database Services API v2" });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "O*NET table listing failed." });
  }
});

router.get("/occupational-source-browser/onet/database/table/:tableId", async (req: Request, res: Response) => {
  const tableId = clean(req.params.tableId, 200);
  try {
    const table = await validTable(tableId);
    if (!table) return res.status(404).json({ ok: false, error: "Unknown O*NET database table." });
    const info = await getJson(`/database/info/${encodeURIComponent(tableId)}`);
    return res.json({ ok: true, table, info, source: "O*NET Database Services API v2" });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "O*NET table information failed." });
  }
});

router.get("/occupational-source-browser/onet/database/table/:tableId/rows", async (req: Request, res: Response) => {
  const tableId = clean(req.params.tableId, 200);
  const start = clamp(req.query.start, 1);
  const end = Math.min(start + 99, clamp(req.query.end, start + 49));
  try {
    const table = await validTable(tableId);
    if (!table) return res.status(404).json({ ok: false, error: "Unknown O*NET database table." });
    const payload = await getJson(`/database/rows/${encodeURIComponent(tableId)}?start=${start}&end=${end}`);
    return res.json({ ok: true, table, payload, source: "O*NET Database Services API v2" });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "O*NET table rows failed." });
  }
});

export default router;
