// Integrity audit of the Country → Geographic Combatant Command registry.
// Counts are computed from the rows, never typed in, so a duplicate or overlapping current assignment cannot hide.

import { ASSIGNMENT_ROWS } from "./assignments-rows";
import { assignmentFor, assignmentHistoryFor, CURRENT_ASSIGNMENTS, COMMAND_SOURCES } from "./assignments";
import type { CommandId, CountryAorAssignment } from "./types";

const COMMANDS = Object.keys(ASSIGNMENT_ROWS) as CommandId[];

export interface RegistryAudit {
  uniqueCurrentSovereign: number;
  uniqueCurrentEntities: number;
  uniqueCurrentTotal: number;
  currentRows: number;
  perCommand: Record<CommandId, { sovereign: number; entities: number; total: number; publicCount: string; matchesPublicSovereignCount: boolean | null; liveVerify: boolean }>;
  /** ISO3 codes with more than one CURRENT assignment (must be empty). */
  duplicateCurrent: Array<{ iso3: string; commands: CommandId[] }>;
  /** Superseded assignments, kept as history; none of these is counted as current. */
  historical: Array<{ iso3: string; name: string; command: CommandId; effectiveTo: string | null; supersededBy: CommandId | null }>;
  /** Historical records whose ISO3 also resolves to the same command as a current record (must be empty). */
  historicalOverlappingCurrent: string[];
  /** Entries of the app's AOR country table with no command assignment (must be empty). */
  unmappedCountryTable: Array<{ iso3: string; name: string }>;
  /** Current assignments whose country/entity is not in the app's AOR country table (mapped, but not selectable in the UI). */
  mappedButNotInCountryTable: Array<{ iso3: string; name: string; entityType: CountryAorAssignment["entityType"]; command: CommandId }>;
  liveVerifyCommands: CommandId[];
}

const PUBLIC_SOVEREIGN_COUNT: Partial<Record<CommandId, number>> = { CENTCOM: 21, AFRICOM: 53, EUCOM: 50, INDOPACOM: 36, SOUTHCOM: 31, NORTHCOM: 4 };

export function auditRegistry(countryTable: ReadonlyArray<{ iso3: string; country: string }> = [], rows: readonly CountryAorAssignment[] = CURRENT_ASSIGNMENTS): RegistryAudit {
  const byIso = new Map<string, Set<CommandId>>();
  for (const row of rows) {
    const set = byIso.get(row.iso3) ?? new Set<CommandId>();
    set.add(row.command);
    byIso.set(row.iso3, set);
  }
  const duplicates = [...byIso.entries()].filter(([, commands]) => commands.size > 1).map(([iso3, commands]) => ({ iso3, commands: [...commands] }));
  // A repeated row for the same command is also a duplicate even though it names one command.
  const rowCount = new Map<string, number>();
  for (const row of rows) rowCount.set(row.iso3, (rowCount.get(row.iso3) ?? 0) + 1);
  for (const [iso3, count] of rowCount) if (count > 1 && !duplicates.some((entry) => entry.iso3 === iso3)) duplicates.push({ iso3, commands: [...(byIso.get(iso3) ?? [])] });

  const sovereign = rows.filter((row) => row.entityType === "sovereign");
  const entities = rows.filter((row) => row.entityType === "entity");

  const perCommand = {} as RegistryAudit["perCommand"];
  for (const command of COMMANDS) {
    const s = sovereign.filter((row) => row.command === command).length;
    const e = entities.filter((row) => row.command === command).length;
    const expected = PUBLIC_SOVEREIGN_COUNT[command] ?? null;
    perCommand[command] = { sovereign: s, entities: e, total: s + e, publicCount: COMMAND_SOURCES[command].publicCount, matchesPublicSovereignCount: expected === null ? null : expected === s, liveVerify: /LIVE VERIFY/.test(COMMAND_SOURCES[command].verification) };
  }

  const historical: RegistryAudit["historical"] = [];
  for (const row of rows) {
    for (const old of assignmentHistoryFor(row.iso3)) {
      historical.push({ iso3: old.iso3, name: old.name, command: old.command, effectiveTo: old.effectiveTo, supersededBy: row.command });
    }
  }
  const historicalOverlappingCurrent = historical.filter((old) => rows.some((row) => row.iso3 === old.iso3 && row.command === old.command)).map((old) => old.iso3);

  const tableIso = new Set(countryTable.map((entry) => entry.iso3));
  const unmapped = countryTable.filter((entry) => !assignmentFor(entry.iso3)).map((entry) => ({ iso3: entry.iso3, name: entry.country }));
  const alias = (iso3: string) => (iso3 === "XKX" ? "XKS" : iso3);
  const notInTable = countryTable.length ? rows.filter((row) => !tableIso.has(row.iso3) && !tableIso.has(alias(row.iso3))).map((row) => ({ iso3: row.iso3, name: row.name, entityType: row.entityType, command: row.command })) : [];

  return {
    uniqueCurrentSovereign: new Set(sovereign.map((row) => row.iso3)).size,
    uniqueCurrentEntities: new Set(entities.map((row) => row.iso3)).size,
    uniqueCurrentTotal: byIso.size,
    currentRows: rows.length,
    perCommand,
    duplicateCurrent: duplicates,
    historical,
    historicalOverlappingCurrent,
    unmappedCountryTable: unmapped,
    mappedButNotInCountryTable: notInTable,
    liveVerifyCommands: COMMANDS.filter((command) => perCommand[command].liveVerify),
  };
}
