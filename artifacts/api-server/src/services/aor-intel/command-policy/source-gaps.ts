// Ledger of command-policy source gaps. A gap is RESOLVED only when the original source was read and the rule data now
// carries the detail; OPEN_LIVE_VERIFY means the pack marked it and a read was attempted but did not yield the data;
// OPEN_DEFERRED means the field exists in the source, the pack did not extract it, and no feature needs it yet.

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
}

const ATTEMPT = "2026-10-08";

export const SOURCE_GAP_LEDGER: SourceGapEntry[] = [
  {
    id: "eucom-country-list", command: "EUCOM", item: "EUCOM country list (membership)", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.eucom.mil/commander", "https://www.eucom.mil/document/42003/sasc-29-mar-", "https://www.eucom.mil/staff-resources/eucom-theatre-medical-clearance-information", "https://www.eucom.mil/about-the-command"],
    outcome: "The count is resolved: the current EUCOM commander page says \"U.S. defense operations and relations with NATO and 50 countries\" (the page is undated), so 50 is the official count. The page names no country. The posture-statement URL could not be fetched, and the Theatre Medical Clearance and About pages list no countries. The membership therefore rests on the pack's normalization of the count and stays LIVE VERIFY.",
    ruleIds: [], remaining: ["official one-page enumeration of the EUCOM AOR membership", "whether the 50 includes places such as Kosovo, Liechtenstein, Monaco, San Marino, Vatican City"],
  },
  {
    id: "indopacom-country-list", command: "INDOPACOM", item: "INDOPACOM country list (membership)", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", "https://keystone.ndu.edu/Portals/86/Keystone%2026-2%20INDOPACOM%20Brief%202026.pdf", "https://www.pacom.mil/About-USINDOPACOM/", "https://www.pacom.mil/Resources/Travel-Requirements/"],
    outcome: "The count is resolved to 36: the command fact sheet (undated, former USPACOM name) says '36 countries' and the Keystone INDOPACOM brief dated 11 June 2026 says '36 countries'. The About page's '38 nations comprising the Asia-Pacific region' is retained as a source conflict, not used as the count. Neither source lists the countries, so the membership stays LIVE VERIFY.",
    ruleIds: [], remaining: ["official one-page enumeration of the INDOPACOM AOR membership"],
  },
  {
    id: "indopacom-message-date", command: "INDOPACOM", item: "GENADMIN P-25-0295 message / document date", status: "OPEN_LIVE_VERIFY", attemptedAt: ATTEMPT,
    sources: ["https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D", "https://www.pacom.mil/Resources/Travel-Requirements/"],
    outcome: "The PDF could not be fetched. The Travel Requirements page carries no message date; its only date, 'as of December 8, 2023', belongs to the page's general travel procedures and is not used as the GENADMIN date. The date stays null.",
    ruleIds: ["ip:order"], remaining: ["message DTG / issue date", "populations", "stay-duration thresholds", "immunization requirements"],
  },
  {
    id: "southcom-dependencies", command: "SOUTHCOM", item: "SOUTHCOM's 12 dependencies and areas of special sovereignty", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.southcom.mil/About/Area-of-Responsibility/", "https://www.southcom.mil/About/", "https://www.state.gov/dependencies-and-areas-of-special-sovereignty/", "https://www.southcom.mil/Portals/7/Documents/Posture%20Statements/SOUTHCOM_POSTURE_STATEMENT_FINAL_2016.pdf?ver=2017-01-04-094258-267"],
    outcome: "SOUTHCOM officially states '31 countries and 12 dependencies and areas of special sovereignty' (officialCurrentCountryCount 31, officialCurrentDependencyOrSpecialAreaCount 12) but names none of the 12 on its AOR or About pages; verifiedNamedDependencyCount is 0. The State Department fact sheet lists places by sovereignty and assigns none to a command. No SOUTHCOM entity is recorded as an assignment. The earlier inferred set was removed from the registry; twelve plausible places are held in candidate-entities.ts as candidate_unverified / LIVE VERIFY and are never returned as an assignment. Source conflict retained as historical evidence: the 10 March 2016 posture statement (Adm. Tidd) says '31 nations and 16 areas of special sovereignty'; it is older, is not the current count, and also names no place.",
    ruleIds: [], remaining: ["an official SOUTHCOM enumeration naming the 12 places", "whether the 2016 figure of 16 reflects a changed scope or a different counting basis"],
  },
  {
    id: "northcom-entities", command: "NORTHCOM", item: "NORTHCOM territories and dependencies", status: "RESOLVED", attemptedAt: "2026-10-10",
    sources: ["https://www.northcom.mil/About/About/"],
    outcome: "The official AOR sentence names Greenland, Puerto Rico and the U.S. Virgin Islands (plus The Bahamas, a sovereign state) and 'portions of the Caribbean region'. Bermuda, Turks and Caicos, the British Virgin Islands and the Cayman Islands are not mentioned, so none is assigned. The page does not classify the three places; classes are recorded with their basis.",
    ruleIds: [], remaining: ["which other Caribbean places fall under 'portions of the Caribbean region'"],
  },
  {
    id: "centcom-africom-entities", command: "CENTCOM", item: "CENTCOM and AFRICOM named territories", status: "RESOLVED", attemptedAt: "2026-10-10",
    sources: ["https://www.centcom.mil/AREA-OF-RESPONSIBILITY/", "https://www.africom.mil/about-the-command"],
    outcome: "Neither official page names a territory or dependency (CENTCOM: 21 nations; AFRICOM: 53 African states). The Palestinian Territories and Western Sahara records come from the extraction pack only and are flagged as such.",
    ruleIds: [], remaining: ["an official source naming the Palestinian Territories (CENTCOM) or Western Sahara (AFRICOM)"],
  },
  {
    id: "eucom-indopacom-entities", command: "INDOPACOM", item: "EUCOM and INDOPACOM named territories", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.pacom.mil/Portals/55/Documents/pdf/USPACOM%20FACT%20SHEET%20v3.pdf", "https://keystone.ndu.edu/Portals/86/Keystone%2026-2%20INDOPACOM%20Brief%202026.pdf", "https://www.eucom.mil/commander"],
    outcome: "INDOPACOM: the command fact sheet names Guam, American Samoa and the Commonwealth of the Northern Mariana Islands as U.S. territories in the AOR (\"Other U.S. territories in the AOR include …\", not an exhaustive list), and the 11 June 2026 Keystone brief lists the same three. These are recorded as territories with the source age stated: the fact sheet is undated and carries the former USPACOM name. Taiwan comes from the extraction pack only. EUCOM: no retrievable page names any territory, so EUCOM entity coverage cannot be confirmed or ruled out.",
    ruleIds: [], remaining: ["whether INDOPACOM names further territories beyond the three", "an official INDOPACOM source naming Taiwan", "a EUCOM AOR description naming any territory"],
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
    resolved: SOURCE_GAP_LEDGER.filter((entry) => entry.status === "RESOLVED").map((entry) => entry.id),
    openLiveVerify: SOURCE_GAP_LEDGER.filter((entry) => entry.status === "OPEN_LIVE_VERIFY").map((entry) => entry.id),
    deferred: { rules: deferred.length, fields: deferred.reduce((total, entry) => total + entry.gaps.length, 0), byCommand },
    restrictedMaterial: "Several command documents reference CAC-only or intranet resources. Inaccessible subordinate material is recorded as restricted/unavailable, not as evidence that no rule exists.",
  };
}
