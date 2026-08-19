import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, Database, Search, Sparkles } from "lucide-react";
import HologramPointCloud, { type HologramRegionKey } from "./HologramPointCloud";
import "./reviewer-injury-hologram.css";

type AnyRecord = Record<string, any>;
type OshaBodyPart = { name: string; code?: string; count: number; share: number };
type OshaCaseProfile = {
  selectedYear?: number | null;
  totalCases?: number;
  codedBodyPartCases?: number;
  bodyParts?: OshaBodyPart[];
};

type RegionSignal = {
  key: HologramRegionKey;
  label: string;
  score: number;
  detail: string[];
};

type SignalMode = "osha" | "onet" | "idle";

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
    head: { x: 50, y: 12, w: 18, h: 15 }, neck: { x: 50, y: 20, w: 12, h: 7 }, shoulder: { x: 50, y: 28, w: 42, h: 13 },
    chest: { x: 50, y: 39, w: 34, h: 22 }, lowBack: { x: 50, y: 52, w: 30, h: 15 }, upperExtremity: { x: 50, y: 45, w: 68, h: 35 },
    hand: { x: 50, y: 61, w: 80, h: 15 }, hip: { x: 50, y: 58, w: 31, h: 14 }, knee: { x: 50, y: 76, w: 28, h: 11 },
    lowerExtremity: { x: 50, y: 82, w: 34, h: 30 }, foot: { x: 50, y: 96, w: 35, h: 9 },
  },
  back: {
    head: { x: 50, y: 12, w: 18, h: 15 }, neck: { x: 50, y: 20, w: 12, h: 7 }, shoulder: { x: 50, y: 28, w: 42, h: 13 },
    chest: { x: 50, y: 39, w: 34, h: 21 }, lowBack: { x: 50, y: 52, w: 32, h: 17 }, upperExtremity: { x: 50, y: 45, w: 68, h: 35 },
    hand: { x: 50, y: 61, w: 80, h: 15 }, hip: { x: 50, y: 59, w: 33, h: 15 }, knee: { x: 50, y: 76, w: 28, h: 11 },
    lowerExtremity: { x: 50, y: 82, w: 34, h: 30 }, foot: { x: 50, y: 96, w: 35, h: 9 },
  },
};

const DEMAND_PATTERNS: Array<{ key: HologramRegionKey; patterns: RegExp[] }> = [
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

const BODY_PART_PATTERNS: Array<{ key: HologramRegionKey; patterns: RegExp[] }> = [
  { key: "head", patterns: [/head|face|eye|cranial/i] },
  { key: "neck", patterns: [/neck|cervical/i] },
  { key: "shoulder", patterns: [/shoulder/i] },
  { key: "lowBack", patterns: [/back|lumbar/i] },
  { key: "chest", patterns: [/chest|thorax|trunk|torso/i] },
  { key: "hand", patterns: [/hand|wrist|finger|thumb/i] },
  { key: "upperExtremity", patterns: [/arm|elbow|upper extrem/i] },
  { key: "hip", patterns: [/hip|pelvis/i] },
  { key: "knee", patterns: [/knee/i] },
  { key: "foot", patterns: [/foot|feet|ankle|toe/i] },
  { key: "lowerExtremity", patterns: [/leg|thigh|lower extrem/i] },
  { key: "wholeBody", patterns: [/whole body|multiple body|body systems|multiple parts/i] },
];

function profileText(profile: AnyRecord | null): string[] {
  if (!profile) return [];
  const values: string[] = [];
  const push = (value: unknown) => { if (typeof value === "string" && value.trim()) values.push(value.trim()); };
  push(profile.occupation?.title);
  push(profile.occupation?.description);
  for (const item of profile.serviceMatches ?? []) { push(item?.label); push(item?.description); }
  for (const item of profile.tasks ?? profile.taskEvidence ?? []) push(typeof item === "string" ? item : item?.text ?? item?.name ?? item?.description);
  for (const item of profile.workActivities ?? profile.activities ?? []) push(typeof item === "string" ? item : item?.name ?? item?.title ?? item?.description);
  return values;
}

function deriveDemandSignals(profile: AnyRecord | null): RegionSignal[] {
  const evidence = profileText(profile);
  if (!evidence.length) return [];
  const joined = evidence.join(" · ");
  const signals: RegionSignal[] = [];
  for (const region of DEMAND_PATTERNS) {
    const matches = region.patterns.filter((pattern) => pattern.test(joined));
    if (!matches.length) continue;
    const detail = evidence.filter((value) => region.patterns.some((pattern) => pattern.test(value))).slice(0, 4);
    const score = Math.min(1, 0.34 + matches.length * 0.14 + Math.min(detail.length, 3) * 0.10);
    signals.push({ key: region.key, label: REGION_LABELS[region.key], score, detail });
  }
  return signals.length
    ? signals.sort((a, b) => b.score - a.score)
    : [{ key: "wholeBody", label: REGION_LABELS.wholeBody, score: 0.38, detail: ["Occupation profile loaded; no specific anatomical demand dominated the returned O*NET evidence."] }];
}

function deriveCaseSignals(caseProfile: OshaCaseProfile | null | undefined): RegionSignal[] {
  const parts = caseProfile?.bodyParts ?? [];
  const denominator = caseProfile?.codedBodyPartCases ?? 0;
  if (!parts.length || denominator <= 0) return [];
  const grouped = new Map<HologramRegionKey, { count: number; detail: string[] }>();
  for (const part of parts) {
    const match = BODY_PART_PATTERNS.find((region) => region.patterns.some((pattern) => pattern.test(part.name)));
    if (!match) continue;
    const current = grouped.get(match.key) ?? { count: 0, detail: [] };
    current.count += part.count;
    current.detail.push(`${part.name} · ${part.count.toLocaleString()} coded case${part.count === 1 ? "" : "s"} (${part.share.toFixed(1)}%)`);
    grouped.set(match.key, current);
  }
  return [...grouped.entries()]
    .map(([key, value]) => ({
      key,
      label: REGION_LABELS[key],
      score: Math.max(0.04, Math.min(1, value.count / denominator)),
      detail: value.detail.slice(0, 4),
    }))
    .sort((a, b) => b.score - a.score);
}

function heatColor(score: number) {
  if (score >= 0.45) return "#ff5f76";
  if (score >= 0.25) return "#ffb45e";
  if (score >= 0.12) return "#7ae7cf";
  return "#55c9e8";
}

export function ReviewerInjuryHologram({ profile, caseProfile }: { profile: AnyRecord | null; caseProfile?: OshaCaseProfile | null }) {
  const caseSignals = useMemo(() => deriveCaseSignals(caseProfile), [caseProfile]);
  const demandSignals = useMemo(() => deriveDemandSignals(profile), [profile]);
  const mode: SignalMode = caseSignals.length ? "osha" : profile ? "onet" : "idle";
  const signals = mode === "osha" ? caseSignals : demandSignals;
  const signalMap = useMemo(() => new Map(signals.map((signal) => [signal.key, signal])), [signals]);
  const regionScores = useMemo(
    () => Object.fromEntries(signals.map((signal) => [signal.key, signal.score])) as Partial<Record<HologramRegionKey, number>>,
    [signals],
  );
  const [view, setView] = useState<"front" | "back">("front");
  const [active, setActive] = useState<HologramRegionKey | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const idle = mode === "idle";
  const activeKey = active && signalMap.has(active) ? active : signals[0]?.key ?? null;
  const activeSignal = activeKey ? signalMap.get(activeKey) : undefined;
  const displayValue = mode === "osha"
    ? `${Math.round((activeSignal?.score ?? 0) * 100)}%`
    : activeSignal ? `${activeSignal.detail.length} refs` : "—";

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
            <h2>{idle ? "Occupation-linked anatomical intelligence projection" : mode === "osha" ? `Reported case anatomy · ${caseProfile?.selectedYear ?? "latest imported year"}` : "Job-demand anatomical attention map"}</h2>
          </div>
          <div className="ih-hologram-controls">
            <div className="ih-view-toggle" aria-label="Hologram orientation">
              <button className={view === "front" ? "active" : ""} onClick={() => { setView("front"); setTilt({ x: 0, y: 0 }); }}>ANTERIOR</button>
              <button className={view === "back" ? "active" : ""} onClick={() => { setView("back"); setTilt({ x: 0, y: 0 }); }}>POSTERIOR</button>
            </div>
            <div className="ih-mode-pill">
              {idle ? <Search size={13} /> : mode === "osha" ? <Database size={13} /> : <Sparkles size={13} />}
              {idle ? "Standby" : mode === "osha" ? "OSHA case-linked projection" : "O*NET demand evidence"}
            </div>
          </div>
        </header>

        <div className="ih-hologram-visual" onPointerMove={handlePointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="ih-telemetry ih-telemetry-left"><span>ANATOMY VECTOR</span><strong>{view === "front" ? "ANTERIOR" : "POSTERIOR"}</strong><small>VOLUMETRIC POINT CLOUD · ACTIVE</small></div>
          <div className="ih-telemetry ih-telemetry-right"><span>{mode === "osha" ? "CODED CASE SHARE" : "DEMAND EVIDENCE"}</span><strong>{displayValue}</strong><small>{idle ? "AWAITING OCCUPATION" : mode === "osha" ? "OSHA OIICS BODY-PART DATA" : "O*NET JOB-DEMAND SIGNAL"}</small></div>
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
                    aria-label={`${REGION_LABELS[region]} ${mode === "osha" ? "reported case" : "demand evidence"} signal`}
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

          {idle ? <div className="ih-idle-callout"><Search size={18} /><strong>Search an occupation to energize the projection.</strong><span>When OSHA case detail is available, the projection switches from demand evidence to reported body-part distributions.</span></div> : null}
        </div>
      </div>

      <aside className="ih-hologram-data">
        <div className="ih-focus">
          <span>ACTIVE REGION</span>
          <h3>{activeSignal?.label ?? "Awaiting occupation"}</h3>
          <div className="ih-focus-meta"><strong>{idle ? "Standby" : mode === "osha" ? "Reported OSHA case distribution" : "Occupation demand evidence"}</strong><em>{displayValue}</em></div>
          <div className="ih-focus-bar"><i style={{ width: `${Math.round((activeSignal?.score ?? 0) * 100)}%` }} /></div>
          <div className="ih-detail-list">{(activeSignal?.detail ?? ["Build an occupation profile to connect anatomy to reported case data and job-demand evidence."]).map((detail) => <div key={detail}>{detail}</div>)}</div>
        </div>
        <div className="ih-ranking">
          <span>{mode === "osha" ? "REPORTED BODY-PART SIGNALS" : "DEMAND ATTENTION REGIONS"}</span>
          {signals.length ? signals.map((signal, index) => (
            <button key={signal.key} className={activeKey === signal.key ? "active" : ""} onClick={() => setActive(signal.key)}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div><strong>{signal.label}</strong><span><i style={{ width: `${Math.round(signal.score * 100)}%` }} /></span></div>
              <em>{mode === "osha" ? `${Math.round(signal.score * 100)}%` : `${signal.detail.length}`}</em>
            </button>
          )) : <p>Search an occupation to populate anatomical evidence.</p>}
        </div>
      </aside>
    </section>
  );
}
