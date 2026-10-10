// Integrity audit of the Country → Geographic Combatant Command registry.
// Counts are computed from the rows, never typed in, so a duplicate or overlapping current assignment cannot hide.

import { ASSIGNMENT_ROWS } from "./assignments-rows";
import { assignmentFor, assignmentHistoryFor, CURRENT_ASSIGNMENTS, COMMAND_SOURCES, ENTITY_COVERAGE_REVIEW } from "./assignments";
import { CANDIDATE_ENTITIES } from "./candidate-entities";
import type { CommandId, CountryAorAssignment, GeographicClass } from "./types";

const COMMANDS = Object.keys(ASSIGNMENT_ROWS) as CommandId[];
export const GEOGRAPHIC_CLASSES: readonly GeographicClass[] = ["sovereign_state", "territory", "dependency", "overseas_department", "autonomous_country", "collectivity", "area_of_special_sovereignty", "disputed_entity", "other_entity", "candidate_unverified"];
const DEPENDENCY_TYPE = new Set<GeographicClass>(["dependency", "overseas_department", "autonomous_country", "collectivity", "area_of_special_sovereignty"]);
const emptyClasses = (): Record<GeographicClass, number> => Object.fromEntries(GEOGRAPHIC_CLASSES.map((name) => [name, 0])) as Record<GeographicClass, number>;

export interface CommandAuditRow {
  sovereign: number;
  entities: number;
  total: number;
  byClass: Record<GeographicClass, number>;
  publicCount: string;
  matchesPublicSovereignCount: boolean | null;
  liveVerify: boolean;
  /** Entities the command's own page says it covers, versus entities recorded here. */
  entityRecorded: number;
  /** Non-sovereign records named by official command material (verified named) and records carried from the extraction pack only. */
  verifiedNamedEntities: number;
  packOnlyEntities: number;
  /** The command's own current statements. Counts the command states are kept even when it names no individual place. */
  officialCurrentCountryCount: number | null;
  officialCurrentDependencyOrSpecialAreaCount: number | null;
  /** Verified-named dependency-type records (dependency, overseas department, autonomous country, collectivity, area of special sovereignty). */
  verifiedNamedDependencyCount: number;
  entityCoverageStatus: "COMPLETE_AS_STATED" | "INCOMPLETE_LIVE_VERIFY";
}

export interface RegistryAudit {
  /** Sovereign states only. */
  sovereignStates: number;
  /** Territories, dependencies, areas of special sovereignty and other entities, all non-sovereign. */
  territoriesDependenciesEntities: number;
  totalCurrentRecords: number;
  byClass: Record<GeographicClass, number>;
  // Kept names (same values as above) used by earlier tests and endpoints.
  uniqueCurrentSovereign: number;
  uniqueCurrentEntities: number;
  uniqueCurrentTotal: number;
  currentRows: number;
  perCommand: Record<CommandId, CommandAuditRow>;
  /** ISO3 codes with more than one CURRENT assignment (must be empty). */
  duplicateCurrent: Array<{ iso3: string; commands: CommandId[] }>;
  /** Superseded assignments, kept as history; none of these is counted as current. */
  historical: Array<{ iso3: string; name: string; command: CommandId; effectiveTo: string | null; supersededBy: CommandId | null }>;
  /** Historical records whose ISO3 also resolves to the same command as a current record (must be empty). */
  historicalOverlappingCurrent: string[];
  /** Places the UI selector offers that have no command assignment (must be empty). */
  unmappedSelectable: Array<{ iso3: string; name: string }>;
  /** Current records not offered by the UI selector (mapped, but cannot be picked). */
  mappedMissingFromSelector: Array<{ iso3: string; name: string; geographicClass: GeographicClass; command: CommandId }>;
  /** Commands whose own pages declare more entities than the registry can name. */
  /** `shortfall` = officially declared minus verified named. Candidates never close a shortfall. */
  declaredButUnenumerated: Array<{ command: CommandId; officialDeclared: number; verifiedNamed: number; shortfall: number; wording: string | null }>;
  /** Non-sovereign records named by an official command page versus carried only from the extraction pack. */
  entityEvidence: { commandPageNamesIt: string[]; packOnly: string[] };
  /** Candidate / LIVE VERIFY places held outside the registry. Never counted, never an assignment. */
  candidates: { count: number; isOfficialAssignment: false; entries: Array<{ iso3: string; name: string; candidateForCommand: CommandId; status: "LIVE_VERIFY"; referenceClass: GeographicClass }> };
  /** Conflicting official statements retained as evidence. */
  sourceConflicts: Array<{ command: CommandId; statement: string; value: number; kind: string; sourceDate: string | null; resolution: string }>;
  liveVerifyCommands: CommandId[];
  entityLiveVerifyCommands: CommandId[];
}

const PUBLIC_SOVEREIGN_COUNT: Partial<Record<CommandId, number>> = { CENTCOM: 21, AFRICOM: 53, EUCOM: 50, INDOPACOM: 36, SOUTHCOM: 31, NORTHCOM: 4 };

export function auditRegistry(countryTable: ReadonlyArray<{ iso3: string; country: string }> = [], rows: readonly CountryAorAssignment[] = CURRENT_ASSIGNMENTS): RegistryAudit {
  const byIso = new Map<string, Set<CommandId>>();
  const rowCount = new Map<string, number>();
  for (const row of rows) {
    const set = byIso.get(row.iso3) ?? new Set<CommandId>();
    set.add(row.command);
    byIso.set(row.iso3, set);
    rowCount.set(row.iso3, (rowCount.get(row.iso3) ?? 0) + 1);
  }
  const duplicates: RegistryAudit["duplicateCurrent"] = [];
  for (const [iso3, count] of rowCount) {
    const commands = [...(byIso.get(iso3) ?? [])];
    if (commands.length > 1 || count > 1) duplicates.push({ iso3, commands });
  }

  const sovereign = rows.filter((row) => row.geographicClass === "sovereign_state");
  const entities = rows.filter((row) => row.geographicClass !== "sovereign_state");

  const byClass = emptyClasses();
  for (const row of rows) byClass[row.geographicClass] += 1;

  const perCommand = {} as RegistryAudit["perCommand"];
  for (const command of COMMANDS) {
    const mine = rows.filter((row) => row.command === command);
    const classes = emptyClasses();
    for (const row of mine) classes[row.geographicClass] += 1;
    const s = classes.sovereign_state;
    const e = mine.length - s;
    const expected = PUBLIC_SOVEREIGN_COUNT[command] ?? null;
    const review = ENTITY_COVERAGE_REVIEW[command];
    perCommand[command] = {
      sovereign: s, entities: e, total: mine.length, byClass: classes,
      publicCount: COMMAND_SOURCES[command].publicCount,
      matchesPublicSovereignCount: expected === null ? null : expected === s,
      liveVerify: /LIVE VERIFY/.test(COMMAND_SOURCES[command].verification),
      entityRecorded: e,
      verifiedNamedEntities: mine.filter((row) => row.geographicClass !== "sovereign_state" && row.entityEvidence === "command_page_names_it").length,
      packOnlyEntities: mine.filter((row) => row.geographicClass !== "sovereign_state" && row.entityEvidence === "pack_only_not_named_by_command_page").length,
      officialCurrentCountryCount: review.officialCurrentCountryCount,
      officialCurrentDependencyOrSpecialAreaCount: review.officialCurrentDependencyOrSpecialAreaCount,
      verifiedNamedDependencyCount: mine.filter((row) => row.entityEvidence === "command_page_names_it" && DEPENDENCY_TYPE.has(row.geographicClass)).length,
      entityCoverageStatus: review.status,
    };
  }

  const historical: RegistryAudit["historical"] = [];
  for (const row of rows) {
    for (const old of assignmentHistoryFor(row.iso3)) historical.push({ iso3: old.iso3, name: old.name, command: old.command, effectiveTo: old.effectiveTo, supersededBy: row.command });
  }
  const historicalOverlappingCurrent = historical.filter((old) => rows.some((row) => row.iso3 === old.iso3 && row.command === old.command)).map((old) => old.iso3);

  const tableIso = new Set(countryTable.map((entry) => entry.iso3));
  const unmapped = countryTable.filter((entry) => !assignmentFor(entry.iso3)).map((entry) => ({ iso3: entry.iso3, name: entry.country }));
  const alias = (iso3: string) => (iso3 === "XKX" ? "XKS" : iso3);
  const missing = countryTable.length ? rows.filter((row) => !tableIso.has(row.iso3) && !tableIso.has(alias(row.iso3))).map((row) => ({ iso3: row.iso3, name: row.name, geographicClass: row.geographicClass, command: row.command })) : [];

  const declaredButUnenumerated = COMMANDS.flatMap((command) => {
    const declared = perCommand[command].officialCurrentDependencyOrSpecialAreaCount;
    const verifiedNamed = perCommand[command].verifiedNamedDependencyCount;
    return declared !== null && verifiedNamed < declared ? [{ command, officialDeclared: declared, verifiedNamed, shortfall: declared - verifiedNamed, wording: ENTITY_COVERAGE_REVIEW[command].declaredWording }] : [];
  });
  const sourceConflicts = COMMANDS.flatMap((command) => ENTITY_COVERAGE_REVIEW[command].sourceConflicts.map((c) => ({ command, statement: c.statement, value: c.value, kind: c.kind, sourceDate: c.sourceDate, resolution: c.resolution })));

  return {
    sovereignStates: new Set(sovereign.map((row) => row.iso3)).size,
    territoriesDependenciesEntities: new Set(entities.map((row) => row.iso3)).size,
    totalCurrentRecords: byIso.size,
    byClass,
    uniqueCurrentSovereign: new Set(sovereign.map((row) => row.iso3)).size,
    uniqueCurrentEntities: new Set(entities.map((row) => row.iso3)).size,
    uniqueCurrentTotal: byIso.size,
    currentRows: rows.length,
    perCommand,
    duplicateCurrent: duplicates,
    historical,
    historicalOverlappingCurrent,
    unmappedSelectable: unmapped,
    mappedMissingFromSelector: missing,
    declaredButUnenumerated,
    entityEvidence: {
      commandPageNamesIt: entities.filter((row) => row.entityEvidence === "command_page_names_it").map((row) => row.iso3).sort(),
      packOnly: entities.filter((row) => row.entityEvidence === "pack_only_not_named_by_command_page").map((row) => row.iso3).sort(),
    },
    candidates: { count: CANDIDATE_ENTITIES.length, isOfficialAssignment: false, entries: CANDIDATE_ENTITIES.map((c) => ({ iso3: c.iso3, name: c.name, candidateForCommand: c.candidateForCommand, status: c.status, referenceClass: c.referenceClass })) },
    sourceConflicts,
    liveVerifyCommands: COMMANDS.filter((command) => perCommand[command].liveVerify),
    entityLiveVerifyCommands: COMMANDS.filter((command) => perCommand[command].entityCoverageStatus === "INCOMPLETE_LIVE_VERIFY"),
  };
}

