import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { COMMAND_VIEW, type DirectoryIndex } from "./aor-directory";
import type { CountryEntry, CountryIndex } from "./aor-geo";
import type { GlobeView } from "./aor-view";
import { DIMENSION_COLORS, type Dimension, type EvidenceRecord, type WorldEvent } from "./aor-intel-types";

// Two-dimensional AOR map. It renders the same repository boundary polygons the globe uses (equirectangular, no invented geometry) and
// the same directory markers for locations that have no polygon. It is the fallback when Cesium ion / WebGL is unavailable and an
// explicit alternative the person can choose.

type Camera = { lon: number; lat: number; span: number };
type Props = {
  index: CountryIndex;
  directory: DirectoryIndex;
  view: GlobeView;
  evidence: EvidenceRecord[];
  activeLayers: ReadonlySet<Dimension>;
  worldEvents: WorldEvent[];
  showAorShading: boolean;
  showMarkers: boolean;
  /** Width of the panel docked on the right; the camera target is shifted so the subject sits in the visible area. */
  rightInsetPx?: number;
  onPickLocation: (id: string) => void;
  onPickSplit: (iso3: string) => void;
  onPickEvidence: (id: string) => void;
  onHover: (name: string | null) => void;
};

const WORLD: Camera = { lon: 0, lat: 12, span: 380 };
const X = (lon: number) => lon + 180;
const Y = (lat: number) => 90 - lat;
const round = (value: number) => Math.round(value * 100) / 100;

/** Ring points closer than `tolerance` degrees to the previously kept point are dropped (the last point always stays, so rings still close). */
function decimate(ring: number[][], tolerance: number): number[][] {
  if (tolerance <= 0 || ring.length < 8) return ring;
  const kept: number[][] = [ring[0]];
  for (let i = 1; i < ring.length - 1; i++) {
    const last = kept[kept.length - 1];
    if (Math.abs(ring[i][0] - last[0]) >= tolerance || Math.abs(ring[i][1] - last[1]) >= tolerance) kept.push(ring[i]);
  }
  kept.push(ring[ring.length - 1]);
  return kept.length >= 4 ? kept : ring;
}

type Shape = { full: string; coarse: string; bbox: [number, number, number, number] };

/** Boundary geometry as SVG path data at two levels of detail, plus its bounding box in map units. The full outline is unchanged repository data. */
function shapeOf(entry: CountryEntry): Shape {
  let full = "";
  let coarse = "";
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const write = (ring: number[][]) => ring.map(([lon, lat], i) => `${i ? "L" : "M"}${round(X(lon))} ${round(Y(lat))}`).join("") + "Z";
  for (const polygon of entry.polygons) for (const ring of polygon) {
    for (const [lon, lat] of ring) { minX = Math.min(minX, X(lon)); maxX = Math.max(maxX, X(lon)); minY = Math.min(minY, Y(lat)); maxY = Math.max(maxY, Y(lat)); }
    full += write(ring);
    coarse += write(decimate(ring, COARSE_TOLERANCE));
  }
  return { full, coarse, bbox: [minX, minY, maxX, maxY] };
}

// Above this camera span (degrees across the screen) the world is drawn from simplified outlines; closer in, the full outlines are used.
// Software rasterisers redraw every country each animation frame, so drawing only what is on screen at the detail the zoom can show keeps flights smooth.
const COARSE_TOLERANCE = 0.2;
const COARSE_ABOVE_SPAN = 90;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function AorFlatMap(props: Props) {
  const { index, directory, view, evidence, activeLayers, worldEvents, showAorShading, showMarkers } = props;
  const rightInset = props.rightInsetPx ?? 0;
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [camera, setCamera] = useState<Camera>(WORLD);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const animation = useRef(0);
  const drag = useRef<{ x: number; y: number; lon: number; lat: number; moved: boolean } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setSize({ w: Math.max(320, host.clientWidth), h: Math.max(240, host.clientHeight) }));
    observer.observe(host);
    setSize({ w: Math.max(320, host.clientWidth), h: Math.max(240, host.clientHeight) });
    return () => observer.disconnect();
  }, []);

  const shapes = useMemo(() => new Map(index.list.map((entry) => [entry.iso2, shapeOf(entry)])), [index]);
  const aspect = size.w / size.h;

  // --- camera transitions: World -> command -> location ----------------------------------------
  const target = useMemo<Camera>(() => {
    // Shift the camera centre right-of-subject by half the docked panel so the subject is centred in the visible map area.
    const inset = (camera: Camera): Camera => ({ ...camera, lon: camera.lon + (camera.span * rightInset) / (2 * size.w) });
    if (view.level === "world") return { ...WORLD, span: Math.max(WORLD.span, 190 * aspect) };
    if (view.level === "aor" && view.aorId) {
      const command = COMMAND_VIEW[view.aorId];
      return inset({ lon: command.center[0], lat: command.center[1], span: Math.max(command.flatSpan[0], command.flatSpan[1] * aspect) });
    }
    const location = view.locationId ? directory.byId.get(view.locationId) : null;
    const entry = location?.boundaryIso2 ? index.byIso2.get(location.boundaryIso2) : view.splitIso3 ? index.byIso2.get(directory.splitByIso3.get(view.splitIso3)?.boundaryIso2 ?? "") : null;
    if (entry) {
      const { west, south, east, north } = entry.focus;
      return inset({ lon: (west + east) / 2, lat: (south + north) / 2, span: clamp(Math.max((east - west) * 2.4, (north - south) * 2.4 * aspect), 8, 360) });
    }
    if (location?.referencePoint) return inset({ lon: location.referencePoint.lon, lat: location.referencePoint.lat, span: 14 });
    return cameraRef.current;
  }, [view.level, view.aorId, view.locationId, view.splitIso3, view.nonce, aspect, directory, index, rightInset, size.w]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cancelAnimationFrame(animation.current);
    const from = cameraRef.current;
    const started = performance.now();
    const duration = 750;
    const step = (now: number) => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      // Zoom in log space so the move feels even.
      const span = Math.exp(Math.log(from.span) + (Math.log(target.span) - Math.log(from.span)) * eased);
      setCamera({ lon: from.lon + (target.lon - from.lon) * eased, lat: from.lat + (target.lat - from.lat) * eased, span });
      if (t < 1) animation.current = requestAnimationFrame(step);
    };
    animation.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation.current);
  }, [target]);

  const spanH = camera.span / aspect;
  const viewBox = `${round(X(camera.lon) - camera.span / 2)} ${round(Y(camera.lat) - spanH / 2)} ${round(camera.span)} ${round(spanH)}`;
  const unit = camera.span / size.w; // user units per screen pixel
  // Only outlines that intersect the visible area (plus a margin) are drawn.
  const viewMinX = X(camera.lon) - camera.span / 2 - camera.span * 0.15, viewMaxX = X(camera.lon) + camera.span / 2 + camera.span * 0.15;
  const viewMinY = Y(camera.lat) - spanH / 2 - spanH * 0.15, viewMaxY = Y(camera.lat) + spanH / 2 + spanH * 0.15;
  const onScreen = (b: [number, number, number, number]) => b[2] >= viewMinX && b[0] <= viewMaxX && b[3] >= viewMinY && b[1] <= viewMaxY;

  const zoom = useCallback((factor: number) => { cancelAnimationFrame(animation.current); setCamera((current) => ({ ...current, span: clamp(current.span * factor, 2, 400) })); }, []);

  const onWheel = (event: React.WheelEvent) => { zoom(event.deltaY > 0 ? 1.18 : 1 / 1.18); };
  const onPointerDown = (event: React.PointerEvent) => {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    cancelAnimationFrame(animation.current);
    drag.current = { x: event.clientX, y: event.clientY, lon: cameraRef.current.lon, lat: cameraRef.current.lat, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) state.moved = true;
    if (!state.moved) return;
    setCamera((current) => ({ ...current, lon: clamp(state.lon - dx * unit, -180, 180), lat: clamp(state.lat + dy * unit, -85, 85) }));
  };
  const onPointerUp = () => { window.setTimeout(() => { drag.current = null; }, 0); };

  const pick = (iso2: string) => {
    if (drag.current?.moved) return;
    const location = directory.byBoundaryIso2.get(iso2);
    if (location) { props.onPickLocation(location.id); return; }
    const split = directory.splitByBoundaryIso2.get(iso2);
    if (split) props.onPickSplit(split.iso3);
  };

  const selected = view.locationId ? directory.byId.get(view.locationId) ?? null : null;
  const aor = view.aorId;
  const nameOf = (iso2: string) => directory.byBoundaryIso2.get(iso2)?.name ?? directory.splitByBoundaryIso2.get(iso2)?.name ?? index.byIso2.get(iso2)?.name ?? iso2;

  const fillFor = (iso2: string): { fill: string; opacity: number; dashed: boolean } => {
    const location = directory.byBoundaryIso2.get(iso2);
    const split = directory.splitByBoundaryIso2.get(iso2);
    if (!location) return { fill: split ? "#94a3b8" : "#64748b", opacity: split ? 0.3 : 0.12, dashed: Boolean(split) };
    const color = location.command ? COMMAND_VIEW[location.command].color : "#64748b";
    if (!showAorShading) return { fill: "#64748b", opacity: 0.14, dashed: false };
    const isSelected = selected?.id === location.id;
    if (view.level === "world") return { fill: color, opacity: 0.34, dashed: false };
    const inAor = location.command === aor;
    if (view.level === "aor") return { fill: color, opacity: inAor ? 0.5 : 0.07, dashed: false };
    return { fill: color, opacity: isSelected ? 0.7 : inAor ? 0.24 : 0.05, dashed: false };
  };

  const tinted = useMemo(() => {
    const set = new Map<string, string>();
    for (const record of evidence) if (record.geometry.type === "Country" && activeLayers.has(record.dimension)) set.set(`${record.dimension}:${record.geometry.iso2}`, DIMENSION_COLORS[record.dimension]);
    return [...set].map(([key, color]) => ({ iso2: key.split(":")[1], color }));
  }, [evidence, activeLayers]);

  // Markers and labels keep a constant on-screen size. The old 0.25-degree floor made them balloon to 100+ px when zoomed into small islands.
  const markerRadius = Math.min(5 * unit, 3);
  const labelSize = 13 * unit;
  const noPolygon = directory.directory.locations.filter((entry) => !entry.boundaryIso2 && entry.referencePoint);
  const visibleMarkers = !showMarkers ? [] : view.level === "world" ? noPolygon : noPolygon.filter((entry) => entry.command === aor || entry.id === selected?.id);

  return (
    <div ref={hostRef} data-testid="aor-flat-map" className="absolute inset-0 z-0 touch-none select-none overflow-hidden bg-[#020a12]" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="application" aria-label="Two-dimensional AOR map. Select a country or territory, or use the search box." fillRule="evenodd">
        <rect x={-400} y={-200} width={1160} height={580} fill="#03101b" />
        {[...Array(13)].map((_, i) => <line key={`m${i}`} x1={i * 30} x2={i * 30} y1={0} y2={180} stroke="rgba(160,210,255,.07)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {[...Array(7)].map((_, i) => <line key={`p${i}`} y1={i * 30} y2={i * 30} x1={0} x2={360} stroke="rgba(160,210,255,.07)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        <g>
          {index.list.map((entry) => {
            const shape = shapes.get(entry.iso2);
            if (!shape) return null;
            const isSelectedShape = Boolean(selected?.boundaryIso2 === entry.iso2 || (view.splitIso3 && directory.splitByIso3.get(view.splitIso3)?.boundaryIso2 === entry.iso2));
            if (!isSelectedShape && !onScreen(shape.bbox)) return null;
            const d = camera.span > COARSE_ABOVE_SPAN ? shape.coarse : shape.full;
            const style = fillFor(entry.iso2);
            const location = directory.byBoundaryIso2.get(entry.iso2);
            const isSelected = Boolean(location && selected?.id === location.id) || Boolean(view.splitIso3 && directory.splitByIso3.get(view.splitIso3)?.boundaryIso2 === entry.iso2);
            return (
              <path
                key={entry.iso2} d={d} data-iso2={entry.iso2} data-location-id={location?.id ?? ""} data-command={location?.command ?? ""} data-selected={isSelected ? "true" : "false"}
                fill={style.fill} fillOpacity={style.opacity}
                stroke={isSelected ? "#e8ffff" : "rgba(190,225,255,.38)"} strokeWidth={isSelected ? 1.8 : 0.6} strokeDasharray={style.dashed ? "3 2" : undefined} vectorEffect="non-scaling-stroke"
                className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-70" onClick={() => pick(entry.iso2)}
                onMouseEnter={() => props.onHover(nameOf(entry.iso2))} onMouseLeave={() => props.onHover(null)}
              />
            );
          })}
        </g>
        <g pointerEvents="none">
          {tinted.map(({ iso2, color }) => { const shape = shapes.get(iso2); return shape && onScreen(shape.bbox) ? <path key={`${iso2}${color}`} d={camera.span > COARSE_ABOVE_SPAN ? shape.coarse : shape.full} fill={color} fillOpacity={0.14} stroke="none" /> : null; })}
        </g>
        <g>
          {visibleMarkers.map((entry) => {
            const point = entry.referencePoint!;
            const color = entry.command ? COMMAND_VIEW[entry.command].color : "#94a3b8";
            const isSelected = selected?.id === entry.id;
            return (
              <g key={entry.id} data-testid="aor-flat-marker" data-location-id={entry.id} role="button" tabIndex={0} aria-label={`${entry.name}, ${entry.command ?? "AOR unavailable"}, reference point only — no boundary is drawn`}
                className="cursor-pointer outline-none" onClick={() => props.onPickLocation(entry.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); props.onPickLocation(entry.id); } }}
                onMouseEnter={() => props.onHover(`${entry.name} (reference point)`)} onMouseLeave={() => props.onHover(null)}>
                <circle cx={round(X(point.lon))} cy={round(Y(point.lat))} r={markerRadius * (isSelected ? 1.7 : 1)} fill={color} fillOpacity={0.9} stroke={isSelected ? "#ffffff" : "rgba(255,255,255,.75)"} strokeWidth={isSelected ? 2 : 1} vectorEffect="non-scaling-stroke" />
                {isSelected || camera.span < 40 ? <text x={X(point.lon) + markerRadius * 2.2} y={Y(point.lat) + labelSize * 0.35} fontSize={labelSize} fontWeight={600} fill="#e8fbff" stroke="rgba(2,10,18,.9)" strokeWidth={labelSize * 0.25} paintOrder="stroke" pointerEvents="none">{entry.name}</text> : null}
              </g>
            );
          })}
          {evidence.filter((record) => record.geometry.type === "Point" && activeLayers.has(record.dimension)).map((record) => {
            const [lon, lat] = (record.geometry as { coordinates: [number, number] }).coordinates;
            return <circle key={record.id} data-testid="aor-flat-evidence" cx={round(X(lon))} cy={round(Y(lat))} r={markerRadius * 0.9} fill={DIMENSION_COLORS[record.dimension]} stroke="rgba(255,255,255,.9)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="cursor-pointer" onClick={() => props.onPickEvidence(record.id)}><title>{record.title}</title></circle>;
          })}
          {view.level !== "country" && activeLayers.has("disasters") ? worldEvents.map((event) => <circle key={event.id} cx={round(X(event.lon))} cy={round(Y(event.lat))} r={markerRadius * 0.7} fill={DIMENSION_COLORS.disasters} fillOpacity={0.85} stroke="rgba(255,255,255,.7)" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />) : null}
        </g>
      </svg>
      <div className="absolute bottom-16 left-4 z-10 flex flex-col overflow-hidden rounded-xl border border-white/[.09] bg-black/45 backdrop-blur-xl">
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1 / 1.6)} className="grid h-8 w-8 place-items-center text-white/80 hover:bg-white/10"><Plus size={13} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(1.6)} className="grid h-8 w-8 place-items-center border-t border-white/[.06] text-white/80 hover:bg-white/10"><Minus size={13} /></button>
        <button type="button" aria-label="Reset to world view" onClick={() => setCamera({ ...WORLD, span: Math.max(WORLD.span, 190 * aspect) })} className="grid h-8 w-8 place-items-center border-t border-white/[.06] text-white/80 hover:bg-white/10"><RotateCcw size={12} /></button>
      </div>
    </div>
  );
}
