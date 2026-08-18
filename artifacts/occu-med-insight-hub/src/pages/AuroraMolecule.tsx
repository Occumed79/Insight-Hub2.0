import { useEffect, useMemo, useState, type CSSProperties } from "react";
import "./AuroraMolecule.css";

type Atom = { id: number; element: number; x: number; y: number; z: number };
type Bond = { a: number; b: number; order: number };
type Model = { atoms: Atom[]; bonds: Bond[]; source: "3d" | "2d" };

type Props = {
  cid: number | string;
  name: string;
};

const ELEMENT_LABELS: Record<number, string> = {
  1: "H", 6: "C", 7: "N", 8: "O", 9: "F", 15: "P", 16: "S", 17: "Cl", 35: "Br", 53: "I",
};

const ELEMENT_PALETTE: Record<number, { core: string; rim: string; glow: string }> = {
  1: { core: "#dffcff", rim: "#86e8ff", glow: "#7ee8ff" },
  6: { core: "#82f5e5", rim: "#22c9d7", glow: "#2de0dc" },
  7: { core: "#7bd7ff", rim: "#3589ff", glow: "#4ea8ff" },
  8: { core: "#c5a7ff", rim: "#7756ff", glow: "#966bff" },
  9: { core: "#9df7ef", rim: "#38d9c6", glow: "#54ead8" },
  15: { core: "#b9c9ff", rim: "#6675ff", glow: "#7180ff" },
  16: { core: "#9cecff", rim: "#4e9cff", glow: "#59b6ff" },
  17: { core: "#7ff0dc", rim: "#28b6b0", glow: "#42d7cb" },
  35: { core: "#c2a7ff", rim: "#7856d9", glow: "#936bff" },
  53: { core: "#ad9cff", rim: "#6447ca", glow: "#7e60e8" },
};

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCompound(payload: any, source: "3d" | "2d"): Model | null {
  const compound = payload?.PC_Compounds?.[0];
  if (!compound) return null;
  const ids: number[] = Array.isArray(compound?.atoms?.aid) ? compound.atoms.aid.map(Number) : [];
  const elements: number[] = Array.isArray(compound?.atoms?.element) ? compound.atoms.element.map(Number) : [];
  const conformer = compound?.coords?.[0]?.conformers?.[0];
  const xs: number[] = Array.isArray(conformer?.x) ? conformer.x.map(Number) : [];
  const ys: number[] = Array.isArray(conformer?.y) ? conformer.y.map(Number) : [];
  const zs: number[] = Array.isArray(conformer?.z) ? conformer.z.map(Number) : [];
  if (!ids.length || xs.length !== ids.length || ys.length !== ids.length) return null;

  const atoms = ids.map((id, i) => ({
    id,
    element: elements[i] || 6,
    x: asNumber(xs[i]),
    y: asNumber(ys[i]),
    z: source === "3d" ? asNumber(zs[i]) : 0,
  }));

  const a1: number[] = Array.isArray(compound?.bonds?.aid1) ? compound.bonds.aid1.map(Number) : [];
  const a2: number[] = Array.isArray(compound?.bonds?.aid2) ? compound.bonds.aid2.map(Number) : [];
  const orders: number[] = Array.isArray(compound?.bonds?.order) ? compound.bonds.order.map(Number) : [];
  const bonds = a1.map((a, i) => ({ a, b: a2[i], order: Math.max(1, Math.min(3, orders[i] || 1)) })).filter((bond) => Number.isFinite(bond.a) && Number.isFinite(bond.b));
  return { atoms, bonds, source };
}

async function loadModel(cid: number | string, signal: AbortSignal): Promise<Model> {
  const base = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(String(cid))}/record/JSON`;
  for (const source of ["3d", "2d"] as const) {
    const response = await fetch(`${base}?record_type=${source}`, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) continue;
    const model = parseCompound(await response.json(), source);
    if (model) return model;
  }
  throw new Error("PubChem coordinate record unavailable.");
}

function useModel(cid: number | string) {
  const [state, setState] = useState<{ model: Model | null; loading: boolean; error: string }>(() => ({ model: null, loading: true, error: "" }));
  useEffect(() => {
    const controller = new AbortController();
    setState({ model: null, loading: true, error: "" });
    loadModel(cid, controller.signal)
      .then((model) => setState({ model, loading: false, error: "" }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ model: null, loading: false, error: error instanceof Error ? error.message : "Molecular coordinates unavailable." });
      });
    return () => controller.abort();
  }, [cid]);
  return state;
}

function atomRadius(element: number) {
  if (element === 1) return 9;
  if (element === 6) return 13;
  if (element === 7 || element === 8) return 14;
  return 15;
}

export default function AuroraMolecule({ cid, name }: Props) {
  const { model, loading, error } = useModel(cid);

  const projection = useMemo(() => {
    if (!model) return null;
    const xs = model.atoms.map((a) => a.x);
    const ys = model.atoms.map((a) => a.y);
    const zs = model.atoms.map((a) => a.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const dx = Math.max(1, maxX - minX), dy = Math.max(1, maxY - minY), dz = Math.max(1, maxZ - minZ);
    const width = 820, height = 470, pad = 72;
    const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy);
    const byId = new Map<number, Atom & { sx: number; sy: number; depth: number; radius: number }>();
    for (const atom of model.atoms) {
      const depth = (atom.z - minZ) / dz;
      const perspective = 0.88 + depth * 0.24;
      const sx = width / 2 + (atom.x - (minX + maxX) / 2) * scale * perspective;
      const sy = height / 2 - (atom.y - (minY + maxY) / 2) * scale * perspective;
      byId.set(atom.id, { ...atom, sx, sy, depth, radius: atomRadius(atom.element) * perspective });
    }
    const atoms = [...byId.values()].sort((a, b) => a.depth - b.depth);
    const bonds = model.bonds.flatMap((bond) => {
      const a = byId.get(bond.a), b = byId.get(bond.b);
      return a && b ? [{ ...bond, a, b, depth: (a.depth + b.depth) / 2 }] : [];
    }).sort((a, b) => a.depth - b.depth);
    return { width, height, atoms, bonds, source: model.source };
  }, [model]);

  if (loading) return <div className="aurora-molecule-status">Resolving PubChem coordinates…</div>;
  if (error || !projection) return <div className="aurora-molecule-status is-error">{error || "Molecular coordinates unavailable."}</div>;

  const bondLines = projection.bonds.flatMap((bond, index) => {
    const { a, b, order, depth } = bond;
    const dx = b.sx - a.sx, dy = b.sy - a.sy;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length, ny = dx / length;
    const spacing = order === 1 ? [0] : order === 2 ? [-3.1, 3.1] : [-5, 0, 5];
    return spacing.map((offset, lane) => (
      <g key={`${index}-${lane}`} opacity={0.68 + depth * 0.28}>
        <line x1={a.sx + nx * offset} y1={a.sy + ny * offset} x2={b.sx + nx * offset} y2={b.sy + ny * offset} className="aurora-bond-halo" />
        <line x1={a.sx + nx * offset} y1={a.sy + ny * offset} x2={b.sx + nx * offset} y2={b.sy + ny * offset} className="aurora-bond-core" />
      </g>
    ));
  });

  return (
    <div className="aurora-molecule" data-testid="aurora-molecule" aria-label={`Aurora molecular structure for ${name}`}>
      <div className="aurora-bokeh" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}
      </div>
      <svg viewBox={`0 0 ${projection.width} ${projection.height}`} role="img" aria-label={`PubChem ${projection.source.toUpperCase()} structure for ${name}`}>
        <defs>
          <filter id="auroraBondGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="auroraAtomGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="auroraBondGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#65f0dc" /><stop offset="48%" stopColor="#69c8ff" /><stop offset="100%" stopColor="#9a72ff" /></linearGradient>
          {Object.entries(ELEMENT_PALETTE).map(([element, palette]) => (
            <radialGradient key={element} id={`atom-${element}`} cx="34%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity=".98" />
              <stop offset="18%" stopColor={palette.core} stopOpacity="1" />
              <stop offset="60%" stopColor={palette.rim} stopOpacity=".98" />
              <stop offset="100%" stopColor="#07142c" stopOpacity="1" />
            </radialGradient>
          ))}
          <radialGradient id="atom-default" cx="34%" cy="28%" r="72%"><stop offset="0%" stopColor="#fff" /><stop offset="22%" stopColor="#95ecff" /><stop offset="70%" stopColor="#5f72ff" /><stop offset="100%" stopColor="#07142c" /></radialGradient>
        </defs>
        <g className="aurora-molecule-rig">
          <g filter="url(#auroraBondGlow)">{bondLines}</g>
          {projection.atoms.map((atom) => {
            const palette = ELEMENT_PALETTE[atom.element] ?? { glow: "#68c8ff" };
            const label = ELEMENT_LABELS[atom.element] ?? "";
            return (
              <g key={atom.id} transform={`translate(${atom.sx} ${atom.sy})`} opacity={0.78 + atom.depth * 0.22}>
                <circle r={atom.radius * 1.8} fill={palette.glow} opacity={0.16 + atom.depth * 0.12} filter="url(#auroraAtomGlow)" />
                <circle r={atom.radius} fill={`url(#atom-${ELEMENT_PALETTE[atom.element] ? atom.element : "default"})`} stroke="#dffcff" strokeOpacity=".26" strokeWidth="1" />
                <ellipse cx={-atom.radius * .26} cy={-atom.radius * .3} rx={atom.radius * .28} ry={atom.radius * .18} fill="#fff" opacity=".66" />
                {label && atom.element !== 6 && atom.element !== 1 ? <text y="4" textAnchor="middle" className="aurora-atom-label">{label}</text> : null}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="aurora-molecule-depth-fog" aria-hidden="true" />
      <span className="aurora-coordinate-badge">PUBCHEM {projection.source.toUpperCase()} COORDINATES</span>
    </div>
  );
}
