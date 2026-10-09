// Versioned Country → Geographic Combatant Command registry.
//
// The Unified Command Plan (UCP) is classified. This registry is built from public DoD / command material as
// normalized by the extraction pack, keeps provenance per command, and keeps assignment HISTORY so a reassignment
// (Israel, EUCOM → CENTCOM) is a record, never a silent overwrite.

import { ASSIGNMENT_ROWS, type CommandId } from "./assignments-rows";
import type { AssignmentBasis, AssignmentVerification, CountryAorAssignment } from "./types";

export const ASSIGNMENT_REGISTRY_VERSION = "2026-10-pack-1";

interface CommandSource {
  authority: string;
  url: string;
  basis: AssignmentBasis;
  verification: AssignmentVerification;
  publicCount: string;
  note: string | null;
}

export const COMMAND_NAMES: Record<CommandId, string> = {
  CENTCOM: "U.S. Central Command",
  AFRICOM: "U.S. Africa Command",
  EUCOM: "U.S. European Command",
  INDOPACOM: "U.S. Indo-Pacific Command",
  SOUTHCOM: "U.S. Southern Command",
  NORTHCOM: "U.S. Northern Command",
};

export const COMMAND_SOURCES: Record<CommandId, CommandSource> = {
  CENTCOM: {
    authority: "USCENTCOM – official operations/AOR country list",
    url: "https://www.centcom.mil/OPERATIONS-AND-EXERCISES/",
    basis: "official_list",
    verification: "PUBLIC-SOURCE BASELINE",
    publicCount: "21 nations",
    note: null,
  },
  AFRICOM: {
    authority: "USAFRICOM – About the Command",
    url: "https://www.africom.mil/about-the-command",
    basis: "official_count_normalized_list",
    verification: "PUBLIC-SOURCE BASELINE",
    publicCount: "53 African states (all African sovereign states except Egypt)",
    note: "The 53-state mapping is authoritative at the command level: AFRICOM states the count and its history identifies Egypt as the sole African state retained by CENTCOM.",
  },
  EUCOM: {
    authority: "USEUCOM – 2026 posture statement (public count: 50 countries/territories)",
    url: "https://www.eucom.mil/document/42003/sasc-29-mar-",
    basis: "official_count_normalized_list",
    verification: "PUBLIC-SOURCE BASELINE — LIVE VERIFY",
    publicCount: "50 countries/territories",
    note: "The official page states the count but no one-page country enumeration was retrieved. This list is a normalized baseline; verify against a future official enumeration.",
  },
  INDOPACOM: {
    authority: "USINDOPACOM – official command page (36 nations)",
    url: "https://www.pacom.mil/Leadership/Article/2590636/commander-us-pacific-command/",
    basis: "official_count_normalized_list",
    verification: "PUBLIC-SOURCE BASELINE — LIVE VERIFY",
    publicCount: "36 nations",
    note: "The official page states the count but no one-page country enumeration was retrieved. This list is a normalized baseline; verify against a future official enumeration.",
  },
  SOUTHCOM: {
    authority: "USSOUTHCOM – Area of Responsibility",
    url: "https://www.southcom.mil/About/Area-of-Responsibility/",
    basis: "official_list",
    verification: "PUBLIC-SOURCE BASELINE",
    publicCount: "31 countries (plus dependencies)",
    note: null,
  },
  NORTHCOM: {
    authority: "USNORTHCOM – About / Area of Responsibility",
    url: "https://www.northcom.mil/About/About/",
    basis: "official_list",
    verification: "PUBLIC-SOURCE BASELINE",
    publicCount: "U.S., Canada, Mexico, The Bahamas (plus Greenland, Puerto Rico, U.S. Virgin Islands geography)",
    note: null,
  },
};

const DOD_UCP_AUTHORITY = "DoD – Unified Combatant Commands / UCP authority";
const DOD_UCP_URL = "https://www.defense.gov/Resources/Military-Departments/Our-Story/Combatant-Commands/index.html/";
export const ISRAEL_REASSIGNMENT = {
  authority: "DoD – 2020 UCP change shifting Israel from EUCOM to CENTCOM",
  url: "https://www.defense.gov/News/Releases/Release/Article/2473648/department-of-defense-statement-on-unified-command-plan-change/",
  announced: "2021-01-15",
};

const ENTITY_ROWS: Array<{ iso3: string; name: string; command: CommandId; note: string; basis: AssignmentBasis }> = [
  { iso3: "GRL", name: "Greenland", command: "NORTHCOM", note: "Official NORTHCOM public AOR page. A territory, not a sovereign state.", basis: "official_boundary_statement" },
  { iso3: "PRI", name: "Puerto Rico", command: "NORTHCOM", note: "Official NORTHCOM public AOR page. A territory, not a sovereign state.", basis: "official_boundary_statement" },
  { iso3: "VIR", name: "U.S. Virgin Islands", command: "NORTHCOM", note: "Official NORTHCOM public AOR page. A territory, not a sovereign state.", basis: "official_boundary_statement" },
  { iso3: "TWN", name: "Taiwan", command: "INDOPACOM", note: "Operational geographic entity; not counted in the command's 36-nation public count.", basis: "official_count_normalized_list" },
  { iso3: "PSE", name: "Palestinian Territories", command: "CENTCOM", note: "Geographic entity in the CENTCOM theater; not counted in the command's 21-nation public count.", basis: "official_count_normalized_list" },
  { iso3: "ESH", name: "Western Sahara", command: "AFRICOM", note: "Geographic entity in the AFRICOM theater; not counted as a separate sovereign state in the 53-state public count.", basis: "official_count_normalized_list" },
];

function build(): CountryAorAssignment[] {
  const out: CountryAorAssignment[] = [];
  for (const command of Object.keys(ASSIGNMENT_ROWS) as CommandId[]) {
    const source = COMMAND_SOURCES[command];
    for (const [iso3, name] of ASSIGNMENT_ROWS[command]) {
      const israel = iso3 === "ISR";
      out.push({
        iso3,
        name,
        command,
        entityType: "sovereign",
        basis: source.basis,
        verification: source.verification,
        sourceAuthority: israel ? ISRAEL_REASSIGNMENT.authority : source.authority,
        sourceUrl: israel ? ISRAEL_REASSIGNMENT.url : source.url,
        effectiveFrom: israel ? ISRAEL_REASSIGNMENT.announced : null,
        effectiveTo: null,
        supersedesCommand: israel ? "EUCOM" : null,
        note: israel ? "Assigned to CENTCOM by the 2020 UCP change announced by DoD on 15 Jan 2021 (previously EUCOM). The effective date recorded is the announcement date." : source.note,
      });
    }
  }
  for (const entity of ENTITY_ROWS) {
    const source = COMMAND_SOURCES[entity.command];
    out.push({
      iso3: entity.iso3,
      name: entity.name,
      command: entity.command,
      entityType: "entity",
      basis: entity.basis,
      verification: source.verification,
      sourceAuthority: source.authority,
      sourceUrl: source.url,
      effectiveFrom: null,
      effectiveTo: null,
      supersedesCommand: null,
      note: entity.note,
    });
  }
  return out;
}

/** Superseded assignments, preserved as history. The pack establishes exactly one. */
const HISTORY: CountryAorAssignment[] = [
  {
    iso3: "ISR",
    name: "Israel",
    command: "EUCOM",
    entityType: "sovereign",
    basis: "official_boundary_statement",
    verification: "PUBLIC-SOURCE BASELINE",
    sourceAuthority: ISRAEL_REASSIGNMENT.authority,
    sourceUrl: ISRAEL_REASSIGNMENT.url,
    effectiveFrom: null,
    effectiveTo: ISRAEL_REASSIGNMENT.announced,
    supersedesCommand: null,
    note: "Superseded: moved from EUCOM to CENTCOM by the 2020 UCP change (DoD announcement 15 Jan 2021). Start date of the earlier assignment is not stated in the pack.",
  },
];

export const CURRENT_ASSIGNMENTS: readonly CountryAorAssignment[] = build();
const BY_ISO3 = new Map(CURRENT_ASSIGNMENTS.map((entry) => [entry.iso3, entry]));

/** The AOR country table uses XKS for Kosovo; the pack uses the common user-assigned code XKX. */
const ISO3_ALIASES: Record<string, string> = { XKS: "XKX" };
const canonicalIso3 = (iso3: string) => {
  const code = String(iso3 || "").toUpperCase();
  return ISO3_ALIASES[code] ?? code;
};

export function assignmentFor(iso3: string): CountryAorAssignment | null {
  return BY_ISO3.get(canonicalIso3(iso3)) ?? null;
}

export function assignmentHistoryFor(iso3: string): CountryAorAssignment[] {
  return HISTORY.filter((entry) => entry.iso3 === canonicalIso3(iso3));
}

export function countriesForCommand(command: CommandId, includeEntities = false): CountryAorAssignment[] {
  return CURRENT_ASSIGNMENTS.filter((entry) => entry.command === command && (includeEntities || entry.entityType === "sovereign"));
}

export function assignmentStats(): { version: string; byCommand: Record<CommandId, { sovereign: number; entities: number; publicCount: string }>; ucpAuthority: { authority: string; url: string; note: string } } {
  const byCommand = {} as Record<CommandId, { sovereign: number; entities: number; publicCount: string }>;
  for (const command of Object.keys(COMMAND_SOURCES) as CommandId[]) {
    byCommand[command] = {
      sovereign: countriesForCommand(command).length,
      entities: countriesForCommand(command, true).length - countriesForCommand(command).length,
      publicCount: COMMAND_SOURCES[command].publicCount,
    };
  }
  return { version: ASSIGNMENT_REGISTRY_VERSION, byCommand, ucpAuthority: { authority: DOD_UCP_AUTHORITY, url: DOD_UCP_URL, note: "The UCP itself is classified; assignments are constructed from public DoD and command material." } };
}
