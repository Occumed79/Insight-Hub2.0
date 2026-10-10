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
    authority: "USEUCOM – commander page (\"NATO and 50 countries\"; undated)",
    url: "https://www.eucom.mil/commander",
    basis: "official_count_normalized_list",
    verification: "PUBLIC-SOURCE BASELINE — LIVE VERIFY",
    publicCount: "50 countries",
    note: "The count of 50 is supported by the current EUCOM commander page (Gen. Alexus G. Grynkewich; the page carries no date). The count is not in question. No official source supplies the individual membership, so the list is a normalized baseline and stays LIVE VERIFY.",
  },
  INDOPACOM: {
    authority: "USINDOPACOM – command material stating 36 countries (command fact sheet, undated; Keystone INDOPACOM brief, 11 June 2026)",
    url: "https://www.pacom.mil/Leadership/Article/2590636/commander-us-pacific-command/",
    basis: "official_count_normalized_list",
    verification: "PUBLIC-SOURCE BASELINE — LIVE VERIFY",
    publicCount: "36 nations",
    note: "INDOPACOM material repeatedly states 36 countries (the command fact sheet and the 11 June 2026 Keystone brief), so the count is 36; the About page's '38 nations comprising the Asia-Pacific region' is kept as a source conflict. No official source supplies the individual membership, so the list is a normalized baseline and stays LIVE VERIFY.",
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

const SOURCE_NOTE_USPACOM_FACT_SHEET = "Source is the command fact sheet 'Headquarters, United States Pacific Command Fact Sheet' (USPACOM, the command's name before the 2018 rename to INDOPACOM). It states no publication date. It is retained as an older source and is not treated as current: re-verify against a current INDOPACOM AOR description. The 11 June 2026 Keystone INDOPACOM brief (keystone.ndu.edu) lists the same three territories.";
const ENTITY_ROWS: Array<{ iso3: string; name: string; command: CommandId; geographicClass: GeographicClass; classBasis: string; evidence: EntityEvidence; note: string; basis: AssignmentBasis; sourceUrl?: string; sourceAuthority?: string; sourceDate?: string | null; sourceCurrencyNote?: string | null }> = [
  { iso3: "GRL", name: "Greenland", command: "NORTHCOM", geographicClass: "dependency", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: "Named in NORTHCOM's AOR sentence without a class; the State Department fact sheet lists it under Danish sovereignty among 'dependencies and areas of special sovereignty'. The fact sheet does not distinguish dependency from area of special sovereignty, so 'dependency' (the State Department list's own heading) is the only class these sources support. A finer class is not asserted.",
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
  { iso3: "GUM", name: "Guam", command: "INDOPACOM", geographicClass: "territory", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: "The USPACOM fact sheet describes it, with others, as one of the 'U.S. territories in the AOR'; the class recorded is the command's own. The 11 June 2026 Keystone INDOPACOM brief (keystone.ndu.edu) also lists it under 'U.S. territories'.",
    note: "Named by the USPACOM fact sheet: 'Other U.S. territories in the AOR include Guam, American Samoa and the Commonwealth of the Northern Mariana Islands.' Not a sovereign state.",
    sourceUrl: "https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", sourceAuthority: "USPACOM – Headquarters fact sheet (undated; predates the INDOPACOM name)", sourceDate: null, sourceCurrencyNote: SOURCE_NOTE_USPACOM_FACT_SHEET },
  { iso3: "ASM", name: "American Samoa", command: "INDOPACOM", geographicClass: "territory", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: "The USPACOM fact sheet describes it, with others, as one of the 'U.S. territories in the AOR'; the class recorded is the command's own. The 11 June 2026 Keystone INDOPACOM brief (keystone.ndu.edu) also lists it under 'U.S. territories'.",
    note: "Named by the USPACOM fact sheet: 'Other U.S. territories in the AOR include Guam, American Samoa and the Commonwealth of the Northern Mariana Islands.' Not a sovereign state.",
    sourceUrl: "https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", sourceAuthority: "USPACOM – Headquarters fact sheet (undated; predates the INDOPACOM name)", sourceDate: null, sourceCurrencyNote: SOURCE_NOTE_USPACOM_FACT_SHEET },
  { iso3: "MNP", name: "Northern Mariana Islands", command: "INDOPACOM", geographicClass: "territory", evidence: "command_page_names_it", basis: "official_boundary_statement",
    classBasis: "The USPACOM fact sheet describes it, with others, as one of the 'U.S. territories in the AOR'. The command's own wording is 'Commonwealth of the Northern Mariana Islands'; the class recorded is the command's 'territory'.",
    note: "Named by the USPACOM fact sheet: 'Other U.S. territories in the AOR include Guam, American Samoa and the Commonwealth of the Northern Mariana Islands.' Not a sovereign state.",
    sourceUrl: "https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", sourceAuthority: "USPACOM – Headquarters fact sheet (undated; predates the INDOPACOM name)", sourceDate: null, sourceCurrencyNote: SOURCE_NOTE_USPACOM_FACT_SHEET },
  { iso3: "ESH", name: "Western Sahara", command: "AFRICOM", geographicClass: "other_entity", evidence: "pack_only_not_named_by_command_page", basis: "official_count_normalized_list",
    classBasis: "Not classified by an official command source and not on the State Department dependencies fact sheet.",
    note: "From the extraction pack only: a geographic entity in the AFRICOM theater not counted in the 53-state public count. The AFRICOM page read on 2026-10-10 names no territory. LIVE VERIFY." },
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
      verification: entity.evidence === "pack_only_not_named_by_command_page" ? "PUBLIC-SOURCE BASELINE — LIVE VERIFY" : source.verification,
      sourceAuthority: entity.sourceAuthority ?? source.authority,
      sourceUrl: entity.sourceUrl ?? source.url,
      ...(entity.sourceCurrencyNote !== undefined ? { sourceDate: entity.sourceDate ?? null, sourceCurrencyNote: entity.sourceCurrencyNote } : {}),
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
export interface SourceConflict {
  statement: string;
  value: number;
  kind: "country_count" | "dependency_or_special_area_count";
  sourceUrl: string;
  sourceDate: string | null;
  resolution: "RESOLVED_TOWARD_CURRENT_COUNT" | "RETAINED_AS_HISTORICAL_EVIDENCE";
  note: string;
}

export interface EntityCoverageReview {
  command: CommandId;
  reviewedAt: string;
  sourceUrl: string;
  /** The command's current official country count, where it states one. */
  officialCurrentCountryCount: number | null;
  /** The command's current official count of dependencies / areas of special sovereignty, where it states one. */
  officialCurrentDependencyOrSpecialAreaCount: number | null;
  declaredWording: string | null;
  /** ISO3 of non-sovereign places the command's own material names. */
  named: string[];
  /** Older or differing official statements, kept as evidence and never silently overwritten. */
  sourceConflicts: SourceConflict[];
  finding: string;
  status: "COMPLETE_AS_STATED" | "INCOMPLETE_LIVE_VERIFY";
}

export const ENTITY_COVERAGE_REVIEW: Record<CommandId, EntityCoverageReview> = {
  NORTHCOM: { command: "NORTHCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.northcom.mil/About/About/", officialCurrentCountryCount: null, officialCurrentDependencyOrSpecialAreaCount: null, declaredWording: null, named: ["GRL", "PRI", "VIR"], sourceConflicts: [], status: "COMPLETE_AS_STATED",
    finding: "The AOR sentence names Greenland, Puerto Rico and the U.S. Virgin Islands (and The Bahamas, a sovereign state) and says 'portions of the Caribbean region'. It does not classify any place. Bermuda, Turks and Caicos, the British Virgin Islands and the Cayman Islands are not mentioned, so none is assigned." },
  SOUTHCOM: { command: "SOUTHCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.southcom.mil/About/Area-of-Responsibility/", officialCurrentCountryCount: 31, officialCurrentDependencyOrSpecialAreaCount: 12, declaredWording: "31 countries and 12 dependencies and areas of special sovereignty", named: [],
    sourceConflicts: [{
      statement: "promote security cooperation with the 31 nations and 16 areas of special sovereignty in our AOR", value: 16, kind: "dependency_or_special_area_count",
      sourceUrl: "https://www.southcom.mil/Portals/7/Documents/Posture%20Statements/SOUTHCOM_POSTURE_STATEMENT_FINAL_2016.pdf?ver=2017-01-04-094258-267", sourceDate: "2016-03-10", resolution: "RETAINED_AS_HISTORICAL_EVIDENCE",
      note: "Posture statement of Adm. Kurt W. Tidd to the Senate Armed Services Committee, 10 March 2016. It disagrees with the current page's 12 on areas of special sovereignty (the 31 agrees). It is older and is not used as the current count; it is kept as source-conflict evidence. Neither source names the places.",
    }],
    status: "INCOMPLETE_LIVE_VERIFY",
    finding: "SOUTHCOM officially states 31 countries and 12 dependencies and areas of special sovereignty but its public pages name none of the 12; the AOR page links the State Department fact sheet, which lists places by sovereignty and assigns none to a command. Zero are recorded as assignments. Plausible candidates are held apart in candidate-entities.ts as candidate_unverified / LIVE VERIFY and are never returned as assignments. SOUTHCOM's About page describes the Caribbean 'except U.S. commonwealths, territories, and possessions'." },
  CENTCOM: { command: "CENTCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.centcom.mil/AREA-OF-RESPONSIBILITY/", officialCurrentCountryCount: 21, officialCurrentDependencyOrSpecialAreaCount: null, declaredWording: "The 21 nations of the AOR", named: [], sourceConflicts: [], status: "COMPLETE_AS_STATED",
    finding: "The AOR page gives only the 21-nation count and regional descriptors; it names no territory. The Palestinian Territories record comes from the extraction pack, not from the command page." },
  AFRICOM: { command: "AFRICOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.africom.mil/about-the-command", officialCurrentCountryCount: 53, officialCurrentDependencyOrSpecialAreaCount: null, declaredWording: "The area of responsibility consists of 53 African states", named: [], sourceConflicts: [], status: "COMPLETE_AS_STATED",
    finding: "The page states 53 African states and refers to 'island nations' generally; it names no territory or dependency. The Western Sahara record comes from the extraction pack." },
  EUCOM: { command: "EUCOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.eucom.mil/commander", officialCurrentCountryCount: 50, officialCurrentDependencyOrSpecialAreaCount: null, declaredWording: "U.S. defense operations and relations with NATO and 50 countries", named: [], sourceConflicts: [], status: "INCOMPLETE_LIVE_VERIFY",
    finding: "The current EUCOM commander page supports the count of 50 countries (the page is undated). It names no country and no territory, so the individual membership stays LIVE VERIFY and no entity can be confirmed or ruled out." },
  INDOPACOM: { command: "INDOPACOM", reviewedAt: "2026-10-10", sourceUrl: "https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", officialCurrentCountryCount: 36, officialCurrentDependencyOrSpecialAreaCount: null, declaredWording: "36 countries", named: ["GUM", "ASM", "MNP"],
    sourceConflicts: [{
      statement: "The 38 nations comprising the Asia-Pacific region", value: 38, kind: "country_count",
      sourceUrl: "https://www.pacom.mil/About-USINDOPACOM/", sourceDate: null, resolution: "RESOLVED_TOWARD_CURRENT_COUNT",
      note: "The About page uses '38 nations' as a regional description. The command fact sheet (undated) and the 11 June 2026 Keystone INDOPACOM brief both state 36 countries, so the count is 36. The 38 is kept as evidence, not as the count.",
    }],
    status: "INCOMPLETE_LIVE_VERIFY",
    finding: "INDOPACOM material states 36 countries and names Guam, American Samoa and the Commonwealth of the Northern Mariana Islands as U.S. territories in the AOR ('Other U.S. territories in the AOR include …', which is not an exhaustive list). The fact sheet is undated and carries the former USPACOM name, so it is treated as an older source; the 11 June 2026 Keystone INDOPACOM brief lists the same three territories. Taiwan comes from the extraction pack only. The country list stays LIVE VERIFY." },
};

export const STATE_DEPARTMENT_FACT_SHEET = STATE_FACT_SHEET;
