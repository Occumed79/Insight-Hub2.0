import { useMemo, type CSSProperties } from "react";
import {
  BODY_CENTER,
  GROUP_LABEL,
  HOLOGRAM_IMAGE,
  ZONES,
  ZONES_BY_AREA_DESC,
  zoneInView,
  type GroupKey,
  type Zone,
} from "./anatomy";
import { heatColor, indexByGroup, type Signal, type SignalMode } from "./signals";

const IMG_W = HOLOGRAM_IMAGE.width;
const IMG_H = HOLOGRAM_IMAGE.height;

export interface HologramStageProps {
  mode: SignalMode;
  signals: Signal[];
  activeGroup: GroupKey | null;
  activeZoneId: string | null;
  onHover: (zone: Zone | null) => void;
  onSelect: (zone: Zone) => void;
}

function describe(signal: Signal | undefined, mode: SignalMode) {
  if (!signal) return { value: "No signal", note: mode === "idle" ? "Region preview" : "Not indicated in current evidence" };
  if (mode === "osha") return { value: `${Math.round(signal.score * 100)}%`, note: "of coded body-part cases" };
  if (mode === "onet") return { value: `${signal.detail.length} refs`, note: "O*NET demand evidence" };
  return { value: signal.score >= 0.6 ? "Primary" : "Secondary", note: "anatomical association" };
}

export default function HologramStage({
  mode, signals, activeGroup, activeZoneId, onHover, onSelect,
}: HologramStageProps) {
  const byGroup = useMemo(() => indexByGroup(signals), [signals]);
  const maxScore = useMemo(() => Math.max(0.0001, ...signals.map((signal) => signal.score)), [signals]);
  const relative = (signal: Signal) => Math.min(1, Math.max(0.38, 0.38 + 0.62 * (signal.score / maxScore)));

  const activeZone = useMemo(
    () => ZONES.find((zone) => zone.id === activeZoneId) ?? null,
    [activeZoneId],
  );

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
      className="hs-stage"
      data-testid="health-hologram"
      data-mode={mode}
    >
      <div className="hs-atmosphere" aria-hidden="true">
        <i className="hs-bloom hs-bloom-a" />
        <i className="hs-bloom hs-bloom-b" />
        <i className="hs-floor" />
        <i className="hs-dust"><b /></i>
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

      <div className="hs-vignette" aria-hidden="true" />
    </div>
  );
}
