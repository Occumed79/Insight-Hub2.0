/**
 * Data-driven anatomy zones for the Health intelligence hologram.
 *
 * Coordinates are in the pixel space of the exact hologram image
 * (public/health/hologram-body.png, 1536 x 1024): the anterior figure is the
 * left body, the posterior figure is the right body. Every overlay layer
 * (glow, lit copy, hit areas, reticle, callouts) is positioned from these
 * numbers, so aligning a region is a data edit, never a layout edit.
 */

export const HOLOGRAM_IMAGE = {
  src: `${import.meta.env.BASE_URL}health/hologram-body.png`,
  width: 1536,
  height: 1024,
} as const;

export type View = "front" | "back";

export type GroupKey =
  | "head"
  | "neck"
  | "shoulders"
  | "chest"
  | "gut"
  | "lowBack"
  | "hips"
  | "arms"
  | "hands"
  | "knees"
  | "thighs"
  | "calves"
  | "feet"
  | "wholeBody";

export const GROUP_LABEL: Record<GroupKey, string> = {
  head: "Brain / head",
  neck: "Neck / cervical spine",
  shoulders: "Shoulders",
  chest: "Heart, lungs & thoracic",
  gut: "Abdomen / gut",
  lowBack: "Lower back",
  hips: "Hips / pelvis",
  arms: "Arms",
  hands: "Hands / wrists",
  knees: "Knees",
  thighs: "Thighs",
  calves: "Calves / circulation",
  feet: "Feet / ankles",
  wholeBody: "Whole body",
};

export interface Zone {
  id: string;
  group: GroupKey;
  view: View;
  /** Ellipse centre / radii, image pixels. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export const BODY_CENTER: Record<View, number> = { front: 490, back: 1050 };

/** [group, cx offset from body centre (0 = single central zone), cy, rx, ry, mirrored] */
type Spec = [GroupKey, number, number, number, number, boolean];

const SHARED: Spec[] = [
  ["head", 0, 88, 46, 62, false],
  ["neck", 0, 168, 26, 22, false],
  ["shoulders", 105, 224, 52, 38, true],
  ["arms", 150, 345, 34, 88, true],
  ["arms", 172, 450, 28, 58, true],
  ["hands", 186, 545, 30, 40, true],
  ["knees", 58, 762, 40, 38, true],
  ["thighs", 52, 625, 52, 100, true],
  ["calves", 62, 860, 38, 72, true],
  ["feet", 95, 960, 55, 28, true],
];

const FRONT_ONLY: Spec[] = [
  ["chest", 0, 288, 100, 62, false],
  ["gut", 0, 400, 78, 62, false],
  ["hips", 0, 495, 88, 50, false],
];

const BACK_ONLY: Spec[] = [
  ["chest", 0, 288, 100, 62, false],
  ["lowBack", 0, 405, 72, 60, false],
  ["hips", 0, 505, 90, 50, false],
];

function build(view: View, specs: Spec[]): Zone[] {
  const center = BODY_CENTER[view];
  const zones: Zone[] = [];
  for (const [group, dx, cy, rx, ry, mirrored] of specs) {
    if (!mirrored) {
      zones.push({ id: `${view}-${group}-${zones.length}`, group, view, cx: center, cy, rx, ry });
      continue;
    }
    zones.push({ id: `${view}-${group}-${zones.length}-l`, group, view, cx: center - dx, cy, rx, ry });
    zones.push({ id: `${view}-${group}-${zones.length}-r`, group, view, cx: center + dx, cy, rx, ry });
  }
  return zones;
}

export const ZONES: Zone[] = [
  ...build("front", [...SHARED, ...FRONT_ONLY]),
  ...build("back", [...SHARED, ...BACK_ONLY]),
];

/** Hit-testing order: large regions first so small regions sit on top. */
export const ZONES_BY_AREA_DESC: Zone[] = [...ZONES].sort((a, b) => b.rx * b.ry - a.rx * a.ry);

export function zonesForGroup(group: GroupKey): Zone[] {
  return ZONES.filter((zone) => zone.group === group);
}

/** Zone of a group inside one specific view, or null when the group has no zone there. */
export function zoneInView(group: GroupKey, view: View): Zone | null {
  return zonesForGroup(group).find((zone) => zone.view === view) ?? null;
}

/** Zone used to anchor the reticle / callout for a group (anterior preferred, except lower back). */
export function anchorZone(group: GroupKey, preferView?: View): Zone | null {
  const zones = zonesForGroup(group);
  if (!zones.length) return null;
  const view = preferView ?? (group === "lowBack" ? "back" : "front");
  return zones.find((zone) => zone.view === view) ?? zones[0];
}

/** Image-space point -> percentage of the full image box. */
export function toPercent(x: number, y: number) {
  return { x: (x / HOLOGRAM_IMAGE.width) * 100, y: (y / HOLOGRAM_IMAGE.height) * 100 };
}
