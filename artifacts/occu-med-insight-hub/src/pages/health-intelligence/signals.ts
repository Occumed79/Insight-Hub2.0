/**
 * Evidence -> anatomy signals.
 *
 * Three evidence families feed the hologram, and each keeps its own meaning:
 *
 *  - OSHA / OIICS case profile: one signal per *source body-part category*, never merged with
 *    another category. Every share uses one denominator: cases with a coded body part.
 *  - O*NET demand evidence: job-demand context, not injury data.
 *  - Medical-condition associations: primary / secondary anatomical context, not findings.
 *
 * A source category is only lit on a specific region when its own name says so. Broad categories
 * (back, trunk, upper / lower extremities) light the broad region they cover and say so; multiple /
 * nonspecific categories get whole-body emphasis; anything we cannot place stays listed but unlit.
 * Signals are evidence distributions, never an individual injury probability.
 */
import { GROUP_LABEL, type GroupKey } from "./anatomy";
import type { HealthCondition } from "./conditions";

export type AnyRecord = Record<string, any>;

export type SignalMode = "idle" | "osha" | "onet" | "condition";

export type SignalKind =
  | "specific" // source category names one region
  | "regional" // source category is broader than one displayed region
  | "nonspecific" // multiple body parts / body systems
  | "unmapped" // cannot be placed on the figure
  | "demand" // O*NET job-demand context
  | "primary" // condition: primary anatomical association
  | "secondary"; // condition: secondary / downstream association

export interface Signal {
  id: string;
  /** Source category name (OSHA), demand label (O*NET) or region name (condition). Never relabelled. */
  label: string;
  kind: SignalKind;
  /** 0..1 drawing weight: share of coded cases, demand strength, or association weight. */
  score: number;
  /** OSHA only: cases in this source category / cases with a coded body part. */
  count?: number;
  denominator?: number;
  code?: string;
  /** Anatomy groups this signal lights (empty for unmapped categories). */
  groups: GroupKey[];
  /** Plain-language explanation of how the source category is displayed. */
  note?: string;
  detail: string[];
}

export type OshaBodyPart = { name: string; code?: string; count: number; share?: number };
export type OshaCaseProfile = {
  occupationTitle?: string;
  selectedYear?: number | null;
  oiicsYear?: number | null;
  totalCases?: number;
  codedBodyPartCases?: number;
  bodyParts?: OshaBodyPart[];
};

export const formatShare = (count: number, denominator: number) =>
  denominator > 0 ? `${((count / denominator) * 100).toFixed(1)}%` : "—";

export interface CaseTotals {
  total: number;
  coded: number;
  uncoded: number;
  year: number | null;
}

export function caseTotals(profile: OshaCaseProfile | null | undefined): CaseTotals | null {
  if (!profile) return null;
  const total = Math.max(0, profile.totalCases ?? 0);
  const coded = Math.max(0, profile.codedBodyPartCases ?? 0);
  return { total, coded, uncoded: Math.max(0, total - coded), year: profile.oiicsYear ?? profile.selectedYear ?? null };
}

/* ------------------------------------------------------------------ OSHA / OIICS body part -> display */

interface Placement {
  kind: Extract<SignalKind, "specific" | "regional" | "nonspecific" | "unmapped">;
  groups: GroupKey[];
  note?: string;
}

/**
 * Place one source category on the figure. Order matters: explicit "multiple" wins, then the most
 * specific named region, then broad categories, and only then "unmapped".
 */
export function placeBodyPart(rawName: string): Placement {
  const name = rawName.trim();
  const has = (pattern: RegExp) => pattern.test(name);

  if (has(/multiple|body systems?|whole body|systemic/i)) {
    return {
      kind: "nonspecific",
      groups: ["wholeBody"],
      note: "Multiple body parts or body systems. Not tied to one region, so it is shown as whole-body emphasis.",
    };
  }
  if (has(/^head\b|\bskull\b|\bbrain\b|^eyes?\b|^ears?\b|^face\b|\bmouth\b|\bnose\b|\bjaw\b|\bscalp\b/i)) return { kind: "specific", groups: ["head"] };
  if (has(/^neck\b|\bcervical\b|\bthroat\b/i)) return { kind: "specific", groups: ["neck"] };
  if (has(/shoulder|clavicle|scapula/i)) return { kind: "specific", groups: ["shoulders"] };
  if (has(/^chest\b|\bribs?\b|\bsternum\b/i)) return { kind: "specific", groups: ["chest"] };
  if (has(/abdom/i)) return { kind: "specific", groups: ["gut"] };
  if (has(/lumbar|sacr|coccy|lower back|low back|lumbosacral/i)) return { kind: "specific", groups: ["lowBack"] };
  if (has(/upper back|thoracic (spine|region)/i)) return { kind: "specific", groups: ["upperBack"] };
  if (has(/\bback\b|\bspine\b|\bspinal\b/i)) {
    return {
      kind: "regional",
      groups: ["upperBack", "lowBack"],
      note: "The level of the back is not coded in this category. It is shown across the posterior torso and is not lower-back evidence.",
    };
  }
  if (has(/\bhips?\b|pelvi|buttock|groin/i)) return { kind: "specific", groups: ["hips"] };
  if (has(/^arms?\b|elbow|forearm|upper arm/i)) return { kind: "specific", groups: ["arms"] };
  if (has(/\bhands?\b|wrist|finger|thumb|\bpalm\b/i)) return { kind: "specific", groups: ["hands"] };
  if (has(/knee/i)) return { kind: "specific", groups: ["knees"] };
  if (has(/thigh|upper leg/i)) return { kind: "specific", groups: ["thighs"] };
  if (has(/lower leg|calf|calves|shin|tibia|fibula/i)) return { kind: "specific", groups: ["calves"] };
  if (has(/foot|feet|ankle|\btoes?\b|heel/i)) return { kind: "specific", groups: ["feet"] };

  if (has(/^trunk\b/i)) {
    return {
      kind: "regional",
      groups: ["chest", "gut", "upperBack", "lowBack"],
      note: "Trunk is a broad category (chest, back, abdomen). It is shown across the torso and is not specific to any one of them.",
    };
  }
  if (has(/upper extrem/i)) {
    return {
      kind: "regional",
      groups: ["shoulders", "arms", "hands"],
      note: "Upper extremities is a broad category. It is shown across shoulder, arm and hand regions and is not specific to the shoulder.",
    };
  }
  if (has(/lower extrem/i)) {
    return {
      kind: "regional",
      groups: ["thighs", "knees", "calves", "feet"],
      note: "Lower extremities is a broad category. It is shown across the leg and foot regions and is not specific to one joint.",
    };
  }
  if (has(/^legs?\b/i)) {
    return {
      kind: "regional",
      groups: ["thighs", "knees", "calves"],
      note: "Leg is a broad category. It is shown across thigh, knee and lower-leg regions.",
    };
  }
  return {
    kind: "unmapped",
    groups: [],
    note: "This source category cannot be placed on a specific region, so it is listed but not highlighted.",
  };
}

export function deriveCaseSignals(caseProfile: OshaCaseProfile | null | undefined): Signal[] {
  const parts = caseProfile?.bodyParts ?? [];
  const denominator = caseProfile?.codedBodyPartCases ?? 0;
  if (!parts.length || denominator <= 0) return [];
  return parts
    .filter((part) => part.count > 0)
    .map<Signal>((part, index) => {
      const placement = placeBodyPart(part.name);
      return {
        id: `osha:${part.code || index}:${part.name}`,
        label: part.name,
        kind: placement.kind,
        score: Math.max(0.04, Math.min(1, part.count / denominator)),
        count: part.count,
        denominator,
        code: part.code,
        groups: placement.groups,
        note: placement.note,
        detail: [`${part.count.toLocaleString()} of ${denominator.toLocaleString()} coded cases (${formatShare(part.count, denominator)})`],
      };
    })
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

/* ------------------------------------------------------------------ O*NET demand evidence */

type DemandId =
  | "head" | "neck" | "shoulder" | "chest" | "back" | "arm" | "hand"
  | "hip" | "knee" | "legs" | "foot" | "wholeBody";

const DEMANDS: Record<DemandId, { label: string; groups: GroupKey[]; patterns: RegExp[] }> = {
  head: { label: "Head, face & vision demands", groups: ["head"], patterns: [/head|face|eye|vision|brain|cranial|helmet/i] },
  neck: { label: "Neck demands", groups: ["neck"], patterns: [/neck|cervical/i] },
  shoulder: { label: "Overhead & shoulder demands", groups: ["shoulders"], patterns: [/shoulder|overhead|reach above|raised arm/i] },
  chest: { label: "Respiratory & thoracic demands", groups: ["chest"], patterns: [/chest|thorax|torso|respirat|breath|lung|cardio/i] },
  back: { label: "Lifting, carrying & bending demands", groups: ["upperBack", "lowBack"], patterns: [/back|lumbar|lift|carry|bend|stoop|material handling/i] },
  arm: { label: "Arm push, pull & reach demands", groups: ["arms"], patterns: [/arm|elbow|push|pull|reach|upper extrem/i] },
  hand: { label: "Hand, grip & tool demands", groups: ["hands"], patterns: [/hand|wrist|finger|grip|manual|dexterity|tool/i] },
  hip: { label: "Hip & squat demands", groups: ["hips"], patterns: [/hip|pelvis|squat/i] },
  knee: { label: "Kneeling & crouching demands", groups: ["knees"], patterns: [/knee|kneel|crouch/i] },
  legs: { label: "Standing, walking & climbing demands", groups: ["thighs", "calves"], patterns: [/leg|lower extrem|walk|stand|climb|stair|balance/i] },
  foot: { label: "Foot & ankle demands", groups: ["feet"], patterns: [/foot|feet|ankle|toe/i] },
  wholeBody: { label: "Whole-body physical demands", groups: ["wholeBody"], patterns: [/whole body|multiple|heavy physical|strenuous|physical demand/i] },
};

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
  const note = "O*NET job-demand context. It describes what the work asks of the body, not coded injuries.";
  const signals: Signal[] = [];
  for (const [id, demand] of Object.entries(DEMANDS) as Array<[DemandId, (typeof DEMANDS)[DemandId]]>) {
    const matches = demand.patterns.filter((pattern) => pattern.test(joined));
    if (!matches.length) continue;
    const detail = evidence.filter((value) => demand.patterns.some((pattern) => pattern.test(value))).slice(0, 4);
    const score = Math.min(1, 0.34 + matches.length * 0.14 + Math.min(detail.length, 3) * 0.1);
    signals.push({ id: `onet:${id}`, label: demand.label, kind: "demand", score, groups: demand.groups, note, detail });
  }
  return signals.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ medical-condition associations */

export const PRIMARY_NOTE = "Primary anatomical association for this condition category. Context only, not a finding for any individual.";
export const SECONDARY_NOTE = "Secondary association (downstream or contextual). It is not a confirmed clinical finding.";

export function deriveConditionSignals(condition: HealthCondition | null): Signal[] {
  if (!condition) return [];
  const review = `Review domains: ${condition.domains.join(" · ")}`;
  const primary = condition.primary.map<Signal>((group) => ({
    id: `${condition.id}:${group}`,
    label: GROUP_LABEL[group],
    kind: "primary",
    score: 0.9,
    groups: [group],
    note: PRIMARY_NOTE,
    detail: [review],
  }));
  const secondary = condition.secondary
    .filter((group) => !condition.primary.includes(group))
    .map<Signal>((group) => ({
      id: `${condition.id}:${group}`,
      label: GROUP_LABEL[group],
      kind: "secondary",
      score: 0.3,
      groups: [group],
      note: SECONDARY_NOTE,
      detail: [review],
    }));
  return [...primary, ...secondary];
}

/** group -> strongest signal covering it (drives lighting). */
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

/** Every signal that lights a given group (for the region readout). */
export function signalsForGroups(signals: Signal[], groups: GroupKey[]): Signal[] {
  return signals.filter((signal) => signal.groups.some((group) => groups.includes(group)));
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
