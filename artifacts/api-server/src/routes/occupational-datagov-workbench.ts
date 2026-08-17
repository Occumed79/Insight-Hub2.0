import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const DATASTORE_SEARCH = "https://catalog.data.gov/api/3/action/datastore_search";
const MAX_ROWS = 100;
const MAX_COLUMNS = 50;

type CkanField = { id?: string; type?: string };
type CkanResult = { total?: number; records?: Array<Record<string, unknown>>; fields?: CkanField[] };

type ColumnProfile = {
  name: string;
  declaredType: string;
  nonEmpty: number;
  inferredType: "numeric" | "date" | "text";
  min?: number;
  max?: number;
  samples: string[];
};

function clean(value: unknown, max = 400): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : String(value ?? "").slice(0, max);
}

function profileColumns(rows: Array<Record<string, unknown>>, fields: CkanField[]): ColumnProfile[] {
  const declared = new Map(fields.map((field) => [clean(field.id, 200), clean(field.type, 100)]));
  const columns = Array.from(new Set([...fields.map((field) => clean(field.id, 200)), ...rows.flatMap((row) => Object.keys(row))])).filter(Boolean).slice(0, MAX_COLUMNS);
  return columns.map((column) => {
    const rawValues = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && clean(value).length > 0);
    const numericValues = rawValues.map((value) => Number(String(value).replace(/[, $%]/g, ""))).filter(Number.isFinite);
    const dateValues = rawValues.filter((value) => !Number.isFinite(Number(value)) && !Number.isNaN(Date.parse(String(value))));
    const inferredType: ColumnProfile["inferredType"] = numericValues.length >= Math.max(2, rawValues.length * 0.8) ? "numeric" : dateValues.length >= Math.max(2, rawValues.length * 0.8) ? "date" : "text";
    return {
      name: column,
      declaredType: declared.get(column) || "unknown",
      nonEmpty: rawValues.length,
      inferredType,
      min: numericValues.length ? Math.min(...numericValues) : undefined,
      max: numericValues.length ? Math.max(...numericValues) : undefined,
      samples: Array.from(new Set(rawValues.slice(0, 20).map((value) => clean(value, 120)))).slice(0, 4),
    };
  });
}

router.get("/occupational-discovery/datagov-datastore-preview", async (req: Request, res: Response) => {
  const resourceId = clean(req.query.resource, 200);
  if (!resourceId || !/^[A-Za-z0-9._:-]+$/.test(resourceId)) {
    return res.status(400).json({ ok: false, error: "A valid CKAN datastore resource ID is required." });
  }
  try {
    const params = new URLSearchParams({ resource_id: resourceId, limit: String(MAX_ROWS) });
    const response = await fetch(`${DATASTORE_SEARCH}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 Data.gov workbench" },
    });
    if (!response.ok) throw new Error(`Data.gov datastore returned HTTP ${response.status}.`);
    const payload = await response.json() as { success?: boolean; result?: CkanResult; error?: unknown };
    if (!payload.success || !payload.result) throw new Error("This resource is not available through the Data.gov CKAN datastore preview endpoint.");
    const records = (payload.result.records ?? []).slice(0, MAX_ROWS).map((record) => Object.fromEntries(Object.entries(record).slice(0, MAX_COLUMNS).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 3000) : value])));
    const fields = (payload.result.fields ?? []).slice(0, MAX_COLUMNS);
    return res.json({
      ok: true,
      resourceId,
      total: Number(payload.result.total ?? records.length),
      displayed: records.length,
      fields,
      columns: profileColumns(records, fields),
      records,
      limitation: `Workbench preview is capped at ${MAX_ROWS} rows and ${MAX_COLUMNS} columns. Use the publishing agency's original resource for complete data and metadata.`,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "Data.gov datastore preview failed." });
  }
});

export default router;
