import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const ONET_BASE_URL = "https://api-v2.onetcenter.org";

type JsonRecord = Record<string, unknown>;
type Evidence = { id?: string; name: string; description?: string; value?: number; category?: string; response?: Array<{ percentage?: number; description?: string }> };

function asRecord(value: unknown): JsonRecord | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown, max = 2000): string { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""; }

async function fetchOnet(path: string): Promise<unknown> {
  const key = process.env.ONET_API_KEY?.trim();
  if (!key) throw new Error("ONET_API_KEY is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${ONET_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { "X-API-Key": key, Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 O*NET resolver" },
    });
    if (!response.ok) throw new Error(`O*NET returned HTTP ${response.status}.`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function normalizeItems(payload: unknown, key: string): Evidence[] {
  const record = asRecord(payload);
  return asArray(record?.[key]).map((item) => {
    const row = asRecord(item) ?? {};
    const numeric = Number(row.importance ?? row.context ?? row.value);
    const response = asArray(row.response).map((entry) => {
      const responseRow = asRecord(entry) ?? {};
      const pct = Number(responseRow.percentage_of_respondents ?? responseRow.percentage);
      return { percentage: Number.isFinite(pct) ? pct : undefined, description: text(responseRow.description, 500) || undefined };
    });
    return {
      id: text(row.id, 100) || undefined,
      name: text(row.name ?? row.title ?? row.statement, 1000),
      description: text(row.description, 2000) || undefined,
      value: Number.isFinite(numeric) ? numeric : undefined,
      category: text(row.category, 100) || undefined,
      response: response.length ? response : undefined,
    };
  }).filter((item) => item.name);
}

router.get("/occupational-discovery/onet/profile-by-code", async (req: Request, res: Response) => {
  const code = text(req.query.code, 40);
  if (!/^\d{2}-\d{4}\.\d{2}$/.test(code)) return res.status(400).json({ ok: false, error: "A valid O*NET-SOC code is required." });
  if (!process.env.ONET_API_KEY?.trim()) return res.status(503).json({ ok: false, error: "ONET_API_KEY is not configured." });
  const encoded = encodeURIComponent(code);
  try {
    const settled = await Promise.allSettled([
      fetchOnet(`/online/occupations/${encoded}/`),
      fetchOnet(`/online/occupations/${encoded}/details/tasks?end=100&sort=importance`),
      fetchOnet(`/online/occupations/${encoded}/details/work_context?end=100&sort=context`),
      fetchOnet(`/online/occupations/${encoded}/details/abilities?end=100&sort=importance`),
      fetchOnet(`/online/occupations/${encoded}/details/work_activities?end=100&sort=importance`),
      fetchOnet(`/online/occupations/${encoded}/details/detailed_work_activities?end=100`),
    ]);
    const overview = settled[0].status === "fulfilled" ? asRecord(settled[0].value) : null;
    const title = text(overview?.title ?? overview?.name, 500);
    if (!title) return res.status(404).json({ ok: false, error: "O*NET occupation was not found." });
    const profile = {
      occupation: { code, title, description: text(overview?.description, 2500) },
      tasks: settled[1].status === "fulfilled" ? normalizeItems(settled[1].value, "task") : [],
      workContext: settled[2].status === "fulfilled" ? normalizeItems(settled[2].value, "element") : [],
      abilities: settled[3].status === "fulfilled" ? normalizeItems(settled[3].value, "element") : [],
      workActivities: settled[4].status === "fulfilled" ? normalizeItems(settled[4].value, "element") : [],
      detailedWorkActivities: settled[5].status === "fulfilled" ? normalizeItems(settled[5].value, "activity") : [],
    };
    return res.json({
      ok: true,
      profile,
      partialErrors: settled.map((entry, index) => entry.status === "rejected" ? ["overview", "tasks", "workContext", "abilities", "workActivities", "detailedWorkActivities"][index] : null).filter(Boolean),
      source: "O*NET Web Services",
      limitation: "O*NET describes occupations broadly. Employer-specific essential functions, exposures, physical requirements, and medical implications require reviewer verification.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "O*NET request failed.";
    return res.status(502).json({ ok: false, error: message.slice(0, 300) });
  }
});

export default router;
