import { useMemo, useState } from "react";
import { Activity, Brain, Calculator, HeartPulse, MoonStar, RefreshCw, ShieldCheck } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import "./reviewer-tool-hierarchy.css";

type CalcGroup = "Risk & Prevention" | "Body & Renal" | "Cardiac & ECG" | "Respiratory & Exposure";
type CalcField = {
  key: string;
  label: string;
  unit?: string;
  type?: "number" | "select";
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
};
type SecondaryResult = { label: string; value: string };
type CalcOutput = {
  value: string;
  interpretation: string;
  reference: string;
  secondary?: SecondaryResult[];
  note?: string;
};
type CalcDef = {
  id: string;
  label: string;
  description: string;
  group: CalcGroup;
  fields: CalcField[];
  calculate: (v: Record<string, string>) => CalcOutput | null;
  sourceUrl?: string;
  badge?: string;
};

type PreventCoefficients = Record<string, number>;

const n = (v: Record<string, string>, key: string) => Number.parseFloat(v[key] || "");
const yes = (v: Record<string, string>, key: string) => v[key] === "yes";
const result = (value: string, interpretation: string, reference: string, secondary?: SecondaryResult[], note?: string): CalcOutput => ({ value, interpretation, reference, secondary, note });
const sexOptions = [{ label: "Male", value: "male" }, { label: "Female", value: "female" }];
const yesNoOptions = [{ label: "No", value: "no" }, { label: "Yes", value: "yes" }];

const PREVENT_10: Record<"female" | "male", PreventCoefficients> = {
  female: {
    age: 0.719883, nonHdl: 0.1176967, hdl: -0.151185, sbpLt: -0.0835358, sbpGe: 0.3592852,
    dm: 0.8348585, smoking: 0.4831078, egfrLt: 0.4864619, egfrGe: 0.0397779, bpTx: 0.2265309,
    statin: -0.0592374, bpTxSbpGe: -0.0395762, statinNonHdl: 0.0844423, ageNonHdl: -0.0567839,
    ageHdl: 0.0325692, ageSbpGe: -0.1035985, ageDm: -0.2417542, ageSmoking: -0.0791142,
    ageEgfrLt: -0.1671492, constant: -3.819975,
  },
  male: {
    age: 0.7099847, nonHdl: 0.1658663, hdl: -0.1144285, sbpLt: -0.2837212, sbpGe: 0.3239977,
    dm: 0.7189597, smoking: 0.3956973, egfrLt: 0.3690075, egfrGe: 0.0203619, bpTx: 0.2036522,
    statin: -0.0865581, bpTxSbpGe: -0.0322916, statinNonHdl: 0.114563, ageNonHdl: -0.0300005,
    ageHdl: 0.0232747, ageSbpGe: -0.0927024, ageDm: -0.2018525, ageSmoking: -0.0970527,
    ageEgfrLt: -0.1217081, constant: -3.500655,
  },
};

const PREVENT_30: Record<"female" | "male", PreventCoefficients> = {
  female: {
    age: 0.4669202, ageSquared: -0.0893118, nonHdl: 0.1256901, hdl: -0.1542255, sbpLt: -0.0018093,
    sbpGe: 0.322949, dm: 0.6296707, smoking: 0.268292, egfrLt: 0.100106, egfrGe: 0.0499663,
    bpTx: 0.1875292, statin: 0.0152476, bpTxSbpGe: -0.0276123, statinNonHdl: 0.0736147,
    ageNonHdl: -0.0521962, ageHdl: 0.0316918, ageSbpGe: -0.1046101, ageDm: -0.2727793,
    ageSmoking: -0.1530907, ageEgfrLt: -0.1299149, constant: -1.974074,
  },
  male: {
    age: 0.3994099, ageSquared: -0.0937484, nonHdl: 0.1744643, hdl: -0.120203, sbpLt: -0.0665117,
    sbpGe: 0.2753037, dm: 0.4790257, smoking: 0.1782635, egfrLt: -0.0218789, egfrGe: 0.0602553,
    bpTx: 0.1421182, statin: 0.0135996, bpTxSbpGe: -0.0218265, statinNonHdl: 0.1013148,
    ageNonHdl: -0.0312619, ageHdl: 0.020673, ageSbpGe: -0.0920935, ageDm: -0.2159947,
    ageSmoking: -0.1548811, ageEgfrLt: -0.0712547, constant: -1.736444,
  },
};

function preventTerms(v: Record<string, string>) {
  const age = (n(v, "age") - 55) / 10;
  const nonHdl = (n(v, "totalChol") - n(v, "hdl")) * 0.02586 - 3.5;
  const hdl = (n(v, "hdl") * 0.02586 - 1.3) / 0.3;
  const sbpLt = (Math.min(n(v, "sbp"), 110) - 110) / 20;
  const sbpGe = (Math.max(n(v, "sbp"), 110) - 130) / 20;
  const egfrLt = (Math.min(n(v, "egfr"), 60) - 60) / -15;
  const egfrGe = (Math.max(n(v, "egfr"), 60) - 90) / -15;
  const dm = yes(v, "diabetes") ? 1 : 0;
  const smoking = yes(v, "smoking") ? 1 : 0;
  const bpTx = yes(v, "bpTx") ? 1 : 0;
  const statin = yes(v, "statin") ? 1 : 0;
  return {
    age,
    ageSquared: age * age,
    nonHdl,
    hdl,
    sbpLt,
    sbpGe,
    dm,
    smoking,
    egfrLt,
    egfrGe,
    bpTx,
    statin,
    bpTxSbpGe: bpTx * sbpGe,
    statinNonHdl: statin * nonHdl,
    ageNonHdl: age * nonHdl,
    ageHdl: age * hdl,
    ageSbpGe: age * sbpGe,
    ageDm: age * dm,
    ageSmoking: age * smoking,
    ageEgfrLt: age * egfrLt,
  };
}

function preventRisk(v: Record<string, string>, horizon: 10 | 30) {
  const sex = v.sex === "female" ? "female" : "male";
  const coefficients = horizon === 10 ? PREVENT_10[sex] : PREVENT_30[sex];
  const terms = preventTerms(v);
  let logOdds = coefficients.constant;
  Object.entries(terms).forEach(([key, value]) => {
    if (coefficients[key] !== undefined) logOdds += coefficients[key] * value;
  });
  return 1 / (1 + Math.exp(-logOdds));
}

function preventBand(risk: number) {
  if (risk < 0.03) return "Low";
  if (risk < 0.05) return "Borderline";
  if (risk < 0.10) return "Intermediate";
  return "High";
}

function seizureRecurrence(v: Record<string, string>) {
  const seizureHr = v.seizureType === "focal" ? 1.15 : v.seizureType === "other" ? 0.80 : 1;
  const eegHr = v.eeg === "abnormal" ? 1.30 : v.eeg === "not-indicated" ? 1.18 : 1;
  const imagingHr = v.imaging === "abnormal" ? 1.11 : v.imaging === "not-indicated" ? 1.24 : 1;
  const hr = (yes(v, "neuroDeficit") ? 1.39 : 1) * seizureHr * eegHr * imagingHr * (v.treatment === "immediate" ? 0.74 : 1);
  const oneYear = 1 - Math.pow(1 - 0.351, hr);
  const threeYear = 1 - Math.pow(1 - 0.462, hr);
  return { oneYear, threeYear, hr };
}

const CALCS: CalcDef[] = [
  {
    id: "prevent-ascvd",
    label: "PREVENT-ASCVD",
    group: "Risk & Prevention",
    badge: "2026 guideline",
    description: "Current AHA PREVENT estimate of future atherosclerotic cardiovascular disease risk.",
    sourceUrl: "https://professional.heart.org/en/guidelines-and-statements/prevent-calculator",
    fields: [
      { key: "age", label: "Age", unit: "years", min: 30, max: 79, step: 1 },
      { key: "sex", label: "Sex used by equation", type: "select", options: sexOptions },
      { key: "sbp", label: "Systolic BP", unit: "mmHg", min: 90, max: 180, step: 1 },
      { key: "totalChol", label: "Total cholesterol", unit: "mg/dL", min: 130, max: 320, step: 1 },
      { key: "hdl", label: "HDL cholesterol", unit: "mg/dL", min: 20, max: 100, step: 1 },
      { key: "egfr", label: "eGFR", unit: "mL/min/1.73m²", min: 15, max: 140, step: 1 },
      { key: "bpTx", label: "BP treatment", type: "select", options: yesNoOptions },
      { key: "statin", label: "Statin therapy", type: "select", options: yesNoOptions },
      { key: "diabetes", label: "Diabetes", type: "select", options: yesNoOptions },
      { key: "smoking", label: "Current smoking", type: "select", options: yesNoOptions },
    ],
    calculate: (v) => {
      if (n(v, "hdl") >= n(v, "totalChol")) return null;
      const tenYear = preventRisk(v, 10);
      const age = n(v, "age");
      const secondary: SecondaryResult[] = [{ label: "2026 risk category", value: preventBand(tenYear) }];
      if (age <= 59) secondary.push({ label: "30-year ASCVD risk", value: `${(preventRisk(v, 30) * 100).toFixed(1)}%` });
      return result(
        `${(tenYear * 100).toFixed(1)}%`,
        `${preventBand(tenYear)} 10-year PREVENT-ASCVD risk under 2026 ACC/AHA categories.`,
        "AHA PREVENT-ASCVD base equation; 2026 ACC/AHA Dyslipidemia Guideline.",
        secondary,
        "Primary-prevention estimate for adults 30–79 without known cardiovascular disease. Optional PREVENT predictors are intentionally omitted to keep the input set minimal."
      );
    },
  },
  {
    id: "mess-seizure",
    label: "Seizure Recurrence",
    group: "Risk & Prevention",
    badge: "MESS model",
    description: "Model-derived 1- and 3-year recurrence estimates after a single seizure or early epilepsy presentation.",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8776562/",
    fields: [
      { key: "neuroDeficit", label: "Neurological deficit", type: "select", options: yesNoOptions },
      { key: "seizureType", label: "Seizure type", type: "select", options: [{ label: "Generalized", value: "generalized" }, { label: "Focal", value: "focal" }, { label: "Other", value: "other" }] },
      { key: "eeg", label: "EEG result", type: "select", options: [{ label: "Normal", value: "normal" }, { label: "Abnormal", value: "abnormal" }, { label: "Not clinically indicated", value: "not-indicated" }] },
      { key: "imaging", label: "CT / MRI result", type: "select", options: [{ label: "Normal", value: "normal" }, { label: "Abnormal", value: "abnormal" }, { label: "Not clinically indicated", value: "not-indicated" }] },
      { key: "treatment", label: "Antiseizure treatment", type: "select", options: [{ label: "Delayed / not immediate", value: "delayed" }, { label: "Immediate", value: "immediate" }] },
    ],
    calculate: (v) => {
      const estimate = seizureRecurrence(v);
      return result(
        `${(estimate.oneYear * 100).toFixed(1)}%`,
        "MESS-derived estimated probability of seizure recurrence within 1 year.",
        "MESS model development and external validation, Seizure (2022).",
        [
          { label: "3-year recurrence estimate", value: `${(estimate.threeYear * 100).toFixed(1)}%` },
          { label: "Relative hazard vs reference", value: `${estimate.hr.toFixed(2)}×` },
        ],
        "The published model has modest discrimination; this estimate supports risk review and is not an individual certainty or a fitness-for-duty decision."
      );
    },
  },
  {
    id: "essen-stroke",
    label: "Recurrent Stroke · Essen",
    group: "Risk & Prevention",
    badge: "Secondary prevention",
    description: "Essen Stroke Risk Score for recurrent stroke / vascular-event stratification after ischemic stroke or TIA.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/19023098/",
    fields: [
      { key: "age", label: "Age", unit: "years", min: 18, max: 110, step: 1 },
      { key: "hypertension", label: "Hypertension", type: "select", options: yesNoOptions },
      { key: "diabetes", label: "Diabetes", type: "select", options: yesNoOptions },
      { key: "mi", label: "Previous MI", type: "select", options: yesNoOptions },
      { key: "otherCvd", label: "Other cardiovascular disease", type: "select", options: yesNoOptions },
      { key: "pad", label: "Peripheral artery disease", type: "select", options: yesNoOptions },
      { key: "smoking", label: "Current / recent smoking", type: "select", options: yesNoOptions },
      { key: "priorEvent", label: "Prior TIA / ischemic stroke before qualifying event", type: "select", options: yesNoOptions },
    ],
    calculate: (v) => {
      const age = n(v, "age");
      const agePoints = age > 75 ? 2 : age >= 65 ? 1 : 0;
      const score = agePoints + ["hypertension", "diabetes", "mi", "otherCvd", "pad", "smoking", "priorEvent"].filter((key) => yes(v, key)).length;
      const elevated = score > 2;
      return result(
        `${score} / 9`,
        `${elevated ? "Higher" : "Lower"} recurrent-stroke risk stratum by the traditional Essen cutoff (>2).`,
        "Essen Stroke Risk Score; REACH validation (Stroke 2009) and 1-year hospital validation.",
        [{ label: "Observed 1-year recurrence in one validation cohort", value: elevated ? "18.0%" : "10.3%" }],
        "The percentage shown is an observed cohort rate for the score stratum, not a personalized probability. The score was validated in non-atrial-fibrillation ischemic stroke/TIA populations."
      );
    },
  },
  {
    id: "stop-bang",
    label: "STOP-Bang",
    group: "Risk & Prevention",
    badge: "OSA screening",
    description: "Concise obstructive sleep apnea screening score with eight clinical items.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26378880/",
    fields: [
      { key: "snoring", label: "Loud snoring", type: "select", options: yesNoOptions },
      { key: "tired", label: "Daytime tiredness", type: "select", options: yesNoOptions },
      { key: "observed", label: "Observed apnea", type: "select", options: yesNoOptions },
      { key: "hypertension", label: "High blood pressure", type: "select", options: yesNoOptions },
      { key: "bmi", label: "BMI", unit: "kg/m²", min: 10, max: 80, step: 0.1 },
      { key: "age", label: "Age", unit: "years", min: 18, max: 110, step: 1 },
      { key: "neck", label: "Neck circumference", unit: "cm", min: 20, max: 80, step: 0.1 },
      { key: "sex", label: "Sex", type: "select", options: sexOptions },
    ],
    calculate: (v) => {
      const stop = ["snoring", "tired", "observed", "hypertension"].filter((key) => yes(v, key)).length;
      const score = stop + (n(v, "bmi") > 35 ? 1 : 0) + (n(v, "age") > 50 ? 1 : 0) + (n(v, "neck") > 40 ? 1 : 0) + (v.sex === "male" ? 1 : 0);
      const highCombination = score >= 3 && stop >= 2 && (n(v, "bmi") > 35 || v.sex === "male" || n(v, "neck") > 40);
      const tier = score <= 2 ? "Low" : score >= 5 || highCombination ? "High" : "Intermediate";
      return result(
        `${score} / 8`,
        `${tier} screening risk for moderate-to-severe obstructive sleep apnea.`,
        "Chung et al., CHEST 2016 STOP-Bang practical approach.",
        [{ label: "STOP subtotal", value: `${stop} / 4` }],
        "STOP-Bang is a screening instrument; objective sleep testing is required to diagnose OSA."
      );
    },
  },
  {
    id: "bmi",
    label: "BMI",
    group: "Body & Renal",
    description: "Adult body-mass-index screening value.",
    sourceUrl: "https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html",
    fields: [{ key: "weight", label: "Weight", unit: "kg", min: 20, max: 300 }, { key: "height", label: "Height", unit: "cm", min: 100, max: 250 }],
    calculate: (v) => {
      const bmi = n(v, "weight") / ((n(v, "height") / 100) ** 2);
      if (!Number.isFinite(bmi)) return null;
      const band = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy-weight" : bmi < 30 ? "Overweight" : bmi < 35 ? "Obesity class 1" : bmi < 40 ? "Obesity class 2" : "Obesity class 3";
      return result(bmi.toFixed(1), `${band} adult BMI range.`, "CDC adult BMI categories.", undefined, "BMI is a screening measure, not a diagnosis or fitness determination.");
    },
  },
  {
    id: "egfr",
    label: "eGFR",
    group: "Body & Renal",
    badge: "2021 CKD-EPI",
    description: "Race-free adult creatinine estimate using the 2021 CKD-EPI equation.",
    sourceUrl: "https://www.kidney.org/ckd-epi-creatinine-equation-2021",
    fields: [{ key: "creatinine", label: "Serum creatinine", unit: "mg/dL", min: 0.3, max: 15, step: 0.01 }, { key: "age", label: "Age", unit: "years", min: 18, max: 120 }, { key: "sex", label: "Sex used by equation", type: "select", options: sexOptions }],
    calculate: (v) => {
      const cr = n(v, "creatinine"), age = n(v, "age"), female = v.sex === "female", k = female ? 0.7 : 0.9, a = female ? -0.241 : -0.302, ratio = cr / k;
      const value = 142 * Math.pow(Math.min(ratio, 1), a) * Math.pow(Math.max(ratio, 1), -1.2) * Math.pow(0.9938, age) * (female ? 1.012 : 1);
      if (!Number.isFinite(value)) return null;
      const band = value >= 90 ? "G1 eGFR range — eGFR alone does not establish CKD" : value >= 60 ? "G2 eGFR range — eGFR alone does not establish CKD" : value >= 45 ? "G3a eGFR range" : value >= 30 ? "G3b eGFR range" : value >= 15 ? "G4 eGFR range" : "G5 eGFR range";
      return result(`${value.toFixed(0)} mL/min/1.73m²`, band, "2021 CKD-EPI race-free creatinine equation; National Kidney Foundation.");
    },
  },
  {
    id: "crcl",
    label: "Creatinine Clearance",
    group: "Body & Renal",
    description: "Adult Cockcroft–Gault estimate for medication-dosing contexts that specifically call for CrCl.",
    fields: [{ key: "age", label: "Age", unit: "years", min: 18, max: 120 }, { key: "weight", label: "Weight selected for equation", unit: "kg", min: 20, max: 500 }, { key: "creatinine", label: "Serum creatinine", unit: "mg/dL", min: 0.2, max: 20, step: 0.01 }, { key: "sex", label: "Sex adjustment", type: "select", options: sexOptions }],
    calculate: (v) => {
      let value = ((140 - n(v, "age")) * n(v, "weight")) / (72 * n(v, "creatinine"));
      if (v.sex === "female") value *= 0.85;
      return result(`${value.toFixed(0)} mL/min`, "Cockcroft–Gault estimate.", "Cockcroft–Gault equation.", undefined, "Appropriate weight selection and medication-specific dosing rules remain protocol-specific.");
    },
  },
  {
    id: "bsa",
    label: "Body Surface Area",
    group: "Body & Renal",
    description: "Mosteller body-surface-area estimate.",
    fields: [{ key: "height", label: "Height", unit: "cm", min: 50, max: 275 }, { key: "weight", label: "Weight", unit: "kg", min: 2, max: 500 }],
    calculate: (v) => result(`${Math.sqrt(n(v, "height") * n(v, "weight") / 3600).toFixed(2)} m²`, "Body-size estimate.", "Mosteller: √((height cm × weight kg) ÷ 3600).", undefined, "Use only where the applicable clinical protocol calls for BSA."),
  },
  {
    id: "ibw",
    label: "Ideal Body Weight",
    group: "Body & Renal",
    description: "Devine equation dosing reference.",
    fields: [{ key: "height", label: "Height", unit: "cm", min: 100, max: 250 }, { key: "sex", label: "Sex used by equation", type: "select", options: sexOptions }],
    calculate: (v) => {
      const inches = n(v, "height") / 2.54, base = v.sex === "female" ? 45.5 : 50, value = base + 2.3 * Math.max(0, inches - 60);
      return result(`${value.toFixed(1)} kg`, "Equation-derived dosing reference.", "Devine equation.", undefined, "Not a target body weight or fitness determination.");
    },
  },
  {
    id: "adjbw",
    label: "Adjusted Body Weight",
    group: "Body & Renal",
    description: "IBW-based dosing reference.",
    fields: [{ key: "actual", label: "Actual weight", unit: "kg", min: 2, max: 500 }, { key: "ibw", label: "Ideal body weight", unit: "kg", min: 20, max: 250 }],
    calculate: (v) => result(`${(n(v, "ibw") + 0.4 * (n(v, "actual") - n(v, "ibw"))).toFixed(1)} kg`, "Adjusted body-weight estimate.", "AdjBW = IBW + 0.4 × (actual − IBW).", undefined, "Use only when a medication or protocol specifies adjusted body weight."),
  },
  {
    id: "map",
    label: "Mean Arterial Pressure",
    group: "Cardiac & ECG",
    description: "Quick systolic / diastolic blood-pressure arithmetic estimate.",
    fields: [{ key: "sbp", label: "Systolic BP", unit: "mmHg", min: 50, max: 300 }, { key: "dbp", label: "Diastolic BP", unit: "mmHg", min: 20, max: 200 }],
    calculate: (v) => n(v, "sbp") > n(v, "dbp") ? result(`${((n(v, "sbp") + 2 * n(v, "dbp")) / 3).toFixed(0)} mmHg`, "Arithmetic MAP estimate.", "MAP ≈ (SBP + 2×DBP) / 3.", undefined, "Apply program-specific blood-pressure criteria separately.") : null,
  },
  {
    id: "bazett",
    label: "QTc · Bazett",
    group: "Cardiac & ECG",
    description: "Heart-rate-corrected QT interval using Bazett correction.",
    fields: [{ key: "qt", label: "QT interval", unit: "ms", min: 100, max: 1000 }, { key: "rr", label: "RR interval", unit: "seconds", min: 0.3, max: 2, step: 0.01 }],
    calculate: (v) => result(`${(n(v, "qt") / Math.sqrt(n(v, "rr"))).toFixed(0)} ms`, "Bazett-corrected QT estimate.", "QTc = QT ÷ √RR.", undefined, "Interpret in ECG and clinical context; Bazett may overcorrect at higher heart rates."),
  },
  {
    id: "fridericia",
    label: "QTc · Fridericia",
    group: "Cardiac & ECG",
    description: "Cube-root heart-rate correction for the QT interval.",
    fields: [{ key: "qt", label: "QT interval", unit: "ms", min: 100, max: 1000 }, { key: "rr", label: "RR interval", unit: "seconds", min: 0.3, max: 2, step: 0.01 }],
    calculate: (v) => result(`${(n(v, "qt") / Math.cbrt(n(v, "rr"))).toFixed(0)} ms`, "Fridericia-corrected QT estimate.", "QTc = QT ÷ ∛RR.", undefined, "Interpret in ECG and clinical context."),
  },
  {
    id: "pack",
    label: "Pack-Years",
    group: "Respiratory & Exposure",
    description: "Smoking exposure history for clinical screening and documentation.",
    fields: [{ key: "cigs", label: "Cigarettes per day", min: 0, max: 200 }, { key: "years", label: "Years smoked", min: 0, max: 100, step: 0.5 }],
    calculate: (v) => result(`${((n(v, "cigs") / 20) * n(v, "years")).toFixed(1)} pack-years`, "Cumulative cigarette-exposure summary.", "(cigarettes/day ÷ 20) × years.", undefined, "Screening eligibility and medical decisions come from the applicable clinical standard."),
  },
];

const GROUPS: Array<{ id: CalcGroup; label: string; copy: string }> = [
  { id: "Risk & Prevention", label: "Risk & prevention", copy: "ASCVD, seizure recurrence, recurrent stroke, OSA" },
  { id: "Body & Renal", label: "Body & renal", copy: "BMI, kidney function, dosing references" },
  { id: "Cardiac & ECG", label: "Cardiac & ECG", copy: "MAP and QT correction" },
  { id: "Respiratory & Exposure", label: "Respiratory", copy: "Medical exposure history only" },
];

const groupIcon: Record<CalcGroup, typeof Activity> = {
  "Risk & Prevention": ShieldCheck,
  "Body & Renal": Activity,
  "Cardiac & ECG": HeartPulse,
  "Respiratory & Exposure": MoonStar,
};

export default function ReviewerClinicalCalculatorsPage() {
  const [group, setGroup] = useState<CalcGroup>("Risk & Prevention");
  const [activeId, setActiveId] = useState("prevent-ascvd");
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [output, setOutput] = useState<CalcOutput | null>(null);
  const [error, setError] = useState("");
  const groupCalcs = useMemo(() => CALCS.filter((calc) => calc.group === group), [group]);
  const active = CALCS.find((calc) => calc.id === activeId) ?? groupCalcs[0];
  const current = values[active.id] || {};
  const GroupIcon = groupIcon[group];

  function chooseGroup(next: CalcGroup) {
    setGroup(next);
    const first = CALCS.find((calc) => calc.group === next);
    if (first) setActiveId(first.id);
    setOutput(null);
    setError("");
  }

  function chooseCalc(id: string) {
    setActiveId(id);
    setOutput(null);
    setError("");
  }

  function setValue(key: string, value: string) {
    setValues((all) => ({ ...all, [active.id]: { ...(all[active.id] || {}), [key]: value } }));
    setOutput(null);
    setError("");
  }

  function calculate() {
    const missing = active.fields.find((field) => current[field.key] === undefined || current[field.key] === "");
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    const invalid = active.fields.find((field) => field.type !== "select" && (!Number.isFinite(n(current, field.key)) || (field.min !== undefined && n(current, field.key) < field.min) || (field.max !== undefined && n(current, field.key) > field.max)));
    if (invalid) {
      setError(`${invalid.label} must be within ${invalid.min}–${invalid.max}${invalid.unit ? ` ${invalid.unit}` : ""}.`);
      return;
    }
    try {
      const value = active.calculate(current);
      if (!value) throw new Error("Inputs are not clinically valid for this equation.");
      setOutput(value);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Calculation failed.");
    }
  }

  function clear() {
    setValues((all) => ({ ...all, [active.id]: {} }));
    setOutput(null);
    setError("");
  }

  return (
    <main className="aurora-bg reviewer-native-page min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow="Clinical / Calculators" title="Clinical Calculators" subtitle="Medical calculators only: validated clinical risk, renal/dosing, ECG, and screening values with the minimum inputs required by each model." />

        <div className="rh-stack">
          <section className="rh-primary-action">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="rh-kicker">01 · Medical calculator family</div>
                <h2 className="rh-section-title">Choose the clinical question.</h2>
                <p className="rh-section-copy">Environmental comfort math has been removed. Every tool here returns a medical screening, physiologic, dosing, or validated risk value.</p>
              </div>
              <GroupIcon className="text-cyan-100/50" />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {GROUPS.map((item) => (
                <button key={item.id} className={`rh-tab rounded-2xl border p-3 text-left ${group === item.id ? "active" : ""}`} onClick={() => chooseGroup(item.id)}>
                  <strong className="block text-[11px]">{item.label}</strong>
                  <span className="mt-1 block text-[9px] leading-4 opacity-55">{item.copy}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {groupCalcs.map((calc) => (
                <button key={calc.id} onClick={() => chooseCalc(calc.id)} className={`rh-secondary ${active.id === calc.id ? "!border-cyan-100/28 !bg-cyan-300/[.08] !text-white" : ""}`}>
                  {calc.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rh-hero">
            <div className="rh-hero-grid">
              <div className="rh-hero-main">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="rh-kicker">02 · Minimum required inputs</div>
                    <h2 className="rh-section-title">{active.label}</h2>
                    <p className="rh-section-copy">{active.description}</p>
                  </div>
                  {active.badge ? <span className="rounded-full border border-violet-200/16 bg-violet-300/[.06] px-3 py-1 text-[9px] font-black uppercase tracking-[.1em] text-violet-50/70">{active.badge}</span> : null}
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {active.fields.map((field) => (
                    <label key={field.key}>
                      <span className="rh-label">{field.label}{field.unit ? ` · ${field.unit}` : ""}</span>
                      {field.type === "select" ? (
                        <select aria-label={field.unit ? `${field.label} · ${field.unit}` : field.label} value={current[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)} className="rh-input mt-2 bg-[#061123]">
                          <option value="">Select…</option>
                          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : (
                        <input aria-label={field.unit ? `${field.label} · ${field.unit}` : field.label} type="number" min={field.min} max={field.max} step={field.step || 0.1} value={current[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)} className="rh-input mt-2" />
                      )}
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button onClick={calculate} className="rh-action"><Calculator size={15} className="mr-2 inline" />Calculate</button>
                  <button onClick={clear} className="rh-secondary"><RefreshCw size={14} className="mr-2 inline" />Clear</button>
                </div>
                {error ? <div className="mt-5 rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-sm text-rose-50/75">{error}</div> : null}
              </div>

              <aside className="rh-hero-side">
                <div className="rh-kicker">03 · Clinical result</div>
                {output ? (
                  <>
                    <div className="mt-5 text-4xl font-black tracking-[-.05em] text-white sm:text-5xl">{output.value}</div>
                    <p className="mt-4 text-sm leading-6 text-cyan-50/70">{output.interpretation}</p>
                    {output.secondary?.length ? (
                      <div className="mt-5 grid gap-2">
                        {output.secondary.map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
                            <div className="text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/42">{item.label}</div>
                            <strong className="mt-1 block text-sm text-white">{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {output.note ? <div className="mt-5 rounded-2xl border border-amber-200/13 bg-amber-300/[.035] p-3 text-[10px] leading-5 text-amber-100/65">{output.note}</div> : null}
                    <div className="mt-5 border-t border-white/8 pt-4 text-[10px] leading-5 text-cyan-100/42">
                      <strong className="text-cyan-50/65">Reference:</strong> {output.reference}
                      {active.sourceUrl ? <a className="ml-2 font-black text-cyan-100/66 hover:text-white" href={active.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a> : null}
                    </div>
                  </>
                ) : (
                  <div className="mt-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-300/[.05]"><Calculator size={24} className="text-cyan-100/55" /></div>
                    <h3 className="mt-5 text-xl font-black">Ready for calculation</h3>
                    <p className="mt-3 text-sm leading-6 text-cyan-100/46">Enter only the fields required by this model. The result, interpretation, source, and limits appear here.</p>
                  </div>
                )}
              </aside>
            </div>
          </section>

          <section className="rh-support-grid">
            <div className="rh-card is-wide">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="rh-label">What changed</div>
                  <h3 className="mt-2">Clinical signal over generic arithmetic</h3>
                  <p className="mt-3">PREVENT-ASCVD, seizure recurrence, recurrent-stroke stratification, and STOP-Bang now sit beside the renal, ECG, and dosing calculations that actually belong in a medical-review workspace.</p>
                </div>
                <Brain className="shrink-0 text-violet-100/48" />
              </div>
            </div>
            <div className="rh-card">
              <div className="rh-label">Removed</div>
              <h3 className="mt-2">Environmental calculators</h3>
              <p className="mt-3">Heat Index, Wind Chill, generic target-heart-rate math, predicted max HR, and walking-MET estimation are not part of this clinical calculator workspace.</p>
            </div>
            <div className="rh-card is-full is-quiet">
              <div className="rh-label">Interpretation boundary</div>
              <p className="mt-2">These tools reproduce published equations and screening scores. They support medical review; they do not diagnose disease, predict an individual outcome with certainty, or issue fitness-for-duty clearance.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
