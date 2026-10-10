// Ledger of command-policy source gaps. A gap is RESOLVED only when the original source was read and the rule data now
// carries the detail; OPEN_LIVE_VERIFY means the pack marked it and a read was attempted but did not yield the data;
// OPEN_DEFERRED means the field exists in the source, the pack did not extract it, and no feature needs it yet.

import { RESEARCHED_MEDICAL_RULES } from "./researched-medical-rules";
import { RESEARCH_EVIDENCE } from "./verified-research";
import type { CommandId } from "./types";
import { COMMAND_RULES, COMMAND_POLICIES } from "./policies-data";

export type GapStatus = "RESOLVED" | "OPEN_LIVE_VERIFY" | "OPEN_DEFERRED";

export interface SourceGapEntry {
  id: string;
  command: CommandId;
  item: string;
  status: GapStatus;
  attemptedAt: string | null;
  sources: string[];
  outcome: string;
  /** Rule ids that now carry the resolved detail. */
  ruleIds: string[];
  /** What is still not known after the attempt. */
  remaining: string[];
  previousOutcome?: string;
}

const ATTEMPT = "2026-10-08";

export const SOURCE_GAP_LEDGER: SourceGapEntry[] = [
  {
    id: "indopacom-fy26-content", command: "INDOPACOM", item: "FY26 detailed medical standards and current compatibility", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D"],
    outcome: "Indexed message header supplies issue date; direct PDF fetch 403 prevents full-text verification. USARPAC March 2025 component handbook is publicly accessible and integrated as advisory component summaries, with FY25 reference, source conflicts and no invented FY26 supersession.",
    ruleIds: RESEARCHED_MEDICAL_RULES.map(rule => rule.id), remaining: ["FY26 populations, exact duration triggers, immunizations, conditions, and supersession wording", "direct current USFK supplements", "USARPAC 3-3(b) vaccine-product/disease inconsistency"],
  },
  {
    id: "africom-2026-forms", command: "AFRICOM", item: "September 2026 screening and counseling publication versions", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.africom.mil/media-gallery/documents", "https://www.africom.mil/staff-resources/theater-medical-clearance"],
    outcome: "Command public page names AC Form 42/43 and component contacts, now integrated. Library lists September 18 screening and counseling documents alongside June forms. Posting date is not proof of effective date or replacement; no version overwritten.",
    ruleIds: ["af:forms-routing"], remaining: ["September form contents, version dates and explicit supersession"],
  },

  {
    id: "eucom-country-list", command: "EUCOM", item: "EUCOM country list (membership)", status: "RESOLVED", attemptedAt: "2026-10-10",
    sources: ["https://www.eucom.mil/about/the-region", "https://www.eucom.mil/commander", "https://www.eucom.mil/document/42003/sasc-29-mar-", "https://www.eucom.mil/staff-resources/eucom-theatre-medical-clearance-information", "https://www.eucom.mil/about-the-command"],
    previousOutcome: "The count is resolved: the current EUCOM commander page says \"U.S. defense operations and relations with NATO and 50 countries\" (the page is undated), so 50 is the official count. The page names no country. The posture-statement URL could not be fetched, and the Theatre Medical Clearance and About pages list no countries. The membership therefore rests on the pack's normalization of the count and stays LIVE VERIFY.",
    outcome: "USEUCOM The Region names all 50 countries in nine geographic groups. Every name is matched to the existing ISO3 registry; NATO tab excluded as overlapping membership. Retrieved indexed primary text 2026-10-10; direct fetch 403. No publication date supplied. Source enumeration is stored independently in verified-research.ts.",
    ruleIds: [], remaining: [],
  },
  {
    id: "indopacom-country-list", command: "INDOPACOM", item: "INDOPACOM country list (membership)", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://samm.dsca.mil/table/table-c4t2a", "https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", "https://keystone.ndu.edu/Portals/86/Keystone%2026-2%20INDOPACOM%20Brief%202026.pdf", "https://www.pacom.mil/About-USINDOPACOM/", "https://www.pacom.mil/Resources/Travel-Requirements/"],
    previousOutcome: "The count is resolved to 36: the command fact sheet (undated, former USPACOM name) says '36 countries' and the Keystone INDOPACOM brief dated 11 June 2026 says '36 countries'. The About page's '38 nations comprising the Asia-Pacific region' is retained as a source conflict, not used as the count. Neither source lists the countries, so the membership stays LIVE VERIFY.",
    outcome: "Current 36-country public count retained. DSCA C4.T2A supplies individually named Pacific CMD security-cooperation rows including Taiwan, Cook Islands, Niue and other entities, but it is not an exact geographic 36-country enumeration. No replacement list constructed from those codes or count matching. Baseline stays LIVE VERIFY.",
    ruleIds: [], remaining: ["exact current command-published 36-country enumeration and its counting basis"],
  },
  {
    id: "indopacom-message-date", command: "INDOPACOM", item: "GENADMIN P-25-0295 message / document date", status: "RESOLVED", attemptedAt: "2026-10-10",
    sources: ["https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D", "https://www.pacom.mil/Resources/Travel-Requirements/"],
    previousOutcome: "The PDF could not be fetched. The Travel Requirements page carries no message date; its only date, 'as of December 8, 2023', belongs to the page's general travel procedures and is not used as the GENADMIN date. The date stays null.",
    outcome: "Official FY26 PDF indexed page 1 gives DTG 070905Z Nov 25 (2025-11-07). Issue date integrated. Direct PDF download remains HTTP 403, so issue date is not used as an effective date; deeper content has a separate open gap.",
    ruleIds: ["ip:order"], remaining: [],
  },
  {
    id: "southcom-dependencies", command: "SOUTHCOM", item: "SOUTHCOM's 12 dependencies and areas of special sovereignty", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://samm.dsca.mil/table/table-c4t2a", "https://www.southcom.mil/About/Area-of-Responsibility/", "https://www.southcom.mil/About/", "https://www.state.gov/dependencies-and-areas-of-special-sovereignty/", "https://www.southcom.mil/Portals/7/Documents/Posture%20Statements/SOUTHCOM_POSTURE_STATEMENT_FINAL_2016.pdf?ver=2017-01-04-094258-267"],
    previousOutcome: "SOUTHCOM officially states '31 countries and 12 dependencies and areas of special sovereignty' (officialCurrentCountryCount 31, officialCurrentDependencyOrSpecialAreaCount 12) but names none of the 12 on its AOR or About pages; verifiedNamedDependencyCount is 0. The State Department fact sheet lists places by sovereignty and assigns none to a command. No SOUTHCOM entity is recorded as an assignment. The earlier inferred set was removed from the registry; twelve plausible places are held in candidate-entities.ts as candidate_unverified / LIVE VERIFY and are never returned as an assignment. Source conflict retained as historical evidence: the 10 March 2016 posture statement (Adm. Tidd) says '31 nations and 16 areas of special sovereignty'; it is older, is not the current count, and also names no place.",
    outcome: "Current SOUTHCOM page still declares 31 countries and 12 dependencies/areas without naming the 12. DSCA C4.T2A individually names territory command codes, but it is a security-cooperation customer table and includes historical entities; no coincidentally matching subset is treated as a geographic enumeration. Conflicts retained: Cuba NO in DSCA versus SOUTHCOM geographic listing; British Virgin Islands and Turks and Caicos NO in DSCA; older SOUTHCOM 16 remains historical. Candidates stay outside assignments.",
    ruleIds: [], remaining: ["official SOUTHCOM geographic enumeration of the 12 areas", "basis for older count 16 versus current 12"],
  },
  {
    id: "northcom-entities", command: "NORTHCOM", item: "NORTHCOM territories and dependencies", status: "RESOLVED", attemptedAt: "2026-10-10",
    sources: ["https://www.northcom.mil/About/About/"],
    outcome: "The official AOR sentence names Greenland, Puerto Rico and the U.S. Virgin Islands (plus The Bahamas, a sovereign state) and 'portions of the Caribbean region'. Bermuda, Turks and Caicos, the British Virgin Islands and the Cayman Islands are not mentioned, so none is assigned. The page does not classify the three places; classes are recorded with their basis.",
    ruleIds: [], remaining: ["which other Caribbean places fall under 'portions of the Caribbean region'"],
  },
  {
    id: "centcom-africom-entities", command: "CENTCOM", item: "CENTCOM and AFRICOM named territories", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://samm.dsca.mil/table/table-c4t2a", "https://www.congress.gov/crs_external_products/IF/PDF/IF11428/IF11428.4.pdf", "https://www.centcom.mil/AREA-OF-RESPONSIBILITY/", "https://www.africom.mil/about-the-command"],
    previousOutcome: "Neither official page names a territory or dependency (CENTCOM: 21 nations; AFRICOM: 53 African states). The Palestinian Territories and Western Sahara records come from the extraction pack only and are flagged as such.",
    outcome: "CRS IF11428 v4, 30 March 2022 explicitly includes West Bank & Gaza in CENTCOM AOR; PSE geographic treatment resolved with dated provenance. Current DSCA SAMM C4.T2A explicitly codes Western Sahara AF for security cooperation, which is captured separately. No primary current geographic AOR statement naming Western Sahara located; retain the pack's geographic mapping as provisional LIVE VERIFY.",
    ruleIds: [], remaining: ["current geographic AOR treatment for Western Sahara; security cooperation is verified but is not equivalent"],
  },
  {
    id: "eucom-indopacom-entities", command: "INDOPACOM", item: "EUCOM and INDOPACOM named territories", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://samm.dsca.mil/table/table-c4t2a", "https://www.congress.gov/crs_external_products/IF/PDF/IF12604/IF12604.2.pdf", "https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", "https://keystone.ndu.edu/Portals/86/Keystone%2026-2%20INDOPACOM%20Brief%202026.pdf", "https://www.eucom.mil/commander"],
    previousOutcome: "INDOPACOM: the command fact sheet names Guam, American Samoa and the Commonwealth of the Northern Mariana Islands as U.S. territories in the AOR (\"Other U.S. territories in the AOR include …\", not an exhaustive list), and the 11 June 2026 Keystone brief lists the same three. These are recorded as territories with the source age stated: the fact sheet is undated and carries the former USPACOM name. Taiwan comes from the extraction pack only. EUCOM: no retrievable page names any territory, so EUCOM entity coverage cannot be confirmed or ruled out.",
    outcome: "CRS IF12604 v2 (5 March 2024) explicitly includes Taiwan under Focal Points in the INDOPACOM AOR; Taiwan treatment resolved with dated provenance, without claiming inclusion/exclusion in 36. Previously verified Guam, American Samoa and Northern Mariana Islands retained. DSCA explicitly codes additional Pacific entities, stored as security cooperation only, not geographic assignments. EUCOM country enumeration does not enumerate territories.",
    ruleIds: [], remaining: ["exact exhaustive current INDOPACOM geographic entity list", "EUCOM territory completeness"],
  },
  {
    id: "centcom-immunization-detail", command: "CENTCOM", item: "MOD 18 per-agent immunization / chemoprophylaxis detail", status: "RESOLVED", attemptedAt: ATTEMPT,
    sources: ["https://www.centcom.mil/Portals/6/MEDICAL/MOD18FINALV2.pdf"],
    outcome: "MOD 18 paras 9 and 14 were read: Tdap/Td, varicella, MMR, polio (plus Afghanistan/Pakistan booster), influenza, hepatitis A and B, typhoid, COVID-19 (host-nation definition), smallpox (withdrawn 2014), oral cholera, anthrax (15+ days, non-waivable by CENTCOM), rabies (groups, SOF, Pakistan), malaria agents and regimen, and the religious-accommodation and waiver process. The source states mandatory vaccines apply for any period in theater, so these rules carry no >30-day trigger.",
    ruleIds: COMMAND_RULES.filter((rule) => rule.id.startsWith("cc:imm:") || rule.id === "cc:waiver-process" || rule.id === "cc:waiver-religious").map((rule) => rule.id),
    remaining: ["anthrax dose schedule (referenced documents not in the text read)", "rabies pre-exposure series schedule", "influenza season window", "malaria-risk country list and seasons beyond Afghanistan, Pakistan and Yemen", "Tab C form contents"],
  },
  {
    id: "africom-yellow-fever-scope", command: "AFRICOM", item: "AFRICOM Yellow Fever theater requirement — country scope", status: "RESOLVED", attemptedAt: ATTEMPT,
    sources: ["https://www.africom.mil/document/36281/yellow-fever-vaccination-requirements-for-the-usafricom-theater"],
    outcome: "GENADMIN DTG 140953Z Jun 24 was read: single lifetime YF-VAX dose, at least 10 days before arrival, for all DoD personnel; every USAFRICOM AOR country is covered except Comoros, Morocco and Tunisia (exempt only without a layover in a yellow fever endemic country).",
    ruleIds: ["af:supplement:yellow-fever"], remaining: ["the message does not list the AOR countries; scope is 'all other countries in the AOR' and follows the AFRICOM registry"],
  },
];

/** Rule-level SOURCE_GAP fields still open, grouped by command. These are deferred, not attempted. */
export function deferredRuleGaps(): Array<{ command: CommandId; ruleId: string; gaps: string[] }> {
  const policyCommand = new Map(COMMAND_POLICIES.map((policy) => [policy.policyId, policy.command]));
  return COMMAND_RULES.filter((rule) => rule.sourceGaps.length).map((rule) => ({ command: policyCommand.get(rule.policyId) as CommandId, ruleId: rule.id, gaps: rule.sourceGaps }));
}

export function gapSummary() {
  const deferred = deferredRuleGaps();
  const byCommand: Record<string, { ruleGapRules: number; ruleGapFields: number }> = {};
  for (const entry of deferred) {
    const row = (byCommand[entry.command] ??= { ruleGapRules: 0, ruleGapFields: 0 });
    row.ruleGapRules += 1;
    row.ruleGapFields += entry.gaps.length;
  }
  return {
    ledger: SOURCE_GAP_LEDGER,
    researchEvidence: RESEARCH_EVIDENCE,
    resolved: SOURCE_GAP_LEDGER.filter((entry) => entry.status === "RESOLVED").map((entry) => entry.id),
    openLiveVerify: SOURCE_GAP_LEDGER.filter((entry) => entry.status === "OPEN_LIVE_VERIFY").map((entry) => entry.id),
    deferred: { rules: deferred.length, fields: deferred.reduce((total, entry) => total + entry.gaps.length, 0), byCommand },
    restrictedMaterial: "Several command documents reference CAC-only or intranet resources. Inaccessible subordinate material is recorded as restricted/unavailable, not as evidence that no rule exists.",
  };
}
