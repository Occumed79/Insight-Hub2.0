import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const CACHE_TTL_MS = 30 * 60_000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

type Row = Record<string, unknown>;
type Atom = { id: number; element: number; x: number; y: number; z: number };
type Bond = { a: number; b: number; order: number };

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
}

async function fetchPubChemRecord(cid: number, recordType: "3d" | "2d") {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/JSON?record_type=${recordType}`;
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Occu-Med-Insight-Hub/2.0 molecule-renderer",
      },
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`PubChem returned HTTP ${response.status}.`);
    if (!raw.trim()) throw new Error("PubChem returned an empty conformer response.");
    const payload = JSON.parse(raw) as unknown;
    cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function parseConformer(payload: unknown) {
  const root = record(payload);
  const compounds = Array.isArray(root.PC_Compounds) ? root.PC_Compounds : [];
  const compound = record(compounds[0]);
  const atomsBlock = record(compound.atoms);
  const atomIds = numberArray(atomsBlock.aid);
  const elements = numberArray(atomsBlock.element);
  if (!atomIds.length || atomIds.length !== elements.length) return null;

  const coordsBlocks = Array.isArray(compound.coords) ? compound.coords : [];
  const coordsBlock = coordsBlocks.map(record).find((item) => Array.isArray(item.conformers)) ?? record(coordsBlocks[0]);
  const coordIds = numberArray(coordsBlock.aid);
  const conformers = Array.isArray(coordsBlock.conformers) ? coordsBlock.conformers : [];
  const conformer = record(conformers[0]);
  const xs = numberArray(conformer.x);
  const ys = numberArray(conformer.y);
  const zsRaw = numberArray(conformer.z);
  const zs = zsRaw.length ? zsRaw : new Array(xs.length).fill(0);
  if (!coordIds.length || xs.length !== coordIds.length || ys.length !== coordIds.length || zs.length !== coordIds.length) return null;

  const positionById = new Map<number, { x: number; y: number; z: number }>();
  coordIds.forEach((id, index) => positionById.set(id, { x: xs[index], y: ys[index], z: zs[index] ?? 0 }));

  const atoms: Atom[] = atomIds.flatMap((id, index) => {
    const position = positionById.get(id);
    if (!position) return [];
    return [{ id, element: elements[index], ...position }];
  });
  if (!atoms.length || atoms.length > 300) return null;

  const bondsBlock = record(compound.bonds);
  const aid1 = numberArray(bondsBlock.aid1);
  const aid2 = numberArray(bondsBlock.aid2);
  const orders = numberArray(bondsBlock.order);
  const bonds: Bond[] = [];
  for (let index = 0; index < Math.min(aid1.length, aid2.length); index += 1) {
    const a = aid1[index];
    const b = aid2[index];
    if (!positionById.has(a) || !positionById.has(b)) continue;
    bonds.push({ a, b, order: Math.max(1, Math.min(3, Math.round(orders[index] || 1))) });
  }

  return { atoms, bonds };
}

router.get("/reviewer-tools/pubchem-conformer", async (req: Request, res: Response) => {
  const cid = Number(req.query.cid);
  if (!Number.isInteger(cid) || cid <= 0 || cid > 2_147_483_647) {
    return res.status(400).json({ ok: false, error: "A valid PubChem CID is required." });
  }

  try {
    let recordType: "3d" | "2d" = "3d";
    let parsed = parseConformer(await fetchPubChemRecord(cid, recordType));
    if (!parsed) {
      recordType = "2d";
      parsed = parseConformer(await fetchPubChemRecord(cid, recordType));
    }
    if (!parsed) return res.status(404).json({ ok: false, error: "No renderable PubChem conformer was returned." });

    return res.json({
      ok: true,
      source: "NIH PubChem PUG REST full compound record",
      cid,
      recordType,
      ...parsed,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "PubChem conformer unavailable.",
    });
  }
});

export default router;
