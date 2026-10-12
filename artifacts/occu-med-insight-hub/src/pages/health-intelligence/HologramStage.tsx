import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  GROUP_LABEL,
  HOLOGRAM_IMAGE,
  ZONES,
  ZONES_BY_AREA_DESC,
  type GroupKey,
  type Zone,
} from "./anatomy";
import LoadingOrb from "./LoadingOrb";
import { heatColor, indexByGroup, type Signal, type SignalMode } from "./signals";
import Strands, { STRANDS_DEFAULTS, type StrandsParams } from "./Strands";

const IMG_W = HOLOGRAM_IMAGE.width;
const IMG_H = HOLOGRAM_IMAGE.height;
/** Matches the .hs-scan-exit transition. */
const SCAN_EXIT_MS = 320;

export interface HologramStageProps {
  mode: SignalMode;
  /** True only while booting or processing a request. The scanner never outlives it. */
  scanning: boolean;
  signals: Signal[];
  /** Groups the user is inspecting (hover / selection); strengthens their glow. */
  focusGroups: GroupKey[];
  /** Single zone that carries the reticle, when the focus is one region. */
  reticleZone: Zone | null;
  onHover: (zone: Zone | null) => void;
  onSelect: (zone: Zone) => void;
}

/**
 * The scan is one coordinated sequence driven by the sphere: beams leave the sphere for each
 * head, then one shared Strands band sweeps both figures head -> feet at the same height. The
 * band is clipped to the body silhouettes so energy can only ever appear on the anatomy.
 */
function BodyScan({ exiting }: { exiting: boolean }) {
  const params = useRef<StrandsParams>({
    ...STRANDS_DEFAULTS,
    colors: ["#FFE9A8", "#FFB020", "#FFD24A", "#FF8A00"],
    count: 6,
    speed: 0.9,
    amplitude: 0.45,
    waviness: 1.4,
    thickness: 0.5,
    intensity: 0.8,
    glow: 2.2,
    taper: 3,
    scale: 2.6,
    saturation: 1.12,
    opacity: 0.85,
  });

  return (
    <div
      className={`hs-scan${exiting ? " is-exiting" : ""}`}
      data-testid="health-body-scan"
      data-state={exiting ? "exiting" : "active"}
      aria-hidden="true"
    >
      <svg className="hs-scan-beams" viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none">
        <path className="hs-scan-beam" pathLength={1} d="M768 60 C 692 26, 572 22, 490 46" />
        <path className="hs-scan-beam" pathLength={1} d="M768 60 C 844 26, 964 22, 1050 46" />
        <circle className="hs-scan-node" cx={490} cy={46} r={5} />
        <circle className="hs-scan-node" cx={1050} cy={46} r={5} />
      </svg>
      <div className="hs-scan-clip">
        <div className="hs-scan-band">
          <span className="hs-scan-trail" />
          <div className="hs-scan-strands"><Strands paramsRef={params} maxDpr={1} /></div>
          <span className="hs-scan-line" />
        </div>
      </div>
    </div>
  );
}

export default function HologramStage({ mode, scanning, signals, focusGroups, reticleZone, onHover, onSelect }: HologramStageProps) {
  const byGroup = useMemo(() => indexByGroup(signals), [signals]);
  const maxScore = useMemo(() => Math.max(0.0001, ...signals.map((signal) => signal.score)), [signals]);
  const relative = (signal: Signal) => Math.min(1, Math.max(0.38, 0.38 + 0.62 * (signal.score / maxScore)));

  // Mount the scanner for exactly as long as a request runs (plus a short fade-out).
  const [scanMounted, setScanMounted] = useState(scanning);
  const [scanExiting, setScanExiting] = useState(false);
  useEffect(() => {
    if (scanning) {
      setScanMounted(true);
      setScanExiting(false);
      return;
    }
    setScanExiting(true);
    const timer = window.setTimeout(() => {
      setScanMounted(false);
      setScanExiting(false);
    }, SCAN_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [scanning]);

  // ---- lit layer: mask + glow blobs ------------------------------------------------------
  const litZones = useMemo(() => {
    const entries: Array<{ zone: Zone; strength: number; color: string; active: boolean }> = [];
    for (const zone of ZONES) {
      const signal = byGroup.get(zone.group);
      if (!signal || zone.group === "wholeBody") continue;
      const active = focusGroups.includes(zone.group);
      const strength = relative(signal);
      entries.push({ zone, strength: active ? Math.min(1, strength + 0.18) : strength, color: heatColor(relative(signal)), active });
    }
    // A focused region with no evidence still gets a soft marker (neutral, not an evidence signal).
    for (const zone of ZONES) {
      if (byGroup.has(zone.group) || !focusGroups.includes(zone.group) || zone.group === "wholeBody") continue;
      entries.push({ zone, strength: 0.4, color: "#ffd978", active: true });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byGroup, focusGroups, maxScore]);

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
  const label = (zone: Zone) =>
    `${GROUP_LABEL[zone.group]} region${byGroup.has(zone.group) ? ", evidence available" : ""}`;
  const reticleR = reticleZone ? Math.max(reticleZone.rx, reticleZone.ry) : 0;

  return (
    <div className="hs-stage" data-testid="health-hologram" data-mode={mode} data-scanning={scanMounted ? "true" : "false"}>
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

        {scanMounted ? <BodyScan exiting={scanExiting} /> : null}

        <svg className="hs-overlay" viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none">
          {reticleZone ? (
            <g className="hs-reticle" transform={`translate(${reticleZone.cx} ${reticleZone.cy})`} key={reticleZone.id}>
              <circle className="hs-reticle-ring" r={reticleR * 1.12} />
              <circle className="hs-reticle-inner" r={reticleR * 0.7} />
              {[0, 90, 180, 270].map((angle) => (
                <line key={angle} className="hs-reticle-tick" x1={0} y1={-reticleR * 1.12 - 6} x2={0} y2={-reticleR * 1.12 + 10} transform={`rotate(${angle})`} />
              ))}
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
              data-group={zone.group}
              data-view={zone.view}
              aria-label={label(zone)}
              aria-pressed={focusGroups.length === 1 && focusGroups[0] === zone.group}
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

        {scanMounted ? <LoadingOrb exiting={scanExiting} /> : null}

        <span className="hs-cap hs-cap-front" aria-hidden="true">ANTERIOR</span>
        <span className="hs-cap hs-cap-back" aria-hidden="true">POSTERIOR</span>
      </div>

      <div className="hs-vignette" aria-hidden="true" />
    </div>
  );
}
