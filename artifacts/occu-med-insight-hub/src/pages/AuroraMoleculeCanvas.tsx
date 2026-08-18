import { useEffect, useRef, useState } from "react";

type Atom = { id: number; element: number; x: number; y: number; z: number };
type Bond = { a: number; b: number; order: number };
type ConformerPayload = {
  ok?: boolean;
  error?: string;
  cid?: number;
  recordType?: "3d" | "2d";
  atoms?: Atom[];
  bonds?: Bond[];
};

type Props = {
  cid: number;
  name: string;
};

type RGB = [number, number, number];

const AURORA: RGB[] = [
  [77, 239, 216],
  [91, 220, 255],
  [78, 156, 255],
  [130, 105, 255],
  [171, 99, 255],
];

const ELEMENT_PALETTE: Record<number, RGB> = {
  1: [199, 248, 255],
  6: [82, 230, 226],
  7: [87, 167, 255],
  8: [158, 103, 255],
  9: [85, 244, 202],
  15: [111, 137, 255],
  16: [112, 223, 255],
  17: [74, 239, 203],
  35: [145, 111, 255],
  53: [174, 104, 255],
};

const ATOM_RADIUS: Record<number, number> = {
  1: 5.2,
  6: 9.4,
  7: 10.4,
  8: 10.8,
  9: 10.6,
  15: 11.7,
  16: 11.9,
  17: 11.5,
  35: 12.2,
  53: 13.0,
};

const BOKEH = Array.from({ length: 26 }, (_, index) => ({
  x: ((index * 37) % 101) / 100,
  y: ((index * 61 + 17) % 103) / 102,
  radius: 3 + ((index * 17) % 12),
  depth: ((index * 29) % 100) / 100,
  color: AURORA[index % AURORA.length],
}));

function colorForElement(element: number): RGB {
  return ELEMENT_PALETTE[element] ?? AURORA[Math.abs(element) % AURORA.length];
}

function rgba([r, g, b]: RGB, alpha: number) {
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ];
}

export default function AuroraMoleculeCanvas({ cid, name }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [payload, setPayload] = useState<ConformerPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setPayload(null);
    fetch(`/api/reviewer-tools/pubchem-conformer?cid=${encodeURIComponent(String(cid))}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || `Conformer request failed (${response.status}).`);
        return body as ConformerPayload;
      })
      .then((body) => {
        if (!body.atoms?.length) throw new Error("PubChem returned no renderable atoms.");
        setPayload(body);
        setStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPayload({ error: error instanceof Error ? error.message : "Molecular conformer unavailable." });
        setStatus("error");
      });
    return () => controller.abort();
  }, [cid]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const atoms = payload?.atoms ?? [];
    const bonds = payload?.bonds ?? [];
    if (!host || !canvas || !atoms.length || status !== "ready") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const atomById = new Map(atoms.map((atom) => [atom.id, atom]));
    const mean = atoms.reduce((acc, atom) => ({ x: acc.x + atom.x, y: acc.y + atom.y, z: acc.z + atom.z }), { x: 0, y: 0, z: 0 });
    mean.x /= atoms.length;
    mean.y /= atoms.length;
    mean.z /= atoms.length;
    const centered = atoms.map((atom) => ({ ...atom, x: atom.x - mean.x, y: atom.y - mean.y, z: atom.z - mean.z }));
    const centeredById = new Map(centered.map((atom) => [atom.id, atom]));
    const span = Math.max(
      1,
      ...centered.flatMap((atom) => [Math.abs(atom.x) * 2, Math.abs(atom.y) * 2, Math.abs(atom.z) * 2]),
    );

    let width = 1;
    let height = 1;
    let frame = 0;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const drawBokeh = (foreground = false, t = 0) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 0; index < BOKEH.length; index += 1) {
        const orb = BOKEH[index];
        const isFront = orb.depth > 0.72;
        if (isFront !== foreground) continue;
        const drift = reducedMotion ? 0 : Math.sin(t * 0.00025 + index * 1.7) * (5 + orb.depth * 9);
        const x = orb.x * width + drift;
        const y = orb.y * height + Math.cos(t * 0.00019 + index) * 4;
        const radius = orb.radius * (foreground ? 1.25 : 0.74);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.4);
        gradient.addColorStop(0, rgba(mix(orb.color, [255, 255, 255], 0.32), foreground ? 0.42 : 0.23));
        gradient.addColorStop(0.28, rgba(orb.color, foreground ? 0.24 : 0.15));
        gradient.addColorStop(1, rgba(orb.color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      drawBokeh(false, time);

      const pointer = pointerRef.current;
      const angleY = (reducedMotion ? 0.35 : time * 0.00017) + pointer.x * 0.34;
      const angleX = -0.16 + pointer.y * 0.20;
      const angleZ = pointer.x * -0.05;
      const cy = Math.cos(angleY);
      const sy = Math.sin(angleY);
      const cx = Math.cos(angleX);
      const sx = Math.sin(angleX);
      const cz = Math.cos(angleZ);
      const sz = Math.sin(angleZ);
      const scale = Math.min(width, height) / (span * 1.28);

      const projected = new Map<number, { x: number; y: number; z: number; perspective: number; element: number }>();
      for (const atom of centered) {
        const x1 = atom.x * cy + atom.z * sy;
        const z1 = -atom.x * sy + atom.z * cy;
        const y1 = atom.y * cx - z1 * sx;
        const z2 = atom.y * sx + z1 * cx;
        const x2 = x1 * cz - y1 * sz;
        const y2 = x1 * sz + y1 * cz;
        const perspective = Math.max(0.72, Math.min(1.28, 1 + z2 * 0.035));
        projected.set(atom.id, {
          x: width / 2 + x2 * scale * perspective,
          y: height / 2 - y2 * scale * perspective,
          z: z2,
          perspective,
          element: atom.element,
        });
      }

      const sortedBonds = [...bonds].sort((a, b) => {
        const az = ((projected.get(a.a)?.z ?? 0) + (projected.get(a.b)?.z ?? 0)) / 2;
        const bz = ((projected.get(b.a)?.z ?? 0) + (projected.get(b.b)?.z ?? 0)) / 2;
        return az - bz;
      });

      for (const bond of sortedBonds) {
        const start = projected.get(bond.a);
        const end = projected.get(bond.b);
        const startAtom = centeredById.get(bond.a) ?? atomById.get(bond.a);
        const endAtom = centeredById.get(bond.b) ?? atomById.get(bond.b);
        if (!start || !end || !startAtom || !endAtom) continue;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const order = Math.max(1, Math.min(3, Math.round(bond.order || 1)));
        const startColor = colorForElement(startAtom.element);
        const endColor = colorForElement(endAtom.element);
        const linePerspective = (start.perspective + end.perspective) / 2;

        for (let line = 0; line < order; line += 1) {
          const offset = (line - (order - 1) / 2) * 4.2 * linePerspective;
          const x1 = start.x + nx * offset;
          const y1 = start.y + ny * offset;
          const x2 = end.x + nx * offset;
          const y2 = end.y + ny * offset;
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, rgba(startColor, 0.96));
          gradient.addColorStop(0.5, rgba(mix(startColor, endColor, 0.5), 0.98));
          gradient.addColorStop(1, rgba(endColor, 0.96));

          ctx.save();
          ctx.lineCap = "round";
          ctx.strokeStyle = gradient;
          ctx.shadowColor = rgba(mix(startColor, endColor, 0.5), 0.65);
          ctx.shadowBlur = 18 * linePerspective;
          ctx.lineWidth = 9.5 * linePerspective;
          ctx.globalAlpha = 0.17;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.globalAlpha = 0.98;
          ctx.shadowBlur = 8 * linePerspective;
          ctx.lineWidth = 2.8 * linePerspective;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const sortedAtoms = [...projected.entries()].sort((a, b) => a[1].z - b[1].z);
      for (const [id, point] of sortedAtoms) {
        const atom = centeredById.get(id);
        if (!atom) continue;
        const base = colorForElement(atom.element);
        const radius = (ATOM_RADIUS[atom.element] ?? 10.4) * point.perspective;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.6);
        halo.addColorStop(0, rgba(base, 0.34));
        halo.addColorStop(0.38, rgba(base, 0.17));
        halo.addColorStop(1, rgba(base, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const sphere = ctx.createRadialGradient(
          point.x - radius * 0.34,
          point.y - radius * 0.42,
          radius * 0.08,
          point.x,
          point.y,
          radius,
        );
        sphere.addColorStop(0, "rgba(255,255,255,.98)");
        sphere.addColorStop(0.16, rgba(mix(base, [255, 255, 255], 0.58), 1));
        sphere.addColorStop(0.44, rgba(base, 1));
        sphere.addColorStop(0.78, rgba(mix(base, [6, 18, 48], 0.48), 1));
        sphere.addColorStop(1, "rgba(2,8,22,.98)");

        ctx.save();
        ctx.fillStyle = sphere;
        ctx.shadowColor = rgba(base, 0.78);
        ctx.shadowBlur = 18 * point.perspective;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(226,252,255,.58)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }

      drawBokeh(true, time);
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [payload, status]);

  return (
    <div
      ref={hostRef}
      className="relative z-[3] h-[390px] w-full touch-none overflow-hidden rounded-[24px]"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2)),
          y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2)),
        };
      }}
      onPointerLeave={() => { pointerRef.current = { x: 0, y: 0 }; }}
      data-testid="aurora-molecule-renderer"
      data-record-type={payload?.recordType ?? "pending"}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
        aria-label={`Cinematic aurora rendering of the PubChem molecular conformer for ${name}`}
      />
      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-center text-xs font-bold tracking-[.08em] text-cyan-100/48">BUILDING TRUE 3D CONFORMER…</div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center text-xs leading-6 text-cyan-100/48">{payload?.error || "PubChem conformer unavailable."}</div>
      ) : null}
      {status === "ready" ? (
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-cyan-100/12 bg-[#020a17]/50 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.15em] text-cyan-50/48 backdrop-blur-xl">
          PubChem {payload?.recordType?.toUpperCase()} conformer · interactive
        </div>
      ) : null}
    </div>
  );
}
