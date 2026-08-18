import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, Database, Search, Sparkles } from "lucide-react";
import HologramPointCloud, { type HologramRegionKey } from "./HologramPointCloud";
import "./reviewer-injury-hologram.css";

type AnyRecord = Record<string, any>;

type RegionSignal = {
  key: HologramRegionKey;
  label: string;
  score: number;
  detail: string[];
};

const REGION_LABELS: Record<HologramRegionKey, string> = {
  head: "Head",
  neck: "Neck",
  shoulder: "Shoulder",
  chest: "Chest / torso",
  lowBack: "Low back",
  upperExtremity: "Upper extremity",
  hand: "Hand / wrist",
  hip: "Hip / pelvis",
  knee: "Knee",
  lowerExtremity: "Lower extremity",
  foot: "Foot / ankle",
  wholeBody: "Whole body / multiple",
};

const HOTSPOTS: Record<"front" | "back", Partial<Record<HologramRegionKey, { x: number; y: number; w: number; h: number }>>> = {
  front: {
    head: { x: 50, y: 12, w: 18, h: 15 },
    neck: { x: 50, y: 20, w: 12, h: 7 },
    shoulder: { x: 50, y: 28, w: 42, h: 13 },
    chest: { x: 50, y: 39, w: 34, h: 22 },
    lowBack: { x: 50, y: 52, w: 30, h: 15 },
    upperExtremity: { x: 50, y: 45, w: 68, h: 35 },
    hand: { x: 50, y: 61, w: 80, h: 15 },
    hip: { x: 50, y: 58, w: 31, h: 14 },
    knee: { x: 50, y: 76, w: 28, h: 11 },
    lowerExtremity: { x: 50, y: 82, w: 34, h: 30 },
    foot: { x: 50, y: 96, w: 35, h: 9 },
  },
  back: {
    head: { x: 50, y: 12, w: 18, h: 15 },
    neck: { x: 50, y: 20, w: 12, h: 7 },
    shoulder: { x: 50, y: 28, w: 42, h: 13 },
    chest: { x: 50, y: 39, w: 34, h: 21 },
    lowBack: { x: 50, y: 52, w: 32, h: 17 },
    upperExtremity: { x: 50, y: 45, w: 68, h: 35 },
    hand: { x: 50, y: 61, w: 80, h: 15 },
    hip: { x: 50, y: 59, w: 33, h: 15 },
    knee: { x: 50, y: 76, w: 28, h: 11 },
    lowerExtremity: { x: 50, y: 82, w: 34, h: 30 },
    foot: { x: 50, y: 96, w: 35, h: 9 },
  },
};

const REGION_PATTERNS: Array<{ key: HologramRegionKey; patterns: RegExp[] }> = [
  { key: "head", patterns: [/head|face|eye|vision|brain|cranial|helmet/i] },
  { key: "neck", patterns: [/neck|cervical/i] },
  { key: "shoulder", patterns: [/shoulder|overhead|reach above|raised arm/i] },
  { key: "chest", patterns: [/chest|thorax|torso|respirat|breath|lung|cardio/i] },
  { key: "lowBack", patterns: [/back|lumbar|lift|carry|bend|stoop|material handling/i] },
  { key: "upperExtremity", patterns: [/arm|elbow|push|pull|reach|upper extrem/i] },
  { key: "hand", patterns: [/hand|wrist|finger|grip|manual|dexterity|tool/i] },
  { key: "hip", patterns: [/hip|pelvis|squat/i] },
  { key: "knee", patterns: [/knee|kneel|crouch/i] },
  { key: "lowerExtremity", patterns: [/leg|lower extrem|walk|stand|climb|stair|balance/i] },
  { key: "foot", patterns: [/foot|feet|ankle|toe/i] },
  { key: "wholeBody", patterns: [/whole body|multiple|heavy physical|strenuous|physical demand/i] },
];

function profileText(profile: AnyRecord | null): string[] {
  if (!profile) return [];
  const values: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) values.push(value.trim());
  };
  push(profile.occupation?.title);
  push(profile.occupation?.description);
  for (const item of profile.serviceMatches ?? []) {
    push(item?.label);
    push(item?.description);
  }
  for (const item of profile.tasks ?? profile.taskEvidence ?? []) {
    push(typeof item === "string" ? item : item?.text ?? item?.name ?? item?.description);
  }
  for (const item of profile.workActivities ?? profile.activities ?? []) {
    push(typeof item === "string" ? item : item?.name ?? item?.title ?? item?.description);
  }
  return values;
}

function deriveSignals(profile: AnyRecord | null): RegionSignal[] {
  const evidence = profileText(profile);
  if (!evidence.length) return [];
  const joined = evidence.join(" · ");
  const signals: RegionSignal[] = [];
  for (const region of REGION_PATTERNS) {
    const matches = region.patterns.filter((pattern) => pattern.test(joined));
    if (!matches.length) continue;
    const detail = evidence.filter((value) => region.patterns.some((pattern) => pattern.test(value))).slice(0, 4);
    const score = Math.min(1, 0.34 + matches.length * 0.14 + Math.min(detail.length, 3) * 0.10);
    signals.push({ key: region.key, label: REGION_LABELS[region.key], score, detail });
  }
  if (!signals.length) {
    return [
      { key: "wholeBody", label: REGION_LABELS.wholeBody, score: 0.38, detail: ["Occupation profile loaded; no specific body-region keyword dominated the available O*NET evidence."] },
    ];
  }
  return signals.sort((a, b) => b.score - a.score);
}

function heatColor(score: number) {
  if (score >= 0.8) return "#ff5f76";
  if (score >= 0.6) return "#ffb45e";
  if (score >= 0.4) return "#7ae7cf";
  return "#55c9e8";
}

export function ReviewerInjuryHologram({ profile }: { profile: AnyRecord | null }) {
  const signals = useMemo(() => deriveSignals(profile), [profile]);
  const signalMap = useMemo(() => new Map(signals.map((signal) => [signal.key, signal])), [signals]);
  const regionScores = useMemo(
    () => Object.fromEntries(signals.map((signal) => [signal.key, signal.score])) as Partial<Record<HologramRegionKey, number>>,
    [signals],
  );
  const [view, setView] = useState<"front" | "back">("front");
  const [active, setActive] = useState<HologramRegionKey | null>(signals[0]?.key ?? null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const idle = !profile;
  const activeKey = active && signalMap.has(active) ? active : signals[0]?.key ?? null;
  const activeSignal = activeKey ? signalMap.get(activeKey) : undefined;

  const projectionStyle = {
    "--holo-rotate-x": `${(-tilt.y * 3.5).toFixed(2)}deg`,
    "--holo-rotate-y": `${(tilt.x * 4.5).toFixed(2)}deg`,
    "--holo-pointer-x": `${50 + tilt.x * 18}%`,
    "--holo-pointer-y": `${50 + tilt.y * 14}%`,
    "--holo-energy": activeSignal?.score ?? 0.34,
  } as CSSProperties;

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  }

  return (
    <section className={`ih-hologram-shell${idle ? " is-idle" : ""}`} style={projectionStyle} data-testid="injury-hologram">
      <div className="ih-hologram-stage">
        <header className="ih-hologram-head">
          <div>
            <span><Activity size={13} /> HOLOGRAPHIC INJURY ANATOMY</span>
            <h2>{idle ? "Occupation-linked anatomical intelligence projection" : "Interactive anatomical risk projection"}</h2>
          </div>
          <div className="ih-hologram-controls">
            <div className="ih-view-toggle" aria-label="Hologram orientation">
              <button className={view === "front" ? "active" : ""} onClick={() => { setView("front"); setTilt({ x: 0, y: 0 }); }}>ANTERIOR</button>
              <button className={view === "back" ? "active" : ""} onClick={() => { setView("back"); setTilt({ x: 0, y: 0 }); }}>POSTERIOR</button>
            </div>
            <div className="ih-mode-pill">
              {idle ? <Search size={13} /> : signals.length ? <Database size={13} /> : <Sparkles size={13} />}
              {idle ? "Standby" : "O*NET-linked projection"}
            </div>
          </div>
        </header>

        <div className="ih-hologram-visual" onPointerMove={handlePointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="ih-telemetry ih-telemetry-left"><span>ANATOMY VECTOR</span><strong>{view === "front" ? "ANTERIOR" : "POSTERIOR"}</strong><small>VOLUMETRIC POINT CLOUD · ACTIVE</small></div>
          <div className="ih-telemetry ih-telemetry-right"><span>REGION ENERGY</span><strong>{Math.round((activeSignal?.score ?? 0) * 100).toString().padStart(2, "0")}%</strong><small>{idle ? "AWAITING OCCUPATION" : "O*NET-DERIVED SIGNAL"}</small></div>
          <div className="ih-floor-grid" />
          <div className="ih-depth ih-depth-a" /><div className="ih-depth ih-depth-b" /><div className="ih-depth ih-depth-c" />
          <div className="ih-orbit ih-orbit-x" /><div className="ih-orbit ih-orbit-y" />
          <div className="ih-scan-plane" /><div className="ih-scan-plane secondary" />
          <div className="ih-projector"><i /><i /><i /></div>

          <div className="ih-hologram-rig">
            <div className="ih-volume-shell" />
            <div className="ih-body" data-view={view}>
              <HologramPointCloud view={view} tiltX={tilt.x} tiltY={tilt.y} activeRegion={activeKey} regionScores={regionScores} />
              <div className="ih-body-scanlines" />
              <div className="ih-crosshair" />
              {!idle && Object.entries(HOTSPOTS[view]).map(([key, position]) => {
                const region = key as HologramRegionKey;
                if (!position) return null;
                const signal = signalMap.get(region);
                if (!signal) return null;
                return (
                  <button
                    key={region}
                    aria-label={`${REGION_LABELS[region]} injury signal`}
                    className={`ih-hotspot${activeKey === region ? " active" : ""}`}
                    style={{
                      left: `${position.x}%`, top: `${position.y}%`, width: `${position.w}%`, height: `${position.h}%`,
                      "--heat-color": heatColor(signal.score), "--heat-strength": signal.score,
                    } as CSSProperties}
                    onMouseEnter={() => setActive(region)}
                    onFocus={() => setActive(region)}
                    onClick={() => setActive(region)}
                  />
                );
              })}
            </div>
          </div>

          {idle ? (
            <div className="ih-idle-callout"><Search size={18} /><strong>Search an occupation to energize the projection.</strong><span>The same 24,000-point human mesh from Exam Reviewer is loaded in standby.</span></div>
          ) : null}
        </div>
      </div>

      <aside className="ih-hologram-data">
        <div className="ih-focus">
          <span>ACTIVE REGION</span>
          <h3>{activeSignal?.label ?? "Awaiting occupation"}</h3>
          <div className="ih-focus-meta"><strong>{idle ? "Standby" : "Occupation demand context"}</strong><em>{Math.round((activeSignal?.score ?? 0) * 100)}%</em></div>
          <div className="ih-focus-bar"><i style={{ width: `${Math.round((activeSignal?.score ?? 0) * 100)}%` }} /></div>
          <div className="ih-detail-list">
            {(activeSignal?.detail ?? ["Build an occupation profile to connect anatomical regions to O*NET evidence."]).map((detail) => <div key={detail}>{detail}</div>)}
          </div>
        </div>
        <div className="ih-ranking">
          <span>REGION SIGNALS</span>
          {signals.length ? signals.map((signal, index) => (
            <button key={signal.key} className={activeKey === signal.key ? "active" : ""} onClick={() => setActive(signal.key)}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div><strong>{signal.label}</strong><span><i style={{ width: `${Math.round(signal.score * 100)}%` }} /></span></div>
              <em>{Math.round(signal.score * 100)}</em>
            </button>
          )) : <p>Search an occupation to populate anatomical signals.</p>}
        </div>
      </aside>
    </section>
  );
}
