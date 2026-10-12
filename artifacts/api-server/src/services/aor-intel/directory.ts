// The AOR location directory exposed to the workspace: every record in the 285-location geographic registry, the split ISO
// parents, and what the map can honestly draw for each. Nothing here assigns a command — membership comes from the registry's own
// resolver — and nothing here invents geometry: a location is `boundary: null` unless the repository's boundary file has its polygon.

import { countryBoundaries, resolveCountry } from "./geo";
import { getAorCountryProfileByIso2 } from "../../data/aor-country-profiles";
import { referencePointFor, type ReferencePoint } from "./location-reference-points";
import { ASSIGNMENT_REGISTRY_VERSION, COMMAND_NAMES, CURRENT_ASSIGNMENTS, ambiguousParentFor, assignmentStats } from "./command-policy/assignments";
import { SPLIT_PARENTS, normalizeName } from "./command-policy/global-directory";
import type { CommandId } from "./command-policy/assignments-rows";
import { COMMAND_POLICIES, COMMAND_RULES } from "./command-policy/policies-data";
import type { CountryAorAssignment, EvidenceClass, GeographicClass } from "./command-policy/types";

export interface DirectoryLocation {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  command: CommandId;
  geographicClass: GeographicClass;
  categoryLabel: string;
  entityType: "sovereign" | "entity";
  evidenceClass: EvidenceClass;
  authorityTier: number;
  provisional: boolean;
  contested: boolean;
  disputedSovereignty: boolean;
  verification: string;
  administering: string | null;
  parentId: string | null;
  parentIso3: string | null;
  parentName: string | null;
  splitParent: boolean;
  aliases: string[];
  /** ISO2 key of the polygon in /api/aor/boundaries, or null when the repository has no polygon for this location. */
  boundaryIso2: string | null;
  referencePoint: ReferencePoint | null;
  /** The per-country intelligence workspace (/api/aor/country-intel) can be assembled for this location. */
  countryIntelIso2: string | null;
  /** One of the 197 separate baseline country profiles exists for this location. */
  baselineProfile: boolean;
  assignmentNote: string | null;
}

export interface SplitParentEntry {
  iso2: string;
  iso3: string;
  name: string;
  message: string;
  boundaryIso2: string | null;
  constituentIds: string[];
  commands: CommandId[];
}

export interface BoundaryOnlyEntry {
  iso2: string;
  iso3: string;
  name: string;
  /** A polygon exists but no registry record carries it. It is drawn neutral and never assigned. */
  reason: string;
}

const featureByIso3 = new Map(countryBoundaries.features.map((feature) => [feature.properties.iso3, feature.properties]));
const featureByIso2 = new Map(countryBoundaries.features.map((feature) => [feature.properties.iso2, feature.properties]));

function boundaryIso2For(record: CountryAorAssignment): string | null {
  const directory = record.directory;
  if (!directory || directory.splitParent) return null;
  // Composite-parent children (Bonaire, Saba, Gaza ...) never use the parent's polygon: it covers more than the child.
  if (directory.parentIso3 && !directory.splitParent && record.iso3 !== directory.parentIso3 && directory.compositeParentRecord) return null;
  const byIso3 = featureByIso3.get(record.iso3);
  if (byIso3) return byIso3.iso2;
  if (directory.iso2 && !directory.parentIso3) return featureByIso2.get(directory.iso2)?.iso2 ?? null;
  return null;
}

function toLocation(record: CountryAorAssignment, nameByIso3: Map<string, string>): DirectoryLocation {
  const directory = record.directory!;
  const iso2 = directory.iso2 ?? null;
  const iso3 = directory.idKind === "synthetic" ? null : record.iso3;
  const parentName = directory.parentIso3 ? SPLIT_PARENTS[directory.parentIso3]?.name ?? nameByIso3.get(directory.parentIso3) ?? null : null;
  return {
    id: record.iso3,
    name: record.name,
    iso2,
    iso3,
    command: record.command,
    geographicClass: record.geographicClass,
    categoryLabel: directory.categoryLabel,
    entityType: record.entityType,
    evidenceClass: directory.evidenceClass,
    authorityTier: directory.authorityTier,
    provisional: directory.provisional,
    contested: directory.contested,
    disputedSovereignty: directory.disputedSovereignty,
    verification: record.verification,
    administering: directory.administering,
    parentId: directory.parentIso3 ?? null,
    parentIso3: directory.parentIso3 ?? null,
    parentName,
    splitParent: directory.splitParent,
    aliases: directory.aliases,
    boundaryIso2: boundaryIso2For(record),
    referencePoint: referencePointFor(record.iso3, iso3, iso2),
    countryIntelIso2: iso2 && resolveCountry(iso2) ? iso2 : null,
    baselineProfile: Boolean(iso2 && getAorCountryProfileByIso2(iso2)),
    assignmentNote: record.note,
  };
}

export interface AorDirectory {
  registryVersion: string;
  total: number;
  commands: Array<{ id: CommandId; name: string; total: number; sovereign: number; entities: number }>;
  locations: DirectoryLocation[];
  splitParents: SplitParentEntry[];
  boundaryOnly: BoundaryOnlyEntry[];
  /** Component / JTF names the integrated command-policy sources actually use, with the command whose policy names each. Used to populate the medical-applicability form. */
  supportComponents: Array<{ id: string; command: CommandId }>;
  baselineProfileCount: number;
  polygonCount: number;
  withoutPolygonCount: number;
}

/** Components named by rule scopes in the integrated command policies (the command's own name is the command, not a component). */
function supportComponents(): Array<{ id: string; command: CommandId }> {
  const commandOfPolicy = new Map(COMMAND_POLICIES.map((policy) => [policy.policyId, policy.command]));
  const seen = new Map<string, CommandId>();
  for (const rule of COMMAND_RULES) {
    const component = rule.scope.component;
    const command = commandOfPolicy.get(rule.policyId);
    if (!component || !command || /^US(?:EUCOM|AFRICOM|INDOPACOM|CENTCOM|SOUTHCOM|NORTHCOM)$/.test(component)) continue;
    if (!seen.has(component)) seen.set(component, command);
  }
  return [...seen].map(([id, command]) => ({ id, command })).sort((a, b) => a.command.localeCompare(b.command) || a.id.localeCompare(b.id));
}

let cached: AorDirectory | null = null;

export function buildAorDirectory(): AorDirectory {
  if (cached) return cached;
  const nameByIso3 = new Map(CURRENT_ASSIGNMENTS.map((record) => [record.iso3, record.name]));
  const locations = CURRENT_ASSIGNMENTS.filter((record) => record.directory).map((record) => toLocation(record, nameByIso3))
    .sort((a, b) => a.name.localeCompare(b.name));

  const splitParents: SplitParentEntry[] = Object.values(SPLIT_PARENTS).flatMap((parent) => {
    const ambiguity = ambiguousParentFor(parent.iso3);
    if (!ambiguity) return [];
    return [{
      iso2: parent.iso2, iso3: parent.iso3, name: parent.name, message: ambiguity.message,
      boundaryIso2: featureByIso2.get(parent.iso2)?.iso2 ?? null,
      constituentIds: ambiguity.constituents.map((entry) => entry.id),
      commands: [...new Set(ambiguity.constituents.map((entry) => entry.command))].sort() as CommandId[],
    }];
  });

  const claimedIso2 = new Set([...locations.map((entry) => entry.boundaryIso2), ...splitParents.map((entry) => entry.boundaryIso2)].filter(Boolean));
  const boundaryOnly = countryBoundaries.features
    .filter((feature) => !claimedIso2.has(feature.properties.iso2))
    .map((feature) => ({ iso2: feature.properties.iso2, iso3: feature.properties.iso3, name: feature.properties.name, reason: "The boundary file has a polygon for this area but no registry record is attached to it; it is drawn neutral and carries no AOR." }));

  const stats = assignmentStats();
  const commands = (Object.keys(COMMAND_NAMES) as CommandId[]).map((id) => ({
    id, name: COMMAND_NAMES[id],
    total: locations.filter((entry) => entry.command === id).length,
    sovereign: stats.byCommand[id]?.sovereign ?? 0,
    entities: stats.byCommand[id]?.entities ?? 0,
  }));

  cached = {
    registryVersion: ASSIGNMENT_REGISTRY_VERSION,
    total: locations.length,
    commands, locations, splitParents, boundaryOnly, supportComponents: supportComponents(),
    baselineProfileCount: locations.filter((entry) => entry.baselineProfile).length,
    polygonCount: locations.filter((entry) => entry.boundaryIso2).length,
    withoutPolygonCount: locations.filter((entry) => !entry.boundaryIso2).length,
  };
  return cached;
}

/** Common names that are not in a record's own name or aliases. Each maps to an existing record id; nothing here assigns a command. */
const SEARCH_SYNONYMS: Record<string, string> = {
  uk: "GBR", "great britain": "GBR", britain: "GBR", england: "GBR", burma: "MMR", "ivory coast": "CIV", swaziland: "SWZ", "cape verde": "CPV", "east timor": "TLS",
  turkey: "TUR", holland: "NLD", "czech republic": "CZE", "south korea": "KOR", "north korea": "PRK", "dr congo": "COD", drc: "COD", "palestine": "PSE", uae: "ARE", russia: "RUS",
  "democratic republic of the congo": "COD", "republic of the congo": "COG", macedonia: "MKD", "vatican": "VAT", "falklands": "FLK", "pitcairn": "PCN",
};

/** Directory search: name, alias, ISO2/ISO3 or record id. Split ISO parents are returned as their own entry with their constituents. */
export function searchAorDirectory(query: string, limit = 12): { locations: DirectoryLocation[]; splitParents: SplitParentEntry[] } {
  const directory = buildAorDirectory();
  const needle = normalizeName(query);
  const code = query.trim().toUpperCase();
  if (!needle) return { locations: [], splitParents: [] };
  const synonym = SEARCH_SYNONYMS[needle] ?? null;
  const score = (entry: DirectoryLocation): number => {
    if (synonym && entry.id === synonym) return 0;
    const names = [entry.name, ...entry.aliases].map(normalizeName);
    if (entry.id === code || entry.iso2 === code || entry.iso3 === code) return 0;
    if (names.some((value) => value === needle)) return 1;
    if (names.some((value) => value.startsWith(needle))) return 2;
    if (names.some((value) => value.split(" ").some((word) => word.startsWith(needle)))) return 3;
    if (needle.length >= 3 && names.some((value) => value.includes(needle))) return 4;
    return 9;
  };
  const locations = directory.locations.map((entry) => ({ entry, rank: score(entry) })).filter((item) => item.rank < 9)
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name)).slice(0, limit).map((item) => item.entry);
  const splitParents = directory.splitParents.filter((parent) => {
    const names = [parent.name, ...(SPLIT_PARENTS[parent.iso3]?.names ?? [])].map(normalizeName);
    return parent.iso2 === code || parent.iso3 === code || names.some((value) => value === needle || value.startsWith(needle) || value.includes(needle));
  });
  return { locations, splitParents };
}
