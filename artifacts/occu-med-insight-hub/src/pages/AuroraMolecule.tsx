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

async function loadModel(cid: number | string, signal: AbortSignal): Promise<Model> {
  const response = await fetch(`/api/reviewer-tools/pubchem-structure?cid=${encodeURIComponent(String(cid))}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.model) throw new Error(payload?.error || "PubChem coordinate record unavailable.");
  return payload.model as Model;
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
  if (element === 1) return 8;
  if (element === 6) return 13;
  if (element === 7 || element === 8) return 14;
  return 15;
}

export default function AuroraMolecule({ cid, name }: Props) {
  const { model, loading, error } = useModel(cid);

  const projection = useMemo(() => {
    if (!model?.atoms?.length) return null;
    const xs = model.atoms.map((a) => Number(a.x));
    const ys = model.atoms.map((a) => Number(a.y));
    const zs = model.atoms.map((a) => Number(a.z));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const dx = Math.max(1, maxX - minX), dy = Math.max(1, maxY - minY), dz = Math.max(1, maxZ - minZ);
    const width = 820, height = 470, pad = 62;
    const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy);
    const byId = new Map<number, Atom & { sx: number; sy: number; depth: number; radius: number }>();
    for (const atom of model.atoms) {
      const depth = (Number(atom.z) - minZ) / dz;
      const perspective = 0.86 + depth * 0.30;
      const sx = width / 2 + (Number(atom.x) - (minX + maxX) / 2) * scale * perspective;
      const sy = height / 2 - (Number(atom.y) - (minY + maxY) / 2) * scale * perspective;
      byId.set(Number(atom.id), { ...atom, sx, sy, depth, radius: atomRadius(Number(atom.element)) * perspective });
    }
    const atoms = [...byId.values()].sort((a, b) => a.depth - b.depth);
    const bonds = (model.bonds || []).flatMap((bond) => {
      const a = byId.get(Number(bond.a)), b = byId.get(Number(bond.b));
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
    const spacing = Number(order) === 1 ? [0] : Number(order) === 2 ? [-3.1, 3.1] : [-5, 0, 5];
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
      <svg viewBox={`0 0 ${projection.width} ${projection.height}`} role="img" aria-label={`PubChem ${String(projection.source).toUpperCase()} structure for ${name}`}>
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
            const palette = ELEMENT_PALETTE[Number(atom.element)] ?? { glow: "#68c8ff" };
            const label = ELEMENT_LABELS[Number(atom.element)] ?? "";
            return (
              <g key={atom.id} transform={`translate(${atom.sx} ${atom.sy})`} opacity={0.78 + atom.depth * 0.22}>
                <circle r={atom.radius * 1.8} fill={palette.glow} opacity={0.16 + atom.depth * 0.12} filter="url(#auroraAtomGlow)" />
                <circle r={atom.radius} fill={`url(#atom-${ELEMENT_PALETTE[Number(atom.element)] ? Number(atom.element) : "default"})`} stroke="#dffcff" strokeOpacity=".26" strokeWidth="1" />
                <ellipse cx={-atom.radius * .26} cy={-atom.radius * .3} rx={atom.radius * .28} ry={atom.radius * .18} fill="#fff" opacity=".66" />
                {label && Number(atom.element) !== 6 && Number(atom.element) !== 1 ? <text y="4" textAnchor="middle" className="aurora-atom-label">{label}</text> : null}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="aurora-molecule-depth-fog" aria-hidden="true" />
      <span className="aurora-coordinate-badge">PUBCHEM {String(projection.source).toUpperCase()} COORDINATES</span>
    </div>
  );
}
