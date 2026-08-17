export type StandardId = 'centcom-mod18' | 'fmcsa' | 'faa' | 'nfpa1580';
export type FindingLevel = 'info' | 'review' | 'waiver' | 'strict';

export type StandardSource = {
  id: StandardId;
  shortLabel: string;
  title: string;
  edition: string;
  authority: 'official-policy' | 'regulation' | 'official-guidance' | 'consensus-standard';
  sourceUrl: string;
  description: string;
  currentAsOf: string;
  accent: string;
};

export type ReviewContext = {
  frameworks: StandardId[];
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
};

export type StandardFinding = {
  id: string;
  standardId: StandardId;
  level: FindingLevel;
  title: string;
  summary: string;
  action: string;
  citation: string;
  sourceUrl: string;
  topics: string[];
  matchedBy: string[];
};

export const STANDARD_SOURCES: Record<StandardId, StandardSource> = {
  'centcom-mod18': {
    id: 'centcom-mod18',
    shortLabel: 'CENTCOM MOD 18',
    title: 'USCENTCOM MOD EIGHTEEN + TAB A',
    edition: '201214Z AUG 25',
    authority: 'official-policy',
    sourceUrl: 'https://www.centcom.mil/CONTACT/THEATRE-MEDICAL-REQUIREMENTS/',
    description: 'Current USCENTCOM deployment policy and amplified minimal medical fitness standards for the CENTCOM AOR.',
    currentAsOf: '20 Aug 2025',
    accent: '#64e7ff',
  },
  fmcsa: {
    id: 'fmcsa',
    shortLabel: 'FMCSA',
    title: '49 CFR Part 391 + Medical Examiner’s Handbook',
    edition: '2024 handbook / current CFR',
    authority: 'regulation',
    sourceUrl: 'https://www.fmcsa.dot.gov/regulations/medical/medical-regulations-and-guidance-resource-links',
    description: 'Physical qualification regulations, Medical Advisory Criteria, and current FMCSA medical examiner guidance.',
    currentAsOf: 'Current CFR + Jan 2024 handbook',
    accent: '#7ed6ff',
  },
  faa: {
    id: 'faa',
    shortLabel: 'FAA',
    title: 'FAA Guide for Aviation Medical Examiners',
    edition: 'Current revision',
    authority: 'official-guidance',
    sourceUrl: 'https://www.faa.gov/ame_guide',
    description: 'Continuously updated aeromedical certification standards, disposition tables, protocols, and medication guidance.',
    currentAsOf: '29 Jul 2026',
    accent: '#9ca8ff',
  },
  nfpa1580: {
    id: 'nfpa1580',
    shortLabel: 'NFPA 1580',
    title: 'NFPA 1580 — Emergency Responder Occupational Health and Wellness',
    edition: '2025',
    authority: 'consensus-standard',
    sourceUrl: 'https://link.nfpa.org/all-publications/1580/2025',
    description: 'Current NFPA emergency-responder occupational health and wellness standard. Chapters 9–13 carry the occupational-medical content formerly associated with NFPA 1582.',
    currentAsOf: '2025 edition',
    accent: '#ffb86a',
  },
};

const norm = (value: string | undefined) => (value ?? '').toLowerCase();
const has = (text: string, ...needles: string[]) => needles.some((needle) => text.includes(needle));

export function defaultFrameworksForOccupation(occupation: string): StandardId[] {
  const value = norm(occupation);
  const ids: StandardId[] = [];
  if (has(value, 'deploy', 'contractor', 'dod', 'centcom')) ids.push('centcom-mod18');
  if (has(value, 'driver', 'truck', 'commercial')) ids.push('fmcsa');
  if (has(value, 'pilot', 'aviation', 'aircrew', 'air traffic')) ids.push('faa');
  if (has(value, 'fire', 'ems', 'emergency responder')) ids.push('nfpa1580');
  return ids.length ? ids : ['centcom-mod18', 'fmcsa', 'faa', 'nfpa1580'];
}

function finding(
  id: string,
  standardId: StandardId,
  level: FindingLevel,
  title: string,
  summary: string,
  action: string,
  citation: string,
  topics: string[],
  matchedBy: string[],
  sourceUrl?: string,
): StandardFinding {
  return { id, standardId, level, title, summary, action, citation, topics, matchedBy, sourceUrl: sourceUrl ?? STANDARD_SOURCES[standardId].sourceUrl };
}

export function evaluateStandards(context: ReviewContext): StandardFinding[] {
  const findings: StandardFinding[] = [];
  const condition = norm(context.condition);
  const medication = norm(context.medication);
  const occupation = norm(context.occupation);
  const combined = `${condition} ${medication} ${occupation}`;
  const active = new Set(context.frameworks);

  if (active.has('centcom-mod18')) {
    findings.push(finding(
      'mod18-functional-baseline', 'centcom-mod18', 'info', 'Deployment functional baseline',
      'MOD 18 requires deployers to meet medical, dental, and behavioral-health fitness standards and to remain capable of performing required duties in the deployed environment, including required protective equipment and emergency ingress/egress.',
      'Confirm duty-specific functional capacity and deployed-location support limitations before resolving medical fitness.',
      'MOD 18 paras 4–5; Tab A paras 1–7', ['deployment', 'functional capacity', 'PPE', 'environment'], ['CENTCOM selected'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18FINALV2.pdf',
    ));

    if (has(condition, 'asthma', 'respiratory')) findings.push(finding(
      'mod18-asthma', 'centcom-mod18', 'waiver', 'Respiratory / asthma deployment rule',
      'Moderate or severe persistent asthma, FEV1 below 50% predicted, a respiratory hospitalization/ER visit in the prior 12 months, or daily systemic steroids are deployment-limiting. Mild intermittent/persistent asthma with ACT >19 is identified as not requiring waiver.',
      'Capture asthma severity, ACT, FEV1, recent urgent care/hospitalization, steroid use, and medication supply plan.',
      'MOD 18 Tab A §7.A.1', ['respiratory', 'asthma', 'FEV1', 'waiver'], ['condition'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));

    if (has(condition, 'seizure', 'epilep')) findings.push(finding(
      'mod18-seizure', 'centcom-mod18', 'strict', 'Seizure activity / anticonvulsant rule',
      'Seizure disorder within the last year or current anticonvulsant treatment for prior seizure activity is deployment-limiting. Stable anticonvulsant therapy with one year seizure-free may be considered for waiver; seizure activity within the last year is identified as not waiverable.',
      'Document last seizure date, diagnosis, medication indication, treatment stability, and waiver pathway.',
      'MOD 18 Tab A §7.A.2', ['neurologic', 'seizure', 'anticonvulsant', 'waiver'], ['condition', 'medication'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));

    if (has(condition, 'diabetes', 'diabetic') || context.a1c !== undefined || has(medication, 'insulin', 'semaglutide', 'tirzepatide')) {
      const level: FindingLevel = has(medication, 'insulin') ? 'strict' : (context.a1c !== undefined && context.a1c > 7 ? 'waiver' : 'review');
      findings.push(finding(
        'mod18-diabetes', 'centcom-mod18', level, 'Diabetes / glycemic deployment criteria',
        'MOD 18 identifies diabetes on pharmacotherapy or A1C >7.0 as deployment-limiting, while stable type 2 diabetes on oral agents with no medication change for 90 days and A1C ≤7.0 can avoid waiver when 10-year cardiac risk is below 15%. Insulin-requiring diabetes is identified as not waiverable.',
        'Review A1C, treatment route, 90-day medication stability, ASCVD/CHD risk, and initial diabetes evaluation documentation.',
        'MOD 18 Tab A §7.A.3', ['diabetes', 'A1C', 'ASCVD', 'insulin', 'waiver'], ['condition', 'A1C', 'medication'],
        'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
      ));
    }

    if (has(condition, 'sleep apnea', 'osa') || context.ahi !== undefined || context.papCompliance !== undefined) {
      let level: FindingLevel = 'review';
      if ((context.ahi ?? 0) > 30) level = 'waiver';
      if (has(condition, 'symptomatic') || (context.epworth ?? 0) >= 10) level = 'waiver';
      findings.push(finding(
        'mod18-osa', 'centcom-mod18', level, 'Obstructive sleep apnea deployment criteria',
        'For moderate/severe OSA, MOD 18 requires documented PAP compliance of at least 4 hours/night on more than 70% of nights over 30 days. Mild OSA does not require waiver; asymptomatic compliant moderate OSA with Epworth <10 does not require waiver; severe OSA requires waiver. Symptomatic OSA is identified as not waiverable.',
        'Review diagnostic AHI/RDI, symptoms, Epworth score, 30-day compliance, battery backup, and deployment-location electrical reliability.',
        'MOD 18 Tab A §7.A.15', ['OSA', 'PAP compliance', 'AHI', 'Epworth', 'waiver'], ['condition', 'AHI', 'PAP compliance'],
        'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
      ));
    }

    if ((context.weightLb ?? 0) > 300) findings.push(finding(
      'mod18-weight', 'centcom-mod18', 'strict', 'Weight exceeds deployed-environment limit',
      'MOD 18 states that weight above 136 kg (300 lb) is incompatible with the deployed environment.',
      'Flag for deployment review and verify current measured weight and any applicable individualized assessment/waiver authority guidance.',
      'MOD 18 Tab A §7.A.17', ['weight', 'deployment'], ['weight'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));

    if (has(condition, 'hypertension', 'blood pressure', 'cardiac', 'coronary', 'heart') || context.sbp !== undefined || context.dbp !== undefined || context.ascvd !== undefined || (context.age ?? 0) >= 40) {
      const elevatedBp = (context.sbp ?? 0) > 140 || (context.dbp ?? 0) > 90;
      const highRisk = (context.ascvd ?? 0) >= 15;
      findings.push(finding(
        'mod18-cardiovascular', 'centcom-mod18', elevatedBp || highRisk ? 'waiver' : 'review', 'Cardiovascular risk / blood pressure screen',
        'MOD 18 identifies a 3-day average BP above 140/90 as a circumstance requiring waiver review and requires DoD civilians/contractors age 40+ to calculate 10-year CHD risk. Risk ≥15% triggers further cardiology work-up including functional assessment.',
        'Capture 3-day BP average, age, ASCVD/CHD risk, medication stability, and cardiology functional testing when indicated.',
        'MOD 18 Tab A §7.B.6–7', ['cardiovascular', 'hypertension', 'ASCVD', 'stress test'], ['condition', 'age', 'BP', 'ASCVD'],
        'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
      ));
    }

    if (has(condition, 'hearing', 'dental', 'glaucoma', 'vision')) findings.push(finding(
      'mod18-sensory-dental', 'centcom-mod18', 'review', 'Sensory / dental deployment requirements',
      'MOD 18 requires safe functional vision/hearing for duty, identifies specific ophthalmic limitations, and requires a current dental examination with low risk of dental emergency during deployment.',
      'Review occupational visual/hearing requirements, unaided emergency-alarm hearing where relevant, dental exam currency, and DD2813/equivalent documentation.',
      'MOD 18 Tab A §7.D', ['vision', 'hearing', 'dental'], ['condition'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));

    if (has(condition, 'depression', 'anxiety', 'ptsd', 'bipolar', 'psych', 'adhd', 'insomnia', 'substance') || has(medication, 'benzodiazep', 'xanax', 'ativan', 'ambien', 'stimulant', 'adderall')) findings.push(finding(
      'mod18-behavioral', 'centcom-mod18', 'waiver', 'Behavioral-health stability / medication review',
      'MOD 18 requires behavioral-health stability and identifies multiple diagnoses, recent hospitalization/self-harm, certain medication patterns, and controlled-substance treatment as deployment-limiting or waiver-requiring.',
      'Document diagnosis, treatment stability, functional impact, therapy frequency, medication indication/dosing, side effects, and ability to function if medication resupply is disrupted.',
      'MOD 18 Tab A §7.H–I', ['behavioral health', 'psychotropics', 'controlled substances', 'stability'], ['condition', 'medication'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));

    if (has(medication, 'eliquis', 'apixaban', 'xarelto', 'rivaroxaban', 'warfarin', 'coumadin')) findings.push(finding(
      'mod18-anticoagulant', 'centcom-mod18', 'strict', 'Therapeutic anticoagulant is strictly disqualifying',
      'MOD 18 Tab A identifies therapeutic anticoagulants including warfarin, rivaroxaban, and apixaban as strictly disqualifying for deployment.',
      'Do not treat this as a routine medication flag; surface the controlling MOD 18 medication section and waiver-authority pathway.',
      'MOD 18 Tab A §7.I.3.a', ['medication', 'anticoagulant', 'strict'], ['medication'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));

    if (has(medication, 'inject', 'insulin', 'semaglutide', 'tirzepatide', 'ozempic', 'mounjaro', 'wegovy')) findings.push(finding(
      'mod18-injectable', 'centcom-mod18', 'waiver', 'Injectable medication deployment rule',
      'MOD 18 identifies injectable medications as waiver-requiring with limited exceptions and separately identifies insulin and GLP-1 therapy concerns.',
      'Confirm route, storage requirements, supply continuity, indication, stability, and the specific MOD 18 exception/waiver rule that applies.',
      'MOD 18 Tab A §7.I.13–15', ['medication', 'injectable', 'storage', 'waiver'], ['medication'],
      'https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf',
    ));
  }

  if (active.has('fmcsa')) {
    findings.push(finding(
      'fmcsa-core', 'fmcsa', 'info', 'FMCSA physical qualification framework',
      '49 CFR 391.41 establishes the binding physical qualification standards for interstate CMV drivers; the 2024 Medical Examiner’s Handbook and Appendix A provide guidance for applying those standards.',
      'Separate binding regulation from advisory guidance in every reviewer conclusion.',
      '49 CFR §391.41; Appendix A to Part 391; MEH 2024', ['CMV', 'regulation', 'medical certification'], ['FMCSA selected'],
      'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41',
    ));

    if (has(condition, 'seizure', 'epilep', 'syncope', 'loss of consciousness')) findings.push(finding(
      'fmcsa-neuro', 'fmcsa', 'strict', 'Loss-of-consciousness / epilepsy standard',
      '49 CFR 391.41(b)(8) requires no established history or clinical diagnosis of epilepsy or another condition likely to cause loss of consciousness or loss of ability to control a CMV, absent an applicable variance pathway.',
      'Review diagnosis, recurrence risk, medication effects, and whether an FMCSA exemption/variance pathway is relevant.',
      '49 CFR §391.41(b)(8)', ['neurologic', 'epilepsy', 'loss of consciousness'], ['condition'],
      'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41',
    ));

    if (has(condition, 'diabetes') || has(medication, 'insulin')) findings.push(finding(
      'fmcsa-diabetes', 'fmcsa', 'review', 'Insulin-treated diabetes has a specific qualification pathway',
      'FMCSA permits insulin-treated diabetes only when the driver satisfies the requirements of 49 CFR 391.46; it is not evaluated as a blanket prohibition under the current rule.',
      'Use the insulin-treated diabetes assessment pathway and required documentation rather than applying an obsolete absolute disqualification.',
      '49 CFR §§391.41(b)(3), 391.46', ['diabetes', 'insulin', 'MCSA-5870'], ['condition', 'medication'],
      'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.46',
    ));

    if (has(condition, 'heart', 'cardiac', 'coronary', 'angina', 'syncope', 'hypertension') || context.sbp !== undefined || context.dbp !== undefined) findings.push(finding(
      'fmcsa-cardio', 'fmcsa', 'review', 'Cardiovascular / blood-pressure qualification review',
      'FMCSA’s regulation addresses cardiovascular disease associated with syncope, dyspnea, collapse, or congestive heart failure and high blood pressure likely to interfere with safe CMV operation.',
      'Apply 49 CFR 391.41(b)(4) and (6) with the current Handbook/Medical Advisory Criteria for certification interval and work-up decisions.',
      '49 CFR §391.41(b)(4),(6)', ['cardiovascular', 'hypertension', 'safe driving'], ['condition', 'BP'],
      'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41',
    ));

    if (has(condition, 'vision', 'hearing')) findings.push(finding(
      'fmcsa-sensory', 'fmcsa', 'review', 'FMCSA vision / hearing thresholds',
      'FMCSA’s physical qualification standard includes explicit visual acuity, field-of-vision, color-recognition, and hearing thresholds, with a separate alternative vision standard pathway for qualifying drivers.',
      'Compare measured vision/hearing results to 49 CFR 391.41(b)(10)–(11) and use 391.44 when the alternative vision standard may apply.',
      '49 CFR §391.41(b)(10)–(11); §391.44', ['vision', 'hearing', 'threshold'], ['condition'],
      'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41',
    ));

    if (medication) findings.push(finding(
      'fmcsa-medication', 'fmcsa', 'review', 'Medication safety must be tied to safe CMV operation',
      'FMCSA distinguishes Schedule I substances from prescribed Schedule II–V drugs. For the prescription exception, the treating practitioner must be familiar with the driver’s history and advise that the substance will not adversely affect safe CMV operation; medication side effects/interactions remain part of the qualification assessment.',
      'Consider MCSA-5895 or equivalent prescriber communication when needed and document sedation, cognition, coordination, and interaction concerns.',
      '49 CFR §391.41(b)(12); Appendix A to Part 391', ['medication', 'controlled substance', 'safe driving'], ['medication'],
      'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.41',
    ));
  }

  if (active.has('faa')) {
    findings.push(finding(
      'faa-current-guide', 'faa', 'info', 'FAA AME Guide is a continuously updated source',
      'The FAA AME Guide is updated on a recurring schedule; the current revision should be checked rather than relying on a static historical summary.',
      'Open the current AME Guide and use the relevant disposition table/protocol for the condition and certificate class.',
      'FAA AME Guide — current revision', ['aviation', 'current source', 'AME'], ['FAA selected'],
      'https://www.faa.gov/ame_guide',
    ));

    if (medication) findings.push(finding(
      'faa-medication', 'faa', 'review', 'FAA medication disposition / no-fly review',
      'FAA medication guidance separates medications that prevent AME issuance without FAA clearance from medications requiring a no-fly observation period or other safety restrictions. The underlying condition and medication side effects must both be considered.',
      'Check the current FAA Pharmaceuticals section and DNI/DNF material for the exact medication/class before making an aeromedical recommendation.',
      'FAA AME Guide — Pharmaceuticals; DNI/DNF', ['medication', 'DNI', 'DNF', 'aeromedical'], ['medication'],
      'https://www.faa.gov/ame_guide/pharm',
    ));

    if (has(condition, 'hypertension', 'blood pressure') || has(medication, 'lisinopril', 'losartan', 'metoprolol', 'amlodipine')) findings.push(finding(
      'faa-hypertension', 'faa', 'review', 'FAA antihypertensive medication pathway',
      'FAA guidance allows multiple antihypertensive classes when certification criteria are met and calls for a seven-day ground/no-fly trial after starting a new hypertension medication to verify absence of side effects.',
      'Confirm medication class, number of agents, stability, side effects, and the current FAA hypertension worksheet/disposition.',
      'FAA AME Guide — Antihypertensive', ['hypertension', 'medication', 'ground trial'], ['condition', 'medication'],
      'https://www.faa.gov/ame_guide/pharm/antihyp',
    ));

    if (has(condition, 'depression', 'anxiety', 'ptsd', 'psychiatric', 'bipolar') || has(medication, 'ssri', 'sertraline', 'fluoxetine', 'escitalopram', 'antidepressant')) findings.push(finding(
      'faa-psychiatric', 'faa', 'waiver', 'Psychiatric condition / psychotropic disposition',
      'FAA guidance generally requires deferral for psychotropic medication use, with defined exceptions and special pathways for certain antidepressant-treated conditions. Current condition-specific disposition tools control.',
      'Use the current psychiatric disposition table and antidepressant pathway rather than a generic medication rule.',
      'FAA AME Guide Item 47; Antidepressants', ['psychiatric', 'psychotropic', 'defer', 'special issuance'], ['condition', 'medication'],
      'https://www.faa.gov/ame_guide/app_process/exam_tech/item47/amd',
    ));

    if (has(condition, 'sleep apnea', 'osa')) findings.push(finding(
      'faa-osa', 'faa', 'review', 'FAA OSA protocol / AASI pathway',
      'FAA maintains a dedicated OSA protocol, decision table, treated-status report, compliance material, and AME Assisted Special Issuance pathway.',
      'Use the current OSA protocol and treated-status/compliance documentation for the airman’s case.',
      'FAA AME Guide — OSA protocol', ['OSA', 'AASI', 'compliance'], ['condition'],
      'https://www.faa.gov/ame_guide/dec_cons/disease_prot/osa/ref_materials',
    ));
  }

  if (active.has('nfpa1580')) {
    findings.push(finding(
      'nfpa-occupational-medical', 'nfpa1580', 'review', 'NFPA 1580 occupational-medical chapters apply to emergency responders',
      'The 2025 NFPA 1580 standard consolidates the emergency-responder occupational-medical program content formerly published in NFPA 1582. Occupational-medical roles, essential job tasks, member evaluation, annual fitness evaluation, and evaluation requirements are organized in Chapters 9–13.',
      'Map the member’s condition and functional limitations to the essential job tasks and current NFPA 1580 occupational-medical chapters. Use NFPA LiNK/authorized standard access for controlling copyrighted criteria.',
      'NFPA 1580 (2025), Chapters 9–13', ['firefighter', 'essential job tasks', 'occupational medical', 'annual fitness'], ['NFPA selected', 'occupation'],
      'https://link.nfpa.org/all-publications/1580/2025',
    ));

    if (has(combined, 'respirator', 'scba', 'fire', 'heat', 'cardiac', 'heart', 'vision', 'hearing', 'musculoskeletal', 'seizure', 'diabetes', 'medication')) findings.push(finding(
      'nfpa-duty-interaction', 'nfpa1580', 'review', 'Condition must be assessed against emergency-responder essential job tasks',
      'For firefighter/emergency-responder review, the medical issue cannot be evaluated in isolation from essential job tasks such as emergency response, protective equipment/SCBA use, strenuous exertion, heat exposure, sensory demands, and safe team operations.',
      'Use the current NFPA 1580 essential-job-task and evaluation chapters to identify the specific duty interaction, then document the medical evidence needed to resolve that interaction.',
      'NFPA 1580 (2025), Chapters 10–13', ['essential job tasks', 'SCBA', 'heat', 'functional capacity'], ['condition', 'medication', 'occupation'],
      'https://link.nfpa.org/all-publications/1580/2025',
    ));
  }

  return findings;
}
