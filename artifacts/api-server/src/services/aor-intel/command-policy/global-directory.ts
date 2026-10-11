// Global geographic AOR directory integration.
//
// This module does NOT hold a second registry. It takes the rows the existing registry already builds (assignments.ts) and the
// 285-record workbook (global-directory-rows.ts) and produces one merged list of single-AOR geographic records, in the same
// CountryAorAssignment shape, with the workbook's identifiers, hierarchy and provenance attached as `directory`.
//
// Rules enforced here:
//  - One location = one primary geographic AOR. The three split ISO parents (US, UM, TF) have NO AOR of their own; they resolve through
//    their constituent records, and a generic parent lookup returns the constituents, never an inherited command.
//  - The assignment and its evidence are separate. Evidence is classified (individually_verified / official_aggregate_count /
//    regional_inference / provisional) and an assignment is never promoted because the directory is complete.
//  - Controlling authority decides conflicts (tier 1 Presidential UCP / boundary directive … tier 6 regional inference). The displaced
//    claim stays in `corrections` / `conflictHistory`.
//  - Disputed sovereignty is recorded on the record and never produces a second AOR.

import { CROSSWALK_ROWS, DIRECTORY_ROWS, type DirectoryRow } from "./global-directory-rows";
import { CRS_CENTCOM_URL } from "./verified-research";
import type {
  AmbiguousParent, AuthorityTier, CommandId, ControllingSource, CountryAorAssignment, DirectoryCorrection, DirectoryDetail, EntityEvidence, EvidenceClass, GeographicClass,
} from "./types";

/* ------------------------------------------------------------------ */
/* Command names                                                       */
/* ------------------------------------------------------------------ */

/** Workbook command names → the application's internal command ids. */
export const WORKBOOK_COMMAND_IDS: Record<string, CommandId> = {
  USPACOM: "INDOPACOM",
  USINDOPACOM: "INDOPACOM",
  USEUCOM: "EUCOM",
  USAFRICOM: "AFRICOM",
  USSOUTHCOM: "SOUTHCOM",
  USCENTCOM: "CENTCOM",
  USNORTHCOM: "NORTHCOM",
};

/** Names a command has been called, kept for compatibility. USPACOM is the pre-2018 name of INDOPACOM. */
export const COMMAND_ALIASES: Record<CommandId, string[]> = {
  INDOPACOM: ["USINDOPACOM", "USPACOM", "PACOM", "U.S. Pacific Command", "U.S. Indo-Pacific Command"],
  EUCOM: ["USEUCOM", "U.S. European Command"],
  AFRICOM: ["USAFRICOM", "U.S. Africa Command"],
  SOUTHCOM: ["USSOUTHCOM", "U.S. Southern Command"],
  CENTCOM: ["USCENTCOM", "U.S. Central Command"],
  NORTHCOM: ["USNORTHCOM", "U.S. Northern Command"],
};

export function commandIdFromLabel(label: string): CommandId | null {
  const text = String(label || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (WORKBOOK_COMMAND_IDS[text]) return WORKBOOK_COMMAND_IDS[text];
  const head = text.split("/")[0].trim();
  if (WORKBOOK_COMMAND_IDS[head]) return WORKBOOK_COMMAND_IDS[head];
  if (WORKBOOK_COMMAND_IDS[`US${head}`]) return WORKBOOK_COMMAND_IDS[`US${head}`];
  if (head === "PACOM") return "INDOPACOM";
  return (["CENTCOM", "AFRICOM", "EUCOM", "INDOPACOM", "SOUTHCOM", "NORTHCOM"] as CommandId[]).find((id) => id === head) ?? null;
}

/* ------------------------------------------------------------------ */
/* Identifiers and hierarchy                                           */
/* ------------------------------------------------------------------ */

/** The workbook publishes Kosovo as XKS (GENC); the registry's canonical id is XKX. Both stay resolvable. */
export const ID_ALIASES: Record<string, string> = { XKS: "XKX" };

export interface SplitParent {
  iso2: string;
  iso3: string;
  name: string;
  names: string[];
}

/** The three ISO entities that span more than one AOR (workbook sheet "ISO Split Crosswalk"). They have no AOR of their own. */
export const SPLIT_PARENTS: Record<string, SplitParent> = {
  USA: { iso2: "US", iso3: "USA", name: "United States", names: ["United States", "United States of America", "U.S.", "US", "USA"] },
  UMI: { iso2: "UM", iso3: "UMI", name: "U.S. Minor Outlying Islands", names: ["U.S. Minor Outlying Islands", "United States Minor Outlying Islands", "US Minor Outlying Islands", "UM", "UMI"] },
  ATF: { iso2: "TF", iso3: "ATF", name: "French Southern Territories", names: ["French Southern Territories", "French Southern and Antarctic Lands", "TF", "ATF"] },
};

const slug = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function recordIdOf(row: Pick<DirectoryRow, "iso3" | "name">): string {
  if (row.iso3) return ID_ALIASES[row.iso3] ?? row.iso3;
  return `GEO:${slug(row.name)}`;
}

export const normalizeName = (value: string) =>
  String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

const CONTIGUOUS_STATES = [
  "Alabama", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas",
  "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

function aliasesFor(row: DirectoryRow, id: string): string[] {
  const out = new Set<string>();
  const add = (value: string | null | undefined) => { if (value) out.add(value); };
  add(row.name);
  const tail = row.name.includes(" — ") ? row.name.split(" — ").pop() : null;
  add(tail);
  add(row.name.replace(/\s*\(.*?\)\s*/g, " ").trim());
  add(tail?.replace(/\s*\(.*?\)\s*/g, " ").trim());
  if (row.iso3 && !row.parentIso3) add(row.iso3);
  if (row.iso3 === "XKS") add("XKX");
  // Constituents of the split parents are commonly named without the generic suffix ("Crozet", "Kerguelen", "Wake").
  if (row.parentIso3) add((tail ?? row.name).replace(/\s+(Islands|Island|Atoll|Reef)$/i, "").trim());
  if (row.iso2 && !row.parentIso2) add(row.iso2);
  if (row.name.startsWith("French Southern Territories — Îles Éparses")) {
    for (const part of String(row.note ?? "").replace(/^.*includes\s+/i, "").split(/,\s*|\s+and\s+/)) add(part.replace(/\.$/, "").trim());
  }
  if (id === "GEO:UNITED_STATES_CONTIGUOUS_48_STATES_AND_WASHINGTON_DC") {
    ["Contiguous United States", "Continental United States", "CONUS", "Lower 48", "Washington, DC", "Washington DC", "District of Columbia", ...CONTIGUOUS_STATES.filter((state) => state !== "Georgia")].forEach(add);
  }
  return [...out].filter((value) => normalizeName(value).length >= 2);
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

/** Workbook "Entity category" → registry GeographicClass. The workbook's own label is always kept as `categoryLabel`. */
export function classOfCategory(category: string): GeographicClass {
  const text = category.trim();
  if (text === "Sovereign state" || text === "U.S.-recognized independent state (non-ISO code)") return "sovereign_state";
  if (/^Sovereign state — geographic /.test(text)) return "sovereign_component";
  if (text === "Overseas department/region") return "overseas_department";
  if (text === "Autonomous constituent country") return "autonomous_country";
  if (/^U\.S\. (unincorporated|incorporated) territory$|^U\.S\. territory \/ possession$|^U\.S\. unincorporated island/.test(text)) return "territory";
  if (/^Disputed (island group|non-self-governing territory)$/.test(text)) return "disputed_entity";
  if (/^(Crown dependency|Dependency \/ territory \/ possession|British sovereign base area|Australian external territory|Overseas territory island group|UK overseas territory constituent|French overseas possession|Norwegian Arctic island|Norwegian Arctic archipelago|Autonomous territory)$/.test(text)) return "dependency";
  return "other_entity";
}

const CLASS_RANK: Record<EvidenceClass, number> = { individually_verified: 3, official_aggregate_count: 2, regional_inference: 1, provisional: 0 };

/**
 * One source's claim about which command a location belongs to. A claim carries its own command, authority tier and effective date;
 * its evidence class only describes how well THAT claim identifies the location and travels with the claim, never with another command.
 */
export interface Claim {
  command: CommandId;
  evidenceClass: EvidenceClass;
  tier: AuthorityTier;
  /** ISO date (or year-month) from which the claim is effective, when the source states one. Never inferred. */
  effectiveDate: string | null;
  source: ControllingSource;
  label: string;
  origin: "registry" | "directory" | "repository_evidence";
}

/** Two partial ISO dates are ordered only up to the precision both state ("2025-08" vs "2025-08-19" is not an ordering). */
function compareDates(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  const x = a.slice(0, n);
  const y = b.slice(0, n);
  return x === y ? 0 : x < y ? -1 : 1;
}

/**
 * Which of two claims CONTROLS the geographic assignment. Authority first: the lower tier (Presidential UCP / boundary directive … regional
 * inference) controls. At the same tier the claim with the later effective date controls (amendment / supersession). Evidence class is not
 * consulted: it describes confidence and must never override a controlling directive.
 * Returns <0 when `a` controls, >0 when `b` controls, 0 when control cannot be established (same tier and no orderable effective dates).
 */
export function compareControl(a: Claim, b: Claim): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.effectiveDate && b.effectiveDate) {
    const order = compareDates(a.effectiveDate, b.effectiveDate);
    if (order !== 0) return -order; // the later effective date controls
  }
  return 0;
}

/** Best of several claims FOR THE SAME COMMAND: authority/date first, evidence class only breaks an exact tie. */
function bestSupporter(claims: readonly Claim[]): Claim {
  return claims.reduce((best, claim) => {
    const order = compareControl(claim, best);
    if (order < 0) return claim;
    if (order === 0 && CLASS_RANK[claim.evidenceClass] > CLASS_RANK[best.evidenceClass]) return claim;
    return best;
  });
}

export interface ClaimResolution {
  winner: Claim;
  /** The claim the winning assignment's evidence class is taken from: always a claim for the winning command. */
  evidence: Claim;
  /** Same tier, no orderable effective dates, different commands: control cannot be established, so the incumbent is kept and flagged contested. */
  contested: boolean;
  losers: Claim[];
}

export function resolveClaims(claims: readonly Claim[], incumbent: CommandId | null): ClaimResolution {
  const commands = [...new Set(claims.map((claim) => claim.command))];
  const leads = commands.map((command) => bestSupporter(claims.filter((claim) => claim.command === command)));
  let winner = leads[0];
  let contested = false;
  if (leads.length > 1) {
    const ordered = [...leads].sort((a, b) => compareControl(a, b));
    const top = ordered[0];
    const tied = ordered.slice(1).filter((claim) => compareControl(top, claim) === 0);
    if (tied.length) {
      contested = true;
      const pool = [top, ...tied];
      winner = pool.find((claim) => claim.command === incumbent) ?? top;
    } else winner = top;
  }
  const supporters = claims.filter((claim) => claim.command === winner.command);
  const evidence = bestSupporter(supporters);
  return { winner, evidence, contested, losers: claims.filter((claim) => claim.command !== winner.command) };
}

function workbookClaim(row: DirectoryRow, id: string, command: CommandId): Claim {
  const source = (tier: AuthorityTier): ControllingSource => ({
    authority: `Directory source for ${row.name}`,
    url: row.sourceUrl,
    date: /^\d{4}-\d{2}(-\d{2})?$/.test(row.sourceDate) ? row.sourceDate : null,
    tier,
  });
  const label = `Directory evidence: ${row.evidence}`;
  const make = (evidenceClass: EvidenceClass, tier: AuthorityTier): Claim => ({ command, evidenceClass, tier, effectiveDate: source(tier).date, source: source(tier), label, origin: "directory" });
  switch (row.evidence) {
    case "Direct command confirmation":
      // Greenland: the directory's basis is a formal UCP reassignment (2025-06-17), i.e. tier 2 (a later authorized amendment).
      return id === "GRL" ? make("individually_verified", 2) : make("individually_verified", 4);
    case "Regional command confirmation":
      return make("official_aggregate_count", 4);
    case "Provisional geographic mapping":
    case "Regional mapping; disputed status":
    case "Geographic mapping (not explicit roster)":
      return make("provisional", 6);
    default:
      return make("regional_inference", 6);
  }
}

function registryClaim(base: CountryAorAssignment): Claim {
  const source = (tier: AuthorityTier): ControllingSource => ({ authority: base.sourceAuthority, url: base.sourceUrl, date: base.sourceDate ?? null, tier });
  const label = `Registry evidence: ${base.entityEvidence ?? base.basis}`;
  const effectiveDate = base.effectiveFrom ?? base.sourceDate ?? null;
  const make = (evidenceClass: EvidenceClass, tier: AuthorityTier, text = label): Claim => ({ command: base.command, evidenceClass, tier, effectiveDate, source: source(tier), label: text, origin: "registry" });
  if (base.entityEvidence === "pack_only_not_named_by_command_page") return make("provisional", 6);
  if (base.entityEvidence === "primary_us_government_names_it") return make("individually_verified", 5);
  if (base.entityEvidence === "command_page_names_it") return make("individually_verified", 4);
  if (base.supersedesCommand) return make("individually_verified", 2, "Registry evidence: DoD UCP change");
  if (base.basis === "official_count_normalized_list") return make("official_aggregate_count", 4);
  if (base.basis === "official_list" || base.basis === "official_boundary_statement") return make("individually_verified", 4);
  return make("regional_inference", 6);
}

/**
 * Stronger official evidence already in the repository for locations the workbook only lists by geography or as provisional.
 * Each entry cites the exact material the repository already holds; nothing here is newly researched.
 */
const NORTHCOM_ABOUT_URL = "https://www.northcom.mil/About/About/";
const OVERRIDES: Record<string, Claim> = {
  "GEO:UNITED_STATES_CONTIGUOUS_48_STATES_AND_WASHINGTON_DC": {
    command: "NORTHCOM", origin: "repository_evidence", effectiveDate: null,
    evidenceClass: "individually_verified", tier: 4, label: "NORTHCOM AOR page names the continental United States",
    source: { authority: "USNORTHCOM – About / Area of Responsibility (AOR sentence: \"encompasses the continental United States, Alaska, Canada, Mexico, Greenland\")", url: NORTHCOM_ABOUT_URL, date: null, tier: 4 },
  },
  "GEO:UNITED_STATES_ALASKA": {
    command: "NORTHCOM", origin: "repository_evidence", effectiveDate: null,
    evidenceClass: "individually_verified", tier: 4, label: "NORTHCOM AOR page names Alaska",
    source: { authority: "USNORTHCOM – About / Area of Responsibility (AOR sentence: \"encompasses the continental United States, Alaska, Canada, Mexico, Greenland\")", url: NORTHCOM_ABOUT_URL, date: null, tier: 4 },
  },
  "GEO:GAZA_STRIP": {
    command: "CENTCOM", origin: "repository_evidence", effectiveDate: "2022-03-30",
    evidenceClass: "individually_verified", tier: 5, label: "CRS IF11428 v4 names West Bank & Gaza in the CENTCOM AOR",
    source: { authority: "Congressional Research Service IF11428 v4 – explicitly includes West Bank & Gaza in the CENTCOM AOR", url: CRS_CENTCOM_URL, date: "2022-03-30", tier: 5 },
  },
  "GEO:WEST_BANK": {
    command: "CENTCOM", origin: "repository_evidence", effectiveDate: "2022-03-30",
    evidenceClass: "individually_verified", tier: 5, label: "CRS IF11428 v4 names West Bank & Gaza in the CENTCOM AOR",
    source: { authority: "Congressional Research Service IF11428 v4 – explicitly includes West Bank & Gaza in the CENTCOM AOR", url: CRS_CENTCOM_URL, date: "2022-03-30", tier: 5 },
  },
};

/** Claims the directory or repository records but that do not control the geographic AOR. Kept as provenance. */
const DISPLACED_CLAIMS: Record<string, Array<{ claim: string; source: string; reason: string }>> = {
  MYT: [{
    claim: "A 2014 SOUTHCOM contract clause listed Mayotte.",
    source: "Directory note for Mayotte (the clause itself was not re-opened in this integration)",
    reason: "The directory records it as superseded by a 2021 DoD deviation, with the African geographic AOR controlling. An AFRICOM chikungunya message naming Mayotte for medical measures is not a geographic UCP assignment.",
  }],
  "GEO:UNITED_STATES_ALASKA": [{
    claim: "PACOM may command some assigned Alaska-based forces.",
    source: "Directory note for Alaska",
    reason: "Command of assigned forces is not the geographic AOR. Alaska stays NORTHCOM.",
  }],
  ESH: [{
    claim: "DSCA security-cooperation coding places Western Sahara with AFRICOM.",
    source: "DSCA SAMM (carried in the repository's security-cooperation table)",
    reason: "Security-cooperation coverage is not a formal GCC boundary assignment. The geographic assignment stays provisional.",
  }],
  "GEO:CANARY_ISLANDS": [{
    claim: "Geographic proximity to Africa.",
    source: "Directory note for the Canary Islands",
    reason: "Proximity does not establish an AFRICOM assignment; the directory maps the islands with Spain / EUCOM.",
  }],
  BMU: [{
    claim: "Inclusion in the SOUTHCOM 31-country list.",
    source: "Directory note for Bermuda",
    reason: "Bermuda is not in the SOUTHCOM 31; the directory classifies it with the western North Atlantic (NORTHCOM), a regional mapping.",
  }],
};

const DISPUTED_SOVEREIGNTY = /disputed|claim disputed|no sovereignty determination|Malvinas|administered by UK and claimed|Chagos|no U\.S\. recognition|observer-state/i;

/* ------------------------------------------------------------------ */
/* Integration                                                         */
/* ------------------------------------------------------------------ */

export interface IntegrationDeps {
  commandNames: Record<CommandId, string>;
  /** Hook for the registry to apply a stronger directory source to an existing row (Greenland). */
  rows?: readonly DirectoryRow[];
}

export interface IntegrationReport {
  added: string[];
  enriched: string[];
  /** Registry rows removed because their ISO code is a split parent with no AOR of its own. */
  splitParentsRemoved: string[];
  commandConflicts: Array<{ id: string; registry: CommandId | null; directory: CommandId; applied: CommandId; reason: string }>;
  corrections: Array<{ id: string; name: string; field: "evidence_class" | "command"; from: string; to: string; authority: string }>;
  /** Superseded assignments produced by a dated reassignment found during integration (added to the registry history). */
  history: CountryAorAssignment[];
}

export function integrateDirectory(base: readonly CountryAorAssignment[], deps: IntegrationDeps): { records: CountryAorAssignment[]; report: IntegrationReport } {
  const rows = deps.rows ?? DIRECTORY_ROWS;
  const report: IntegrationReport = { added: [], enriched: [], splitParentsRemoved: [], commandConflicts: [], corrections: [], history: [] };

  const kept = base.filter((entry) => {
    if (SPLIT_PARENTS[entry.iso3]) { report.splitParentsRemoved.push(entry.iso3); return false; }
    return true;
  });
  const byId = new Map(kept.map((entry) => [entry.iso3, entry]));

  // Parent hierarchy: workbook parent columns for the split parents; "Within / Part of ISO xx" notes for composite ISO records.
  const iso3ByIso2 = new Map<string, string>();
  for (const row of rows) if (row.iso2 && row.iso3 && !row.parentIso2) iso3ByIso2.set(row.iso2, recordIdOf(row));
  const parentOf = (row: DirectoryRow) => {
    if (row.parentIso3) return { iso2: row.parentIso2, iso3: row.parentIso3, split: true, composite: false };
    const match = /(?:Within|Part of|Separate part of) ISO ([A-Z]{2})/.exec(row.note ?? "");
    if (match) return { iso2: match[1], iso3: iso3ByIso2.get(match[1]) ?? null, split: false, composite: true };
    return { iso2: null, iso3: null, split: false, composite: false };
  };

  const out: CountryAorAssignment[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const id = recordIdOf(row);
    if (seen.has(id)) throw new Error(`Duplicate directory record id ${id}`);
    seen.add(id);
    const directoryCommand = commandIdFromLabel(row.workbookAor);
    if (!directoryCommand) throw new Error(`Unknown workbook command "${row.workbookAor}" for ${row.name}`);

    const existing = byId.get(id);
    const wb = workbookClaim(row, id, directoryCommand);
    const reg = existing ? registryClaim(existing) : null;
    const override = OVERRIDES[id] ?? null;
    const claims = [reg, override, wb].filter((claim): claim is Claim => claim !== null);

    // Control is decided by authority and effective date first. The evidence class is then taken ONLY from claims for the winning command.
    const decision = resolveClaims(claims, existing ? existing.command : directoryCommand);
    const command = decision.winner.command;
    const evidence = decision.evidence;
    const conflictHistory = [...(DISPLACED_CLAIMS[id] ?? [])];
    const corrections: DirectoryCorrection[] = [];
    const reassigned: CountryAorAssignment[] = [];

    for (const loser of decision.losers) {
      const why = decision.contested
        ? `Same authority tier (${loser.tier}) and no orderable effective dates: control cannot be established, so the existing assignment is kept and flagged contested.`
        : loser.tier !== decision.winner.tier
          ? `Displaced: the winning claim carries the more controlling authority (tier ${decision.winner.tier} over tier ${loser.tier}), whatever the evidence classes.`
          : `Displaced: same authority tier (${loser.tier}); the winning claim has the later effective date (${decision.winner.effectiveDate} over ${loser.effectiveDate}).`;
      conflictHistory.push({ claim: `${loser.command} — ${loser.label}${loser.effectiveDate ? ` (effective ${loser.effectiveDate})` : ""}`, source: loser.source.url, reason: why });
    }
    if (decision.losers.length) {
      const directoryLost = directoryCommand !== command;
      const displaced = decision.losers[0];
      report.commandConflicts.push({
        id, registry: existing?.command ?? null, directory: directoryCommand, applied: command,
        reason: decision.contested ? "contested at the same authority tier with no orderable dates; existing assignment kept" : `${decision.winner.origin} claim controls (tier ${decision.winner.tier}${decision.winner.effectiveDate ? `, effective ${decision.winner.effectiveDate}` : ""})`,
      });
      if (!decision.contested) {
        corrections.push({
          field: "command", from: `${displaced.command} (${displaced.origin})`, to: command,
          controllingSource: decision.winner.source,
          reason: `${decision.winner.label} controls${directoryLost ? ", so the directory's own assignment is corrected" : ""}; the displaced ${displaced.origin} assignment is kept in the conflict history.`,
        });
      }
    }
    // The directory's own weaker evidence for the SAME command is a class correction, not a command one.
    if (wb.command === command && evidence !== wb) {
      corrections.push({
        field: "evidence_class", from: `${wb.evidenceClass} (tier ${wb.tier}; directory label "${row.evidence}")`, to: `${evidence.evidenceClass} (tier ${evidence.tier})`,
        controllingSource: evidence.source,
        reason: `${evidence.label}. The directory labelled this "${row.evidence}"; the stronger source for the same command is applied and the directory claim is kept as provenance.`,
      });
    }

    const parent = parentOf(row);
    const category = classOfCategory(row.category);
    const evidenceClass: EvidenceClass = decision.contested ? "provisional" : evidence.evidenceClass;
    const detail: DirectoryDetail = {
      recordId: id,
      idKind: !row.iso3 ? "synthetic" : row.origin === "ISO 3166-1" ? "iso_3166_1" : "workbook_code",
      iso2: row.iso2,
      workbookCode3: row.iso3,
      parentIso2: parent.iso2,
      parentIso3: parent.iso3,
      splitParent: parent.split,
      compositeParentRecord: parent.composite,
      categoryLabel: row.category,
      administering: row.administering,
      rosterOrigin: row.origin,
      workbookAor: row.workbookAor,
      workbookAlias: row.appAlias,
      workbookBasis: row.basis,
      workbookEvidence: row.evidence,
      workbookSourceDate: row.sourceDate,
      workbookSourceUrl: row.sourceUrl,
      workbookNote: row.note,
      aliases: aliasesFor(row, id),
      evidenceClass,
      authorityTier: evidence.tier,
      provisional: evidenceClass === "provisional",
      contested: decision.contested,
      evidenceBasis: { command: evidence.command, label: evidence.label, origin: evidence.origin, effectiveDate: evidence.effectiveDate, source: evidence.source },
      disputedSovereignty: DISPUTED_SOVEREIGNTY.test(`${row.category} ${row.administering} ${row.note ?? ""}`) || existing?.geographicClass === "disputed_entity",
      corrections,
      conflictHistory,
    };

    // Evidence-bearing fields for a record whose evidence comes from a directory / repository claim (never from a losing claim).
    const fieldsFrom = (claim: Claim, text: string): Pick<CountryAorAssignment, "entityEvidence" | "basis" | "verification" | "sourceAuthority" | "sourceUrl" | "sourceDate" | "sourceCurrencyNote"> => {
      const verified = claim.evidenceClass === "individually_verified";
      const fromDirectory = claim.origin === "directory";
      return {
        entityEvidence: category === "sovereign_state" ? null : verified ? (claim.tier === 5 ? "primary_us_government_names_it" : "command_page_names_it") : "directory_geographic_mapping",
        basis: verified ? "official_boundary_statement" : claim.evidenceClass === "official_aggregate_count" ? "official_count_normalized_list" : "regional_geographic_mapping",
        verification: verified ? "PUBLIC-SOURCE BASELINE" : "PUBLIC-SOURCE BASELINE — LIVE VERIFY",
        sourceAuthority: fromDirectory ? `${deps.commandNames[command]} – ${row.sourceUrl.replace(/^https?:\/\//, "").split("/")[0]} (directory source)` : claim.source.authority,
        sourceUrl: claim.source.url,
        sourceDate: claim.source.date,
        sourceCurrencyNote: text,
      };
    };
    const displacedEvidence = (claim: Claim, note: string) => ({ sourceAuthority: claim.source.authority, sourceUrl: claim.source.url, verification: "PUBLIC-SOURCE BASELINE — LIVE VERIFY" as const, note });

    let record: CountryAorAssignment;
    if (existing) {
      record = { ...existing, command, directory: detail };
      if (evidence.origin !== "registry") {
        // The winning evidence is the directory's or the repository's own: its source, class and dates replace the existing row's evidence fields.
        const carried = [...(existing.previousEvidence ?? [])];
        record = {
          ...record,
          ...fieldsFrom(evidence, `Controlling evidence: ${evidence.label}${evidence.effectiveDate ? `, effective ${evidence.effectiveDate}` : ""}. Directory source date text: "${row.sourceDate}".`),
          previousEvidence: [...carried, { sourceAuthority: existing.sourceAuthority, sourceUrl: existing.sourceUrl, verification: existing.verification, note: command === existing.command ? "Earlier evidence for the same assignment; a more controlling source now applies." : `Displaced ${existing.command} assignment evidence; the ${command} claim controls.` }],
        };
        if (command !== existing.command) {
          record.effectiveFrom = evidence.effectiveDate;
          record.supersedesCommand = existing.command;
          record.note = `${row.evidence} — basis: ${row.basis}.${row.note ? ` ${row.note}` : ""} Replaces the earlier ${existing.command} assignment.`;
          if (evidence.effectiveDate) reassigned.push({ ...existing, effectiveTo: evidence.effectiveDate, supersedesCommand: null, directory: undefined, note: `Superseded by ${command} (effective ${evidence.effectiveDate}) on a more controlling or later source.` });
        }
        if (id === "GRL" && command === "NORTHCOM") {
          record.sourceAuthority = "USNORTHCOM – press release: Greenland now in U.S. Northern Command area of responsibility (formal UCP reassignment)";
          record.effectiveFrom = evidence.effectiveDate;
          record.supersedesCommand = "EUCOM";
          record.sourceCurrencyNote = "Dated controlling source (2025-06-17) per the directory; the previous EUCOM assignment is preserved as history.";
          record.note = `${existing.note ?? ""} Transferred from EUCOM to NORTHCOM on 17 June 2025 (formal UCP reassignment).`.trim();
        }
      }
      if (decision.contested) record = { ...record, verification: "PUBLIC-SOURCE BASELINE — LIVE VERIFY" };
      // Directory evidence for the same command that the stronger source supersedes stays on the record.
      if (wb.command === command && evidence !== wb) record.previousEvidence = [...(record.previousEvidence ?? []), displacedEvidence(wb, `Directory evidence "${row.evidence}" (${row.sourceDate}). Retained; the stronger source above controls.`)];
      report.enriched.push(id);
    } else {
      record = {
        iso3: id,
        name: row.name,
        command,
        entityType: category === "sovereign_state" ? "sovereign" : "entity",
        geographicClass: category,
        classBasis: `Directory category "${row.category}"${row.administering ? `; administering / sovereignty: ${row.administering}` : ""}.`,
        ...fieldsFrom(evidence, `Directory source date text: "${row.sourceDate}".${evidence.origin === "directory" ? "" : " The directory's own evidence is kept in previousEvidence."}`),
        effectiveFrom: null,
        effectiveTo: null,
        supersedesCommand: null,
        note: `${row.evidence} — basis: ${row.basis}.${row.note ? ` ${row.note}` : ""}`.trim(),
        ...(wb.command === command && evidence !== wb ? { previousEvidence: [displacedEvidence(wb, `Directory evidence "${row.evidence}" (${row.sourceDate}). Retained; the stronger source controls.`)] } : {}),
        directory: detail,
      };
      report.added.push(id);
    }
    out.push(record);
    report.history.push(...reassigned);
    for (const c of corrections) report.corrections.push({ id, name: row.name, field: c.field, from: c.from, to: c.to, authority: c.controllingSource.authority });
  }

  // Registry rows the directory does not carry (none expected) are kept, never dropped silently.
  for (const entry of kept) if (!seen.has(entry.iso3) && !seen.has(ID_ALIASES[entry.iso3] ?? entry.iso3)) out.push(entry);

  return { records: out, report };
}

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

export type LocationResolution =
  | { status: "resolved"; record: CountryAorAssignment; via: "id" | "iso3" | "iso2" | "name" | "alias" }
  | { status: "ambiguous_parent"; ambiguity: AmbiguousParent }
  | { status: "not_found" };

export interface LocationIndex {
  byId: Map<string, CountryAorAssignment>;
  byIso2: Map<string, CountryAorAssignment>;
  byName: Map<string, CountryAorAssignment>;
  childrenOfSplit: Map<string, CountryAorAssignment[]>;
  childrenOfComposite: Map<string, CountryAorAssignment[]>;
  /** Alias keys that point at more than one record are dropped (never guessed). */
  droppedAliasCollisions: string[];
}

export function buildLocationIndex(records: readonly CountryAorAssignment[]): LocationIndex {
  const byId = new Map<string, CountryAorAssignment>();
  const byIso2 = new Map<string, CountryAorAssignment>();
  const exactNames = new Map<string, string>();
  const aliasCandidates = new Map<string, Set<string>>();
  const childrenOfSplit = new Map<string, CountryAorAssignment[]>();
  const childrenOfComposite = new Map<string, CountryAorAssignment[]>();
  const dropped: string[] = [];
  for (const record of records) {
    byId.set(record.iso3, record);
    const norm = normalizeName(record.name);
    if (exactNames.has(norm) && exactNames.get(norm) !== record.iso3) dropped.push(norm);
    else exactNames.set(norm, record.iso3);
    const d = record.directory;
    if (!d) continue;
    if (d.workbookCode3 && d.workbookCode3 !== record.iso3) byId.set(d.workbookCode3, record);
    if (d.iso2 && !d.parentIso2) byIso2.set(d.iso2, record);
    for (const alias of d.aliases) {
      const key = normalizeName(alias);
      if (!key) continue;
      const set = aliasCandidates.get(key) ?? new Set<string>();
      set.add(record.iso3);
      aliasCandidates.set(key, set);
    }
    if (d.parentIso3) {
      const map = d.splitParent ? childrenOfSplit : childrenOfComposite;
      map.set(d.parentIso3, [...(map.get(d.parentIso3) ?? []), record]);
    }
  }
  // A record's own name always wins over another record's alias; an alias that points at two records is dropped, never guessed.
  const byName = new Map<string, CountryAorAssignment>();
  for (const [key, id] of exactNames) if (!dropped.includes(key)) byName.set(key, byId.get(id) as CountryAorAssignment);
  for (const [key, ids] of aliasCandidates) {
    if (byName.has(key)) continue;
    if (ids.size === 1) byName.set(key, byId.get([...ids][0]) as CountryAorAssignment);
    else dropped.push(key);
  }
  return { byId, byIso2, byName, childrenOfSplit, childrenOfComposite, droppedAliasCollisions: dropped };
}

/** Everything searchable under a sovereign / administrative parent: split-parent constituents and composite-record children. */
export function locationsUnder(index: LocationIndex, parentIso3: string): CountryAorAssignment[] {
  return [...(index.childrenOfSplit.get(parentIso3) ?? []), ...(index.childrenOfComposite.get(parentIso3) ?? [])];
}

export function ambiguityFor(index: LocationIndex, parentIso3: string): AmbiguousParent | null {
  const parent = SPLIT_PARENTS[parentIso3];
  if (!parent) return null;
  const constituents = (index.childrenOfSplit.get(parentIso3) ?? []).map((record) => ({
    id: record.iso3, name: record.name, command: record.command,
    evidenceClass: (record.directory as DirectoryDetail).evidenceClass, provisional: (record.directory as DirectoryDetail).provisional,
  }));
  const commands = [...new Set(constituents.map((c) => c.command))];
  return {
    parentIso2: parent.iso2,
    parentIso3: parent.iso3,
    parentName: parent.name,
    constituents,
    message: `${parent.name} (${parent.iso2}/${parent.iso3}) is not assigned to one geographic combatant command: its ${constituents.length} constituent locations map to ${commands.join(" and ")}. Supply a specific constituent location (for example ${constituents.slice(0, 3).map((c) => c.name).join(", ")}) instead of the parent.`,
  };
}

export function lookupLocation(index: LocationIndex, query: string): LocationResolution {
  const raw = String(query ?? "").trim();
  if (!raw) return { status: "not_found" };
  const upper = raw.toUpperCase();
  const split = Object.values(SPLIT_PARENTS).find((p) => p.iso3 === upper || p.iso2 === upper || p.names.some((n) => normalizeName(n) === normalizeName(raw)));
  if (split) {
    const ambiguity = ambiguityFor(index, split.iso3);
    if (ambiguity) return { status: "ambiguous_parent", ambiguity };
  }
  const id = ID_ALIASES[upper] ?? upper;
  const byId = index.byId.get(id) ?? index.byId.get(raw);
  if (byId) return { status: "resolved", record: byId, via: /^[A-Z]{3}$/.test(upper) ? "iso3" : "id" };
  if (/^[A-Z]{2}$/.test(upper)) { const hit = index.byIso2.get(upper); if (hit) return { status: "resolved", record: hit, via: "iso2" }; }
  const named = index.byName.get(normalizeName(raw));
  if (named) return { status: "resolved", record: named, via: normalizeName(named.name) === normalizeName(raw) ? "name" : "alias" };
  return { status: "not_found" };
}

/* ------------------------------------------------------------------ */
/* Counts                                                              */
/* ------------------------------------------------------------------ */

export interface DirectoryCounts {
  geographicRecordsMapped: number;
  individuallyVerified: number;
  officialAggregateCount: number;
  regionalInference: number;
  provisional: number;
  /**
   * Everything that is NOT individually verified: official aggregate counts + regional inference + provisional. This, not the provisional
   * subset below, is the outstanding individual-verification gap.
   */
  notIndividuallyVerified: number;
  outstandingIndividualVerification: { total: number; official_aggregate_count: number; regional_inference: number; provisional: number };
  /** ONLY the provisional / contested subset: records whose current primary assignment is unsupported by an authoritative source or genuinely contested. */
  unresolvedAuthoritative: Array<{ id: string; name: string; command: CommandId; reason: string }>;
  byEvidenceClassPerCommand: Record<CommandId, Record<EvidenceClass, number>>;
  splitParents: Array<{ iso3: string; name: string; constituents: number; commands: CommandId[] }>;
  corrections: Array<{ id: string; name: string; field: string; from: string; to: string; authority: string }>;
}

export function directoryCounts(records: readonly CountryAorAssignment[]): DirectoryCounts {
  const withDirectory = records.filter((record) => record.directory);
  const tally = (cls: EvidenceClass) => withDirectory.filter((record) => (record.directory as DirectoryDetail).evidenceClass === cls).length;
  const perCommand = {} as DirectoryCounts["byEvidenceClassPerCommand"];
  for (const command of ["CENTCOM", "AFRICOM", "EUCOM", "INDOPACOM", "SOUTHCOM", "NORTHCOM"] as CommandId[]) {
    perCommand[command] = { individually_verified: 0, official_aggregate_count: 0, regional_inference: 0, provisional: 0 };
  }
  for (const record of withDirectory) perCommand[record.command][(record.directory as DirectoryDetail).evidenceClass] += 1;
  const index = buildLocationIndex(records);
  return {
    geographicRecordsMapped: withDirectory.length,
    individuallyVerified: tally("individually_verified"),
    officialAggregateCount: tally("official_aggregate_count"),
    regionalInference: tally("regional_inference"),
    provisional: tally("provisional"),
    notIndividuallyVerified: withDirectory.length - tally("individually_verified"),
    outstandingIndividualVerification: {
      total: withDirectory.length - tally("individually_verified"),
      official_aggregate_count: tally("official_aggregate_count"),
      regional_inference: tally("regional_inference"),
      provisional: tally("provisional"),
    },
    unresolvedAuthoritative: withDirectory.filter((record) => (record.directory as DirectoryDetail).provisional).map((record) => ({
      id: record.iso3, name: record.name, command: record.command,
      reason: (record.directory as DirectoryDetail).disputedSovereignty ? "Provisional geographic mapping on a location with disputed or unsettled status; no controlling source names the assignment." : "Provisional geographic mapping; no controlling source names the assignment.",
    })),
    byEvidenceClassPerCommand: perCommand,
    splitParents: Object.values(SPLIT_PARENTS).map((parent) => {
      const children = index.childrenOfSplit.get(parent.iso3) ?? [];
      return { iso3: parent.iso3, name: parent.name, constituents: children.length, commands: [...new Set(children.map((child) => child.command))].sort() as CommandId[] };
    }),
    corrections: withDirectory.flatMap((record) => (record.directory as DirectoryDetail).corrections.map((c) => ({
      id: record.iso3, name: record.name, field: c.field, from: c.from, to: c.to, authority: c.controllingSource.authority,
    }))),
  };
}

export { CROSSWALK_ROWS };
