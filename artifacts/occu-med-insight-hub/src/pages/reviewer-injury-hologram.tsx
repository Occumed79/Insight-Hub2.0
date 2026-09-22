import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Database, Search, Sparkles } from "lucide-react";
import type { HologramRegionKey } from "./HologramPointCloud";
import "./reviewer-injury-hologram.css";

type AnyRecord = Record<string, any>;
type OshaBodyPart = { name: string; code?: string; count: number; share: number };
type OshaCaseProfile = {
  selectedYear?: number | null;
  oiicsYear?: number | null;
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


export function ReviewerInjuryHologram({ profile, caseProfile }: { profile: AnyRecord | null; caseProfile?: OshaCaseProfile | null }) {
  const caseSignals = useMemo(() => deriveCaseSignals(caseProfile), [caseProfile]);
  const demandSignals = useMemo(() => deriveDemandSignals(profile), [profile]);
  const mode: SignalMode = caseSignals.length ? "osha" : profile ? "onet" : "idle";
  const signals = mode === "osha" ? caseSignals : demandSignals;
  const [active, setActive] = useState<HologramRegionKey | null>(null);
  const signalMap = useMemo(() => new Map(signals.map((signal) => [signal.key, signal])), [signals]);
  const activeKey = active && signalMap.has(active) ? active : signals[0]?.key ?? null;
  const activeSignal = activeKey ? signalMap.get(activeKey) : undefined;
  const displayValue = mode === "osha"
    ? `${Math.round((activeSignal?.score ?? 0) * 100)}%`
    : activeSignal ? `${activeSignal.detail.length} refs` : "—";

  return (
    <section className="injury-atlas-shell brick-surface" data-level="canvas" data-radius="none" data-testid="injury-hologram">
      <header className="injury-atlas-appbar brick-app-bar" data-variant="surface" data-bordered data-blurred>
        <div className="brick-app-bar-toolbar">
          <div className="brick-app-bar-start">
            <Activity size={14} aria-hidden="true" />
            <span>Reported injury burden</span>
          </div>
          <div className="brick-app-bar-center">
            <div className="text-center">
              <strong>Interactive Anatomy Explorer</strong>
              <small>{mode === "osha" ? `OSHA OIICS CY${caseProfile?.oiicsYear ?? "—"}` : mode === "onet" ? "O*NET demand evidence" : "Atlas ready"}</small>
            </div>
          </div>
          <div className="brick-app-bar-end">
            <a href="https://vanatome.vixotic.in" target="_blank" rel="noreferrer">
              Vanatome source <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </header>

      <div className="injury-atlas-workspace">
        <div className="injury-atlas-viewer brick-surface" data-level="raised" data-radius="none">
          <iframe
            src="https://vanatome.vixotic.in"
            title="Vanatome interactive human anatomy explorer"
            loading="lazy"
            allow="fullscreen"
            referrerPolicy="no-referrer"
          />
        </div>

        <aside className="injury-atlas-evidence brick-surface" data-level="subtle" data-bordered data-radius="none">
          <div className="injury-atlas-source-state">
            <span>{mode === "osha" ? <Database size={13} /> : mode === "onet" ? <Sparkles size={13} /> : <Search size={13} />}</span>
            <div>
              <small>Evidence mode</small>
              <strong>{mode === "osha" ? "Reported OSHA body-part distribution" : mode === "onet" ? "Occupation demand evidence" : "Awaiting occupation"}</strong>
            </div>
          </div>

          <section className="injury-atlas-focus">
            <small>Active region</small>
            <h3>{activeSignal?.label ?? "No region selected"}</h3>
            <strong>{displayValue}</strong>
            <div className="injury-atlas-detail">
              {(activeSignal?.detail ?? ["Search an occupation to connect the anatomy workspace to reported case data and job-demand evidence."]).map((detail) => <p key={detail}>{detail}</p>)}
            </div>
          </section>

          <section className="injury-atlas-ranking">
            <div className="injury-atlas-ranking-head">
              <small>{mode === "osha" ? "Reported body-part signals" : "Demand attention regions"}</small>
              <span>{signals.length}</span>
            </div>
            {signals.length ? (
              <div className="injury-atlas-signal-list">
                {signals.map((signal, index) => (
                  <button
                    key={signal.key}
                    type="button"
                    data-selected={activeKey === signal.key ? "" : undefined}
                    onClick={() => setActive(signal.key)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{signal.label}</strong>
                    <em>{mode === "osha" ? `${Math.round(signal.score * 100)}%` : `${signal.detail.length} refs`}</em>
                  </button>
                ))}
              </div>
            ) : <p className="injury-atlas-empty">Search an occupation to populate anatomical evidence.</p>}
          </section>

          <p className="injury-atlas-attribution">
            Viewer: Vanatome · MIT application code. Atlas derived from Z-Anatomy and remains subject to CC BY-SA 4.0 attribution/share-alike terms.
          </p>
        </aside>
      </div>
    </section>
  );
}
