import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

type Atom = { id: number; element: number; x: number; y: number; z: number };
type Bond = { a: number; b: number; order: number };

type CompactModel = {
  source: "3d" | "2d";
  atoms: Atom[];
  bonds: Bond[];
};

function finite(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCompound(payload: any, source: "3d" | "2d"): CompactModel | null {
  const compound = payload?.PC_Compounds?.[0];
  if (!compound) return null;
  const ids = Array.isArray(compound?.atoms?.aid) ? compound.atoms.aid.map(Number) : [];
  const elements = Array.isArray(compound?.atoms?.element) ? compound.atoms.element.map(Number) : [];
  const conformer = compound?.coords?.[0]?.conformers?.[0];
  const xs = Array.isArray(conformer?.x) ? conformer.x.map(Number) : [];
  const ys = Array.isArray(conformer?.y) ? conformer.y.map(Number) : [];
  const zs = Array.isArray(conformer?.z) ? conformer.z.map(Number) : [];
  if (!ids.length || xs.length !== ids.length || ys.length !== ids.length) return null;

  const atoms: Atom[] = ids.map((id: number, index: number) => ({
    id,
    element: elements[index] || 6,
    x: finite(xs[index]),
    y: finite(ys[index]),
    z: source === "3d" ? finite(zs[index]) : 0,
  }));

  const aid1 = Array.isArray(compound?.bonds?.aid1) ? compound.bonds.aid1.map(Number) : [];
  const aid2 = Array.isArray(compound?.bonds?.aid2) ? compound.bonds.aid2.map(Number) : [];
  const orders = Array.isArray(compound?.bonds?.order) ? compound.bonds.order.map(Number) : [];
  const bonds: Bond[] = aid1.flatMap((a: number, index: number) => {
    const b = Number(aid2[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    return [{ a, b, order: Math.max(1, Math.min(3, Number(orders[index]) || 1)) }];
  });

  return { source, atoms, bonds };
}

async function fetchRecord(cid: string, source: "3d" | "2d") {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(cid)}/record/JSON?record_type=${source}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 molecule-renderer" },
    });
    if (!response.ok) return null;
    return parseCompound(await response.json(), source);
  } finally {
    clearTimeout(timer);
  }
}

router.get("/reviewer-tools/pubchem-structure", async (req: Request, res: Response) => {
  const cid = String(req.query.cid ?? "").trim();
  if (!/^\d{1,12}$/.test(cid)) return res.status(400).json({ ok: false, error: "Valid PubChem CID is required." });

  const cached = cache.get(cid);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.payload);

  try {
    const model = await fetchRecord(cid, "3d") ?? await fetchRecord(cid, "2d");
    if (!model) return res.status(404).json({ ok: false, error: "PubChem coordinate record unavailable." });
    const payload = { ok: true, source: "NIH PubChem PUG REST", cid: Number(cid), model };
    cache.set(cid, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "PubChem coordinate service unavailable." });
  }
});

export default router;
