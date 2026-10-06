/**
 * Evidence -> anatomy signals.
 *
 * Region matching for OSHA body-part cases and O*NET demand text mirrors the
 * logic in ../reviewer-injury-hologram.tsx (preserved legacy implementation),
 * re-expressed against this page's anatomy groups. Signals are evidence
 * distributions, never an individual injury probability.
 */
import { GROUP_LABEL, type GroupKey } from "./anatomy";
import type { HealthCondition } from "./conditions";

export type AnyRecord = Record<string, any>;

export type SignalMode = "idle" | "osha" | "onet" | "condition";

export interface Signal {
  id: string;
  label: string;
  /** 0..1 — share of coded cases, demand-evidence strength, or association weight. */
  score: number;
  detail: string[];
  /** Anatomy groups this signal lights. */
  groups: GroupKey[];
}

export type OshaBodyPart = { name: string; code?: string; count: number; share: number };
export type OshaCaseProfile = {
  occupationTitle?: string;
  selectedYear?: number | null;
  oiicsYear?: number | null;
  totalCases?: number;
  codedBodyPartCases?: number;
  bodyParts?: OshaBodyPart[];
};

type RegionId =
  | "head" | "neck" | "shoulder" | "chest" | "lowBack" | "upperExtremity" | "hand"
  | "hip" | "knee" | "lowerExtremity" | "foot" | "wholeBody";

const REGIONS: Record<RegionId, { label: string; groups: GroupKey[] }> = {
  head: { label: "Head", groups: ["head"] },
  neck: { label: "Neck", groups: ["neck"] },
  shoulder: { label: "Shoulder", groups: ["shoulders"] },
  chest: { label: "Chest / torso", groups: ["chest", "gut"] },
  lowBack: { label: "Low back", groups: ["lowBack"] },
  upperExtremity: { label: "Upper extremity", groups: ["arms"] },
  hand: { label: "Hand / wrist", groups: ["hands"] },
  hip: { label: "Hip / pelvis", groups: ["hips"] },
  knee: { label: "Knee", groups: ["knees"] },
  lowerExtremity: { label: "Lower extremity", groups: ["thighs", "calves"] },
  foot: { label: "Foot / ankle", groups: ["feet"] },
  wholeBody: { label: "Whole body / multiple", groups: ["wholeBody"] },
};

const DEMAND_PATTERNS: Array<{ key: RegionId; patterns: RegExp[] }> = [
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

const BODY_PART_PATTERNS: Array<{ key: RegionId; patterns: RegExp[] }> = [
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
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) values.push(value.trim());
  };
  push(profile.occupation?.title);
  push(profile.occupation?.description);
  for (const item of profile.serviceMatches ?? []) {
    push(item?.label);
    push(item?.description);
  }
  for (const item of profile.tasks ?? profile.taskEvidence ?? [])
    push(typeof item === "string" ? item : item?.text ?? item?.name ?? item?.description);
  for (const item of profile.workActivities ?? profile.activities ?? [])
    push(typeof item === "string" ? item : item?.name ?? item?.title ?? item?.description);
  return values;
}

export function deriveDemandSignals(profile: AnyRecord | null): Signal[] {
  const evidence = profileText(profile);
  if (!evidence.length) return [];
  const joined = evidence.join(" · ");
  const signals: Signal[] = [];
  for (const region of DEMAND_PATTERNS) {
    const matches = region.patterns.filter((pattern) => pattern.test(joined));
    if (!matches.length) continue;
    const detail = evidence.filter((value) => region.patterns.some((pattern) => pattern.test(value))).slice(0, 4);
    const score = Math.min(1, 0.34 + matches.length * 0.14 + Math.min(detail.length, 3) * 0.1);
    signals.push({ id: region.key, label: REGIONS[region.key].label, score, detail, groups: REGIONS[region.key].groups });
  }
  return signals.length
    ? signals.sort((a, b) => b.score - a.score)
    : [{
        id: "wholeBody",
        label: REGIONS.wholeBody.label,
        score: 0.38,
        detail: ["Occupation profile loaded; no specific anatomical demand dominated the returned O*NET evidence."],
        groups: REGIONS.wholeBody.groups,
      }];
}

export function deriveCaseSignals(caseProfile: OshaCaseProfile | null | undefined): Signal[] {
  const parts = caseProfile?.bodyParts ?? [];
  const denominator = caseProfile?.codedBodyPartCases ?? 0;
  if (!parts.length || denominator <= 0) return [];
  const grouped = new Map<RegionId, { count: number; detail: string[] }>();
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
      id: key,
      label: REGIONS[key].label,
      score: Math.max(0.04, Math.min(1, value.count / denominator)),
      detail: value.detail.slice(0, 4),
      groups: REGIONS[key].groups,
    }))
    .sort((a, b) => b.score - a.score);
}

export function deriveConditionSignals(condition: HealthCondition | null): Signal[] {
  if (!condition) return [];
  const context = `${condition.label} · ${condition.category}`;
  const review = `Review domains: ${condition.domains.join(" · ")}`;
  const primary = condition.primary.map<Signal>((group) => ({
    id: `${condition.id}:${group}`,
    label: GROUP_LABEL[group],
    score: 0.9,
    detail: [context, "Primary anatomical association", review],
    groups: [group],
  }));
  const secondary = condition.secondary
    .filter((group) => !condition.primary.includes(group))
    .map<Signal>((group) => ({
      id: `${condition.id}:${group}`,
      label: GROUP_LABEL[group],
      score: 0.3,
      detail: [context, "Secondary / downstream association", review],
      groups: [group],
    }));
  return [...primary, ...secondary];
}

/** group -> strongest signal covering it (drives lighting + callouts). */
export function indexByGroup(signals: Signal[]): Map<GroupKey, Signal> {
  const map = new Map<GroupKey, Signal>();
  for (const signal of signals) {
    for (const group of signal.groups) {
      const existing = map.get(group);
      if (!existing || signal.score > existing.score) map.set(group, signal);
    }
  }
  return map;
}

/**
 * Hot-colour ramp that stays in the gold family: soft gold -> amber -> ember.
 * Takes the signal strength *relative to the strongest signal* (0..1).
 */
export function heatColor(relative: number): string {
  if (relative >= 0.85) return "#ff5a2e";
  if (relative >= 0.6) return "#ff9a2e";
  if (relative >= 0.4) return "#ffc247";
  return "#ffd978";
}
