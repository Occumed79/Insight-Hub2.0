import { OCR_SOURCE_DOCUMENT_REGISTRY } from "./ocr-source-documents";
// Primary-source follow-up, retrieved 2026-10-10. Security-cooperation codes are NOT geographic AOR assignments.
import type { CommandId } from "./types";
export const RESEARCH_RETRIEVED_AT = "2026-10-10";
export const EUCOM_ENUMERATION_URL = "https://www.eucom.mil/about/the-region";
export const DSCA_TABLE_URL = "https://samm.dsca.mil/table/table-c4t2a";
export const CRS_CENTCOM_URL = "https://www.congress.gov/crs_external_products/IF/PDF/IF11428/IF11428.4.pdf";
export const CRS_INDOPACOM_URL = "https://www.congress.gov/crs_external_products/IF/PDF/IF12604/IF12604.2.pdf";
export const USARPAC_FHP_URL = "https://api.army.mil/e2/c/downloads/2025/12/11/f068780d/fy25-usarpac-force-health-protection-guidance.pdf";

// Transcribed from the command's nine geographic groups; NATO tab omitted because it duplicates countries.
export const EUCOM_ENUMERATED_GROUPS = {
  central: ["AUT", "CZE", "DEU", "HUN", "LIE", "POL", "SVK", "SVN"],
  eastern: ["BLR", "EST", "LVA", "LTU", "MDA", "RUS", "UKR"],
  levant: ["CYP"],
  northern: ["DNK", "FIN", "ISL", "NOR", "SWE"],
  southeastern: ["ALB", "BIH", "BGR", "HRV", "XKX", "MNE", "MKD", "ROU", "SRB"],
  southern: ["GRC", "VAT", "ITA", "MLT", "SMR"],
  southwesternAsia: ["ARM", "AZE", "GEO", "TUR"],
  southwesternEurope: ["AND", "PRT", "ESP"],
  western: ["BEL", "FRA", "IRL", "LUX", "MCO", "NLD", "CHE", "GBR"],
} as const;

export interface ResearchEvidence {
  id: string;
  command: CommandId;
  iso3: string[];
  issuingAuthority: string;
  sourceUrl: string;
  publicationDate: string | null;
  effectiveDate: string | null;
  retrievedAt: string;
  access: "full_document" | "indexed_primary_text" | "user_supplied_ocr";
  scope: "geographic_aor" | "security_cooperation" | "medical_policy" | "publication_index";
  sourceWording: string;
  finding: string;
  conflicts: string[];
  supersession: string | null;
}
const evidence = (e: Omit<ResearchEvidence, "retrievedAt" | "effectiveDate" | "supersession"> & Partial<Pick<ResearchEvidence, "effectiveDate" | "supersession">>): ResearchEvidence => ({ retrievedAt: RESEARCH_RETRIEVED_AT, effectiveDate: null, supersession: null, ...e });
export const RESEARCH_EVIDENCE: ResearchEvidence[] = [
  evidence({ id: "eucom-enumeration", command: "EUCOM", iso3: Object.values(EUCOM_ENUMERATED_GROUPS).flat(), issuingAuthority: "USEUCOM", sourceUrl: EUCOM_ENUMERATION_URL, publicationDate: null, access: "indexed_primary_text", scope: "geographic_aor", sourceWording: "Explore our interactive map to learn more about the countries in the European Theater.", finding: "The nine command-published geographic groups name 50 distinct countries, matching every existing EUCOM row, including Kosovo, Liechtenstein, Monaco, San Marino and Holy See (Vatican). No geography inference or count-based reconstruction. The separately displayed NATO group is not an AOR list. Direct fetch returned HTTP 403; full indexed geographic-group text was retrieved.", conflicts: ["Previous pack carried a normalized LIVE VERIFY list; preserved as the extraction baseline. Publication date is not given."] }),
  evidence({ id: "palestinian-territories-crs", command: "CENTCOM", iso3: ["PSE"], issuingAuthority: "Congressional Research Service, IF11428 version 4", sourceUrl: CRS_CENTCOM_URL, publicationDate: "2022-03-30", access: "full_document", scope: "geographic_aor", sourceWording: "Its area of responsibility (AOR) comprises Egypt, Jordan, Syria, Iraq, Israel, Kuwait, West Bank & Gaza", finding: "CRS explicitly includes West Bank & Gaza in CENTCOM's AOR. This supports the PSE geographic entity, not an additional nation or sovereign-state recognition. Current DSCA table also assigns Palestinian Authority to CE, but only for security cooperation.", conflicts: ["CRS version 4 is dated 2022 and repeats Israel in its full list; it is used for the explicitly named entity, not for a country count or new effective date."] }),
  evidence({ id: "taiwan-crs", command: "INDOPACOM", iso3: ["TWN"], issuingAuthority: "Congressional Research Service, IF12604 version 2", sourceUrl: CRS_INDOPACOM_URL, publicationDate: "2024-03-05", access: "full_document", scope: "geographic_aor", sourceWording: "Focal Points in the INDOPACOM AOR", finding: "Taiwan is the first named subsection under this heading on page 1. Official AOR treatment is explicit; no claim is made about whether Taiwan is included in the 36-nation total. Current DSCA table corroborates PA security-cooperation responsibility.", conflicts: ["This is a dated 2024 CRS publication, not the classified UCP or an exact current 36-country enumeration."] }),
  evidence({ id: "western-sahara-dsca", command: "AFRICOM", iso3: ["ESH"], issuingAuthority: "Defense Security Cooperation Agency, SAMM C4.T2A", sourceUrl: DSCA_TABLE_URL, publicationDate: null, access: "full_document", scope: "security_cooperation", sourceWording: "Western Sahara | WI | AF | AFR | No", finding: "AF explicitly means Africa CMD in footnote 1. Authoritative security-cooperation treatment is AFRICOM; this table alone does not establish a current geographic UCP assignment. Geographic status remains LIVE VERIFY.", conflicts: ["The extraction pack asserts AFRICOM geography without naming a source. Security-cooperation and geographic responsibilities are not interchangeable."] }),
  evidence({ id: "dsca-entity-scope", command: "SOUTHCOM", iso3: [], issuingAuthority: "Defense Security Cooperation Agency, SAMM C4.T2A", sourceUrl: DSCA_TABLE_URL, publicationDate: null, access: "full_document", scope: "security_cooperation", sourceWording: "Security Cooperation Customer and Regional Codes and Foreign Military Sales Eligibility", finding: "Named country/territory command codes are normalized below as security-cooperation intelligence only. No selection of 12 entries is promoted into SOUTHCOM's unnamed geographic dependency count. Historical countries, legacy customer codes, agencies and funds remain labeled as source rows rather than sovereign states.", conflicts: ["DSCA codes Cuba NO while SOUTHCOM's geographic AOR page explicitly lists Cuba.", "DSCA codes Greenland EU while NORTHCOM's current AOR page explicitly names Greenland; command geographic statement controls the geographic registry.", "DSCA codes British Virgin Islands and Turks and Caicos NO. They cannot be assumed to fill SOUTHCOM's 12.", "DSCA includes Netherlands Antilles, a historical entity; no replacement or successor geography is inferred."] }),
  evidence({ id: "indopacom-fy26-dtg", command: "INDOPACOM", iso3: [], issuingAuthority: "USINDOPACOM J07 / Office of the Command Surgeon", sourceUrl: "https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D", publicationDate: "2025-11-07", access: "indexed_primary_text", scope: "medical_policy", sourceWording: "DTG: 070905Z Nov 25", finding: "The official PDF's indexed page 1 supplies the message issue date. Direct PDF fetch returned HTTP 403, so further FY26 thresholds/populations/supersession remain unverified; an issue date is not automatically an effective date.", conflicts: [] }),
  evidence({ id: "usarpac-fhp-2025", command: "INDOPACOM", iso3: [], issuingAuthority: "USARPAC Assistant Chief of Staff-Medical, COL Alison L. Batig", sourceUrl: USARPAC_FHP_URL, publicationDate: "2025-03-01", access: "full_document", scope: "medical_policy", sourceWording: "this document is not intended as an order, regulation, or source of independent authority", finding: "36-page component handbook, dated 1 March 2025; posted at Army URL in December 2025. Applies to Army operational movements, DA civilians and accompanying contractors per SOW/DoD policy. FY25 basis; current FY26 parent guidance must be consulted. Extracted component rules are advisory summaries of cited requirements, not new theater-wide orders. Effective upon signature; expires three years after signature; signature date is not separately established.", conflicts: ["Section 1-3(a) says 30 days or longer; 1-3(c) says 30 days or less require risk assessment. Preserve both at exactly 30 days.", "Section 3-3(b), under Anthrax, says pre-exposure anthrax prophylaxis uses Jynneos rather than ACAM2000. This product/disease mismatch is retained as a source anomaly and is NOT executable vaccine guidance."], supersession: "No explicit supersession located. Does not supersede more stringent subordinate policy (1-3(d)); cites FY25 INDOPACOM rather than FY26." }),
  evidence({ id: "africom-clearance-forms", command: "AFRICOM", iso3: [], issuingAuthority: "USAFRICOM Command Surgeon", sourceUrl: "https://www.africom.mil/staff-resources/theater-medical-clearance", publicationDate: null, access: "indexed_primary_text", scope: "medical_policy", sourceWording: "AC Form 43, USAFRICOM Medical Waiver Request (Please download the PDF form to fill and sign electronically prior to submission.)", finding: "Public page names AC Form 42 screening and AC Form 43 electronic waiver form, SETAF-AF and Naval Forces Africa routing contacts, and exact FHP message DTGs. Library now lists September 18, 2026 screening/counseling publications, but posting dates alone do not establish supersession.", conflicts: ["AC Form 42 listings from June and September 2026 coexist; document library metadata is not proof a form version supersedes another."] }),
  evidence({ id: "southcom-class-deviation", command: "SOUTHCOM", iso3: [], issuingAuthority: "OUSD(AT&L) Defense Procurement and Acquisition Policy, class deviation 2014-00016", sourceUrl: "https://www.southcom.mil/Portals/7/Documents/Operational%20Contract%20Support/Official%20Class%20Deviation%20USA004118-14-DPAP.pdf", publicationDate: "2014-10-06", access: "full_document", scope: "medical_policy", sourceWording: "Contractor personnel must be medically, dentally, and psychologically fit for performance of their contracted duties.", finding: "Contractor-specific SOUTHCOM requirements (fitness and SC Reg 40-501 screening, immunizations before travel, PHS Form 791, medical evacuation coverage, DNA record) are carried by a DoD class deviation issued at the SOUTHCOM Commander's request. Integrated as three conditional rules that apply only where the clause is in the contract.", conflicts: ["Dated 2014; the memo says it remains in effect until incorporated in the OFARS or rescinded, and neither was checked.", "A DoD acquisition issuance, not a SOUTHCOM instruction; it points to SC Reg 40-501 for the actual medical standards."] }),
  evidence({ id: "africom-aci-version-listing", command: "AFRICOM", iso3: [], issuingAuthority: "USAFRICOM Command Surgeon", sourceUrl: "https://www.africom.mil/theater-medical-clearance", publicationDate: null, access: "full_document", scope: "publication_index", sourceWording: "ACI 4200.09B Force Health Protection (18 March 2025)", finding: "The command's Theater Medical Clearance page, read 2026-10-11, lists ACI 4200.09B and ACN 4200.09B, both dated 18 March 2025, together with the 7 Aug 2025 chikungunya, 30 Jul 2025 malaria, 4 Oct 2024 mpox and 14 Jun 2024 yellow fever messages and AC Forms 42 and 43. It does not list an ACI 4200.09C.", conflicts: ["The registry carries the AFRICOM parent instruction as ACI 4200.09C dated 1 June 2026, from the extraction pack; the 1 June 2026 date also appears in the AC Form 42 footer, which cites ACI 4200.09. The official listing and the registry label disagree. Neither is changed: the version of the current instruction is unresolved.", "The listing page does not say which documents are current or superseded."], supersession: null }),
  evidence({ id: "africom-yf-ascension", command: "AFRICOM", iso3: [], issuingAuthority: "CDR USAFRICOM J3", sourceUrl: "https://health.mil/Reference-Center/Policies/2018/07/01/YELLOW-FEVER-VACCINATION-REQUIREMENTS-FOR-USAFRICOM-MODIFICATION-2-EXCEPTION-FOR-ASCENSION-ISLAND", publicationDate: "2018-07-27", access: "indexed_primary_text", scope: "medical_policy", sourceWording: "ASCENSION ISLAND HAS NO ENDEMIC YELLOW FEVER RISK AND NO YF-VAX ENTRY REQUIREMENT", finding: "DTG 271320Z Jul 18 (Modification 2) exempted DoD personnel traveling directly from CONUS to Ascension Island and back from the YF-VAX requirement, and required a single lifetime dose for travel to Ascension from any location outside CONUS. It supersedes the 2017 Modification 1.", conflicts: ["Historical evidence only. The later 14 Jun 2024 AFRICOM yellow fever message (140953Z Jun 24) is the current theater requirement and its treatment of Ascension Island was not established, so this exception is not executed as a rule.", "Ascension Island has no ISO3 record in the registry, so no country-keyed rule could apply it.", "The printed DTG year (Jul 18) and the 2017 references were both read; the OCR text of the page is imperfect."], supersession: "Supersedes the 17 Jul 2017 Modification 1; its own currency against the 2024 message is unverified." }),
];

// These are document observations, not geographic membership evidence.
RESEARCH_EVIDENCE.push(...OCR_SOURCE_DOCUMENT_REGISTRY.documents.map(doc => ({
  id: `ocr:${doc.id}`, command: doc.command, iso3: doc.id.startsWith("USFKI-") ? ["KOR"] : [],
  issuingAuthority: doc.issuingAuthority, sourceUrl: doc.sourceUrl,
  publicationDate: doc.publicationDate, effectiveDate: doc.effectiveDate, retrievedAt: doc.retrievedAt,
  access: doc.access, scope: "medical_policy" as const,
  sourceWording: doc.effectiveWording ?? "Exact OCR text retained in ocrSourceDocuments; damaged text is not reconstructed.",
  finding: `${doc.title}: user-supplied OCR retained with filename, SHA256 and line range. Relevant normalized rules are separately attributed to this document.`,
  conflicts: doc.conflicts, supersession: doc.supersedes.length ? doc.supersedes.join("; ") : null,
})));
RESEARCH_EVIDENCE.push({
  id: "fda-ixchiq-license-suspension", command: "AFRICOM", iso3: [], issuingAuthority: "U.S. Food and Drug Administration",
  sourceUrl: "https://www.fda.gov/safety/medical-product-safety-information/fda-update-safety-ixchiq-chikungunya-vaccine-live-fda-suspends-biologics-license-fda-safety",
  publicationDate: "2025-08-22", effectiveDate: "2025-08-22", retrievedAt: "2026-10-11", access: "full_document", scope: "medical_policy",
  sourceWording: "has suspended the biologics license", finding: "FDA suspended IXCHIQ's license following serious safety concerns. The earlier AFRICOM 7 August 2025 product paragraph is retained as dated evidence, not a current product recommendation. Confirm current authorized product and patient eligibility before use.",
  conflicts: ["AFRICOM August 7 memorandum lists IXCHIQ as FDA approved; the later FDA licensing action controls U.S. product authorization. This does not cancel the command's outbreak-risk framework."], supersession: "Later FDA licensing action controls product status, not command policy applicability.",
});

export const DSCA_SECURITY_COOPERATION = {
  issuingAuthority: "Defense Security Cooperation Agency, SAMM C4.T2A",
  sourceUrl: DSCA_TABLE_URL,
  publicationDate: null,
  effectiveDate: null,
  retrievedAt: RESEARCH_RETRIEVED_AT,
  scope: "security_cooperation" as const,
  notice: "These are customer-table command codes, not an exact geographic AOR enumeration. Do not count source rows as sovereign states or apply command medical policy from them.",
  rows: [
  {
    "sourceName": "Afghanistan",
    "customerCode": "AF",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Albania",
    "customerCode": "AL",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Algeria",
    "customerCode": "AG",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Andorra",
    "customerCode": "AN",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Angola",
    "customerCode": "AO",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Anguilla (UK)",
    "customerCode": "AV",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Antigua and Barbuda",
    "customerCode": "AC",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Argentina",
    "customerCode": "AR",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Armenia",
    "customerCode": "AM",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Aruba",
    "customerCode": "AA",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Australia",
    "customerCode": "AT (AS)",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Austria",
    "customerCode": "AU",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Azerbaijan",
    "customerCode": "AJ",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Bahamas",
    "customerCode": "BF",
    "command": "NORTHCOM",
    "originalCommandCell": "NO \\6"
  },
  {
    "sourceName": "Bahrain",
    "customerCode": "BA",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Bahrain National Guard",
    "customerCode": "BZ",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Bangladesh",
    "customerCode": "BG",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Barbados",
    "customerCode": "BB",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Belarus",
    "customerCode": "BO",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Belgium",
    "customerCode": "BE",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Belize",
    "customerCode": "BH",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Benin",
    "customerCode": "DA (BN)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Bermuda (UK)",
    "customerCode": "BD",
    "command": "NORTHCOM",
    "originalCommandCell": "NO"
  },
  {
    "sourceName": "Bhutan",
    "customerCode": "BT",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Bolivia",
    "customerCode": "BL",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Bolivia INC",
    "customerCode": "D1",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Bosnia-Herzegovina",
    "customerCode": "BK",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Botswana",
    "customerCode": "BC",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Brazil",
    "customerCode": "BR",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "British Indian Ocean Territory (UK)",
    "customerCode": "IO",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "British Virgin Islands (UK)",
    "customerCode": "VI",
    "command": "NORTHCOM",
    "originalCommandCell": "NO \\7"
  },
  {
    "sourceName": "Brunei",
    "customerCode": "BX",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Bulgaria",
    "customerCode": "BU",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Burkina Faso",
    "customerCode": "UV",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Burma",
    "customerCode": "BM",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Burundi",
    "customerCode": "BY",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Cambodia",
    "customerCode": "CB",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Cameroon",
    "customerCode": "CM",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Canada",
    "customerCode": "CN (CA)",
    "command": "NORTHCOM",
    "originalCommandCell": "NO"
  },
  {
    "sourceName": "Cape Verde, Republic of",
    "customerCode": "CV",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Cayman Islands (UK)",
    "customerCode": "CJ",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Central African Republic",
    "customerCode": "CT",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Chad",
    "customerCode": "CD",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Chile",
    "customerCode": "CI",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "China",
    "customerCode": "CH",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Colombia",
    "customerCode": "CO",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Colombia INC",
    "customerCode": "D5",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Comoros",
    "customerCode": "CR (CN)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Congo, Democratic Republic of (Kinshasa)",
    "customerCode": "CX (CG)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Congo, Republic of (Brazzaville)",
    "customerCode": "CF",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Cook Islands",
    "customerCode": "CW",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Costa Rica",
    "customerCode": "CS",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Croatia",
    "customerCode": "HR",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Cuba",
    "customerCode": "CU",
    "command": "NORTHCOM",
    "originalCommandCell": "NO"
  },
  {
    "sourceName": "Curacao (NL)",
    "customerCode": "KL",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Cyprus",
    "customerCode": "CY",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Czech Republic",
    "customerCode": "EZ",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Czechoslovakia \\5",
    "customerCode": "CZ",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Denmark",
    "customerCode": "DE (DA)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Djibouti",
    "customerCode": "DJ",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Dominica",
    "customerCode": "DO",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Dominican Republic",
    "customerCode": "DR",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Ecuador",
    "customerCode": "EC",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Ecuador INC",
    "customerCode": "D6",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Egypt",
    "customerCode": "EG",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "El Salvador",
    "customerCode": "ES",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Equatorial Guinea",
    "customerCode": "EK",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Eritrea",
    "customerCode": "ER",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Estonia",
    "customerCode": "EN",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Ethiopia",
    "customerCode": "ET",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Faeroe Islands (DE)",
    "customerCode": "FO",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Falkland Islands (UK)",
    "customerCode": "FA",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Fiji",
    "customerCode": "FJ",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Finland",
    "customerCode": "FI",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "France",
    "customerCode": "FR",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "French Guiana (FR)",
    "customerCode": "FG",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "French Polynesia (FR)",
    "customerCode": "FP",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Gabon",
    "customerCode": "GB",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Gambia",
    "customerCode": "GA",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Georgia",
    "customerCode": "GG",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Germany",
    "customerCode": "GY (GM)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Ghana",
    "customerCode": "GH",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Gibraltar (UK)",
    "customerCode": "GI",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Greece",
    "customerCode": "GR",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Greenland (DE)",
    "customerCode": "GL",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Grenada",
    "customerCode": "GJ",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Guadeloupe (FR)",
    "customerCode": "GP",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Guatemala",
    "customerCode": "GT",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Guinea",
    "customerCode": "GV",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Guinea-Bissau",
    "customerCode": "PU",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Guyana",
    "customerCode": "GU",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Haiti",
    "customerCode": "HA",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Honduras",
    "customerCode": "HO",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Hong Kong (CH)",
    "customerCode": "HK",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Hungary",
    "customerCode": "HU",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Iceland",
    "customerCode": "IL (IC)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "India",
    "customerCode": "IN",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Indochina",
    "customerCode": "IC",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Indonesia",
    "customerCode": "ID",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Iran",
    "customerCode": "IR",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Iraq",
    "customerCode": "IQ",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Ireland",
    "customerCode": "EI",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Israel",
    "customerCode": "IS",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Italy",
    "customerCode": "IT",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Ivory Coast (Cote d'Ivoire)",
    "customerCode": "IV",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Jamaica",
    "customerCode": "JM",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Japan",
    "customerCode": "JA",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Jordan",
    "customerCode": "JO",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Kazakhstan",
    "customerCode": "KZ",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Kenya",
    "customerCode": "KE",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Kingdom of Eswatini",
    "customerCode": "WZ",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Kiribati",
    "customerCode": "KR",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Korea (North)",
    "customerCode": "KN",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Korea (Seoul)",
    "customerCode": "KS",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Kosovo",
    "customerCode": "KV",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Kuwait",
    "customerCode": "KU",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Kyrgyz Republic (Kyrgyzstan)",
    "customerCode": "KG",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Laos",
    "customerCode": "LA",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Latvia",
    "customerCode": "LG",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Lebanon",
    "customerCode": "LE",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Lesotho",
    "customerCode": "LT",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Liberia",
    "customerCode": "LI",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Libya",
    "customerCode": "LY",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Liechtenstein",
    "customerCode": "LS",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Lithuania",
    "customerCode": "LH",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Luxembourg",
    "customerCode": "LX (LU)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Macau (CH)",
    "customerCode": "MC",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Madagascar",
    "customerCode": "MA",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Malawi",
    "customerCode": "MI",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Malaysia",
    "customerCode": "MF (MY)",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Maldives",
    "customerCode": "MV",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Mali",
    "customerCode": "RM (ML)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Malta",
    "customerCode": "MT",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Marshall Islands",
    "customerCode": "R1 (RM)",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Martinique (FR)",
    "customerCode": "MB",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Mauritania",
    "customerCode": "MR",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Mauritius",
    "customerCode": "MP",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Mexico",
    "customerCode": "MX",
    "command": "NORTHCOM",
    "originalCommandCell": "NO"
  },
  {
    "sourceName": "Micronesia",
    "customerCode": "FM",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Moldova",
    "customerCode": "MD",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Monaco",
    "customerCode": "MN",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Mongolia",
    "customerCode": "MG",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Montenegro",
    "customerCode": "MJ",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Montserrat (UK)",
    "customerCode": "MH",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Morocco",
    "customerCode": "MO",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Mozambique",
    "customerCode": "MZ",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Namibia",
    "customerCode": "WA",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Nauru",
    "customerCode": "NR",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Nepal",
    "customerCode": "NP",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Netherlands",
    "customerCode": "NE (NL)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Netherlands Antilles (NE)",
    "customerCode": "NA (NT)",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "New Caledonia (FR)",
    "customerCode": "NC",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "New Zealand",
    "customerCode": "NZ",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Nicaragua",
    "customerCode": "NU",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Niger",
    "customerCode": "NK (NG)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Nigeria",
    "customerCode": "NI",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Niue (NZ)",
    "customerCode": "NQ",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Norfolk Island (AT)",
    "customerCode": "NF",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Norway",
    "customerCode": "NO",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Oman",
    "customerCode": "MU",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Pakistan",
    "customerCode": "PK",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Palau",
    "customerCode": "PS",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Palestinian Authority",
    "customerCode": "PW",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Panama",
    "customerCode": "PN (PM)",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Papua-New Guinea",
    "customerCode": "PP",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Paraguay",
    "customerCode": "PA",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Peru",
    "customerCode": "PE",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Peru INC",
    "customerCode": "D3",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Philippine National Police – Special Action Force",
    "customerCode": "EH",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Philippines",
    "customerCode": "PH (PI RP)",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Pitcairn (UK)",
    "customerCode": "PC",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Poland",
    "customerCode": "PL",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Portugal",
    "customerCode": "PT (PO)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Qatar",
    "customerCode": "QA",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Republic of North Macedonia",
    "customerCode": "MK",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Republic of Serbia",
    "customerCode": "RB",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Republic of South Sudan",
    "customerCode": "SX",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Reunion (FR)",
    "customerCode": "RE",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Romania",
    "customerCode": "RO",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Russia",
    "customerCode": "RS",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Rwanda",
    "customerCode": "RW",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Saint Helena (UK)",
    "customerCode": "SH",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Saint Kitts and Nevis",
    "customerCode": "SC",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Saint Lucia",
    "customerCode": "ST",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Saint Pierre and Miquelon (FR)",
    "customerCode": "SB",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Saint Vincent and Grenadines",
    "customerCode": "VC",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Saint-Barthelemy (FR)",
    "customerCode": "TB",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Saint-Martin (FR)",
    "customerCode": "RN",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Samoa",
    "customerCode": "WS",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "San Marino",
    "customerCode": "SM",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Sao Tome and Principe",
    "customerCode": "TP",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Saudi Arabia",
    "customerCode": "SR (SA)",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Saudi Arabia Ministry of the Interior",
    "customerCode": "SD",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Saudi Arabia National Guard",
    "customerCode": "SI",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Saudi Arabia Presidency of State Security",
    "customerCode": "SA",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Saudi Royal Aviation",
    "customerCode": "RA",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Senegal",
    "customerCode": "SK (SG)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Serbia (Refer to Republic of Serbia)",
    "customerCode": "S2 (SR)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Serbia and Montenegro",
    "customerCode": "YI",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Seychelles",
    "customerCode": "SE",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Sierra Leone",
    "customerCode": "SL",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Singapore",
    "customerCode": "SN",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Sint Maarten (NL)",
    "customerCode": "QN",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Slovak Republic",
    "customerCode": "LO",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Slovenia",
    "customerCode": "S3 (SI)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Solomon Islands",
    "customerCode": "BP",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Somalia",
    "customerCode": "SO",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "South Africa",
    "customerCode": "UA (SF)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Spain",
    "customerCode": "SP",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Sri Lanka",
    "customerCode": "CE",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Sudan",
    "customerCode": "SU",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Suriname",
    "customerCode": "NS",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Sweden",
    "customerCode": "SW",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Switzerland",
    "customerCode": "SZ",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Syria",
    "customerCode": "SY",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Taiwan",
    "customerCode": "TW",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Tajikistan",
    "customerCode": "TI",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Tanzania",
    "customerCode": "TZ",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Thailand",
    "customerCode": "TH",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "The Joint Ukraine Multinational Program – Services, Training and Articles Rapid Timeline (JUMPSTART) Fund",
    "customerCode": "JU",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Timor-Leste",
    "customerCode": "TT",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Togo",
    "customerCode": "TO",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Tokelau (NZ)",
    "customerCode": "TL",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Tonga",
    "customerCode": "TN",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Trinidad-Tobago",
    "customerCode": "TD",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Tunisia",
    "customerCode": "TU (TS)",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Türkiye (short-form) - Republic of Türkiye (long-form)",
    "customerCode": "TK (TU)",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Turkmenistan",
    "customerCode": "TX",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Turks and Caicos (UK)",
    "customerCode": "TS",
    "command": "NORTHCOM",
    "originalCommandCell": "NO"
  },
  {
    "sourceName": "Tuvalu",
    "customerCode": "TV",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Uganda",
    "customerCode": "UG",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Ukraine",
    "customerCode": "UP",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "United Arab Emirates (previous code TC)",
    "customerCode": "AE",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "United Kingdom",
    "customerCode": "UK",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "United Kingdom Polaris Project",
    "customerCode": "UZ",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "United Nations Interim Mission in Kosovo",
    "customerCode": "T2",
    "command": "EUCOM",
    "originalCommandCell": "EU"
  },
  {
    "sourceName": "Uruguay",
    "customerCode": "UY",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Uzbekistan",
    "customerCode": "U2",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Vanuatu",
    "customerCode": "NH",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Venezuela",
    "customerCode": "VE",
    "command": "SOUTHCOM",
    "originalCommandCell": "SO"
  },
  {
    "sourceName": "Vietnam (previous code VS)",
    "customerCode": "VM",
    "command": "INDOPACOM",
    "originalCommandCell": "PA"
  },
  {
    "sourceName": "Western Sahara",
    "customerCode": "WI",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Yemen",
    "customerCode": "YE (YM)",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Yemen, Aden",
    "customerCode": "YS (YM)",
    "command": "CENTCOM",
    "originalCommandCell": "CE"
  },
  {
    "sourceName": "Zambia",
    "customerCode": "ZA",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  },
  {
    "sourceName": "Zimbabwe",
    "customerCode": "ZI",
    "command": "AFRICOM",
    "originalCommandCell": "AF"
  }
] as Array<{ sourceName: string; customerCode: string; command: CommandId; originalCommandCell: string }>,
};
export const researchFor = (command: CommandId, iso3: string) => RESEARCH_EVIDENCE.filter(e => e.command === command && (!e.iso3.length || e.iso3.includes(iso3)));
