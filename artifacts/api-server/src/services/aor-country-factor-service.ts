import type { AorCountryProfile } from "../data/aor-country-profiles";

export type AorBaselineSignalKey =
  | "heat"
  | "cold"
  | "humidity"
  | "altitude"
  | "dustAir"
  | "vector"
  | "foodWater"
  | "severeWeather"
  | "seismic"
  | "remoteCare"
  | "specialtyAccess"
  | "evacuation"
  | "medicationContinuity"
  | "securityAccess";

export type AorBaselineEvidenceField =
  | "climateEnvironment"
  | "medicalAccess"
  | "securityAccess"
  | "travelHealthContext"
  | "escalationEvacuation"
  | "reviewWatchItems";

export type AorBaselineSignal = {
  key: AorBaselineSignalKey;
  label: string;
  evidenceField: AorBaselineEvidenceField;
  evidenceText: string;
};

export type AorConditionConsideration = {
  ruleId: string;
  classification: "Reviewer consideration — not a determination";
  summary: string;
  matchedTerms: string[];
  countrySignals: AorBaselineSignalKey[];
  evidenceField: AorBaselineEvidenceField;
  evidenceText: string;
};

const LABELS: Record<AorBaselineSignalKey, string> = {
  heat: "Heat exposure",
  cold: "Cold exposure",
  humidity: "Humidity",
  altitude: "Altitude / terrain",
  dustAir: "Dust / air quality",
  vector: "Vector-borne exposure",
  foodWater: "Food / water exposure",
  severeWeather: "Severe-weather disruption",
  seismic: "Seismic disruption",
  remoteCare: "Remote-care access",
  specialtyAccess: "Specialty-care access",
  evacuation: "Evacuation / escalation",
  medicationContinuity: "Medication / treatment continuity",
  securityAccess: "Security / access",
};

const normalize = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function evidenceSources(profile: AorCountryProfile): Array<[AorBaselineEvidenceField, string]> {
  return [
    ["climateEnvironment", profile.climateEnvironment],
    ["medicalAccess", profile.medicalAccess],
    ["securityAccess", profile.securityAccess],
    ["travelHealthContext", profile.travelHealthContext],
    ["escalationEvacuation", profile.escalationEvacuation],
    ["reviewWatchItems", profile.reviewWatchItems.join("; ")],
  ];
}

const SIGNAL_PATTERNS: Record<AorBaselineSignalKey, RegExp> = {
  heat: /\b(?:heat|hot|thermal load|high outdoor thermal)\b/i,
  cold: /\b(?:cold|winter)\b/i,
  humidity: /\b(?:humid|humidity)\b/i,
  altitude: /\b(?:altitude|mountainous|terrain-related|elevation)\b/i,
  dustAir: /\b(?:dust|air-quality|air quality|particulate)\b/i,
  vector: /\b(?:vector-borne|vector|mosquito|tick|sand fly)\b/i,
  foodWater: /\b(?:food\s*\/\s*water|food and water|food water|water exposure)\b/i,
  severeWeather: /\b(?:severe-weather|severe weather|wildfire|cyclone|hurricane|typhoon|monsoon|heavy-rain)\b/i,
  seismic: /\b(?:seismic|earthquake)\b/i,
  remoteCare: /\b(?:remote|rural|provincial|inter-island|remote-island)\b/i,
  specialtyAccess: /\b(?:specialty|advanced diagnostics|advanced and specialty care)\b/i,
  evacuation: /\b(?:evacuation|escalation|transfer pathway|transport route|staged evacuation)\b/i,
  medicationContinuity: /\b(?:medication continuity|medication-continuity|medication storage|medication-storage|treatment continuity|pharmacy)\b/i,
  securityAccess: /\b(?:security|regional restrictions|border|access conditions|government.*advisory|advisories)\b/i,
};

export function deriveAorBaselineSignals(profile: AorCountryProfile): AorBaselineSignal[] {
  const result: AorBaselineSignal[] = [];
  const seen = new Set<AorBaselineSignalKey>();
  const sources = evidenceSources(profile);

  for (const key of Object.keys(SIGNAL_PATTERNS) as AorBaselineSignalKey[]) {
    const pattern = SIGNAL_PATTERNS[key];
    for (const [evidenceField, evidenceText] of sources) {
      if (!evidenceText || !pattern.test(evidenceText)) continue;
      if (!seen.has(key)) {
        result.push({ key, label: LABELS[key], evidenceField, evidenceText });
        seen.add(key);
      }
      break;
    }
  }

  return result;
}

function hasAny(value: string, expressions: RegExp[]) {
  return expressions.some((expression) => expression.test(value));
}

function firstSignal(signals: AorBaselineSignal[], keys: AorBaselineSignalKey[]) {
  return signals.find((signal) => keys.includes(signal.key)) ?? null;
}

function consideration(
  ruleId: string,
  summary: string,
  matchedTerms: string[],
  signal: AorBaselineSignal,
  countrySignals: AorBaselineSignalKey[],
): AorConditionConsideration {
  return {
    ruleId,
    classification: "Reviewer consideration — not a determination",
    summary,
    matchedTerms,
    countrySignals,
    evidenceField: signal.evidenceField,
    evidenceText: signal.evidenceText,
  };
}

export function evaluateDeploymentConditionLens(input: {
  profile: AorCountryProfile;
  condition?: string;
  medication?: string;
  workContext?: string;
}): AorConditionConsideration[] {
  const condition = normalize(input.condition);
  const medication = normalize(input.medication);
  const workContext = normalize(input.workContext);
  const combined = `${condition} ${medication} ${workContext}`.trim();
  if (!combined) return [];

  const signals = deriveAorBaselineSignals(input.profile);
  const keys = new Set(signals.map((signal) => signal.key));
  const result: AorConditionConsideration[] = [];

  if (hasAny(condition, [/\basthma\b/, /\breactive airway\b/]) && keys.has("dustAir")) {
    const signal = firstSignal(signals, ["dustAir"]);
    if (signal) result.push(consideration(
      "asthma-dust-air",
      "Dust or air-quality context may warrant review of respiratory symptom control, exposure mitigation, and rescue-treatment access.",
      ["asthma", "dust / air-quality context"],
      signal,
      ["dustAir"],
    ));
  }

  if (/\bdiabet(?:es|ic)\b/.test(condition) && /\binsulin\b/.test(medication) && (keys.has("medicationContinuity") || keys.has("remoteCare") || keys.has("evacuation"))) {
    const signal = firstSignal(signals, ["medicationContinuity", "remoteCare", "evacuation"]);
    if (signal) result.push(consideration(
      "diabetes-insulin-continuity",
      "Insulin-dependent diabetes may warrant review of medication storage, resupply, monitoring supplies, and contingency access in this deployment context.",
      ["diabetes", "insulin", "medication / access context"],
      signal,
      [signal.key],
    ));
  }

  if (hasAny(condition, [/\bseizure\b/, /\bepilep(?:sy|tic)\b/]) && (keys.has("remoteCare") || keys.has("specialtyAccess") || keys.has("evacuation"))) {
    const signal = firstSignal(signals, ["remoteCare", "specialtyAccess", "evacuation"]);
    if (signal) result.push(consideration(
      "seizure-emergency-access",
      "A seizure history may warrant review of emergency-response access, rescue planning, medication continuity, and escalation pathways for this location.",
      ["seizure history", "emergency / specialty access context"],
      signal,
      [signal.key],
    ));
  }

  const cardiacCondition = hasAny(condition, [/\bcardiac\b/, /\bcardiovascular\b/, /\bcoronary\b/, /\bheart\b/]);
  const heavyExertion = hasAny(workContext, [/\bheavy exertion\b/, /\bstrenuous\b/, /\bheavy physical\b/, /\bhigh exertion\b/]);
  const profileExertion = input.profile.reviewWatchItems.some((item) => /cardiovascular exertion/i.test(item));
  if (cardiacCondition && keys.has("heat") && (heavyExertion || profileExertion)) {
    const signal = firstSignal(signals, ["heat"]);
    if (signal) result.push(consideration(
      "cardiac-heat-exertion",
      "Cardiac history with heat and exertional demand may warrant review of workload tolerance, hydration/heat controls, symptom stability, and emergency access.",
      ["cardiac history", "heat", heavyExertion ? "heavy exertion" : "cardiovascular exertion watch item"],
      signal,
      ["heat"],
    ));
  }

  const osaCondition = hasAny(condition, [/\bsleep apnea\b/, /\bobstructive sleep apnea\b/, /\bosa\b/]);
  const cpap = hasAny(combined, [/\bcpap\b/, /\bpap therapy\b/]);
  const explicitPowerConstraint = hasAny(workContext, [/\bunreliable power\b/, /\bpower outage\b/, /\bno power\b/, /\belectricity limitation\b/, /\bgenerator dependence\b/]);
  if (osaCondition && cpap && explicitPowerConstraint) {
    const signal = firstSignal(signals, ["medicationContinuity", "remoteCare", "evacuation"]) ?? {
      key: "medicationContinuity" as const,
      label: LABELS.medicationContinuity,
      evidenceField: "reviewWatchItems" as const,
      evidenceText: input.profile.reviewWatchItems.join("; ") || input.profile.travelHealthContext,
    };
    result.push(consideration(
      "osa-cpap-power-continuity",
      "OSA treated with CPAP in a setting with an explicitly identified power constraint may warrant review of power backup, equipment support, adherence continuity, and contingency planning.",
      ["sleep apnea", "CPAP", "explicit power constraint"],
      signal,
      signal.evidenceText ? [signal.key] : [],
    ));
  }

  return result;
}
