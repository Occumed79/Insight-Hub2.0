// Reviewed vaccine entry / exit / transit / event-specific rules.
//
// Every rule below was read from the page named in its sourceUrl on 2026-10-08 (the pages were
// captured with a page-fetch tool and summarized; lists were transcribed from that capture), except
// the CDC/WHO baseline copies, which are labelled OLDER GLOBAL BASELINE. Anything the page did not
// say is left null and written into `notes`. Destination-government sources outrank WHO, which
// outranks CDC, which outranks compiled baselines; conflicts are kept, never silently merged.
//
// productionVerificationRequired stays true on every rule: these pages change without notice and the
// capture could not be repeated from the build sandbox.

import type { SupportingSource, TimeLimit, VaccineRule } from "./types";

const CAPTURED = "2026-10-08";

const days = (value: number, relativeTo: TimeLimit["relativeTo"] = "arrival"): TimeLimit => ({ value, unit: "days", relativeTo });
const weeks = (value: number, relativeTo: TimeLimit["relativeTo"] = "departure"): TimeLimit => ({ value, unit: "weeks", relativeTo });
const months = (value: number, relativeTo: TimeLimit["relativeTo"] = "departure"): TimeLimit => ({ value, unit: "months", relativeTo });
const years = (value: number, relativeTo: TimeLimit["relativeTo"] = "arrival"): TimeLimit => ({ value, unit: "years", relativeTo });

type RuleInput = Partial<VaccineRule> &
  Pick<VaccineRule, "id" | "vaccine" | "ruleType" | "legalForce" | "travelerGroup" | "sourceAuthority" | "authorityTier" | "sourceUrl" | "normalizedRule" | "verificationStatus">;

function make(input: RuleInput): VaccineRule {
  return {
    originScope: "any_origin",
    originCountries: [],
    originRiskAreaNote: null,
    issuingCountry: null,
    destinationCountry: null,
    destinationCountries: [],
    destinationNote: null,
    minimumAge: null,
    maximumAge: null,
    ageUnit: "years",
    minimumAgeExclusive: false,
    transitApplies: null,
    transitThresholdHours: null,
    exposureLookbackDays: null,
    residencyApplies: null,
    longTermVisitorApplies: null,
    stayDurationThresholdDays: null,
    eventType: null,
    hijriYear: null,
    seasonLabel: null,
    vaccineTimingMinimum: null,
    vaccineTimingMaximum: null,
    vaccineDetail: null,
    certificateRequired: null,
    certificateType: null,
    certificateValidity: null,
    exemptions: [],
    validFrom: null,
    validUntil: null,
    sourcePublishedAt: null,
    retrievedAt: CAPTURED,
    lastVerifiedAt: CAPTURED,
    revalidateAfterDays: 30,
    supportingSources: [],
    notes: [],
    productionVerificationRequired: true,
    ...input,
  };
}

/* ------------------------------------------------------------------ */
/* Country lists (ISO 3166-1 alpha-2), transcribed from the sources    */
/* ------------------------------------------------------------------ */

/** Singapore ICA list (marked "correct as of 18 Nov 2022"): 29 African + 13 Latin American entries. */
const YF_AFRICA_29 = ["AO", "BJ", "BF", "BI", "CM", "CF", "TD", "CG", "CI", "CD", "GQ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LR", "ML", "MR", "NE", "NG", "SN", "SL", "SS", "SD", "TG", "UG"];
const YF_LATAM_12 = ["AR", "BO", "BR", "CO", "EC", "GF", "GY", "PA", "PY", "PE", "SR", "VE"];
const SG_YF_ORIGINS = [...YF_AFRICA_29, ...YF_LATAM_12, "TT"];
const SAUDI_YF_ORIGINS = [...YF_AFRICA_29, ...YF_LATAM_12];
/** Sri Lanka Department of Immigration & Emigration list ("Zaire" = Democratic Republic of the Congo). */
const LK_YF_ORIGINS = ["AO", "BI", "BJ", "BF", "CM", "TD", "CF", "CG", "GQ", "ET", "GM", "GA", "GN", "GW", "GH", "CI", "KE", "LR", "ML", "MR", "NE", "NG", "SL", "ST", "SN", "SO", "SD", "SS", "RW", "TZ", "TG", "UG", "CD", ...YF_LATAM_12, "TT"];
/** South Africa DoH guideline Table 1 (45 countries). */
const ZA_YF_ORIGINS = ["AO", "AR", "BJ", "BO", "BR", "BF", "BI", "CM", "CF", "TD", "CO", "CG", "CI", "CD", "EC", "GQ", "ET", "GF", "GA", "GM", "GH", "GN", "GW", "GY", "KE", "LR", "ML", "MR", "NE", "NG", "PA", "PY", "PE", "RW", "ST", "SN", "SL", "SO", "SD", "SR", "TG", "TT", "UG", "TZ", "VE"];
/** CDC Yellow Book 2026 Table 4.21.4 as previously recorded in this repository (not re-read in this pass). */
const CDC_YF_ALL_ARRIVALS: Record<string, string> = {
  AO: "Angola", BJ: "Benin", BF: "Burkina Faso", BI: "Burundi", CM: "Cameroon", CF: "Central African Republic", CG: "Congo, Republic of the",
  CI: "Côte d'Ivoire", CD: "Democratic Republic of the Congo", GA: "Gabon", GH: "Ghana", GN: "Guinea", GW: "Guinea-Bissau", ML: "Mali",
  NE: "Niger", SL: "Sierra Leone", SS: "South Sudan", TG: "Togo", UG: "Uganda", BO: "Bolivia", GF: "French Guiana",
};

/** WHO Polio IHR Emergency Committee statement of 25 Aug 2026. */
const POLIO_CATEGORY_1: Record<string, string[]> = {
  AF: ["WPV1"], PK: ["WPV1"], DE: ["WPV1"], CD: ["cVDPV1"], DJ: ["cVDPV1"], IL: ["cVDPV1"], LA: ["cVDPV1"], SS: ["cVDPV1"], CM: ["cVDPV3"], TD: ["cVDPV3"], NG: ["cVDPV3"],
};
const POLIO_CATEGORY_2 = ["DZ", "AO", "BJ", "CM", "CF", "TD", "CI", "CD", "DJ", "ET", "DE", "MW", "ML", "NA", "NE", "NG", "PG", "SO", "SD", "GB", "TG", "TZ", "YE", "ZM"];

const SAUDI_POLIO_BOPV_OR_IPV = ["AF", "PK", "MZ", "CD", "GN"];
const SAUDI_POLIO_IPV = ["AO", "BJ", "BF", "CM", "CF", "TD", "CG", "CD", "ET", "GN", "KE", "LR", "ML", "MR", "NE", "NG", "SL", "SO", "SS", "TZ", "ID", "PS", "YE"];

/* ------------------------------------------------------------------ */
/* WHO polio temporary recommendations (exit / departure)              */
/* ------------------------------------------------------------------ */

const WHO_POLIO_URL = "https://www.who.int/news/item/25-08-2026-statement-of-the-forty-fifth-meeting-of-the-polio-ihr-emergency-committee";
const CDC_POLIO_SUPPORT: SupportingSource = {
  authority: "CDC",
  tier: "cdc",
  url: "https://www.cdc.gov/polio/vaccines/international-travelers.html",
  note: "CDC (page reviewed 2024-07-09) says some countries may ask for proof of polio vaccination on departure, recorded on the yellow ICVP. The adult and child dosing schedules on that page are medical recommendations, not rules.",
};
const PAKISTAN_NATIONAL: SupportingSource = {
  authority: "Pakistan Polio Eradication Programme",
  tier: "destination_government",
  url: "https://www.poliofreepakistan.gov.pk/certificate/vaccination-certificate",
  note: "National implementation page listed in the source registry; it could not be retrieved in this pass (TLS verification failed), so Pakistan's own departure rule is not verified.",
};

const whoPolioCategory1: VaccineRule[] = Object.entries(POLIO_CATEGORY_1).map(([iso2, viruses]) =>
  make({
    id: `polio-exit-who-cat1-${iso2}`,
    vaccine: "Polio",
    ruleType: "exit",
    legalForce: "who_temporary_recommendation",
    travelerGroup: "residents_and_long_term_visitors",
    originScope: "issuing_country_residents",
    originCountries: [iso2],
    originRiskAreaNote: `State infected with ${viruses.join(", ")} (WHO statement category: WPV1, cVDPV1 or cVDPV3, with or without local transmission)`,
    destinationNote: "Any international destination",
    longTermVisitorApplies: true,
    residencyApplies: true,
    stayDurationThresholdDays: 28,
    vaccineTimingMinimum: weeks(4),
    vaccineTimingMaximum: months(12),
    vaccineDetail: "One dose of bOPV or IPV for residents and long-term visitors (more than four weeks) of all ages, given four weeks to 12 months before international travel; if not vaccinated within that window, at least by the time of departure.",
    certificateRequired: true,
    certificateType: "ICVP using the IHR Annex 6 model; ICVPs issued after 19 Sep 2025 must conform to the amended model",
    sourceAuthority: "WHO — Polio IHR Emergency Committee (45th meeting statement)",
    authorityTier: "who",
    sourceUrl: WHO_POLIO_URL,
    sourcePublishedAt: "2026-08-25",
    supportingSources: [CDC_POLIO_SUPPORT, ...(iso2 === "PK" ? [PAKISTAN_NATIONAL] : [])],
    normalizedRule: `WHO temporary recommendation to ${iso2}: residents and long-term visitors (>4 weeks), all ages, should hold a bOPV/IPV dose given 4 weeks–12 months before international travel (at least by departure) documented on an ICVP; the State should restrict departure of residents lacking documentation (road, air, sea). Addressed to the State, not a destination-country entry rule.`,
    verificationStatus: "WHO VERIFIED",
    notes: [
      "This is an IHR temporary recommendation addressed to the infected State. Whether and how the State enforces departure checks must be confirmed from its own authority.",
      "State list and virus types transcribed from the WHO statement through page extraction; re-read the statement before operational use.",
    ],
  }),
);

const whoPolioCategory2: VaccineRule[] = POLIO_CATEGORY_2.map((iso2) =>
  make({
    id: `polio-exit-who-cat2-${iso2}`,
    vaccine: "Polio",
    ruleType: "exit",
    legalForce: "who_temporary_recommendation",
    travelerGroup: "residents_and_long_term_visitors",
    originScope: "issuing_country_residents",
    originCountries: [iso2],
    originRiskAreaNote: "State infected with cVDPV2 (WHO statement category: cVDPV2, with or without local transmission)",
    destinationNote: "Any international destination",
    longTermVisitorApplies: true,
    residencyApplies: true,
    stayDurationThresholdDays: 28,
    vaccineTimingMinimum: weeks(4),
    vaccineTimingMaximum: months(12),
    vaccineDetail: "Residents and long-term visitors (more than four weeks) are encouraged to receive an IPV dose four weeks to 12 months before international travel. The statement sets no departure restriction for this category.",
    certificateRequired: null,
    certificateType: "ICVP using the IHR Annex 6 model; ICVPs issued after 19 Sep 2025 must conform to the amended model",
    sourceAuthority: "WHO — Polio IHR Emergency Committee (45th meeting statement)",
    authorityTier: "who",
    sourceUrl: WHO_POLIO_URL,
    sourcePublishedAt: "2026-08-25",
    supportingSources: [CDC_POLIO_SUPPORT],
    normalizedRule: `WHO temporary recommendation to ${iso2} (cVDPV2): residents and long-term visitors (>4 weeks) are encouraged to receive an IPV dose 4 weeks–12 months before international travel, documented on an ICVP. No departure restriction is set for this category.`,
    verificationStatus: "WHO VERIFIED",
    notes: [
      "Encouragement only: this category carries no departure restriction in the statement.",
      "State list transcribed from the WHO statement through page extraction; re-read the statement before operational use.",
    ],
  }),
);

/* ------------------------------------------------------------------ */
/* Saudi Arabia — Hajj and Umrah (Ministry of Health seasonal documents) */
/* ------------------------------------------------------------------ */

const SA_UMRAH_URL = "https://www.moh.gov.sa/en/HealthAwareness/Pilgrims-Health/Documents/Health-Regulations-Umrah-EN.pdf";
const SA_HAJJ_URL = "https://www.moh.gov.sa/HealthAwareness/Pilgrims-Health/Documents/Hajj-Health-Requirements-English-language.pdf";
const CDC_MENINGO: SupportingSource = {
  authority: "CDC Yellow Book 2026 — Meningococcal Disease",
  tier: "cdc",
  url: "https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/meningococcal-disease.html",
  note: "Chapter reviewed 2025-04-23; states the same quadrivalent requirement for Umrah and Hajj pilgrims and adds an age floor of 1 year that the 1447H Ministry documents do not state.",
};

function saudiSeasonRules(event: "Hajj" | "Umrah"): VaccineRule[] {
  const url = event === "Hajj" ? SA_HAJJ_URL : SA_UMRAH_URL;
  const seasonNotes = [
    `Ministry document is titled for 1447H (2026) and states no issue date. Saudi MOH publishes seasonal requirements: the current-season (1448H) document has not been verified, and the 1447H text must not be assumed to carry over.`,
    "The document defines its area of application as Makkah, Madinah, Jeddah and Taif.",
  ];
  const base = {
    ruleType: "event-specific" as const,
    legalForce: "mandatory" as const,
    issuingCountry: "SA",
    destinationCountry: "SA",
    eventType: event,
    hijriYear: 1447,
    seasonLabel: "1447H (2026)",
    sourceAuthority: `Saudi Arabia Ministry of Health — ${event} health requirements`,
    authorityTier: "destination_government" as const,
    sourceUrl: url,
    sourcePublishedAt: null,
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED" as const,
    supportingSources: [
      { authority: "Saudi Arabia Ministry of Health — pilgrim health hub", tier: "destination_government" as const, url: "https://www.moh.gov.sa/en/healthawareness/pilgrims-health/pages/default.aspx", note: "Seasonal document hub; check for the current-season publication." },
    ],
  };
  const meningoDetail = "Quadrivalent ACYW or pentavalent ACYWX conjugate vaccine within the last 5 years and at least 10 days before arrival; or quadrivalent ACYW polysaccharide vaccine within the last 3 years and at least 10 days before arrival.";
  const meningoCertificate = "Certificate from the origin-country health authority showing vaccine name and date of administration; if the vaccine type is missing it is treated as valid for 3 years from administration";
  const meningoGroups = event === "Hajj" ? (["pilgrims", "seasonal_workers"] as const) : (["pilgrims"] as const);
  const rules: VaccineRule[] = [];

  for (const group of meningoGroups) {
    rules.push(
      make({
        ...base,
        id: `meningococcal-event-SA-${event.toLowerCase()}-${group}`,
        vaccine: "Meningococcal (ACWY)",
        travelerGroup: group,
        originScope: "any_origin",
        eventType: group === "seasonal_workers" ? "Hajj (seasonal work in Hajj areas)" : event,
        vaccineTimingMinimum: days(10),
        vaccineTimingMaximum: years(5),
        vaccineDetail: meningoDetail,
        certificateRequired: true,
        certificateType: meningoCertificate,
        supportingSources: [...base.supportingSources, CDC_MENINGO],
        normalizedRule: `Saudi Arabia ${event}${group === "seasonal_workers" ? " seasonal workers in Hajj areas" : " pilgrims"} from all countries: proof of ACYW meningococcal vaccination, ≥10 days and ≤5 years (conjugate) or ≤3 years (polysaccharide) before arrival. Not a general entry requirement for other purposes of travel.`,
        notes: [...seasonNotes, "No age limit is stated in the document for this requirement.", "The maximum interval shown is for conjugate vaccine; polysaccharide vaccine is limited to 3 years (see vaccine detail).", ...(event === "Umrah" ? ["The Umrah document also lists 26 African countries (Benin to Uganda) in its meningococcal section; the extraction did not make the extra obligation for them explicit — read section 1.1 of the PDF."] : [])],
      }),
    );
  }

  rules.push(
    make({
      ...base,
      id: `polio-event-SA-${event.toLowerCase()}-bopv-or-ipv`,
      vaccine: "Polio",
      travelerGroup: "arrivals_from_listed_countries",
      originScope: "listed_countries",
      originCountries: SAUDI_POLIO_BOPV_OR_IPV,
      originRiskAreaNote: "Afghanistan, Pakistan (WPV1); Mozambique, DR Congo (cVDPV1); Guinea (cVDPV3)",
      vaccineDetail: "At least one dose of bOPV or IPV before travel, regardless of age or prior vaccination status.",
      certificateRequired: true,
      normalizedRule: `Saudi Arabia ${event}: travelers from Afghanistan, Pakistan, Mozambique, DR Congo or Guinea need at least one bOPV or IPV dose before travel, regardless of age or prior vaccination status.`,
      notes: [...seasonNotes, "No minimum interval before arrival is stated as a requirement. Text on 'previous 12 months for IPV / 6 months for OPV, at least 4 weeks before arrival' is presented as routine-polio timing and is not carried as a requirement here."],
    }),
    make({
      ...base,
      id: `polio-event-SA-${event.toLowerCase()}-ipv`,
      vaccine: "Polio",
      travelerGroup: "arrivals_from_listed_countries",
      originScope: "listed_countries",
      originCountries: SAUDI_POLIO_IPV,
      originRiskAreaNote: "20 African countries plus Indonesia, Palestine and Yemen",
      vaccineDetail: "At least one dose of IPV before travel; if IPV is unavailable, a certificate of at least one dose of type 2 OPV (including novel OPV2) is accepted. Applies regardless of age or prior vaccination status.",
      certificateRequired: true,
      normalizedRule: `Saudi Arabia ${event}: travelers from the listed 23 countries/territories need at least one IPV dose before travel (type 2 OPV accepted if IPV is unavailable), regardless of age or prior vaccination status.`,
      notes: [...seasonNotes, "A separate list of countries where polio vaccination is only advised appears in the document; advice is not carried as a requirement."],
    }),
    make({
      ...base,
      id: `yellow-fever-event-SA-${event.toLowerCase()}`,
      vaccine: "Yellow Fever",
      travelerGroup: "arrivals_from_listed_countries",
      originScope: "listed_countries",
      originCountries: SAUDI_YF_ORIGINS,
      minimumAge: 9,
      ageUnit: "months",
      minimumAgeExclusive: true,
      certificateRequired: true,
      certificateType: "Yellow fever vaccination certificate",
      certificateValidity: "Valid for life starting 10 days after vaccination",
      normalizedRule: `Saudi Arabia ${event}: travelers older than 9 months arriving from the listed 29 African and 12 South American countries must have a yellow fever vaccination certificate (valid for life from 10 days after vaccination).`,
      notes: [...seasonNotes, "This is the pilgrimage document's rule. Saudi Arabia's general (non-pilgrim) yellow fever entry rule is not verified here.", "Transit treatment is not stated."],
    }),
    make({
      ...base,
      id: `covid-19-event-SA-${event.toLowerCase()}`,
      vaccine: "COVID-19",
      travelerGroup: "pilgrims",
      originScope: "any_origin",
      eventType: event,
      vaccineDetail:
        event === "Umrah"
          ? "Required for travelers over 65, pregnant women, and those with chronic heart, respiratory or kidney disease, hereditary blood disorders, congenital or drug-induced immunodeficiency, cancer or chronic neurological disease. Accepted proof (any one): a single dose of the updated 2025–2026 vaccine; a completed primary series (two or more doses in 2021–2024); or laboratory-confirmed COVID-19 recovery in 2025."
          : "Required for 'specific groups' that the extracted Hajj text does not define; also covers those intending seasonal work in Hajj areas. Accepted proof (any one): a single dose of the updated 2025–2026 vaccine; a completed primary series (two or more doses in 2021–2024); or laboratory-confirmed COVID-19 recovery in 2025.",
      certificateRequired: true,
      normalizedRule: `Saudi Arabia ${event}: COVID-19 vaccination (or documented recovery) is required for specified higher-risk groups only; it is not a requirement for all pilgrims.`,
      notes: [...seasonNotes, event === "Hajj" ? "The risk groups are not defined in the extracted Hajj text; read the PDF." : "Group list transcribed through page extraction; confirm against the PDF."],
    }),
  );
  return rules;
}

/** CDC corroboration copies for the Saudi meningococcal rule: kept so the age-floor difference is preserved, not merged. */
const cdcSaudiMeningococcal: VaccineRule[] = (["Hajj", "Umrah"] as const).map((event) =>
  make({
    id: `meningococcal-event-SA-${event.toLowerCase()}-cdc-baseline`,
    vaccine: "Meningococcal (ACWY)",
    ruleType: "event-specific",
    legalForce: "mandatory",
    travelerGroup: "pilgrims",
    issuingCountry: "SA",
    destinationCountry: "SA",
    eventType: event,
    minimumAge: 1,
    ageUnit: "years",
    vaccineTimingMinimum: days(10),
    vaccineTimingMaximum: years(5),
    vaccineDetail: "Timing: ≥10 days and ≤3 years before arrival for polysaccharide vaccine (MPSV4, no longer available in the United States); ≤5 years before arrival for conjugate vaccine.",
    certificateRequired: true,
    sourceAuthority: "CDC Yellow Book 2026 — Meningococcal Disease",
    authorityTier: "cdc",
    sourceUrl: "https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/meningococcal-disease.html",
    sourcePublishedAt: "2025-04-23",
    lastVerifiedAt: null,
    normalizedRule: `CDC Yellow Book: Saudi Arabia requires quadrivalent meningococcal vaccination for travelers ≥1 year making the ${event} pilgrimage.`,
    verificationStatus: "CDC CORROBORATED",
    notes: ["Previously the only source for this rule in the repository; now secondary to the Saudi Ministry of Health seasonal document."],
    productionVerificationRequired: false,
  }),
);

/* ------------------------------------------------------------------ */
/* Yellow fever — destination-government rules                         */
/* ------------------------------------------------------------------ */

const CDC_YF_BY_COUNTRY: SupportingSource = {
  authority: "CDC Yellow Book 2026 — Yellow Fever Vaccine & Malaria Prevention by Country",
  tier: "cdc",
  url: "https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/yellow-fever-vaccine-and-malaria-prevention-information-by-country.html",
  note: "CDC separates country entry requirements (set under the IHR; some countries ask all arrivals, others only travelers above an age from risk countries, sometimes including airport transit) from its own risk-based recommendations. Page reviewed 2025-04-23; individual country entries were not captured.",
};

const destinationYellowFever: VaccineRule[] = [
  make({
    id: "yellow-fever-entry-UG-ncic-2026-10-02",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "removed",
    travelerGroup: "all_arriving_travelers",
    originScope: "any_origin",
    issuingCountry: "UG",
    destinationCountry: "UG",
    certificateRequired: false,
    sourceAuthority: "Uganda Directorate of Citizenship and Immigration Control (NCIC notice)",
    authorityTier: "destination_government",
    sourceUrl: "https://www.immigration.go.ug/index.php/node/254",
    sourcePublishedAt: "2026-10-02",
    revalidateAfterDays: 7,
    supportingSources: [CDC_YF_BY_COUNTRY],
    normalizedRule: "Uganda: a yellow fever vaccination certificate is no longer a mandatory entry requirement (immigration notice posted 2 Oct 2026). Supersedes the all-arrivals requirement carried in the CDC/WHO baseline.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: [
      "The notice names \"Travelers to Uganda\" without distinguishing by origin, age or transit.",
      "Effective date, ICVP handling and transit are not stated. The notice says the requirement is not listed on the e-visa portal.",
      "Other countries may still require a certificate from travelers coming FROM Uganda (for example Singapore, Saudi Arabia and Sri Lanka list Uganda).",
    ],
  }),
  make({
    id: "yellow-fever-entry-ZA-doh",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "arrivals_from_listed_countries",
    originScope: "listed_countries",
    originCountries: ZA_YF_ORIGINS,
    issuingCountry: "ZA",
    destinationCountry: "ZA",
    transitApplies: true,
    vaccineTimingMinimum: days(10),
    certificateRequired: true,
    certificateType: "ICVP in the IHR model, WHO-approved vaccine, given at an approved yellow fever vaccination centre",
    exemptions: ["Medical waiver: letter from a travel physician stating the vaccine is contraindicated, on clinic letterhead with signature and the validation stamp"],
    sourceAuthority: "South Africa National Department of Health — Guidelines for the Prevention of Yellow Fever Importation",
    authorityTier: "destination_government",
    sourceUrl: "https://www.health.gov.za/wp-content/uploads/2026/09/Guidelines-for-the-Prevention-of-Yellow-Fever-Importation-into-South-Africa.pdf",
    sourcePublishedAt: "2010-01-08",
    revalidateAfterDays: 7,
    supportingSources: [
      { authority: "Government of South Africa — media statement", tier: "destination_government", url: "https://www.gov.za/news/media-statements/health-reviews-yellow-fever-requirements-03-feb-2015", note: "Registry-listed policy page (Feb 2015); not read in this pass." },
      { authority: "DIRCO — yellow fever page", tier: "destination_government", url: "https://dirco.gov.za/canberra/yellow-fever/", note: "Registry-listed mission page; not read in this pass." },
      CDC_YF_BY_COUNTRY,
    ],
    normalizedRule: "South Africa: travelers arriving from the 45 listed risk countries, including those who transit or stop over there, need an ICVP showing yellow fever vaccination at least 10 days earlier. Unvaccinated arrivals may be refused entry or quarantined until the certificate becomes valid, for no more than six days.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: [
      "The registry lists this PDF as the '2026' importation guideline because it sits under /uploads/2026/09/, but the document itself is signed 08/01/2010. Treat it as a dated source and confirm it is still in force.",
      "No transit-duration threshold: the document uses days only.",
      "No age exemption is stated as such. The document says the vaccine is not given under six months and lists infants under nine months and travellers over 60 as precautions or contraindications.",
    ],
  }),
  make({
    id: "yellow-fever-entry-SG-ica",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "arrivals_from_listed_countries",
    originScope: "listed_countries",
    originCountries: SG_YF_ORIGINS,
    issuingCountry: "SG",
    destinationCountry: "SG",
    transitApplies: true,
    transitThresholdHours: 12,
    certificateRequired: true,
    certificateType: "Valid yellow fever vaccination certificate",
    certificateValidity: "Valid 10 days after vaccination; lasts for the life of the person vaccinated",
    sourceAuthority: "Singapore Immigration & Checkpoints Authority",
    authorityTier: "destination_government",
    sourceUrl: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/yellow-fever-vaccination-certificate",
    sourcePublishedAt: "2025-05-07",
    supportingSources: [
      { authority: "Singapore Communicable Diseases Agency", tier: "destination_government", url: "https://www.cda.gov.sg/public/diseases/yellow-fever/", note: "Registry-listed; not read in this pass." },
      CDC_YF_BY_COUNTRY,
    ],
    normalizedRule: "Singapore: travellers (including residents) with recent travel to the 42 listed yellow-fever-risk countries, and those who spent more than 12 hours in airport transit there, must present a valid yellow fever vaccination certificate. Those without one, including children aged 1 and under who cannot be vaccinated, are liable to be quarantined.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: [
      "The country list on the page is marked 'correct as of 18 November 2022'; the page itself was last updated 7 May 2025.",
      "The page describes no age exemption: it states children aged 1 year and below are ineligible for the vaccine yet still liable to quarantine without a certificate.",
      "The look-back period for 'recent travel' is not defined in the captured text.",
    ],
  }),
  make({
    id: "yellow-fever-entry-AU-health",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "declaration",
    travelerGroup: "arrivals_from_risk_countries",
    originScope: "risk_countries_unenumerated",
    originRiskAreaNote: "Australia's own list of yellow-fever-risk countries and areas (29 African countries and 13 South/Central American entries, some partial such as Argentina's Misiones and Corrientes provinces and Ecuador excluding the Galápagos) on page 4 of the fact sheet; not transcribed here",
    issuingCountry: "AU",
    destinationCountry: "AU",
    exposureLookbackDays: 6,
    certificateRequired: false,
    certificateType: "ICVP (may be requested by a Biosecurity Officer)",
    sourceAuthority: "Australian Department of Health, Disability and Ageing — yellow fever fact sheet (April 2026)",
    authorityTier: "destination_government",
    sourceUrl: "https://www.health.gov.au/sites/default/files/2026-04/yellow-fever-fact-sheet.pdf",
    sourcePublishedAt: "2026-04-01",
    supportingSources: [{ authority: "Australian Immunisation Handbook", tier: "destination_government", url: "https://immunisationhandbook.health.gov.au/contents/vaccine-preventable-diseases/yellow-fever", note: "Clinical guidance; registry-listed, not read in this pass." }],
    normalizedRule: "Australia: travellers must declare a visit to a yellow-fever-risk country or area in the last six days and may be asked for an ICVP. Australia does not refuse entry for lack of vaccination; travellers without proof are referred to a Biosecurity Officer, who issues an action card advising them to see a doctor if symptoms appear within six days of arrival.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: [
      "Declaration-and-follow-up regime, not a vaccination condition of entry.",
      "Publication date is known to the month only (April 2026). Age and transit treatment are not addressed in the captured text; the fact sheet does not say whether the six days run from departure or arrival.",
    ],
  }),
  make({
    id: "yellow-fever-entry-IN-ihpoe",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "arrivals_from_risk_countries",
    originScope: "risk_countries_unenumerated",
    originRiskAreaNote: "'YF endemic countries' per the WHO list the page says was updated 3 Jan 2023; the list was not captured",
    issuingCountry: "IN",
    destinationCountry: "IN",
    transitApplies: true,
    vaccineTimingMinimum: days(10),
    certificateRequired: true,
    certificateType: "WHO yellow fever card (ICVP), signed by the clinician and bearing the centre's official stamp, from an authorised centre in India",
    certificateValidity: "Life of the person vaccinated; valid 10 days after vaccination",
    sourceAuthority: "India — International Health / Points of Entry (Ministry of Health and Family Welfare)",
    authorityTier: "destination_government",
    sourceUrl: "https://ihpoe.mohfw.gov.in/test2025/vaccination.php",
    sourcePublishedAt: null,
    supportingSources: [CDC_YF_BY_COUNTRY],
    normalizedRule: "India: passengers travelling to and from yellow-fever-endemic countries, including those passing through an endemic country even if they stay seated on the aircraft, must hold a valid yellow fever vaccination certificate. Arrivals without a valid certificate are quarantined for up to six days from last possible exposure or until the certificate becomes valid, whichever comes first; an exemption or contraindication does not avoid quarantine.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: [
      "The page URL contains '/test2025/'; confirm it is the production publication of the rule.",
      "The page gives no publication date and gives inconsistent minimum ages for vaccination (9 months in one place, 6 months in another); no age threshold for the requirement is stated.",
      "The endemic-country list was not captured.",
    ],
  }),
  make({
    id: "yellow-fever-entry-LK-immigration",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "arrivals_from_listed_countries",
    originScope: "listed_countries",
    originCountries: LK_YF_ORIGINS,
    issuingCountry: "LK",
    destinationCountry: "LK",
    certificateRequired: true,
    certificateType: "Yellow fever vaccination certificate produced at the airport immigration counter",
    sourceAuthority: "Sri Lanka Department of Immigration & Emigration",
    authorityTier: "destination_government",
    sourceUrl: "https://immigration.gov.lk/pages_e.php?id=22",
    sourcePublishedAt: "2026-10-07",
    supportingSources: [CDC_YF_BY_COUNTRY],
    normalizedRule: "Sri Lanka: passengers from the 46 listed African and South American countries must produce a yellow fever vaccination certificate at the airport immigration counter; without it they will not be allowed to enter.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: [
      "The date shown is the page footer 'Last Update: 2026-10-07'; it is not a rule effective date.",
      "The list names 'Zaire', mapped here to the Democratic Republic of the Congo.",
      "Transit, age exemptions and certificate validity are not stated.",
    ],
  }),
  make({
    id: "yellow-fever-entry-BW-moh",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "arrivals_from_risk_countries",
    originScope: "risk_countries_unenumerated",
    originRiskAreaNote: "Travelers who are from, have visited or have transited yellow-fever-endemic areas; countries are not named",
    issuingCountry: "BW",
    destinationCountry: "BW",
    transitApplies: true,
    certificateRequired: true,
    certificateType: "International Certificate of Vaccination or Prophylaxis",
    sourceAuthority: "Botswana Government / Ministry of Health (Port Health Unit)",
    authorityTier: "destination_government",
    sourceUrl: "https://www.gov.bw/disease-prevention-control/yellow-fever-vaccination?page=1",
    supportingSources: [{ authority: "Botswana — health guidelines for ports of entry", tier: "destination_government", url: "https://www.gov.bw/learning-and-teaching/health-guidelines-ports-entry?page=1", note: "Registry-listed; not read in this pass." }],
    normalizedRule: "Botswana: an ICVP showing yellow fever vaccination is required, particularly for travelers from, or who have visited or transited, yellow-fever-endemic areas.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: ["The page does not name the endemic countries, give a transit-hour threshold, an age exemption, a publication date or an effective date.", "The page says Botswana 'and other countries' require the certificate; the Port Health Unit is the listed contact."],
  }),
  make({
    id: "yellow-fever-entry-GY-dpi",
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "arrivals_from_risk_countries",
    originScope: "risk_countries_unenumerated",
    originRiskAreaNote: "Travelers from yellow-fever-endemic countries, described as 'mainly from the African continent'; the list is not given",
    issuingCountry: "GY",
    destinationCountry: "GY",
    certificateRequired: true,
    certificateType: "Valid International Certificate of Vaccination or Prophylaxis",
    sourceAuthority: "Guyana Department of Public Information (Ministry of Public Health statement)",
    authorityTier: "destination_government",
    sourceUrl: "https://dpi.gov.gy/yellow-fever-immunization-requirements-for-entry-into-guyana/",
    sourcePublishedAt: "2016-07-08",
    supportingSources: [CDC_YF_BY_COUNTRY],
    normalizedRule: "Guyana: travelers from yellow-fever-endemic countries should hold a valid ICVP on arrival.",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
    notes: ["Dated source (2016). The wording is 'should also be in possession of', so enforcement strength is not stated.", "Transit, age exemptions and timing are not mentioned. The article also says Guyana residents are required to be immunized before travel."],
  }),
];

/* ------------------------------------------------------------------ */
/* Costa Rica — outbound (resident) yellow fever rule                  */
/* ------------------------------------------------------------------ */

const costaRicaOutbound: VaccineRule = make({
  id: "yellow-fever-exit-CR-minsa-2026-10",
  vaccine: "Yellow Fever",
  ruleType: "exit",
  legalForce: "mandatory",
  travelerGroup: "residents_departing",
  originScope: "issuing_country_residents",
  originCountries: ["CR"],
  issuingCountry: "CR",
  destinationCountries: ["BO", "EC", "PY", "TT", "VE", "SR", "GY", "GF", "CO", "BR", "PE"],
  destinationNote: "Plus 'países del continente africano', which the notice does not name",
  residencyApplies: true,
  vaccineTimingMinimum: days(10, "travel"),
  certificateRequired: true,
  certificateType: "Certificado Internacional de Vacunación contra la Fiebre Amarilla (digital, via the Ministry's virtual office, EDUS or Pura Vida Móvil)",
  validFrom: "2026-10-01",
  sourceAuthority: "Costa Rica Ministerio de Salud",
  authorityTier: "destination_government",
  sourceUrl: "https://ministeriodesalud.go.cr/index.php/muestratitulocomunicado/2635-salud-recuerda-cumplir-requisito-de-vacunacion-contra-la-fiebre-amarilla-a-partir-del-1-de-octubre",
  sourcePublishedAt: "2026-09-21",
  revalidateAfterDays: 7,
  supportingSources: [
    { authority: "Costa Rica Ministerio de Salud — 2026 update", tier: "destination_government", url: "https://www.ministeriodesalud.go.cr/index.php/prensa/67-noticias-2026/2364-ministerio-de-salud-actualiza-disposiciones-sobre-fiebre-amarilla-y-mantiene-vacunacion-obligatoria-para-viajeros-a-zonas-de-ri", note: "Notice of 20 Feb 2026 (read): original schedule of 1 March (Colombia) and 16 March 2026 (Brazil, Peru, Africa) under Resolución Ministerial MS-DM-RC-2214-2024, postponed because of vaccine demand." },
    { authority: "Costa Rica Ministerio de Salud — deadline extension", tier: "destination_government", url: "https://ministeriodesalud.go.cr/index.php/muestratitulocomunicado/2618-plazo-para-el-requisito-de-vacunacion-contra-la-fiebre-amarilla-se-amplia-hasta-el-1-de-octubre", note: "Registry-listed August 2026 extension to 1 October; not read in this pass." },
  ],
  normalizedRule: "Costa Rica: from 1 Oct 2026, Costa Rican nationals and residents travelling to the listed destinations (Bolivia, Ecuador, Paraguay, Trinidad and Tobago, Venezuela, Suriname, Guyana, French Guiana, Colombia, Brazil, Peru and African countries) must be vaccinated against yellow fever at least 10 days before travel and hold the international certificate.",
  verificationStatus: "DESTINATION-GOVERNMENT VERIFIED",
  notes: [
    "This is a rule on Costa Rican nationals and residents leaving for risk destinations. The notices do not establish a yellow fever entry requirement for foreign visitors entering Costa Rica.",
    "Mandatory status follows the notice headline ('mantiene vacunación obligatoria para viajeros a zonas de riesgo') and the September reminder; where it is enforced (departure, return or both) and age thresholds are not stated.",
  ],
});

/* ------------------------------------------------------------------ */
/* CDC / WHO compiled baseline: yellow fever from ALL arrivals          */
/* ------------------------------------------------------------------ */

const YB_YF_TABLE: SupportingSource = {
  authority: "CDC Yellow Book 2026, Table 4.21.4",
  tier: "cdc",
  url: "https://www.ncbi.nlm.nih.gov/books/NBK620866/table/yellowfever.tab6/",
  note: "Countries requiring proof of yellow fever vaccination from all arriving travelers; the list derives from WHO International Travel and Health Annex 1 (list last published Jan 2023).",
};

const baselineYellowFever: VaccineRule[] = Object.entries(CDC_YF_ALL_ARRIVALS).map(([iso2, name]) =>
  make({
    id: `yellow-fever-entry-${iso2}-baseline`,
    vaccine: "Yellow Fever",
    ruleType: "entry",
    legalForce: "mandatory",
    travelerGroup: "all_arriving_travelers",
    originScope: "any_origin",
    issuingCountry: iso2,
    destinationCountry: iso2,
    certificateRequired: true,
    sourceAuthority: "CDC Yellow Book 2026, Table 4.21.4 (compiling WHO International Travel and Health Annex 1, list last published Jan 2023)",
    authorityTier: "global_compilation",
    sourceUrl: "https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/yellow-fever.html",
    sourcePublishedAt: "2025-04-23",
    retrievedAt: CAPTURED,
    lastVerifiedAt: null,
    supportingSources: [YB_YF_TABLE],
    normalizedRule: `${name} is listed as requiring proof of yellow fever vaccination from all arriving travelers.`,
    verificationStatus: iso2 === "BJ" ? "NOT CURRENTLY VERIFIED" : "OLDER GLOBAL BASELINE",
    productionVerificationRequired: true,
    notes: [
      "Compiled global list copied into this repository; it was not retrieved from the destination government. Age thresholds, transit and exemptions are not carried by the compilation.",
      ...(iso2 === "BJ" ? ["The source registry lists a 2026 Benin Ministry of Health notice on health formalities at points of entry. That page could not be retrieved in this pass (TLS certificate does not match the host), so this baseline cannot be treated as current."] : []),
    ],
    revalidateAfterDays: iso2 === "BJ" ? 7 : 30,
  }),
);

export const VACCINE_RULES: readonly VaccineRule[] = [
  ...baselineYellowFever,
  ...destinationYellowFever,
  costaRicaOutbound,
  ...saudiSeasonRules("Umrah"),
  ...saudiSeasonRules("Hajj"),
  ...cdcSaudiMeningococcal,
  ...whoPolioCategory1,
  ...whoPolioCategory2,
];

/** Rule sources the registry flags as volatile in 2026 but that could not be read in this pass. */
export const UNREAD_VOLATILE_SOURCES: ReadonlyArray<{ iso2: string; authority: string; url: string; reason: string }> = [
  { iso2: "BJ", authority: "Benin Ministry of Health", url: "https://www.sante.gouv.bj/article/actualites/information-sur-les-formalites-sanitaires-aux-points-dentree-du-benin", reason: "Registry flags a 2026 health-formalities notice; fetch failed (TLS certificate does not match the host)." },
  { iso2: "KE", authority: "Kenya Ministry of Health", url: "https://www.health.go.ke/index.php/incoming-travellers", reason: "Incoming-traveller yellow fever page could not be fetched." },
  { iso2: "TZ", authority: "Tanzania Ministry of Health", url: "https://www.moh.go.tz/storage/app/uploads/public/65a/f76/a77/65af76a777832906196271.pdf", reason: "Yellow fever entry-requirements PDF could not be fetched." },
  { iso2: "PK", authority: "Pakistan Polio Eradication Programme", url: "https://www.poliofreepakistan.gov.pk/certificate/vaccination-certificate", reason: "National polio departure-certificate page could not be fetched (TLS verification failed)." },
  { iso2: "MY", authority: "Malaysia Ministry of Health", url: "https://www.moh.gov.my/en/core/health-information/yellow-fever", reason: "Yellow fever page timed out." },
  { iso2: "SC", authority: "Seychelles Ministry of Health", url: "https://www.health.gov.sc/yellow-fever-vaccine/", reason: "Page returned no body text." },
];
