// Versioned Country → Geographic Combatant Command registry.
//
// The Unified Command Plan (UCP) is classified. This registry is built from public DoD / command material as
// normalized by the extraction pack, keeps provenance per command, and keeps assignment HISTORY so a reassignment
// (Israel, EUCOM → CENTCOM) is a record, never a silent overwrite.

import { ASSIGNMENT_ROWS, type CommandId } from "./assignments-rows";
import type { AssignmentBasis, AssignmentVerification, CountryAorAssignment, EntityEvidence, GeographicClass } from "./types";

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

const STATE_FACT_SHEET = "https://www.state.gov/dependencies-and-areas-of-special-sovereignty/";
const US_TERRITORY_BASIS = "SOUTHCOM's AOR page excludes 'U.S. commonwealths, territories, and possessions' from its Caribbean coverage, and the State Department dependencies fact sheet lists it under United States sovereignty.";

const SOUTHCOM_INFERRED_BASIS = (sovereign: string) => `INFERRED. SOUTHCOM declares 12 dependencies and areas of special sovereignty but names none. This place is one of the 12 non-U.S. Caribbean / South Atlantic entries on the State Department fact sheet (${sovereign} sovereignty); that count-match is the only basis. The fact sheet does not assign places to commands and does not separate dependency from area of special sovereignty, so 'dependency' is the documented convention.`;
const SOUTHCOM_INFERRED_NOTE = "INFERRED, not an official assignment: SOUTHCOM's AOR page states '31 countries and 12 dependencies and areas of special sovereignty' and names none of the 12. Placed here by matching the count against the State Department fact sheet. LIVE VERIFY against an official SOUTHCOM enumeration. Not a sovereign state.";
const ENTITY_ROWS: Array<{ iso3: string; name: string; command: CommandId; geographicClass: GeographicClass; classBasis: string; evidence: EntityEvidence; note: string; basis: AssignmentBasis; sourceUrl?: string; sourceAuthority?: string }> = [
  { iso3: "GRL", name: "Greenland", command: "NORTHCOM", geographicClass: "dependency", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: "Named in NORTHCOM's AOR sentence without a class; the State Department fact sheet lists it under Danish sovereignty among 'dependencies and areas of special sovereignty'. The fact sheet does not distinguish dependency from area of special sovereignty, so 'dependency' is the documented convention for a non-U.S. entry.",
    note: "NORTHCOM's AOR page names Greenland (\"encompasses the continental United States, Alaska, Canada, Mexico, Greenland\"). Not a sovereign state." },
  { iso3: "PRI", name: "Puerto Rico", command: "NORTHCOM", geographicClass: "territory", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: US_TERRITORY_BASIS, note: "NORTHCOM's AOR page names Puerto Rico among the Caribbean portions of its AOR. Not a sovereign state." },
  { iso3: "VIR", name: "U.S. Virgin Islands", command: "NORTHCOM", geographicClass: "territory", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: US_TERRITORY_BASIS, note: "NORTHCOM's AOR page names the U.S. Virgin Islands among the Caribbean portions of its AOR. Not a sovereign state." },
  { iso3: "TWN", name: "Taiwan", command: "INDOPACOM", geographicClass: "other_entity", evidence: "pack_only_not_named_by_command_page", basis: "official_count_normalized_list",
    classBasis: "Not classified by an official command source and not on the State Department dependencies fact sheet.",
    note: "From the extraction pack only: an operational geographic entity not counted in the command's public nation count. The INDOPACOM page read on 2026-10-10 does not name Taiwan. LIVE VERIFY." },
  { iso3: "PSE", name: "Palestinian Territories", command: "CENTCOM", geographicClass: "other_entity", evidence: "pack_only_not_named_by_command_page", basis: "official_count_normalized_list",
    classBasis: "Not classified by an official command source and not on the State Department dependencies fact sheet.",
    note: "From the extraction pack only: a geographic entity in the CENTCOM theater not counted in the 21-nation public count. The CENTCOM AOR page read on 2026-10-10 names no territory. LIVE VERIFY." },
  { iso3: "ESH", name: "Western Sahara", command: "AFRICOM", geographicClass: "other_entity", evidence: "pack_only_not_named_by_command_page", basis: "official_count_normalized_list",
    classBasis: "Not classified by an official command source and not on the State Department dependencies fact sheet.",
    note: "From the extraction pack only: a geographic entity in the AFRICOM theater not counted in the 53-state public count. The AFRICOM page read on 2026-10-10 names no territory. LIVE VERIFY." },
  { iso3: "AIA", name: "Anguilla", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("UK"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "ABW", name: "Aruba", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("Netherlands"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "VGB", name: "British Virgin Islands", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("UK"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "CYM", name: "Cayman Islands", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("UK"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "CUW", name: "Curaçao", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("Netherlands"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "FLK", name: "Falkland Islands", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("UK"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "GUF", name: "French Guiana", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("France"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "MSR", name: "Montserrat", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("UK"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "BLM", name: "Saint Barthélemy", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("France"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "MAF", name: "Saint Martin", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("France"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "SXM", name: "Sint Maarten", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("Netherlands"), note: SOUTHCOM_INFERRED_NOTE },
  { iso3: "TCA", name: "Turks and Caicos Islands", command: "SOUTHCOM", geographicClass: "dependency", evidence: "inferred_not_named_by_command_page", basis: "official_count_normalized_list", classBasis: SOUTHCOM_INFERRED_BASIS("UK"), note: SOUTHCOM_INFERRED_NOTE },
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
        geographicClass: "sovereign_state",
        classBasis: null,
        entityEvidence: null,
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
      geographicClass: entity.geographicClass,
      classBasis: entity.classBasis,
      entityEvidence: entity.evidence,
      basis: entity.basis,
      verification: entity.evidence !== "command_page_names_it" ? "PUBLIC-SOURCE BASELINE — LIVE VERIFY" : source.verification,
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
    geographicClass: "sovereign_state",
    classBasis: null,
    entityEvidence: null,
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

/**
 * What each command's OFFICIAL public AOR description says about non-sovereign places, reviewed 2026-10-10.
 * `declaredCount` is only set where the command itself states a number; `named` lists only places the command names.
 */
export interface EntityCoverageReview {
  command: CommandId;
  reviewedAt: string;
  sourceUrl: string;
  declaredEntityCount: number | null;
  declaredWording: string | null;
  named: string[];
  finding: string;
  status: "COMPLETE_AS_STATED" | "INCOMPLETE_LIVE_VERIFY";
}

export const ENTITY_COVERAGE_REVIEW: Record<CommandId, EntityCoverageReview> = {
  NORTHCOM: { command: "NORTHCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.northcom.mil/About/About/", declaredEntityCount: null, declaredWording: null, named: ["GRL", "PRI", "VIR"], status: "COMPLETE_AS_STATED",
    finding: "The AOR sentence names Greenland, Puerto Rico and the U.S. Virgin Islands (and The Bahamas, a sovereign state) and says 'portions of the Caribbean region'. It does not classify any place. Bermuda, Turks and Caicos, the British Virgin Islands and the Cayman Islands are not mentioned, so none is assigned." },
  SOUTHCOM: { command: "SOUTHCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.southcom.mil/About/Area-of-Responsibility/", declaredEntityCount: 12, declaredWording: "31 countries and 12 dependencies and areas of special sovereignty", named: [], status: "INCOMPLETE_LIVE_VERIFY",
    finding: "SOUTHCOM states 12 dependencies and areas of special sovereignty but its public pages name none; the AOR page links the State Department fact sheet, which lists places by sovereignty and does not assign them to any command. Twelve records are held as INFERENCES (count-match against the fact sheet's non-U.S. Caribbean and South Atlantic entries), tagged inferred_not_named_by_command_page and LIVE VERIFY. Coverage stays INCOMPLETE until an official SOUTHCOM enumeration confirms or corrects them. SOUTHCOM's About page describes the Caribbean 'except U.S. commonwealths, territories, and possessions'." },
  CENTCOM: { command: "CENTCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.centcom.mil/AREA-OF-RESPONSIBILITY/", declaredEntityCount: null, declaredWording: "The 21 nations of the AOR", named: [], status: "COMPLETE_AS_STATED",
    finding: "The AOR page gives only the 21-nation count and regional descriptors; it names no territory. The Palestinian Territories record comes from the extraction pack, not from the command page." },
  AFRICOM: { command: "AFRICOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.africom.mil/about-the-command", declaredEntityCount: null, declaredWording: "The area of responsibility consists of 53 African states", named: [], status: "COMPLETE_AS_STATED",
    finding: "The page states 53 African states and refers to 'island nations' generally; it names no territory or dependency. The Western Sahara record comes from the extraction pack." },
  EUCOM: { command: "EUCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.eucom.mil/about", declaredEntityCount: null, declaredWording: null, named: [], status: "INCOMPLETE_LIVE_VERIFY",
    finding: "No retrievable EUCOM page describes the AOR or states a count of countries/territories, so no entity can be confirmed or ruled out. The country list also remains LIVE VERIFY." },
  INDOPACOM: { command: "INDOPACOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.pacom.mil/About-USINDOPACOM/", declaredEntityCount: null, declaredWording: "The 38 nations comprising the Asia-Pacific region", named: [], status: "INCOMPLETE_LIVE_VERIFY",
    finding: "The About page names no territory or dependency (only Hawaii and Alaska as U.S. states). It states '38 nations comprising the Asia-Pacific region', a regional phrase that differs from the pack's 36-nation command count; the two were not reconciled. Taiwan comes from the extraction pack." },
};

export const STATE_DEPARTMENT_FACT_SHEET = STATE_FACT_SHEET;
