import type { SourceDefinition } from "./types";

const FR_API = "https://www.federalregister.gov/api/v1/documents.json";
const FR_DOCS = "https://www.federalregister.gov/developers/documentation/api/v1";
const US = { country: "United States", region: "North America", jurisdiction: "United States (federal)" };
const UK = { country: "United Kingdom", region: "Europe", jurisdiction: "United Kingdom" };

const frSource = (id: string, agency: string, slug: string, categories: string[], extra: Partial<SourceDefinition> = {}): SourceDefinition => ({
  id, agency: `${agency} (via Federal Register)`, ...US, url: FR_API, discoveryUrl: FR_DOCS, method: "federal_register_api",
  sourceType: "Official JSON API — Federal Register documents", authority: "official_government", docClass: "binding_regulation",
  categories, authRequired: false, authNote: "No key required.", pollHours: 12, relevance: "all", urlBasis: "documented_api",
  fr: { agency: slug, types: ["RULE", "PRORULE", "NOTICE"] }, ...extra,
});

const rss = (id: string, agency: string, url: string, discoveryUrl: string, geo: Pick<SourceDefinition, "country" | "region" | "jurisdiction">, docClass: SourceDefinition["docClass"], categories: string[], extra: Partial<SourceDefinition> = {}): SourceDefinition => ({
  id, agency, ...geo, url, discoveryUrl, method: "rss", sourceType: "Official RSS feed", authority: "official_government", docClass, categories,
  authRequired: false, authNote: "No key required.", pollHours: 12, relevance: "all", urlBasis: "listed_on_official_index", ...extra,
});

const pending = (id: string, agency: string, geo: Pick<SourceDefinition, "country" | "region" | "jurisdiction">, discoveryUrl: string, authority: SourceDefinition["authority"], docClass: SourceDefinition["docClass"], categories: string[], reason: string): SourceDefinition => ({
  id, agency, ...geo, url: null, discoveryUrl, method: "none", sourceType: "No confirmed machine-readable endpoint", authority, docClass, categories,
  authRequired: false, authNote: "Not applicable until an endpoint is confirmed.", pollHours: 12, relevance: "occupational", urlBasis: "none_confirmed", pendingReason: reason,
});

const OSHA_CATS = ["occupational_medicine", "industrial_hygiene", "environmental_safety"];
const NO_ENDPOINT = "No keyless RSS, Atom, or API endpoint was confirmed for this source in Phase 1. Nothing is fetched and no content is inferred.";

export const STANDARDS_SOURCES: SourceDefinition[] = [
  // ── United States: Federal Register API (keyless, structured: type, effective date, RIN, corrections) ──
  frSource("fr-osha", "OSHA", "occupational-safety-and-health-administration", OSHA_CATS),
  frSource("fr-msha", "MSHA", "mine-safety-and-health-administration", ["construction_mining_energy", "respiratory", "industrial_hygiene"]),
  frSource("fr-fmcsa", "FMCSA", "federal-motor-carrier-safety-administration", ["commercial_driver", "employment_exams"]),
  frSource("fr-faa", "FAA", "federal-aviation-administration", ["aviation"], { fr: { agency: "federal-aviation-administration", term: "airman medical certification OR aviation medical OR aerospace medicine", types: ["RULE", "PRORULE", "NOTICE"] }, relevance: "occupational" }),
  frSource("fr-cdc", "CDC (including NIOSH notices)", "centers-for-disease-control-and-prevention", ["infectious_disease", "vaccination", "occupational_medicine", "respiratory"], { relevance: "occupational" }),
  frSource("fr-fda", "FDA", "food-and-drug-administration", ["drug_safety", "vaccination", "laboratory_diagnostics"], { fr: { agency: "food-and-drug-administration", term: "drug safety OR vaccine OR medical device OR laboratory OR biological product", types: ["RULE", "PRORULE", "NOTICE"] }, relevance: "occupational" }),
  frSource("fr-hhs", "HHS", "health-and-human-services-department", ["privacy_records"], { fr: { agency: "health-and-human-services-department", term: "HIPAA OR health information privacy OR occupational", types: ["RULE", "PRORULE", "NOTICE"] }, relevance: "occupational" }),
  frSource("fr-eeoc", "EEOC", "equal-employment-opportunity-commission", ["employment_exams"], { relevance: "occupational" }),
  frSource("fr-uscg", "U.S. Coast Guard", "coast-guard", ["maritime"], { fr: { agency: "coast-guard", term: "merchant mariner medical OR mariner physical OR medical certificate", types: ["RULE", "PRORULE", "NOTICE"] }, relevance: "occupational" }),

  // ── United States: eCFR versioner (keyless; the issuer's own amendment list gives verified version comparison) ──
  {
    id: "ecfr-versions", agency: "eCFR (Office of the Federal Register / GPO)", ...US, url: "https://www.ecfr.gov/api/versioner/v1/versions", discoveryUrl: "https://www.ecfr.gov/developers/documentation/api/v1",
    method: "ecfr_versioner_api", sourceType: "Official JSON API — CFR amendment history", authority: "official_government", docClass: "binding_regulation",
    categories: ["occupational_medicine", "industrial_hygiene", "commercial_driver", "aviation", "maritime", "construction_mining_energy"],
    authRequired: false, authNote: "No key required.", pollHours: 12, relevance: "all", urlBasis: "documented_api",
    ecfr: [
      { title: 29, part: 1910, label: "OSHA General Industry Standards" },
      { title: 29, part: 1926, label: "OSHA Construction Standards" },
      { title: 29, part: 1904, label: "OSHA Recording and Reporting Occupational Injuries and Illnesses" },
      { title: 29, part: 1915, label: "OSHA Shipyard Employment Standards" },
      { title: 30, part: 56, label: "MSHA Metal and Nonmetal Mine Safety and Health (surface)" },
      { title: 42, part: 84, label: "Approval of Respiratory Protective Devices" },
      { title: 49, part: 391, label: "FMCSA Qualifications of Drivers" },
      { title: 49, part: 40, label: "DOT Workplace Drug and Alcohol Testing Procedures" },
      { title: 14, part: 67, label: "FAA Medical Standards and Certification" },
      { title: 46, part: 10, label: "Coast Guard Merchant Mariner Credentials (medical)" },
    ],
  },

  // ── United States: OSHA RSS feeds listed on https://www.osha.gov/rss/ ──
  rss("osha-federal-register", "OSHA", "https://www.osha.gov/laws-regs/federalregisters.xml", "https://www.osha.gov/rss/", US, "binding_regulation", OSHA_CATS),
  rss("osha-interpretations", "OSHA", "https://www.osha.gov/laws-regs/standardinterpretations.xml", "https://www.osha.gov/rss/", US, "official_guidance", OSHA_CATS),
  rss("osha-directives", "OSHA", "https://www.osha.gov/enforcement/directives.xml", "https://www.osha.gov/rss/", US, "official_guidance", OSHA_CATS),
  rss("osha-news-releases", "OSHA", "https://www.osha.gov/news/newsreleases.xml", "https://www.osha.gov/rss/", US, "announcement", OSHA_CATS, { relevance: "occupational" }),
  rss("osha-quicktakes", "OSHA", "https://www.osha.gov/sites/default/files/quicktakes.xml", "https://www.osha.gov/rss/", US, "announcement", OSHA_CATS),

  // ── United States: GovInfo RSS listed on https://www.govinfo.gov/feeds (publication-level indexes, not individual rules) ──
  rss("govinfo-federal-register", "GovInfo (U.S. Government Publishing Office) — Federal Register", "https://www.govinfo.gov/rss/fr.xml", "https://www.govinfo.gov/feeds", US, "index", ["occupational_medicine"]),
  rss("govinfo-lsa", "GovInfo (U.S. Government Publishing Office) — List of CFR Sections Affected", "https://www.govinfo.gov/rss/lsa.xml", "https://www.govinfo.gov/feeds", US, "index", ["occupational_medicine"]),
  rss("govinfo-cfr", "GovInfo (U.S. Government Publishing Office) — Code of Federal Regulations", "https://www.govinfo.gov/rss/cfr.xml", "https://www.govinfo.gov/feeds", US, "index", ["occupational_medicine"]),

  // ── United States: BLS RSS listed on https://www.bls.gov/feed/ ──
  rss("bls-iif-latest", "BLS — Injuries, Illnesses, and Fatalities", "https://www.bls.gov/feed/iif_latest.rss", "https://www.bls.gov/feed/", US, "research", ["occupational_medicine", "environmental_safety"]),
  rss("bls-cfoi", "BLS — Census of Fatal Occupational Injuries", "https://www.bls.gov/feed/cfoi.rss", "https://www.bls.gov/feed/", US, "research", ["occupational_medicine", "environmental_safety"]),
  rss("bls-osh", "BLS — Employer-Reported Workplace Injuries and Illnesses", "https://www.bls.gov/feed/osh.rss", "https://www.bls.gov/feed/", US, "research", ["occupational_medicine", "environmental_safety"]),

  // ── United States: CDC / NIOSH and FDA (addresses follow the agencies' published feed patterns; verified at run time, never assumed) ──
  rss("cdc-mmwr", "CDC — Morbidity and Mortality Weekly Report", "https://tools.cdc.gov/api/v2/resources/media/342778.rss", "https://www.cdc.gov/mmwr/", US, "research", ["infectious_disease", "vaccination", "occupational_medicine"], { urlBasis: "documented_pattern", relevance: "occupational" }),
  rss("fda-press-releases", "FDA", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds", US, "announcement", ["drug_safety", "vaccination", "laboratory_diagnostics"], { urlBasis: "documented_pattern", relevance: "occupational" }),
  rss("fda-medwatch", "FDA — MedWatch Safety Alerts", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml", "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds", US, "announcement", ["drug_safety"], { urlBasis: "documented_pattern", relevance: "occupational" }),

  // ── International ──
  { ...rss("uk-legislation-new", "UK Legislation (The National Archives)", "https://www.legislation.gov.uk/new/data.feed", "https://www.legislation.gov.uk/developer", UK, "binding_regulation", ["occupational_medicine", "industrial_hygiene", "environmental_safety", "international"], { urlBasis: "documented_pattern", relevance: "occupational" }), method: "atom", sourceType: "Official Atom feed" },
  { ...rss("uk-hse-govuk", "UK Health and Safety Executive (GOV.UK)", "https://www.gov.uk/government/organisations/health-and-safety-executive.atom", "https://www.gov.uk/government/organisations/health-and-safety-executive", UK, "official_guidance", ["occupational_medicine", "industrial_hygiene", "international"], { urlBasis: "documented_pattern" }), method: "atom", sourceType: "Official Atom feed" },
  rss("who-news", "World Health Organization", "https://www.who.int/rss-feeds/news-english.xml", "https://www.who.int/rss-feeds", { country: "International", region: "Global", jurisdiction: "International (WHO)" }, "announcement", ["infectious_disease", "vaccination", "international"], { urlBasis: "documented_pattern", relevance: "occupational", authority: "intergovernmental" }),

  // ── Registered, not yet ingestible: no machine-readable endpoint confirmed ──
  pending("niosh-publications", "NIOSH (CDC) — science blog and publications", US, "https://www.cdc.gov/niosh/", "official_government", "research", ["occupational_medicine", "industrial_hygiene", "respiratory", "hearing"], "The blog address that follows the CDC blog pattern returned HTTP 404 from the production server, and no feed link is published on the blog's subscribe page. NIOSH notices that appear in the Federal Register are covered by the CDC Federal Register source. " + NO_ENDPOINT),
  pending("eu-osha", "EU-OSHA (European Agency for Safety and Health at Work)", { country: "European Union", region: "Europe", jurisdiction: "European Union" }, "https://osha.europa.eu", "intergovernmental", "official_guidance", ["occupational_medicine", "international"], "The site was inspected and exposes no RSS/Atom link. " + NO_ENDPOINT),
  pending("eur-lex", "EUR-Lex (Publications Office of the European Union)", { country: "European Union", region: "Europe", jurisdiction: "European Union" }, "https://eur-lex.europa.eu", "intergovernmental", "binding_regulation", ["occupational_medicine", "international"], "EUR-Lex feeds are tied to saved searches and the CELLAR SPARQL endpoint needs a dedicated adapter. " + NO_ENDPOINT),
  pending("ilo-normlex", "ILO (International Labour Organization)", { country: "International", region: "Global", jurisdiction: "International (ILO)" }, "https://www.ilo.org", "intergovernmental", "official_guidance", ["occupational_medicine", "international"], NO_ENDPOINT),
  pending("iarc-monographs", "IARC (International Agency for Research on Cancer)", { country: "International", region: "Global", jurisdiction: "International (WHO/IARC)" }, "https://monographs.iarc.who.int", "intergovernmental", "research", ["industrial_hygiene", "international"], NO_ENDPOINT),
  pending("cal-osha", "Cal/OSHA and the Occupational Safety and Health Standards Board", { country: "United States", region: "North America", jurisdiction: "California" }, "https://www.dir.ca.gov/dosh/", "official_government", "binding_regulation", ["occupational_medicine", "industrial_hygiene"], NO_ENDPOINT),
  pending("nfpa-revisions", "NFPA (National Fire Protection Association)", US, "https://www.nfpa.org", "standards_body", "consensus_standard", ["emergency_response"], "Standards text is restricted. Revision announcements would be metadata only. " + NO_ENDPOINT),
  pending("ansi-news", "ANSI (American National Standards Institute)", US, "https://www.ansi.org", "standards_body", "consensus_standard", ["environmental_safety"], "Standards text is restricted. Revision announcements would be metadata only. " + NO_ENDPOINT),
  pending("iso-standards", "ISO (International Organization for Standardization)", { country: "International", region: "Global", jurisdiction: "International (ISO)" }, "https://www.iso.org", "standards_body", "consensus_standard", ["environmental_safety", "international"], "Standards text is restricted. Revision announcements would be metadata only. " + NO_ENDPOINT),
];

export const sourceById = (id: string) => STANDARDS_SOURCES.find((source) => source.id === id);
export const isIngestible = (source: SourceDefinition) => source.method !== "none" && !!source.url;
