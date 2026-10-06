import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import Strands, { STRANDS_DEFAULTS, type StrandsParams } from "./Strands";
import { Choreographer, type FocusPoint, type Phase } from "./choreography";
import {
  BODY_CENTER,
  GROUP_LABEL,
  HOLOGRAM_IMAGE,
  ZONES,
  ZONES_BY_AREA_DESC,
  zoneInView,
  type GroupKey,
  type View,
  type Zone,
} from "./anatomy";
import { heatColor, indexByGroup, type Signal, type SignalMode } from "./signals";

const IMG_W = HOLOGRAM_IMAGE.width;
const IMG_H = HOLOGRAM_IMAGE.height;

const GOLD_A = ["#FFC940", "#FF8A00", "#FFE9A8", "#FF6A1F"];
const GOLD_B = ["#FFE9A8", "#FFB020", "#FF7A00", "#FFD24A"];
const GOLD_AMBIENT = ["#FFB020", "#FF7A00", "#FFE9A8"];

function makeParams(colors: string[], overrides: Partial<StrandsParams> = {}): StrandsParams {
  return { ...STRANDS_DEFAULTS, colors, taper: 3, saturation: 1.35, ...overrides };
}

export interface HologramStageProps {
  phase: Phase;
  mode: SignalMode;
  signals: Signal[];
  activeGroup: GroupKey | null;
  activeZoneId: string | null;
  onHover: (zone: Zone | null) => void;
  onSelect: (zone: Zone) => void;
}

/** Image-space point -> percent of the stage. */
const toStage = (x: number, y: number) => ({ x: (x / IMG_W) * 100, y: (y / IMG_H) * 100 });

function describe(signal: Signal | undefined, mode: SignalMode) {
  if (!signal) return { value: "No signal", note: mode === "idle" ? "Region preview" : "Not indicated in current evidence" };
  if (mode === "osha") return { value: `${Math.round(signal.score * 100)}%`, note: "of coded body-part cases" };
  if (mode === "onet") return { value: `${signal.detail.length} refs`, note: "O*NET demand evidence" };
  return { value: signal.score >= 0.6 ? "Primary" : "Secondary", note: "anatomical association" };
}

export default function HologramStage({
  phase, mode, signals, activeGroup, activeZoneId, onHover, onSelect,
}: HologramStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ring0El = useRef<HTMLDivElement | null>(null);
  const ring1El = useRef<HTMLDivElement | null>(null);
  const params0 = useRef<StrandsParams>(makeParams(GOLD_A, { count: 5, scale: 2.6 }));
  const params1 = useRef<StrandsParams>(makeParams(GOLD_B, { count: 5, scale: 2.6 }));
  const paramsAmbient = useRef<StrandsParams>(
    makeParams(GOLD_AMBIENT, { count: 3, speed: 0.12, amplitude: 1.5, intensity: 0.4, glow: 2, opacity: 0.28, scale: 2.2, thickness: 0.8 }),
  );
  const choreo = useRef<Choreographer | null>(null);

  const byGroup = useMemo(() => indexByGroup(signals), [signals]);
  const maxScore = useMemo(() => Math.max(0.0001, ...signals.map((signal) => signal.score)), [signals]);
  const relative = (signal: Signal) => Math.min(1, Math.max(0.38, 0.38 + 0.62 * (signal.score / maxScore)));

  const activeZone = useMemo(
    () => ZONES.find((zone) => zone.id === activeZoneId) ?? null,
    [activeZoneId],
  );

  /** Focus point for each ring: the hovered zone in its own view, the group's counterpart in the other. */
  const focus = useMemo<[FocusPoint | null, FocusPoint | null]>(() => {
    if (!activeGroup || activeGroup === "wholeBody") return [null, null];
    const pick = (v: View): FocusPoint | null => {
      const zone = activeZone && activeZone.view === v ? activeZone : zoneInView(activeGroup, v);
      if (!zone) return null;
      const p = toStage(zone.cx, zone.cy);
      return { x: p.x, y: p.y, size: Math.max(9, ((Math.max(zone.rx, zone.ry) * 2.7) / IMG_W) * 100) };
    };
    return [pick("front"), pick("back")];
  }, [activeGroup, activeZone]);

  const bodyX = useMemo<[number, number]>(
    () => [toStage(BODY_CENTER.front, 0).x, toStage(BODY_CENTER.back, 0).x],
    [],
  );

  // One controller for the lifetime of the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controller = new Choreographer(
      [{ el: ring0El.current, params: params0 }, { el: ring1El.current, params: params1 }],
      { el: null, params: paramsAmbient },
      { phase: "calibrate", bodyX: [32, 68], focus: [null, null] },
      reduce,
    );
    const measure = () => controller.setStageSize(stage.clientWidth, stage.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    choreo.current = controller;
    controller.start();
    return () => {
      observer.disconnect();
      controller.stop();
      choreo.current = null;
    };
  }, []);

  useEffect(() => {
    choreo.current?.setInput({ phase, bodyX, focus });
  }, [phase, bodyX, focus]);

  // ---- lit layer: mask + glow blobs ------------------------------------------------------
  const litZones = useMemo(() => {
    const entries: Array<{ zone: Zone; signal?: Signal; strength: number; color: string; active: boolean }> = [];
    for (const zone of ZONES) {
      const signal = byGroup.get(zone.group);
      const active = zone.group === activeGroup;
      if (!signal && !active) continue;
      const strength = signal ? relative(signal) : 0.55;
      entries.push({ zone, signal, strength: active ? Math.min(1, strength + 0.18) : strength, color: heatColor(signal ? relative(signal) : 0.45), active });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byGroup, activeGroup, maxScore]);

  const maskImage = useMemo(() => {
    if (!litZones.length) return "linear-gradient(transparent, transparent)";
    return litZones
      .map(({ zone, strength }) => {
        const rx = ((zone.rx * 1.2) / IMG_W) * 100;
        const ry = ((zone.ry * 1.2) / IMG_H) * 100;
        const x = (zone.cx / IMG_W) * 100;
        const y = (zone.cy / IMG_H) * 100;
        return `radial-gradient(ellipse ${rx.toFixed(2)}% ${ry.toFixed(2)}% at ${x.toFixed(2)}% ${y.toFixed(2)}%, rgba(0,0,0,${strength.toFixed(2)}) 0%, rgba(0,0,0,${(strength * 0.55).toFixed(2)}) 55%, rgba(0,0,0,0) 100%)`;
      })
      .join(", ");
  }, [litZones]);

  const aura = byGroup.get("wholeBody");

  // ---- callout for the active region -------------------------------------------------------
  const callout = useMemo(() => {
    if (!activeGroup || activeGroup === "wholeBody") return null;
    const zone = activeZone ?? zoneInView(activeGroup, activeGroup === "lowBack" ? "back" : "front") ?? ZONES.find((z) => z.group === activeGroup);
    if (!zone) return null;
    const center = BODY_CENTER[zone.view];
    const side = zone.cx < center ? -1 : 1;
    const sx = zone.cx + side * zone.rx * 0.85;
    const sy = zone.cy - zone.ry * 0.25;
    const ex = zone.cx + side * (zone.rx + 62);
    const ey = zone.cy - zone.ry * 0.25 - 34;
    const lx = ex + side * 52;
    return { zone, side, sx, sy, ex, ey, lx, signal: byGroup.get(zone.group) };
  }, [activeGroup, activeZone, byGroup]);

  const label = (zone: Zone) => `${GROUP_LABEL[zone.group]}${byGroup.has(zone.group) ? (mode === "osha" ? " reported case signal" : " signal") : " region"}`;

  return (
    <div
      ref={stageRef}
      className="hs-stage"
      data-testid="health-hologram"
      data-phase={phase}
      data-mode={mode}
    >
      <div className="hs-atmosphere" aria-hidden="true">
        <i className="hs-bloom hs-bloom-a" />
        <i className="hs-bloom hs-bloom-b" />
        <i className="hs-floor" />
        <i className="hs-dust"><b /></i>
      </div>

      <div className="hs-ambient" aria-hidden="true">
        <Strands paramsRef={paramsAmbient} maxDpr={1} timeOffset={11} />
      </div>

      <div className="hs-inner">
        <img
          className={`hs-body${aura ? " has-aura" : ""}`}
          src={HOLOGRAM_IMAGE.src}
          width={IMG_W}
          height={IMG_H}
          alt="Gold holographic human body, anterior and posterior views"
          draggable={false}
          decoding="async"
          fetchPriority="high"
        />

        <div
          className="hs-lit"
          aria-hidden="true"
          style={{ backgroundImage: `url(${HOLOGRAM_IMAGE.src})`, WebkitMaskImage: maskImage, maskImage }}
        />

        <div className="hs-glows" aria-hidden="true">
          {litZones.map(({ zone, strength, color, active }, index) => (
            <i
              key={zone.id}
              className={`hs-glow${active ? " is-active" : ""}`}
              style={{
                left: `${(zone.cx / IMG_W) * 100}%`,
                top: `${(zone.cy / IMG_H) * 100}%`,
                width: `${((zone.rx * 3.1) / IMG_W) * 100}%`,
                height: `${((zone.ry * 3.1) / IMG_H) * 100}%`,
                "--glow": color,
                "--strength": strength,
                animationDelay: `${(index % 7) * -0.45}s`,
              } as CSSProperties}
            />
          ))}
        </div>

        <svg className="hs-overlay" viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none">
          {callout ? (
            <g className="hs-reticle" transform={`translate(${callout.zone.cx} ${callout.zone.cy})`} key={callout.zone.id}>
              <circle className="hs-reticle-ring" r={Math.max(callout.zone.rx, callout.zone.ry) * 1.12} />
              <circle className="hs-reticle-inner" r={Math.max(callout.zone.rx, callout.zone.ry) * 0.7} />
              {[0, 90, 180, 270].map((angle) => (
                <line key={angle} className="hs-reticle-tick" x1={0} y1={-Math.max(callout.zone.rx, callout.zone.ry) * 1.12 - 6} x2={0} y2={-Math.max(callout.zone.rx, callout.zone.ry) * 1.12 + 10} transform={`rotate(${angle})`} />
              ))}
            </g>
          ) : null}
          {callout ? (
            <g className="hs-leader" key={`leader-${callout.zone.id}`}>
              <circle cx={callout.sx} cy={callout.sy} r={3.2} />
              <polyline points={`${callout.sx},${callout.sy} ${callout.ex},${callout.ey} ${callout.lx},${callout.ey}`} />
            </g>
          ) : null}
          {ZONES_BY_AREA_DESC.map((zone) => (
            <ellipse
              key={zone.id}
              className="hs-hit"
              cx={zone.cx}
              cy={zone.cy}
              rx={zone.rx}
              ry={zone.ry}
              role="button"
              tabIndex={0}
              aria-label={label(zone)}
              aria-pressed={zone.group === activeGroup}
              onPointerEnter={() => onHover(zone)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover(zone)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(zone)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(zone);
                }
              }}
            />
          ))}
        </svg>

        {callout ? (() => {
          const info = describe(callout.signal, mode);
          const left = ((callout.lx) / IMG_W) * 100;
          const top = (callout.ey / IMG_H) * 100;
          return (
            <div
              key={`label-${callout.zone.id}`}
              className={`hs-callout side-${callout.side > 0 ? "right" : "left"}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-live="polite"
            >
              <span className="hs-callout-name">{GROUP_LABEL[callout.zone.group]}</span>
              <strong className="hs-callout-value">{info.value}</strong>
              <span className="hs-callout-note">{info.note}</span>
              {callout.signal?.detail[0] ? <span className="hs-callout-detail">{callout.signal.detail[0]}</span> : null}
            </div>
          );
        })() : null}

        <span className="hs-cap hs-cap-front" aria-hidden="true">ANTERIOR</span>
        <span className="hs-cap hs-cap-back" aria-hidden="true">POSTERIOR</span>
      </div>

      <div className="hs-rings" aria-hidden="true">
        <div ref={ring0El} className="hs-ring">
          <Strands paramsRef={params0} timeOffset={0} />
        </div>
        <div ref={ring1El} className="hs-ring">
          <Strands paramsRef={params1} timeOffset={7} />
        </div>
      </div>

      <div className="hs-vignette" aria-hidden="true" />
    </div>
  );
}
