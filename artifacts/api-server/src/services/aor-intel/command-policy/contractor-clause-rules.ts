// SOUTHCOM contractor requirements carried by a DoD class deviation, not by a SOUTHCOM instruction. The class deviation was
// issued at the SOUTHCOM Commander's request and points to SC Reg 40-501 as the operative medical standard. These rules apply
// only where the clause is in the contract, so each carries an applicability condition and stays conditional.
import type { CommandPolicyRule } from "./types";

export const SC_CLASS_DEVIATION_URL = "https://www.southcom.mil/Portals/7/Documents/Operational%20Contract%20Support/Official%20Class%20Deviation%20USA004118-14-DPAP.pdf";
export const SC_CLASS_DEVIATION_ID = "DPAP-CLASS-DEVIATION-2014-00016";
const AUTHORITY = "OUSD(AT&L) Defense Procurement and Acquisition Policy — class deviation 2014-00016 (OARS tracking), issued at the USSOUTHCOM Commander's request";
const CAVEATS = [
  "DoD acquisition class deviation, not a SOUTHCOM instruction. Dated 6 October 2014; the memo states it remains in effect until incorporated in the OFARS or otherwise rescinded. Whether it has since been incorporated or rescinded was not checked.",
  "Applies only to contracts that contain the clause (performance in the USSOUTHCOM AOR, unless DFARS 252.225-7040 applies). It does not create a requirement for military or DoD civilian personnel.",
  "SC Reg 40-501 and SOUTHCOM Force Health Protection guidance remain the operative medical standards it points to; this rule does not restate them.",
];
const CONDITIONS = ["whether the contract contains the USSOUTHCOM AOR contractor-personnel clause (class deviation 2014-00016), rather than DFARS 252.225-7040"];

function clause(id: string, domain: CommandPolicyRule["domain"], title: string, section: string, text: string, extra: Partial<CommandPolicyRule> = {}): CommandPolicyRule {
  return {
    id: `sc:dpap:${id}`, policyId: "SOUTHCOM-REG-40-501", sourceDocumentId: SC_CLASS_DEVIATION_ID, issuingAuthority: AUTHORITY, lastRetrievedAt: "2026-10-11",
    domain, title, kind: "requirement", scope: { level: "command", component: null, countries: [] },
    applicabilityPopulation: ["dod_contractor", "tcn"], populationText: "Contractor personnel performing in the USSOUTHCOM AOR: U.S. citizens and third-country nationals", directedPopulations: [],
    minimumStay: null, pcsOnly: false, contingencyOnly: false, exemptCountries: [], exemptionCondition: null, maximumStayDaysExclusive: null,
    conditionOrRequirement: text, thresholdOrRule: null, status: null, waiverAuthority: null, requiredEvaluation: null, requiredDocumentation: null, medicationOrEquipmentRule: null, immunizationOrProphylaxisRule: null,
    sourceSection: `Class deviation clause, ${section}`, sourceUrl: SC_CLASS_DEVIATION_URL, sourceDate: "2014-10-06", verificationStatus: "COMMAND PUBLICATION (PRIMARY-SOURCE VERIFIED)",
    sourceGaps: ["whether the class deviation was later incorporated into the OFARS or rescinded", "clause text outside the paragraphs read"], caveats: CAVEATS, applicabilityConditions: CONDITIONS, ...extra,
  };
}

export const SOUTHCOM_CLASS_DEVIATION_RULES: CommandPolicyRule[] = [
  clause("fitness-screening", "fitness", "Contractor personnel: medical, dental and psychological fitness and SC Reg 40-501 screening", "(d)(2)",
    "Contractor personnel must be medically, dentally and psychologically fit for performance of their contracted duties. U.S. citizen and third-country-national personnel must meet the medical screening requirements in SC Regulation 40-501 and the Force Health Protection guidance for deployment.",
    { requiredEvaluation: "Medical suitability screening under SC Reg 40-501 and the SOUTHCOM Force Health Protection guidance" }),
  clause("immunization-and-icv", "documentation", "Contractor personnel: immunizations before travel and PHS Form 791", "(d)(2)",
    "All immunizations must be obtained before traveling to the USSOUTHCOM AOR. Personnel traveling from outside the AOR must carry a current PHS Form 791, International Certificate of Vaccination.",
    { requiredDocumentation: "Current PHS Form 791 (International Certificate of Vaccination) when traveling from outside the AOR", immunizationOrProphylaxisRule: "All immunizations obtained before travel to the AOR; the specific vaccines are those in SC Reg 40-501 and Force Health Protection guidance, not listed by the clause", sourceGaps: ["which immunizations the referenced guidance requires", "whether the class deviation was later incorporated or rescinded"] }),
  clause("medevac-and-dna", "documentation", "Contractor personnel: medical evacuation coverage and DNA record", "(d)(2)",
    "U.S. citizen and third-country-national personnel must be beneficiaries of a medical evacuation plan and service through an insurance plan provided by the employer or paid individually. U.S. citizen contractor personnel must have a DNA record collected, with reference specimen storage arranged privately or through AFRSSIR.",
    { requiredDocumentation: "Medical evacuation plan and service (insurance); DNA record for U.S. citizen contractor personnel", applicabilityConditions: [...CONDITIONS, "whether the contractor is a U.S. citizen (DNA record applies to U.S. citizens only; the evacuation plan applies to U.S. citizens and third-country nationals)"] }),
];
