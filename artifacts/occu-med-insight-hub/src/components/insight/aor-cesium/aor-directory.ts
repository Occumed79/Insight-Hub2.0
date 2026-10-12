// Frontend view of the backend location directory (GET /api/aor/directory). The backend registry is the only source of which
// location belongs to which command; this file only adds presentation (colour, camera framing) and lookup helpers.

import type { CountryIndex } from "./aor-geo";

export type CommandId = "NORTHCOM" | "SOUTHCOM" | "EUCOM" | "AFRICOM" | "CENTCOM" | "INDOPACOM";
export type EvidenceClass = "individually_verified" | "official_aggregate_count" | "regional_inference" | "provisional";

/** Presentation only: colour and camera framing per command. Membership never comes from here. */
export const COMMAND_VIEW: Record<CommandId, { label: string; short: string; color: string; center: [number, number]; range: number; flatSpan: [number, number] }> = {
  NORTHCOM: { label: "USNORTHCOM", short: "NORTHCOM", color: "#49e1df", center: [-101, 46], range: 9_500_000, flatSpan: [95, 55] },
  SOUTHCOM: { label: "USSOUTHCOM", short: "SOUTHCOM", color: "#54f0bd", center: [-67, -9], range: 8_500_000, flatSpan: [70, 70] },
  EUCOM: { label: "USEUCOM", short: "EUCOM", color: "#65b9ff", center: [21, 52], range: 4_800_000, flatSpan: [80, 45] },
  AFRICOM: { label: "USAFRICOM", short: "AFRICOM", color: "#a580ff", center: [19, 3], range: 8_200_000, flatSpan: [85, 85] },
  CENTCOM: { label: "USCENTCOM", short: "CENTCOM", color: "#54d8ff", center: [53, 30], range: 4_600_000, flatSpan: [60, 40] },
  INDOPACOM: { label: "USINDOPACOM", short: "INDOPACOM", color: "#7d78ff", center: [142, 13], range: 11_500_000, flatSpan: [150, 80] },
};
export const COMMAND_ORDER: CommandId[] = ["NORTHCOM", "SOUTHCOM", "EUCOM", "AFRICOM", "CENTCOM", "INDOPACOM"];

export const EVIDENCE_CLASS_LABEL: Record<EvidenceClass, string> = {
  individually_verified: "Individually verified",
  official_aggregate_count: "Official aggregate count",
  regional_inference: "Regional inference",
  provisional: "Provisional",
};

export type ReferencePoint = { lat: number; lon: number; source: "world-countries" | "published-coordinate"; note: string | null };

export type DirectoryLocation = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  /** null only when the directory could not be loaded and the map falls back to polygons alone. */
  command: CommandId | null;
  geographicClass: string;
  categoryLabel: string;
  entityType: "sovereign" | "entity";
  evidenceClass: EvidenceClass | null;
  authorityTier: number | null;
  provisional: boolean;
  contested: boolean;
  disputedSovereignty: boolean;
  verification: string | null;
  administering: string | null;
  parentId: string | null;
  parentIso3: string | null;
  parentName: string | null;
  splitParent: boolean;
  aliases: string[];
  boundaryIso2: string | null;
  referencePoint: ReferencePoint | null;
  countryIntelIso2: string | null;
  baselineProfile: boolean;
  assignmentNote: string | null;
};

export type SplitParent = { iso2: string; iso3: string; name: string; message: string; boundaryIso2: string | null; constituentIds: string[]; commands: CommandId[] };

export type AorDirectory = {
  registryVersion: string;
  total: number;
  commands: Array<{ id: CommandId; name: string; total: number; sovereign: number; entities: number }>;
  locations: DirectoryLocation[];
  splitParents: SplitParent[];
  boundaryOnly: Array<{ iso2: string; iso3: string; name: string; reason: string }>;
  supportComponents: Array<{ id: string; command: CommandId }>;
  baselineProfileCount: number;
  polygonCount: number;
  withoutPolygonCount: number;
  /** True when this directory was synthesised from polygons because the backend directory was unavailable. */
  degraded?: boolean;
};

export type DirectoryIndex = {
  directory: AorDirectory;
  byId: Map<string, DirectoryLocation>;
  byBoundaryIso2: Map<string, DirectoryLocation>;
  splitByBoundaryIso2: Map<string, SplitParent>;
  splitByIso3: Map<string, SplitParent>;
  childrenOf: Map<string, DirectoryLocation[]>;
};

export function buildDirectoryIndex(directory: AorDirectory): DirectoryIndex {
  const byId = new Map(directory.locations.map((entry) => [entry.id, entry]));
  const byBoundaryIso2 = new Map<string, DirectoryLocation>();
  for (const entry of directory.locations) if (entry.boundaryIso2) byBoundaryIso2.set(entry.boundaryIso2, entry);
  const splitByBoundaryIso2 = new Map<string, SplitParent>();
  for (const parent of directory.splitParents) if (parent.boundaryIso2) splitByBoundaryIso2.set(parent.boundaryIso2, parent);
  const childrenOf = new Map<string, DirectoryLocation[]>();
  for (const entry of directory.locations) {
    if (!entry.parentId) continue;
    childrenOf.set(entry.parentId, [...(childrenOf.get(entry.parentId) ?? []), entry]);
  }
  return { directory, byId, byBoundaryIso2, splitByBoundaryIso2, splitByIso3: new Map(directory.splitParents.map((entry) => [entry.iso3, entry])), childrenOf };
}

/** When the backend directory cannot be loaded the map still works from polygons, but no AOR is shown or invented. */
export function degradedDirectory(boundaries: CountryIndex): AorDirectory {
  const locations: DirectoryLocation[] = boundaries.list.map((entry) => ({
    id: entry.iso3, name: entry.name, iso2: entry.iso2, iso3: entry.iso3, command: null, geographicClass: "unknown", categoryLabel: "Country (AOR unavailable)", entityType: "sovereign",
    evidenceClass: null, authorityTier: null, provisional: false, contested: false, disputedSovereignty: false, verification: null, administering: null, parentId: null, parentIso3: null,
    parentName: null, splitParent: false, aliases: [], boundaryIso2: entry.iso2, referencePoint: null, countryIntelIso2: entry.iso2, baselineProfile: false, assignmentNote: null,
  }));
  return { registryVersion: "unavailable", total: locations.length, commands: [], locations, splitParents: [], boundaryOnly: [], supportComponents: [], baselineProfileCount: 0, polygonCount: locations.length, withoutPolygonCount: 0, degraded: true };
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** Offline fallback for the search box; the server search (names, aliases, ISO codes, synonyms, split parents) is preferred. */
export function searchLocal(index: DirectoryIndex, query: string, limit = 10): { locations: DirectoryLocation[]; splitParents: SplitParent[] } {
  const needle = normalize(query);
  if (!needle) return { locations: [], splitParents: [] };
  const code = query.trim().toUpperCase();
  const rank = (entry: DirectoryLocation) => {
    const names = [entry.name, ...entry.aliases].map(normalize);
    if (entry.id === code || entry.iso2 === code || entry.iso3 === code) return 0;
    if (names.some((value) => value === needle)) return 1;
    if (names.some((value) => value.startsWith(needle))) return 2;
    if (needle.length >= 3 && names.some((value) => value.includes(needle))) return 4;
    return 9;
  };
  const locations = index.directory.locations.map((entry) => ({ entry, r: rank(entry) })).filter((item) => item.r < 9).sort((a, b) => a.r - b.r || a.entry.name.localeCompare(b.entry.name)).slice(0, limit).map((item) => item.entry);
  const splitParents = index.directory.splitParents.filter((parent) => parent.iso2 === code || parent.iso3 === code || normalize(parent.name).startsWith(needle));
  return { locations, splitParents };
}

export const commandLabel = (command: CommandId | null) => (command ? COMMAND_VIEW[command].short : "AOR unavailable");

export function geographicClassLabel(entry: DirectoryLocation): string {
  return entry.categoryLabel || entry.geographicClass.replace(/_/g, " ");
}
