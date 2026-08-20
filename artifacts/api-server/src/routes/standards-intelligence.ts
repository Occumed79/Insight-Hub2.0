import { Router, type IRouter } from "express";

type FindingLevel = "info" | "review" | "waiver" | "strict";
type StandardAuthority = "official-policy" | "regulation" | "official-guidance" | "consensus-standard";
type RuleCoverage = "automated-medical" | "trigger-based" | "reference";

type StandardSource = {
  id: string;
  shortLabel: string;
  title: string;
  edition: string;
  authority: StandardAuthority;
  category: string;
  sourceUrl: string;
  description: string;
  currentAsOf: string;
  lastVerified: string;
  coverage: RuleCoverage;
  topics: string[];
};

type ReviewContext = {
  frameworks: string[];
  occupation: string;
  condition: string;
  medication: string;
  age?: number;
  a1c?: number;
  ahi?: number;
  papCompliance?: number;
  epworth?: number;
  sbp?: number;
  dbp?: number;
  ascvd?: number;
  weightLb?: number;
  noiseTwaDba?: number;
  respiratorRequired?: boolean;
  hazwoperCovered?: boolean;
  bloodborneExposure?: boolean;
  leadSurveillance?: boolean;
  asbestosSurveillance?: boolean;
  cadmiumSurveillance?: boolean;
  dotTesting?: boolean;
};

type StandardFinding = {
  id: string;
  standardId: string;
  level: FindingLevel;
  title: string;
  summary: string;
  action: string;
  citation: string;
  sourceUrl: string;
  topics: string[];
  matchedBy: string[];
};

type Recommendation = { standardId: string; reason: string };

const SOURCES: StandardSource[] = [
  {
    id: "centcom-mod18",
    shortLabel: "CENTCOM MOD 18",
    title: "USCENTCOM MOD EIGHTEEN + TAB A",
    edition: "201214Z AUG 25",
    authority: "official-policy",
    category: "Deployment",
    sourceUrl: "https://www.centcom.mil/CONTACT/THEATRE-MEDICAL-REQUIREMENTS/",
    description: "USCENTCOM deployment policy and amplified minimal medical fitness standards for the CENTCOM AOR.",
    currentAsOf: "20 Aug 2025",
    lastVerified: "2026-08-19",
    coverage: "automated-medical",
    topics: ["deployment", "fitness", "waiver", "medication", "dental", "behavioral health"],
  },
  {
    id: "fmcsa",
    shortLabel: "FMCSA",
    title: "49 CFR Part 391 + Medical Examiner's Handbook",
    edition: "2024 handbook / current CFR",
    authority: "regulation",
    category: "Transportation",
    sourceUrl: "https://www.fmcsa.dot.gov/regulations/medical/medical-regulations-and-guidance-resource-links",
    description: "Physical qualification regulations, Medical Advisory Criteria, and FMCSA medical examiner guidance for CMV drivers.",
    currentAsOf: "Current CFR + Jan 2024 handbook",
    lastVerified: "2026-08-19",
    coverage: "automated-medical",
    topics: ["commercial driver", "CMV", "seizure", "diabetes", "vision", "hearing", "medication"],
  },
  {
    id: "faa",
    shortLabel: "FAA",
    title: "FAA Guide for Aviation Medical Examiners",
    edition: "Current revision",
    authority: "official-guidance",
    category: "Aviation",
    sourceUrl: "https://www.faa.gov/ame_guide",
    description: "Aeromedical certification standards, disposition tables, protocols, and medication guidance.",
    currentAsOf: "Current FAA AME Guide",
    lastVerified: "2026-08-19",
    coverage: "automated-medical",
    topics: ["aviation", "pilot", "medication", "psychiatric", "OSA", "hypertension"],
  },
  {
    id: "nfpa1580",
    shortLabel: "NFPA 1580",
    title: "NFPA 1580 — Emergency Responder Occupational Health and Wellness",
    edition: "2025",
    authority: "consensus-standard",
    category: "Emergency Response",
    sourceUrl: "https://link.nfpa.org/all-publications/1580/2025",
    description: "Emergency-responder occupational health and wellness standard; occupational-medical content is in Chapters 9–13.",
    currentAsOf: "2025 edition",
    lastVerified: "2026-08-19",
    coverage: "automated-medical",
    topics: ["firefighter", "EMS", "SCBA", "essential job tasks", "fitness"],
  },
  {
    id: "osha-respiratory",
    shortLabel: "OSHA RESPIRATORY",
    title: "29 CFR 1910.134 — Respiratory Protection",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.134",
    description: "Respirator medical evaluation, fit testing, program administration, and written PLHCP recommendation requirements.",
    currentAsOf: "Current 29 CFR 1910.134",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["respirator", "medical evaluation", "fit test", "PLHCP", "PAPR"],
  },
  {
    id: "osha-noise",
    shortLabel: "OSHA HEARING",
    title: "29 CFR 1910.95 — Occupational Noise Exposure",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.95",
    description: "Occupational noise exposure and hearing-conservation requirements, including audiometric testing when the action level applies.",
    currentAsOf: "Current 29 CFR 1910.95",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["noise", "audiogram", "hearing conservation", "STS"],
  },
  {
    id: "osha-hazwoper",
    shortLabel: "OSHA HAZWOPER",
    title: "29 CFR 1910.120 — HAZWOPER",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.120",
    description: "Hazardous-waste and emergency-response medical surveillance, medical consultation, PPE, and training requirements.",
    currentAsOf: "Current 29 CFR 1910.120",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["HAZWOPER", "HAZMAT", "medical surveillance", "PPE", "emergency response"],
  },
  {
    id: "osha-bloodborne",
    shortLabel: "OSHA BLOODBORNE",
    title: "29 CFR 1910.1030 — Bloodborne Pathogens",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1030/",
    description: "Occupational blood/OPIM exposure controls, hepatitis B vaccination, and post-exposure evaluation requirements.",
    currentAsOf: "Current 29 CFR 1910.1030",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["bloodborne pathogens", "HBV", "needlestick", "post-exposure"],
  },
  {
    id: "osha-lead",
    shortLabel: "OSHA LEAD",
    title: "29 CFR 1910.1025 — Lead",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1025",
    description: "General-industry lead exposure standard with biologic monitoring and medical-surveillance provisions.",
    currentAsOf: "Current 29 CFR 1910.1025",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["lead", "blood lead", "medical surveillance", "biologic monitoring"],
  },
  {
    id: "osha-asbestos",
    shortLabel: "OSHA ASBESTOS",
    title: "29 CFR 1910.1001 — Asbestos",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1001",
    description: "General-industry asbestos standard with exposure, respiratory-protection, and medical-surveillance requirements.",
    currentAsOf: "Current 29 CFR 1910.1001",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["asbestos", "respiratory", "medical surveillance"],
  },
  {
    id: "osha-cadmium",
    shortLabel: "OSHA CADMIUM",
    title: "29 CFR 1910.1027 — Cadmium",
    edition: "Current OSHA standard",
    authority: "regulation",
    category: "OSHA Medical Surveillance",
    sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1027",
    description: "Cadmium exposure standard with medical-surveillance and biologic-monitoring requirements.",
    currentAsOf: "Current 29 CFR 1910.1027",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["cadmium", "medical surveillance", "biologic monitoring"],
  },
  {
    id: "dot-part40",
    shortLabel: "DOT PART 40",
    title: "49 CFR Part 40 — Transportation Workplace Drug and Alcohol Testing",
    edition: "Current rule + ODAPC guidance",
    authority: "regulation",
    category: "Drug & Alcohol Testing",
    sourceUrl: "https://www.transportation.gov/odapc/part40",
    description: "DOT-wide procedures for regulated workplace drug and alcohol testing, collectors, laboratories, MROs, BAT/STTs, and service agents.",
    currentAsOf: "ODAPC updated 15 May 2026",
    lastVerified: "2026-08-19",
    coverage: "trigger-based",
    topics: ["DOT drug test", "urine", "oral fluid", "CCF", "MRO", "alcohol"],
  },
];

const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));
const SEVERITY: Record<FindingLevel, number> = { info: 0, review: 1, waiver: 2, strict: 3 };
const norm = (value: string | undefined) => (value ?? "").toLowerCase();
const has = (text: string, ...needles: string[]) => needles.some((needle) => text.includes(needle));

function finding(
  id: string,
  standardId: string,
  level: FindingLevel,
  title: string,
  summary: string,
  action: string,
  citation: string,
  topics: string[],
  matchedBy: string[],
  sourceUrl?: string,
): StandardFinding {
  const source = SOURCE_BY_ID.get(standardId);
  return {
    id,
    standardId,
    level,
    title,
    summary,
    action,
    citation,
    topics,
    matchedBy,
    sourceUrl: sourceUrl ?? source?.sourceUrl ?? "",
  };
}

function recommendFrameworks(context: ReviewContext): Recommendation[] {
  const recommendations = new Map<string, string>();
  const occupation = norm(context.occupation);
  const combined = `${occupation} ${norm(context.condition)} ${norm(context.medication)}`;
  const add = (standardId: string, reason: string) => {
    if (SOURCE_BY_ID.has(standardId) && !recommendations.has(standardId)) recommendations.set(standardId, reason);
  };

  if (has(occupation, "deploy", "contractor", "dod", "centcom")) add("centcom-mod18", "Deployment / DoD contractor context");
  if (has(occupation, "driver", "truck", "commercial motor", "cmv")) {
    add("fmcsa", "Commercial motor-vehicle context");
    add("dot-part40", "DOT-regulated transportation context");
  }
  if (has(occupation, "pilot", "aviation", "aircrew", "air traffic")) add("faa", "Aviation medical context");
  if (has(occupation, "fire", "ems", "emergency responder", "firefighter")) {
    add("nfpa1580", "Emergency-responder context");
    add("osha-respiratory", "SCBA / respirator use is common in emergency response");
    add("osha-noise", "Emergency-response work commonly includes hazardous-noise exposure");
    add("osha-bloodborne", "EMS / emergency-response bloodborne-exposure potential");
  }
  if (context.respiratorRequired || has(combined, "respirator", "scba")) add("osha-respiratory", "Respirator use indicated");
  if ((context.noiseTwaDba ?? 0) >= 85 || has(combined, "hearing conservation", "noise exposure")) add("osha-noise", "Noise/hearing-conservation trigger indicated");
  if (context.hazwoperCovered || has(combined, "hazwoper", "hazmat", "hazardous waste")) add("osha-hazwoper", "HAZWOPER / HAZMAT context indicated");
  if (context.bloodborneExposure) add("osha-bloodborne", "Occupational blood/OPIM exposure indicated");
  if (context.leadSurveillance) add("osha-lead", "Lead medical-surveillance coverage indicated");
  if (context.asbestosSurveillance) add("osha-asbestos", "Asbestos medical-surveillance coverage indicated");
  if (context.cadmiumSurveillance) add("osha-cadmium", "Cadmium medical-surveillance coverage indicated");
  if (context.dotTesting) add("dot-part40", "DOT-regulated drug/alcohol testing indicated");

  return [...recommendations].map(([standardId, reason]) => ({ standardId, reason }));
}

function evaluateStandards(context: ReviewContext): StandardFinding[] {
  const findings: StandardFinding[] = [];
  const condition = norm(context.condition);
  const medication = norm(context.medication);
  const occupation = norm(context.occupation);
  const combined = `${condition} ${medication} ${occupation}`;
  const active = new Set(context.frameworks);

  if (active.has("centcom-mod18")) {
    findings.push(finding(
      "mod18-functional-baseline", "centcom-mod18", "info", "Deployment functional baseline",
      "MOD 18 requires deployers to meet medical, dental, and behavioral-health fitness standards and remain capable of required duties in the deployed environment, including required protective equipment and emergency ingress/egress.",
      "Confirm duty-specific functional capacity and deployed-location support limitations before resolving medical fitness.",
      "MOD 18 paras 4–5; Tab A paras 1–7", ["deployment", "functional capacity", "PPE", "environment"], ["CENTCOM selected"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18FINALV2.pdf",
    ));

    if (has(condition, "asthma", "respiratory")) findings.push(finding(
      "mod18-asthma", "centcom-mod18", "waiver", "Respiratory / asthma deployment rule",
      "Moderate or severe persistent asthma, FEV1 below 50% predicted, a respiratory hospitalization/ER visit in the prior 12 months, or daily systemic steroids are deployment-limiting. Mild intermittent/persistent asthma with ACT >19 is identified as not requiring waiver.",
      "Capture asthma severity, ACT, FEV1, recent urgent care/hospitalization, steroid use, and medication supply plan.",
      "MOD 18 Tab A §7.A.1", ["respiratory", "asthma", "FEV1", "waiver"], ["condition"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));

    if (has(condition, "seizure", "epilep")) findings.push(finding(
      "mod18-seizure", "centcom-mod18", "strict", "Seizure activity / anticonvulsant rule",
      "Seizure disorder within the last year or current anticonvulsant treatment for prior seizure activity is deployment-limiting. Stable anticonvulsant therapy with one year seizure-free may be considered for waiver; seizure activity within the last year is identified as not waiverable.",
      "Document last seizure date, diagnosis, medication indication, treatment stability, and waiver pathway.",
      "MOD 18 Tab A §7.A.2", ["neurologic", "seizure", "anticonvulsant", "waiver"], ["condition", "medication"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));

    if (has(condition, "diabetes", "diabetic") || context.a1c !== undefined || has(medication, "insulin", "semaglutide", "tirzepatide")) {
      const level: FindingLevel = has(medication, "insulin") ? "strict" : context.a1c !== undefined && context.a1c > 7 ? "waiver" : "review";
      findings.push(finding(
        "mod18-diabetes", "centcom-mod18", level, "Diabetes / glycemic deployment criteria",
        "MOD 18 identifies diabetes on pharmacotherapy or A1C >7.0 as deployment-limiting, while stable type 2 diabetes on oral agents with no medication change for 90 days and A1C ≤7.0 can avoid waiver when 10-year cardiac risk is below 15%. Insulin-requiring diabetes is identified as not waiverable.",
        "Review A1C, treatment route, 90-day medication stability, ASCVD/CHD risk, and initial diabetes evaluation documentation.",
        "MOD 18 Tab A §7.A.3", ["diabetes", "A1C", "ASCVD", "insulin", "waiver"], ["condition", "A1C", "medication"],
        "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
      ));
    }

    if (has(condition, "sleep apnea", "osa") || context.ahi !== undefined || context.papCompliance !== undefined) {
      let level: FindingLevel = "review";
      if ((context.ahi ?? 0) > 30) level = "waiver";
      if (has(condition, "symptomatic") || (context.epworth ?? 0) >= 10) level = "waiver";
      findings.push(finding(
        "mod18-osa", "centcom-mod18", level, "Obstructive sleep apnea deployment criteria",
        "For moderate/severe OSA, MOD 18 requires documented PAP compliance of at least 4 hours/night on more than 70% of nights over 30 days. Mild OSA does not require waiver; asymptomatic compliant moderate OSA with Epworth <10 does not require waiver; severe OSA requires waiver. Symptomatic OSA is identified as not waiverable.",
        "Review diagnostic AHI/RDI, symptoms, Epworth score, 30-day compliance, battery backup, and deployment-location electrical reliability.",
        "MOD 18 Tab A §7.A.15", ["OSA", "PAP compliance", "AHI", "Epworth", "waiver"], ["condition", "AHI", "PAP compliance"],
        "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
      ));
    }

    if ((context.weightLb ?? 0) > 300) findings.push(finding(
      "mod18-weight", "centcom-mod18", "strict", "Weight exceeds deployed-environment limit",
      "MOD 18 states that weight above 136 kg (300 lb) is incompatible with the deployed environment.",
      "Flag for deployment review and verify current measured weight and any applicable individualized assessment/waiver authority guidance.",
      "MOD 18 Tab A §7.A.17", ["weight", "deployment"], ["weight"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));

    if (has(condition, "hypertension", "blood pressure", "cardiac", "coronary", "heart") || context.sbp !== undefined || context.dbp !== undefined || context.ascvd !== undefined || (context.age ?? 0) >= 40) {
      const elevatedBp = (context.sbp ?? 0) > 140 || (context.dbp ?? 0) > 90;
      const highRisk = (context.ascvd ?? 0) >= 15;
      findings.push(finding(
        "mod18-cardiovascular", "centcom-mod18", elevatedBp || highRisk ? "waiver" : "review", "Cardiovascular risk / blood pressure screen",
        "MOD 18 identifies a 3-day average BP above 140/90 as a circumstance requiring waiver review and requires DoD civilians/contractors age 40+ to calculate 10-year CHD risk. Risk ≥15% triggers further cardiology work-up including functional assessment.",
        "Capture 3-day BP average, age, ASCVD/CHD risk, medication stability, and cardiology functional testing when indicated.",
        "MOD 18 Tab A §7.B.6–7", ["cardiovascular", "hypertension", "ASCVD", "stress test"], ["condition", "age", "BP", "ASCVD"],
        "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
      ));
    }

    if (has(condition, "hearing", "dental", "glaucoma", "vision")) findings.push(finding(
      "mod18-sensory-dental", "centcom-mod18", "review", "Sensory / dental deployment requirements",
      "MOD 18 requires safe functional vision/hearing for duty, identifies specific ophthalmic limitations, and requires a current dental examination with low risk of dental emergency during deployment.",
      "Review occupational visual/hearing requirements, unaided emergency-alarm hearing where relevant, dental exam currency, and DD2813/equivalent documentation.",
      "MOD 18 Tab A §7.D", ["vision", "hearing", "dental"], ["condition"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));

    if (has(condition, "depression", "anxiety", "ptsd", "bipolar", "psych", "adhd", "insomnia", "substance") || has(medication, "benzodiazep", "xanax", "ativan", "ambien", "stimulant", "adderall")) findings.push(finding(
      "mod18-behavioral", "centcom-mod18", "waiver", "Behavioral-health stability / medication review",
      "MOD 18 requires behavioral-health stability and identifies multiple diagnoses, recent hospitalization/self-harm, certain medication patterns, and controlled-substance treatment as deployment-limiting or waiver-requiring.",
      "Document diagnosis, treatment stability, functional impact, therapy frequency, medication indication/dosing, side effects, and ability to function if medication resupply is disrupted.",
      "MOD 18 Tab A §7.H–I", ["behavioral health", "psychotropics", "controlled substances", "stability"], ["condition", "medication"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));

    if (has(medication, "eliquis", "apixaban", "xarelto", "rivaroxaban", "warfarin", "coumadin")) findings.push(finding(
      "mod18-anticoagulant", "centcom-mod18", "strict", "Therapeutic anticoagulant is strictly disqualifying",
      "MOD 18 Tab A identifies therapeutic anticoagulants including warfarin, rivaroxaban, and apixaban as strictly disqualifying for deployment.",
      "Do not treat this as a routine medication flag; surface the controlling MOD 18 medication section and waiver-authority pathway.",
      "MOD 18 Tab A §7.I.3.a", ["medication", "anticoagulant", "strict"], ["medication"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));

    if (has(medication, "inject", "insulin", "semaglutide", "tirzepatide", "ozempic", "mounjaro", "wegovy")) findings.push(finding(
      "mod18-injectable", "centcom-mod18", "waiver", "Injectable medication deployment rule",
      "MOD 18 identifies injectable medications as waiver-requiring with limited exceptions and separately identifies insulin and GLP-1 therapy concerns.",
      "Confirm route, storage requirements, supply continuity, indication, stability, and the specific MOD 18 exception/waiver rule that applies.",
      "MOD 18 Tab A §7.I.13–15", ["medication", "injectable", "storage", "waiver"], ["medication"],
      "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf",
    ));
  }

  if (active.has("fmcsa")) {
    findings.push(finding(
      "fmcsa-core", "fmcsa", "info", "FMCSA physical qualification framework",
      "49 CFR 391.41 establishes the binding physical qualification standards for interstate CMV drivers; the 2024 Medical Examiner's Handbook and Appendix A provide guidance for applying those standards.",
      "Separate binding regulation from advisory guidance in every reviewer conclusion.",
      "49 CFR §391.41; Appendix A to Part 391; MEH 2024", ["CMV", "regulation", "medical certification"], ["FMCSA selected"],
      "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41",
    ));
    if (has(condition, "seizure", "epilep", "syncope", "loss of consciousness")) findings.push(finding(
      "fmcsa-neuro", "fmcsa", "strict", "Loss-of-consciousness / epilepsy standard",
      "49 CFR 391.41(b)(8) requires no established history or clinical diagnosis of epilepsy or another condition likely to cause loss of consciousness or loss of ability to control a CMV, absent an applicable variance pathway.",
      "Review diagnosis, recurrence risk, medication effects, and whether an FMCSA exemption/variance pathway is relevant.",
      "49 CFR §391.41(b)(8)", ["neurologic", "epilepsy", "loss of consciousness"], ["condition"],
      "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41",
    ));
    if (has(condition, "diabetes") || has(medication, "insulin")) findings.push(finding(
      "fmcsa-diabetes", "fmcsa", "review", "Insulin-treated diabetes has a specific qualification pathway",
      "FMCSA permits insulin-treated diabetes when the driver satisfies 49 CFR 391.46; it is not evaluated as a blanket prohibition under the current rule.",
      "Use the insulin-treated diabetes assessment pathway and required documentation rather than applying an obsolete absolute disqualification.",
      "49 CFR §§391.41(b)(3), 391.46", ["diabetes", "insulin", "MCSA-5870"], ["condition", "medication"],
      "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.46",
    ));
    if (has(condition, "heart", "cardiac", "coronary", "angina", "syncope", "hypertension") || context.sbp !== undefined || context.dbp !== undefined) findings.push(finding(
      "fmcsa-cardio", "fmcsa", "review", "Cardiovascular / blood-pressure qualification review",
      "FMCSA's regulation addresses cardiovascular disease associated with syncope, dyspnea, collapse, or congestive heart failure and high blood pressure likely to interfere with safe CMV operation.",
      "Apply 49 CFR 391.41(b)(4) and (6) with the current Handbook/Medical Advisory Criteria for certification interval and work-up decisions.",
      "49 CFR §391.41(b)(4),(6)", ["cardiovascular", "hypertension", "safe driving"], ["condition", "BP"],
      "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41",
    ));
    if (has(condition, "vision", "hearing")) findings.push(finding(
      "fmcsa-sensory", "fmcsa", "review", "FMCSA vision / hearing thresholds",
      "FMCSA's physical qualification standard includes explicit visual acuity, field-of-vision, color-recognition, and hearing thresholds, with a separate alternative vision standard pathway for qualifying drivers.",
      "Compare measured vision/hearing results to 49 CFR 391.41(b)(10)–(11) and use 391.44 when the alternative vision standard may apply.",
      "49 CFR §391.41(b)(10)–(11); §391.44", ["vision", "hearing", "threshold"], ["condition"],
      "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41",
    ));
    if (medication) findings.push(finding(
      "fmcsa-medication", "fmcsa", "review", "Medication safety must be tied to safe CMV operation",
      "FMCSA distinguishes Schedule I substances from prescribed Schedule II–V drugs. For the prescription exception, the treating practitioner must be familiar with the driver's history and advise that the substance will not adversely affect safe CMV operation; medication side effects/interactions remain part of the qualification assessment.",
      "Consider MCSA-5895 or equivalent prescriber communication when needed and document sedation, cognition, coordination, and interaction concerns.",
      "49 CFR §391.41(b)(12); Appendix A to Part 391", ["medication", "controlled substance", "safe driving"], ["medication"],
      "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41",
    ));
  }

  if (active.has("faa")) {
    findings.push(finding(
      "faa-current-guide", "faa", "info", "FAA AME Guide is a continuously updated source",
      "The FAA AME Guide is updated on a recurring schedule; the current revision should be checked rather than relying on a static historical summary.",
      "Open the current AME Guide and use the relevant disposition table/protocol for the condition and certificate class.",
      "FAA AME Guide — current revision", ["aviation", "current source", "AME"], ["FAA selected"], "https://www.faa.gov/ame_guide",
    ));
    if (medication) findings.push(finding(
      "faa-medication", "faa", "review", "FAA medication disposition / no-fly review",
      "FAA medication guidance separates medications that prevent AME issuance without FAA clearance from medications requiring a no-fly observation period or other safety restrictions. The underlying condition and medication side effects must both be considered.",
      "Check the current FAA Pharmaceuticals section and DNI/DNF material for the exact medication/class before making an aeromedical recommendation.",
      "FAA AME Guide — Pharmaceuticals; DNI/DNF", ["medication", "DNI", "DNF", "aeromedical"], ["medication"], "https://www.faa.gov/ame_guide/pharm",
    ));
    if (has(condition, "hypertension", "blood pressure") || has(medication, "lisinopril", "losartan", "metoprolol", "amlodipine")) findings.push(finding(
      "faa-hypertension", "faa", "review", "FAA antihypertensive medication pathway",
      "FAA guidance allows multiple antihypertensive classes when certification criteria are met and calls for a seven-day ground/no-fly trial after starting a new hypertension medication to verify absence of side effects.",
      "Confirm medication class, number of agents, stability, side effects, and the current FAA hypertension worksheet/disposition.",
      "FAA AME Guide — Antihypertensive", ["hypertension", "medication", "ground trial"], ["condition", "medication"], "https://www.faa.gov/ame_guide/pharm/antihyp",
    ));
    if (has(condition, "depression", "anxiety", "ptsd", "psychiatric", "bipolar") || has(medication, "ssri", "sertraline", "fluoxetine", "escitalopram", "antidepressant")) findings.push(finding(
      "faa-psychiatric", "faa", "waiver", "Psychiatric condition / psychotropic disposition",
      "FAA guidance generally requires deferral for psychotropic medication use, with defined exceptions and special pathways for certain antidepressant-treated conditions. Current condition-specific disposition tools control.",
      "Use the current psychiatric disposition table and antidepressant pathway rather than a generic medication rule.",
      "FAA AME Guide Item 47; Antidepressants", ["psychiatric", "psychotropic", "defer", "special issuance"], ["condition", "medication"], "https://www.faa.gov/ame_guide/app_process/exam_tech/item47/amd",
    ));
    if (has(condition, "sleep apnea", "osa")) findings.push(finding(
      "faa-osa", "faa", "review", "FAA OSA protocol / AASI pathway",
      "FAA maintains a dedicated OSA protocol, decision table, treated-status report, compliance material, and AME Assisted Special Issuance pathway.",
      "Use the current OSA protocol and treated-status/compliance documentation for the airman's case.",
      "FAA AME Guide — OSA protocol", ["OSA", "AASI", "compliance"], ["condition"], "https://www.faa.gov/ame_guide/dec_cons/disease_prot/osa/ref_materials",
    ));
  }

  if (active.has("nfpa1580")) {
    findings.push(finding(
      "nfpa-occupational-medical", "nfpa1580", "review", "NFPA 1580 occupational-medical chapters apply to emergency responders",
      "The 2025 NFPA 1580 standard consolidates the emergency-responder occupational-medical program content formerly published in NFPA 1582. Occupational-medical roles, essential job tasks, member evaluation, annual fitness evaluation, and evaluation requirements are organized in Chapters 9–13.",
      "Map the member's condition and functional limitations to the essential job tasks and current NFPA 1580 occupational-medical chapters. Use NFPA LiNK/authorized standard access for controlling copyrighted criteria.",
      "NFPA 1580 (2025), Chapters 9–13", ["firefighter", "essential job tasks", "occupational medical", "annual fitness"], ["NFPA selected", "occupation"], "https://link.nfpa.org/all-publications/1580/2025",
    ));
    if (has(combined, "respirator", "scba", "fire", "heat", "cardiac", "heart", "vision", "hearing", "musculoskeletal", "seizure", "diabetes", "medication")) findings.push(finding(
      "nfpa-duty-interaction", "nfpa1580", "review", "Condition must be assessed against emergency-responder essential job tasks",
      "For firefighter/emergency-responder review, the medical issue cannot be evaluated in isolation from essential job tasks such as emergency response, protective equipment/SCBA use, strenuous exertion, heat exposure, sensory demands, and safe team operations.",
      "Use the current NFPA 1580 essential-job-task and evaluation chapters to identify the specific duty interaction, then document the medical evidence needed to resolve that interaction.",
      "NFPA 1580 (2025), Chapters 10–13", ["essential job tasks", "SCBA", "heat", "functional capacity"], ["condition", "medication", "occupation"], "https://link.nfpa.org/all-publications/1580/2025",
    ));
  }

  if (active.has("osha-respiratory")) {
    findings.push(finding(
      "osha-respiratory-baseline", "osha-respiratory", "info", "Respirator medical evaluation precedes required use",
      "OSHA requires a medical evaluation to determine an employee's ability to use a respirator before the employee is fit tested or required to use the respirator in the workplace.",
      "Confirm the medical evaluation and PLHCP written recommendation are complete before required respirator use or fit testing.",
      "29 CFR §1910.134(e)(1), (e)(6)", ["respirator", "medical evaluation", "PLHCP"], ["OSHA Respiratory selected"],
    ));
    if (context.respiratorRequired || has(combined, "respirator", "scba")) findings.push(finding(
      "osha-respiratory-trigger", "osha-respiratory", "review", "Required respirator use activates the medical-evaluation workflow",
      "When respirator use is required, the employer must provide the medical evaluation and provide the PLHCP the required respirator/workplace information. Additional evaluation is required when specified symptoms, PLHCP/program observations, or workplace changes indicate a need.",
      "Collect respirator type/weight, duration/frequency, work effort, PPE, temperature/humidity extremes, and the respiratory-protection program information required for the PLHCP.",
      "29 CFR §1910.134(e)(5)–(7)", ["respirator", "work conditions", "follow-up"], ["respirator required"],
    ));
  }

  if (active.has("osha-noise")) {
    findings.push(finding(
      "osha-noise-baseline", "osha-noise", "info", "OSHA hearing-conservation framework",
      "29 CFR 1910.95 governs occupational-noise exposure and requires a hearing-conservation program when employee noise exposure equals or exceeds the 8-hour TWA action level of 85 dBA.",
      "Use measured occupational noise exposure—not job title alone—to determine hearing-conservation coverage.",
      "29 CFR §1910.95(c)", ["noise", "hearing conservation", "audiometry"], ["OSHA Hearing selected"],
    ));
    if ((context.noiseTwaDba ?? 0) >= 85) findings.push(finding(
      "osha-noise-action-level", "osha-noise", "review", "85 dBA TWA hearing-conservation action level met",
      `The entered 8-hour TWA noise exposure is ${context.noiseTwaDba} dBA, meeting or exceeding OSHA's 85 dBA hearing-conservation action level.`,
      "Confirm baseline/annual audiometric testing, employee notification/training, hearing protection, and standard-threshold-shift follow-up as applicable.",
      "29 CFR §1910.95(c)–(g)", ["85 dBA", "audiogram", "hearing conservation"], ["noise TWA"],
    ));
  }

  if (active.has("osha-hazwoper")) {
    findings.push(finding(
      "osha-hazwoper-baseline", "osha-hazwoper", "info", "HAZWOPER medical-surveillance framework",
      "29 CFR 1910.120 requires medical surveillance for specified hazardous-waste and emergency-response employees and links the exam to hazardous-substance exposure, symptoms, respirator use, and ability to wear required PPE.",
      "Determine whether the worker meets a covered employee category before specifying examination frequency/content.",
      "29 CFR §1910.120(f), (q)(9)", ["HAZWOPER", "medical surveillance", "PPE"], ["OSHA HAZWOPER selected"],
    ));
    if (context.hazwoperCovered || has(combined, "hazwoper", "hazmat", "hazardous waste")) findings.push(finding(
      "osha-hazwoper-trigger", "osha-hazwoper", "review", "HAZWOPER-covered work requires a defined surveillance schedule",
      "For covered employees, examinations/consultations include pre-assignment and periodic surveillance, with additional consultation for exposure-related illness, injury, or symptoms and specified termination/reassignment circumstances.",
      "Capture exposure history, respirator/PPE use, symptoms, work history, and the employer's hazardous-substance information for the examining clinician.",
      "29 CFR §1910.120(f)(2)–(4)", ["baseline", "periodic", "exposure", "symptoms"], ["HAZWOPER coverage"],
    ));
  }

  if (active.has("osha-bloodborne")) {
    findings.push(finding(
      "osha-bloodborne-baseline", "osha-bloodborne", "info", "Bloodborne-pathogens occupational-exposure framework",
      "29 CFR 1910.1030 applies to occupational exposure to blood or other potentially infectious materials and includes hepatitis B vaccination and post-exposure evaluation/follow-up requirements.",
      "Confirm whether the role has occupational blood/OPIM exposure and apply the employer's exposure-control plan.",
      "29 CFR §1910.1030(a), (f)", ["bloodborne", "HBV", "post-exposure"], ["OSHA Bloodborne selected"],
    ));
    if (context.bloodborneExposure) findings.push(finding(
      "osha-bloodborne-trigger", "osha-bloodborne", "review", "Occupational blood/OPIM exposure indicated",
      "The scenario indicates occupational exposure to blood/OPIM, so the vaccination and post-exposure evaluation provisions are directly relevant to the program design and case workflow.",
      "Verify hepatitis B vaccination offer/documentation, exposure-incident procedures, source-individual testing rules, employee testing/counseling, and confidential medical records.",
      "29 CFR §1910.1030(f)", ["HBV", "exposure incident", "post-exposure"], ["bloodborne exposure"],
    ));
  }

  if (active.has("osha-lead")) {
    findings.push(finding(
      "osha-lead-baseline", "osha-lead", context.leadSurveillance ? "review" : "info", "Lead medical-surveillance / biologic-monitoring standard",
      "29 CFR 1910.1025 contains medical-surveillance and biologic-monitoring provisions for workers meeting the standard's exposure/coverage criteria.",
      context.leadSurveillance ? "Apply the standard's current biologic-monitoring, medical-exam, physician-information, and medical-removal provisions to this covered worker." : "Confirm exposure measurements and whether the standard's medical-surveillance coverage criteria are met before ordering a lead-surveillance protocol.",
      "29 CFR §1910.1025(j)", ["lead", "biologic monitoring", "medical surveillance"], [context.leadSurveillance ? "lead surveillance indicated" : "OSHA Lead selected"],
    ));
  }

  if (active.has("osha-asbestos")) {
    findings.push(finding(
      "osha-asbestos-baseline", "osha-asbestos", context.asbestosSurveillance ? "review" : "info", "Asbestos medical-surveillance standard",
      "29 CFR 1910.1001 includes medical-surveillance requirements for employees covered by the standard's exposure and respirator-related criteria.",
      context.asbestosSurveillance ? "Apply the current asbestos medical-surveillance requirements and provide the examining clinician the required exposure and respirator information." : "Confirm whether asbestos exposure/respirator criteria place the employee in the medical-surveillance program.",
      "29 CFR §1910.1001(l)", ["asbestos", "medical surveillance", "respirator"], [context.asbestosSurveillance ? "asbestos surveillance indicated" : "OSHA Asbestos selected"],
    ));
  }

  if (active.has("osha-cadmium")) {
    findings.push(finding(
      "osha-cadmium-baseline", "osha-cadmium", context.cadmiumSurveillance ? "review" : "info", "Cadmium medical-surveillance / biologic-monitoring standard",
      "29 CFR 1910.1027 contains medical-surveillance and biologic-monitoring requirements for covered cadmium-exposed employees.",
      context.cadmiumSurveillance ? "Apply the current cadmium surveillance schedule, biologic-monitoring requirements, physician information, and follow-up provisions for this covered worker." : "Confirm exposure/coverage criteria before assigning a cadmium medical-surveillance protocol.",
      "29 CFR §1910.1027(l)", ["cadmium", "biologic monitoring", "medical surveillance"], [context.cadmiumSurveillance ? "cadmium surveillance indicated" : "OSHA Cadmium selected"],
    ));
  }

  if (active.has("dot-part40")) {
    findings.push(finding(
      "dot-part40-baseline", "dot-part40", "info", "DOT testing procedures are controlled by 49 CFR Part 40",
      "49 CFR Part 40 establishes the procedures used across DOT-regulated workplace drug and alcohol testing programs and defines the roles of collectors, laboratories, MROs, BAT/STTs, employers, and service agents.",
      "Determine the DOT agency/program first, then apply Part 40 together with that agency's testing regulation.",
      "49 CFR Part 40", ["DOT", "drug testing", "alcohol testing", "collection"], ["DOT Part 40 selected"],
    ));
    if (context.dotTesting) findings.push(finding(
      "dot-part40-specimen", "dot-part40", "review", "DOT-regulated drug test specimen-method controls apply",
      "Current Part 40 authorizes urine and oral-fluid specimens for DOT drug testing. Point-of-collection urine/oral-fluid drug tests, hair testing, and instant tests are not authorized as DOT drug tests.",
      "Use a DOT-compliant collection workflow, required federal form/process, and an HHS-certified laboratory. Keep non-DOT rapid testing separate from the DOT test event.",
      "49 CFR §40.210; Part 40 collection/laboratory subparts", ["urine", "oral fluid", "instant test", "DOT"], ["DOT testing indicated"],
      "https://www.transportation.gov/odapc/part40/40-210",
    ));
  }

  return findings.sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
}

function numberOrUndefined(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeContext(body: Record<string, unknown>): ReviewContext {
  const requestedFrameworks = Array.isArray(body.frameworks) ? body.frameworks.filter((value): value is string => typeof value === "string" && SOURCE_BY_ID.has(value)) : [];
  return {
    frameworks: [...new Set(requestedFrameworks)],
    occupation: typeof body.occupation === "string" ? body.occupation : "",
    condition: typeof body.condition === "string" ? body.condition : "",
    medication: typeof body.medication === "string" ? body.medication : "",
    age: numberOrUndefined(body.age),
    a1c: numberOrUndefined(body.a1c),
    ahi: numberOrUndefined(body.ahi),
    papCompliance: numberOrUndefined(body.papCompliance),
    epworth: numberOrUndefined(body.epworth),
    sbp: numberOrUndefined(body.sbp),
    dbp: numberOrUndefined(body.dbp),
    ascvd: numberOrUndefined(body.ascvd),
    weightLb: numberOrUndefined(body.weightLb),
    noiseTwaDba: numberOrUndefined(body.noiseTwaDba),
    respiratorRequired: booleanValue(body.respiratorRequired),
    hazwoperCovered: booleanValue(body.hazwoperCovered),
    bloodborneExposure: booleanValue(body.bloodborneExposure),
    leadSurveillance: booleanValue(body.leadSurveillance),
    asbestosSurveillance: booleanValue(body.asbestosSurveillance),
    cadmiumSurveillance: booleanValue(body.cadmiumSurveillance),
    dotTesting: booleanValue(body.dotTesting),
  };
}

const router: IRouter = Router();

router.get("/standards/catalog", (_req, res) => {
  const categories = [...new Set(SOURCES.map((source) => source.category))];
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    ok: true,
    architectureVersion: "standards-api-v2",
    generatedAt: new Date().toISOString(),
    totalSources: SOURCES.length,
    automatedSources: SOURCES.filter((source) => source.coverage !== "reference").length,
    categories,
    sources: SOURCES,
  });
});

router.post("/standards/evaluate", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const context = normalizeContext(body);
  if (!context.frameworks.length) {
    return res.status(400).json({ ok: false, error: "Select at least one standards framework." });
  }

  const findings = evaluateStandards(context);
  const recommendations = recommendFrameworks(context);
  const selectedSources = context.frameworks.map((id) => SOURCE_BY_ID.get(id)).filter((source): source is StandardSource => Boolean(source));
  const matchedFrameworkIds = new Set(findings.map((finding) => finding.standardId));

  return res.json({
    ok: true,
    architectureVersion: "standards-api-v2",
    evaluatedAt: new Date().toISOString(),
    context,
    selectedSources,
    findings,
    recommendations,
    coverage: {
      selected: selectedSources.length,
      matched: matchedFrameworkIds.size,
      automatedSelected: selectedSources.filter((source) => source.coverage !== "reference").length,
      referenceSelected: selectedSources.filter((source) => source.coverage === "reference").length,
    },
  });
});

export default router;
