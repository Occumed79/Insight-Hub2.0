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
    id: "eucom-country-list", command: "EUCOM", item: "Current EUCOM country list", status: "OPEN_LIVE_VERIFY", attemptedAt: ATTEMPT,
    sources: ["https://www.eucom.mil/document/42003/sasc-29-mar-", "https://www.eucom.mil/staff-resources/eucom-theatre-medical-clearance-information", "https://www.eucom.mil/about-the-command"],
    outcome: "The posture-statement URL could not be fetched. The Theatre Medical Clearance page and the About page state no country count and list no countries. The 50-country baseline therefore rests only on the pack's normalization of the public count.",
    ruleIds: [], remaining: ["official one-page enumeration of the EUCOM AOR", "whether the 50 count includes territories such as Kosovo, Liechtenstein, Monaco, San Marino, Vatican City"],
  },
  {
    id: "indopacom-country-list", command: "INDOPACOM", item: "Current INDOPACOM country list", status: "OPEN_LIVE_VERIFY", attemptedAt: ATTEMPT,
    sources: ["https://www.pacom.mil/About-USINDOPACOM/USPACOM-Area-of-Responsibility/", "https://www.pacom.mil/Leadership/Article/2590636/commander-us-pacific-command/", "https://www.pacom.mil/Resources/Travel-Requirements/"],
    outcome: "The AOR page and the 36-nation article could not be fetched. The Travel Requirements page lists no countries. The INDOPACOM About page (read 2026-10-10) lists no countries and states '38 nations comprising the Asia-Pacific region', a regional phrase that differs from the pack's 36-nation command count and was not reconciled. The 36-nation baseline rests only on the pack's normalization of the public count.",
    ruleIds: [], remaining: ["official one-page enumeration of the INDOPACOM AOR"],
  },
  {
    id: "indopacom-message-date", command: "INDOPACOM", item: "GENADMIN P-25-0295 message / document date", status: "OPEN_LIVE_VERIFY", attemptedAt: ATTEMPT,
    sources: ["https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D", "https://www.pacom.mil/Resources/Travel-Requirements/"],
    outcome: "The PDF could not be fetched. The Travel Requirements page carries no message date; its only date, 'as of December 8, 2023', belongs to the page's general travel procedures and is not used as the GENADMIN date. The date stays null.",
    ruleIds: ["ip:order"], remaining: ["message DTG / issue date", "populations", "stay-duration thresholds", "immunization requirements"],
  },
  {
    id: "southcom-dependencies", command: "SOUTHCOM", item: "SOUTHCOM's 12 dependencies and areas of special sovereignty", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.southcom.mil/About/Area-of-Responsibility/", "https://www.southcom.mil/About/", "https://www.state.gov/dependencies-and-areas-of-special-sovereignty/"],
    outcome: "SOUTHCOM states '31 countries and 12 dependencies and areas of special sovereignty' but names none of the 12 on its AOR or About pages. The State Department fact sheet the page links lists places by sovereignty and does not assign any to a command. No SOUTHCOM entity is recorded, because naming them would be an inference, not an official assignment. For information only: the fact sheet's non-U.S. Caribbean and South Atlantic entries (Anguilla, Aruba, British Virgin Islands, Cayman Islands, Curaçao, Falkland Islands, French Guiana, Montserrat, Saint Barthélemy, Saint Martin, Sint Maarten, Turks and Caicos Islands) happen to total 12, but that is not an official enumeration and is not used.",
    ruleIds: [], remaining: ["an official SOUTHCOM enumeration of the 12 places", "which sovereign state each belongs to"],
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
    id: "eucom-indopacom-entities", command: "EUCOM", item: "EUCOM and INDOPACOM named territories", status: "OPEN_LIVE_VERIFY", attemptedAt: "2026-10-10",
    sources: ["https://www.eucom.mil/about", "https://www.pacom.mil/About-USINDOPACOM/"],
    outcome: "No retrievable EUCOM page describes the AOR. The INDOPACOM About page names no territory (only Hawaii and Alaska as U.S. states). The Taiwan record comes from the extraction pack only. Entity coverage for both commands cannot be confirmed or ruled out.",
    ruleIds: [], remaining: ["EUCOM AOR description", "official INDOPACOM naming of territories such as Taiwan"],
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
