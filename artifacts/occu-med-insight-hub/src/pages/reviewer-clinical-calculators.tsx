import { useMemo, useState } from "react";
import { Calculator, FileDown, HeartPulse, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";

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
type CalcOutput = { value: string; interpretation: string; reference: string; secondary?: SecondaryResult[]; note?: string };
type CalcDef = {
  id: string;
  label: string;
  description: string;
  group: CalcGroup;
  fields: CalcField[];
  calculate: (values: Record<string, string>) => CalcOutput | null;
  sourceUrl?: string;
  badge?: string;
};
type PreventCoefficients = Record<string, number>;

const n = (values: Record<string, string>, key: string) => Number.parseFloat(values[key] || "");
const yes = (values: Record<string, string>, key: string) => values[key] === "yes";
const result = (value: string, interpretation: string, reference: string, secondary?: SecondaryResult[], note?: string): CalcOutput => ({ value, interpretation, reference, secondary, note });
const sexOptions = [{ label: "Male", value: "male" }, { label: "Female", value: "female" }];
const yesNoOptions = [{ label: "No", value: "no" }, { label: "Yes", value: "yes" }];

const PREVENT_10: Record<"female" | "male", PreventCoefficients> = {
  female: { age: 0.719883, nonHdl: 0.1176967, hdl: -0.151185, sbpLt: -0.0835358, sbpGe: 0.3592852, dm: 0.8348585, smoking: 0.4831078, egfrLt: 0.4864619, egfrGe: 0.0397779, bpTx: 0.2265309, statin: -0.0592374, bpTxSbpGe: -0.0395762, statinNonHdl: 0.0844423, ageNonHdl: -0.0567839, ageHdl: 0.0325692, ageSbpGe: -0.1035985, ageDm: -0.2417542, ageSmoking: -0.0791142, ageEgfrLt: -0.1671492, constant: -3.819975 },
  male: { age: 0.7099847, nonHdl: 0.1658663, hdl: -0.1144285, sbpLt: -0.2837212, sbpGe: 0.3239977, dm: 0.7189597, smoking: 0.3956973, egfrLt: 0.3690075, egfrGe: 0.0203619, bpTx: 0.2036522, statin: -0.0865581, bpTxSbpGe: -0.0322916, statinNonHdl: 0.114563, ageNonHdl: -0.0300005, ageHdl: 0.0232747, ageSbpGe: -0.0927024, ageDm: -0.2018525, ageSmoking: -0.0970527, ageEgfrLt: -0.1217081, constant: -3.500655 },
};
const PREVENT_30: Record<"female" | "male", PreventCoefficients> = {
  female: { age: 0.4669202, ageSquared: -0.0893118, nonHdl: 0.1256901, hdl: -0.1542255, sbpLt: -0.0018093, sbpGe: 0.322949, dm: 0.6296707, smoking: 0.268292, egfrLt: 0.100106, egfrGe: 0.0499663, bpTx: 0.1875292, statin: 0.0152476, bpTxSbpGe: -0.0276123, statinNonHdl: 0.0736147, ageNonHdl: -0.0521962, ageHdl: 0.0316918, ageSbpGe: -0.1046101, ageDm: -0.2727793, ageSmoking: -0.1530907, ageEgfrLt: -0.1299149, constant: -1.974074 },
  male: { age: 0.3994099, ageSquared: -0.0937484, nonHdl: 0.1744643, hdl: -0.120203, sbpLt: -0.0665117, sbpGe: 0.2753037, dm: 0.4790257, smoking: 0.1782635, egfrLt: -0.0218789, egfrGe: 0.0602553, bpTx: 0.1421182, statin: 0.0135996, bpTxSbpGe: -0.0218265, statinNonHdl: 0.1013148, ageNonHdl: -0.0312619, ageHdl: 0.020673, ageSbpGe: -0.0920935, ageDm: -0.2159947, ageSmoking: -0.1548811, ageEgfrLt: -0.0712547, constant: -1.736444 },
};

function preventTerms(values: Record<string, string>) {
  const age = (n(values, "age") - 55) / 10;
  const nonHdl = (n(values, "totalChol") - n(values, "hdl")) * 0.02586 - 3.5;
  const hdl = (n(values, "hdl") * 0.02586 - 1.3) / 0.3;
  const sbpLt = (Math.min(n(values, "sbp"), 110) - 110) / 20;
  const sbpGe = (Math.max(n(values, "sbp"), 110) - 130) / 20;
  const egfrLt = (Math.min(n(values, "egfr"), 60) - 60) / -15;
  const egfrGe = (Math.max(n(values, "egfr"), 60) - 90) / -15;
  const dm = yes(values, "diabetes") ? 1 : 0;
  const smoking = yes(values, "smoking") ? 1 : 0;
  const bpTx = yes(values, "bpTx") ? 1 : 0;
  const statin = yes(values, "statin") ? 1 : 0;
  return { age, ageSquared: age * age, nonHdl, hdl, sbpLt, sbpGe, dm, smoking, egfrLt, egfrGe, bpTx, statin, bpTxSbpGe: bpTx * sbpGe, statinNonHdl: statin * nonHdl, ageNonHdl: age * nonHdl, ageHdl: age * hdl, ageSbpGe: age * sbpGe, ageDm: age * dm, ageSmoking: age * smoking, ageEgfrLt: age * egfrLt };
}
function preventRisk(values: Record<string, string>, horizon: 10 | 30) {
  const sex = values.sex === "female" ? "female" : "male";
  const coefficients = horizon === 10 ? PREVENT_10[sex] : PREVENT_30[sex];
  let logOdds = coefficients.constant;
  Object.entries(preventTerms(values)).forEach(([key, value]) => { if (coefficients[key] !== undefined) logOdds += coefficients[key] * value; });
  return 1 / (1 + Math.exp(-logOdds));
}
function preventBand(risk: number) { return risk < 0.03 ? "Low" : risk < 0.05 ? "Borderline" : risk < 0.10 ? "Intermediate" : "High"; }
function seizureRecurrence(values: Record<string, string>) {
  const seizureHr = values.seizureType === "focal" ? 1.15 : values.seizureType === "other" ? 0.80 : 1;
  const eegHr = values.eeg === "abnormal" ? 1.30 : values.eeg === "not-indicated" ? 1.18 : 1;
  const imagingHr = values.imaging === "abnormal" ? 1.11 : values.imaging === "not-indicated" ? 1.24 : 1;
  const hr = (yes(values, "neuroDeficit") ? 1.39 : 1) * seizureHr * eegHr * imagingHr * (values.treatment === "immediate" ? 0.74 : 1);
  return { oneYear: 1 - Math.pow(1 - 0.351, hr), threeYear: 1 - Math.pow(1 - 0.462, hr), hr };
}

const CALCS: CalcDef[] = [
  {
    id: "prevent-ascvd", label: "PREVENT-ASCVD", group: "Risk & Prevention", badge: "2026 guideline",
    description: "AHA PREVENT estimate of future atherosclerotic cardiovascular disease risk.",
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
    calculate: (values) => {
      if (n(values, "hdl") >= n(values, "totalChol")) return null;
      const tenYear = preventRisk(values, 10);
      const secondary: SecondaryResult[] = [{ label: "2026 risk category", value: preventBand(tenYear) }];
      if (n(values, "age") <= 59) secondary.push({ label: "30-year ASCVD risk", value: `${(preventRisk(values, 30) * 100).toFixed(1)}%` });
      return result(`${(tenYear * 100).toFixed(1)}%`, `${preventBand(tenYear)} 10-year PREVENT-ASCVD risk under 2026 ACC/AHA categories.`, "AHA PREVENT-ASCVD base equation; 2026 ACC/AHA Dyslipidemia Guideline.", secondary, "Primary-prevention estimate for adults 30–79 without known cardiovascular disease. Optional PREVENT predictors are intentionally omitted to keep the input set minimal.");
    },
  },
  {
    id: "mess-seizure", label: "Seizure Recurrence", group: "Risk & Prevention", badge: "MESS model",
    description: "Model-derived 1- and 3-year recurrence estimates after a single seizure or early epilepsy presentation.", sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8776562/",
    fields: [
      { key: "neuroDeficit", label: "Neurological deficit", type: "select", options: yesNoOptions },
      { key: "seizureType", label: "Seizure type", type: "select", options: [{ label: "Generalized", value: "generalized" }, { label: "Focal", value: "focal" }, { label: "Other", value: "other" }] },
      { key: "eeg", label: "EEG result", type: "select", options: [{ label: "Normal", value: "normal" }, { label: "Abnormal", value: "abnormal" }, { label: "Not clinically indicated", value: "not-indicated" }] },
      { key: "imaging", label: "CT / MRI result", type: "select", options: [{ label: "Normal", value: "normal" }, { label: "Abnormal", value: "abnormal" }, { label: "Not clinically indicated", value: "not-indicated" }] },
      { key: "treatment", label: "Antiseizure treatment", type: "select", options: [{ label: "Delayed / not immediate", value: "delayed" }, { label: "Immediate", value: "immediate" }] },
    ],
    calculate: (values) => { const estimate = seizureRecurrence(values); return result(`${(estimate.oneYear * 100).toFixed(1)}%`, "MESS-derived estimated probability of seizure recurrence within 1 year.", "MESS model development and external validation, Seizure (2022).", [{ label: "3-year recurrence estimate", value: `${(estimate.threeYear * 100).toFixed(1)}%` }, { label: "Relative hazard vs reference", value: `${estimate.hr.toFixed(2)}×` }], "The published model has modest discrimination; this estimate supports risk review and is not an individual certainty or a fitness-for-duty decision."); },
  },
  {
    id: "essen-stroke", label: "Recurrent Stroke · Essen", group: "Risk & Prevention", badge: "Secondary prevention",
    description: "Essen Stroke Risk Score for recurrent stroke / vascular-event stratification after ischemic stroke or TIA.", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/19023098/",
    fields: [
      { key: "age", label: "Age", unit: "years", min: 18, max: 110, step: 1 },
      { key: "hypertension", label: "Hypertension", type: "select", options: yesNoOptions }, { key: "diabetes", label: "Diabetes", type: "select", options: yesNoOptions }, { key: "mi", label: "Previous MI", type: "select", options: yesNoOptions }, { key: "otherCvd", label: "Other cardiovascular disease", type: "select", options: yesNoOptions }, { key: "pad", label: "Peripheral artery disease", type: "select", options: yesNoOptions }, { key: "smoking", label: "Current / recent smoking", type: "select", options: yesNoOptions }, { key: "priorEvent", label: "Prior TIA / ischemic stroke before qualifying event", type: "select", options: yesNoOptions },
    ],
    calculate: (values) => { const age = n(values, "age"); const score = (age > 75 ? 2 : age >= 65 ? 1 : 0) + ["hypertension", "diabetes", "mi", "otherCvd", "pad", "smoking", "priorEvent"].filter((key) => yes(values, key)).length; const elevated = score > 2; return result(`${score} / 9`, `${elevated ? "Higher" : "Lower"} recurrent-stroke risk stratum by the traditional Essen cutoff (>2).`, "Essen Stroke Risk Score; REACH validation (Stroke 2009) and 1-year hospital validation.", [{ label: "Observed 1-year recurrence in one validation cohort", value: elevated ? "18.0%" : "10.3%" }], "The percentage shown is an observed cohort rate for the score stratum, not a personalized probability. The score was validated in non-atrial-fibrillation ischemic stroke/TIA populations."); },
  },
  {
    id: "stop-bang", label: "STOP-Bang", group: "Risk & Prevention", badge: "OSA screening", description: "Concise obstructive sleep apnea screening score with eight clinical items.", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26378880/",
    fields: [{ key: "snoring", label: "Loud snoring", type: "select", options: yesNoOptions }, { key: "tired", label: "Daytime tiredness", type: "select", options: yesNoOptions }, { key: "observed", label: "Observed apnea", type: "select", options: yesNoOptions }, { key: "hypertension", label: "High blood pressure", type: "select", options: yesNoOptions }, { key: "bmi", label: "BMI", unit: "kg/m²", min: 10, max: 80, step: 0.1 }, { key: "age", label: "Age", unit: "years", min: 18, max: 110, step: 1 }, { key: "neck", label: "Neck circumference", unit: "cm", min: 20, max: 80, step: 0.1 }, { key: "sex", label: "Sex", type: "select", options: sexOptions }],
    calculate: (values) => { const stop = ["snoring", "tired", "observed", "hypertension"].filter((key) => yes(values, key)).length; const score = stop + (n(values, "bmi") > 35 ? 1 : 0) + (n(values, "age") > 50 ? 1 : 0) + (n(values, "neck") > 40 ? 1 : 0) + (values.sex === "male" ? 1 : 0); const highCombination = score >= 3 && stop >= 2 && (n(values, "bmi") > 35 || values.sex === "male" || n(values, "neck") > 40); const tier = score <= 2 ? "Low" : score >= 5 || highCombination ? "High" : "Intermediate"; return result(`${score} / 8`, `${tier} screening risk for moderate-to-severe obstructive sleep apnea.`, "Chung et al., CHEST 2016 STOP-Bang practical approach.", [{ label: "STOP subtotal", value: `${stop} / 4` }], "STOP-Bang is a screening instrument; objective sleep testing is required to diagnose OSA."); },
  },
  { id: "bmi", label: "BMI", group: "Body & Renal", description: "Adult body-mass-index screening value.", sourceUrl: "https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html", fields: [{ key: "weight", label: "Weight", unit: "kg", min: 20, max: 300 }, { key: "height", label: "Height", unit: "cm", min: 100, max: 250 }], calculate: (values) => { const bmi = n(values, "weight") / ((n(values, "height") / 100) ** 2); if (!Number.isFinite(bmi)) return null; const band = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy-weight" : bmi < 30 ? "Overweight" : bmi < 35 ? "Obesity class 1" : bmi < 40 ? "Obesity class 2" : "Obesity class 3"; return result(bmi.toFixed(1), `${band} adult BMI range.`, "CDC adult BMI categories.", undefined, "BMI is a screening measure, not a diagnosis or fitness determination."); } },
  { id: "egfr", label: "eGFR", group: "Body & Renal", badge: "2021 CKD-EPI", description: "Race-free adult creatinine estimate using the 2021 CKD-EPI equation.", sourceUrl: "https://www.kidney.org/ckd-epi-creatinine-equation-2021", fields: [{ key: "creatinine", label: "Serum creatinine", unit: "mg/dL", min: 0.3, max: 15, step: 0.01 }, { key: "age", label: "Age", unit: "years", min: 18, max: 120 }, { key: "sex", label: "Sex used by equation", type: "select", options: sexOptions }], calculate: (values) => { const cr = n(values, "creatinine"), age = n(values, "age"), female = values.sex === "female", k = female ? 0.7 : 0.9, a = female ? -0.241 : -0.302, ratio = cr / k; const value = 142 * Math.pow(Math.min(ratio, 1), a) * Math.pow(Math.max(ratio, 1), -1.2) * Math.pow(0.9938, age) * (female ? 1.012 : 1); if (!Number.isFinite(value)) return null; const band = value >= 90 ? "G1 eGFR range — eGFR alone does not establish CKD" : value >= 60 ? "G2 eGFR range — eGFR alone does not establish CKD" : value >= 45 ? "G3a eGFR range" : value >= 30 ? "G3b eGFR range" : value >= 15 ? "G4 eGFR range" : "G5 eGFR range"; return result(`${value.toFixed(0)} mL/min/1.73m²`, band, "2021 CKD-EPI race-free creatinine equation; National Kidney Foundation."); } },
  { id: "crcl", label: "Creatinine Clearance", group: "Body & Renal", description: "Adult Cockcroft–Gault estimate for medication-dosing contexts that specifically call for CrCl.", fields: [{ key: "age", label: "Age", unit: "years", min: 18, max: 120 }, { key: "weight", label: "Weight selected for equation", unit: "kg", min: 20, max: 500 }, { key: "creatinine", label: "Serum creatinine", unit: "mg/dL", min: 0.2, max: 20, step: 0.01 }, { key: "sex", label: "Sex adjustment", type: "select", options: sexOptions }], calculate: (values) => { let value = ((140 - n(values, "age")) * n(values, "weight")) / (72 * n(values, "creatinine")); if (values.sex === "female") value *= 0.85; return result(`${value.toFixed(0)} mL/min`, "Cockcroft–Gault estimate.", "Cockcroft–Gault equation.", undefined, "Appropriate weight selection and medication-specific dosing rules remain protocol-specific."); } },
  { id: "bsa", label: "Body Surface Area", group: "Body & Renal", description: "Mosteller body-surface-area estimate.", fields: [{ key: "height", label: "Height", unit: "cm", min: 50, max: 275 }, { key: "weight", label: "Weight", unit: "kg", min: 2, max: 500 }], calculate: (values) => result(`${Math.sqrt(n(values, "height") * n(values, "weight") / 3600).toFixed(2)} m²`, "Body-size estimate.", "Mosteller: √((height cm × weight kg) ÷ 3600).", undefined, "Use only where the applicable clinical protocol calls for BSA.") },
  { id: "ibw", label: "Ideal Body Weight", group: "Body & Renal", description: "Devine equation dosing reference.", fields: [{ key: "height", label: "Height", unit: "cm", min: 100, max: 250 }, { key: "sex", label: "Sex used by equation", type: "select", options: sexOptions }], calculate: (values) => { const inches = n(values, "height") / 2.54, base = values.sex === "female" ? 45.5 : 50, value = base + 2.3 * Math.max(0, inches - 60); return result(`${value.toFixed(1)} kg`, "Equation-derived dosing reference.", "Devine equation.", undefined, "Not a target body weight or fitness determination."); } },
  { id: "adjbw", label: "Adjusted Body Weight", group: "Body & Renal", description: "IBW-based dosing reference.", fields: [{ key: "actual", label: "Actual weight", unit: "kg", min: 2, max: 500 }, { key: "ibw", label: "Ideal body weight", unit: "kg", min: 20, max: 250 }], calculate: (values) => result(`${(n(values, "ibw") + 0.4 * (n(values, "actual") - n(values, "ibw"))).toFixed(1)} kg`, "Adjusted body-weight estimate.", "AdjBW = IBW + 0.4 × (actual − IBW).", undefined, "Use only when a medication or protocol specifies adjusted body weight.") },
  { id: "map", label: "Mean Arterial Pressure", group: "Cardiac & ECG", description: "Quick systolic / diastolic blood-pressure arithmetic estimate.", fields: [{ key: "sbp", label: "Systolic BP", unit: "mmHg", min: 50, max: 300 }, { key: "dbp", label: "Diastolic BP", unit: "mmHg", min: 20, max: 200 }], calculate: (values) => n(values, "sbp") > n(values, "dbp") ? result(`${((n(values, "sbp") + 2 * n(values, "dbp")) / 3).toFixed(0)} mmHg`, "Arithmetic MAP estimate.", "MAP ≈ (SBP + 2×DBP) / 3.", undefined, "Apply program-specific blood-pressure criteria separately.") : null },
  { id: "bazett", label: "QTc · Bazett", group: "Cardiac & ECG", description: "Heart-rate-corrected QT interval using Bazett correction.", fields: [{ key: "qt", label: "QT interval", unit: "ms", min: 100, max: 1000 }, { key: "rr", label: "RR interval", unit: "seconds", min: 0.3, max: 2, step: 0.01 }], calculate: (values) => result(`${(n(values, "qt") / Math.sqrt(n(values, "rr"))).toFixed(0)} ms`, "Bazett-corrected QT estimate.", "QTc = QT ÷ √RR.", undefined, "Interpret in ECG and clinical context; Bazett may overcorrect at higher heart rates.") },
  { id: "fridericia", label: "QTc · Fridericia", group: "Cardiac & ECG", description: "Cube-root heart-rate correction for the QT interval.", fields: [{ key: "qt", label: "QT interval", unit: "ms", min: 100, max: 1000 }, { key: "rr", label: "RR interval", unit: "seconds", min: 0.3, max: 2, step: 0.01 }], calculate: (values) => result(`${(n(values, "qt") / Math.cbrt(n(values, "rr"))).toFixed(0)} ms`, "Fridericia-corrected QT estimate.", "QTc = QT ÷ ∛RR.", undefined, "Interpret in ECG and clinical context.") },
  { id: "pack", label: "Pack-Years", group: "Respiratory & Exposure", description: "Smoking exposure history for clinical screening and documentation.", fields: [{ key: "cigs", label: "Cigarettes per day", min: 0, max: 200 }, { key: "years", label: "Years smoked", min: 0, max: 100, step: 0.5 }], calculate: (values) => result(`${((n(values, "cigs") / 20) * n(values, "years")).toFixed(1)} pack-years`, "Cumulative cigarette-exposure summary.", "(cigarettes/day ÷ 20) × years.", undefined, "Screening eligibility and medical decisions come from the applicable clinical standard.") },
];

const GROUPS: Array<{ id: CalcGroup; label: string; copy: string }> = [
  { id: "Risk & Prevention", label: "Risk & prevention", copy: "ASCVD, seizure recurrence, recurrent stroke, OSA" },
  { id: "Body & Renal", label: "Body & renal", copy: "BMI, kidney function, dosing references" },
  { id: "Cardiac & ECG", label: "Cardiac & ECG", copy: "MAP and QT correction" },
  { id: "Respiratory & Exposure", label: "Respiratory", copy: "Medical exposure history only" },
];

function pdfAscii(value: string) {
  return value.replace(/·/g, " - ").replace(/×/g, " x ").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/²/g, "^2").replace(/√/g, "sqrt").replace(/∛/g, "cuberoot").replace(/→/g, "->").replace(/[^\x20-\x7E\n]/g, "?");
}
function pdfEscape(value: string) { return pdfAscii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function pdfInputValue(field: CalcField, values: Record<string, string>) {
  const raw = values[field.key] ?? "";
  if (field.type === "select") return field.options?.find((option) => option.value === raw)?.label ?? raw;
  return `${raw}${field.unit ? ` ${field.unit}` : ""}`;
}
function wrapText(value: string, width = 78) {
  const words = pdfAscii(value).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width && line) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}
function buildClinicalCalculatorPdf(calc: CalcDef, values: Record<string, string>, output: CalcOutput) {
  const lines = [
    "OCCU-MED | INSIGHT HUB 2.0",
    "Clinical Calculator Report",
    calc.label,
    "",
    `Result: ${output.value}`,
    ...wrapText(`Interpretation: ${output.interpretation}`),
    "",
    "Inputs used",
    ...calc.fields.map((field) => `${field.label}: ${pdfInputValue(field, values)}`),
    "",
    "Reference and source",
    ...wrapText(output.reference),
    ...(calc.sourceUrl ? wrapText(`Source: ${calc.sourceUrl}`) : []),
    ...(output.secondary?.length ? ["", "Secondary results", ...output.secondary.map((item) => `${item.label}: ${item.value}`)] : []),
    ...(output.note ? ["", "Model limitations", ...wrapText(output.note)] : []),
    "",
    "Reviewer support only - not a diagnosis or fitness-for-duty clearance.",
  ];
  let y = 750;
  const stream = lines.map((line, index) => { const size = index === 1 ? 18 : index === 2 ? 13 : 9; const bold = index <= 2 || /^(Result:|Inputs used|Reference and source|Secondary results|Model limitations)/.test(line); const command = `BT /${bold ? "F2" : "F1"} ${size} Tf 48 ${y} Td (${pdfEscape(line)}) Tj ET\n`; y -= index === 1 ? 25 : index === 2 ? 22 : 15; return command; }).join("");
  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [5 0 R] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n%Occu-Med\n";
  const offsets = new Array(objects.length).fill(0);
  for (let index = 1; index < objects.length; index += 1) { offsets[index] = pdf.length; pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

export default function ReviewerClinicalCalculatorsPage() {
  const [group, setGroup] = useState<CalcGroup>("Risk & Prevention");
  const [activeId, setActiveId] = useState("prevent-ascvd");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [output, setOutput] = useState<CalcOutput | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CALCS.filter((calc) => calc.group === group && (!needle || `${calc.label} ${calc.description}`.toLowerCase().includes(needle)));
  }, [group, query]);
  const active = CALCS.find((calc) => calc.id === activeId) ?? filtered[0] ?? CALCS[0];
  const current = values[active.id] || {};

  function chooseGroup(next: CalcGroup) {
    setGroup(next);
    const first = CALCS.find((calc) => calc.group === next);
    if (first) setActiveId(first.id);
    setOutput(null); setError(""); setQuery("");
  }
  function chooseCalc(id: string) { setActiveId(id); setOutput(null); setError(""); }
  function setValue(key: string, value: string) { setValues((all) => ({ ...all, [active.id]: { ...(all[active.id] || {}), [key]: value } })); setOutput(null); setError(""); }
  function clear() { setValues((all) => ({ ...all, [active.id]: {} })); setOutput(null); setError(""); }
  function calculate() {
    const missing = active.fields.find((field) => current[field.key] === undefined || current[field.key] === "");
    if (missing) { setError(`${missing.label} is required.`); return; }
    const invalid = active.fields.find((field) => field.type !== "select" && (!Number.isFinite(n(current, field.key)) || (field.min !== undefined && n(current, field.key) < field.min) || (field.max !== undefined && n(current, field.key) > field.max)));
    if (invalid) { setError(`${invalid.label} must be within ${invalid.min}–${invalid.max}${invalid.unit ? ` ${invalid.unit}` : ""}.`); return; }
    try { const value = active.calculate(current); if (!value) throw new Error("Inputs are not clinically valid for this equation."); setOutput(value); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Calculation failed."); }
  }
  function downloadPdfReport() {
    if (!output) return;
    const pdf = buildClinicalCalculatorPdf(active, current, output);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeLabel = active.label.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "Clinical-Calculator";
    anchor.href = url;
    anchor.download = `Occu-Med_${safeLabel}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <main className="min-h-screen bg-[#06090d] pb-16 text-white">
      <Sidebar />
      <section className="px-5 py-8 lg:ml-[210px] lg:px-8 2xl:px-10">
        <HeaderBar eyebrow="Clinical / Calculators" title="Clinical Calculators" subtitle="Choose a clinical question, enter only the variables required by the published equation, and keep the result, interpretation, source, and limitations visible in one focused workspace." />

        <div className="mt-5 grid min-h-[760px] border border-white/10 bg-[#080c12] xl:grid-cols-[285px_minmax(0,1fr)_350px]">
          <aside className="border-b border-white/10 xl:border-b-0 xl:border-r">
            <div className="border-b border-white/10 p-4"><div className="flex items-center gap-2"><Calculator size={15} className="text-cyan-200/60" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Calculator library</p></div><div className="mt-4 flex min-h-10 items-center gap-2 border border-white/10 bg-black/25 px-3"><Search size={14} className="text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search calculators…" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></div></div>
            <div className="border-b border-white/10 p-3"><p className="px-1 pb-2 text-[9px] font-black uppercase tracking-[.13em] text-slate-600">Clinical family</p>{GROUPS.map((item) => <button key={item.id} type="button" onClick={() => chooseGroup(item.id)} className={`w-full border-l-2 px-3 py-3 text-left transition ${group === item.id ? "border-cyan-200 bg-white/[.035]" : "border-transparent hover:bg-white/[.02]"}`}><p className="text-xs font-black text-white">{item.label}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{item.copy}</p></button>)}</div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-white/[.06]">{filtered.map((calc) => <button key={calc.id} type="button" onClick={() => chooseCalc(calc.id)} className={`w-full p-4 text-left transition ${active.id === calc.id ? "bg-cyan-300/[.055]" : "hover:bg-white/[.02]"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-black text-white">{calc.label}</p>{calc.badge ? <span className="shrink-0 text-[8px] font-black uppercase text-violet-200/65">{calc.badge}</span> : null}</div><p className="mt-1 text-[10px] leading-5 text-slate-500">{calc.description}</p></button>)}</div>
            <div className="border-t border-white/10 p-4 text-[10px] leading-5 text-slate-600">Medical-only library. Environmental comfort math and generic fitness arithmetic are not included here.</div>
          </aside>

          <section className="min-w-0 border-b border-white/10 xl:border-b-0 xl:border-r">
            <header className="border-b border-white/10 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-100/55">{active.group}</p><h2 className="mt-2 text-3xl font-black tracking-[-.035em] text-white">{active.label}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{active.description}</p></div>{active.badge ? <span className="border border-violet-200/18 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-violet-100/70">{active.badge}</span> : null}</div></header>
            <div className="p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Required inputs</p><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.fields.map((field) => <label key={field.key} className="block"><span className="text-[10px] font-bold text-slate-400">{field.label}{field.unit ? ` · ${field.unit}` : ""}</span>{field.type === "select" ? <select aria-label={field.unit ? `${field.label} · ${field.unit}` : field.label} value={current[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)} className="mt-2 min-h-11 w-full border border-white/10 bg-[#05090e] px-3 text-sm text-white outline-none focus:border-cyan-200/35"><option value="">Select…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input aria-label={field.unit ? `${field.label} · ${field.unit}` : field.label} type="number" min={field.min} max={field.max} step={field.step || 0.1} value={current[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)} className="mt-2 min-h-11 w-full border border-white/10 bg-[#05090e] px-3 text-sm text-white outline-none focus:border-cyan-200/35" />}</label>)}</div><div className="mt-6 flex gap-2"><button type="button" onClick={calculate} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/25 bg-cyan-300/[.09] px-5 text-sm font-black"><Calculator size={15} />Calculate</button><button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-2 border border-white/10 px-4 text-xs font-bold text-slate-400"><RefreshCw size={14} />Clear</button></div>{error ? <div className="mt-5 border border-rose-200/18 bg-rose-300/[.04] p-4 text-sm text-rose-100">{error}</div> : null}</div>
            <div className="border-t border-white/10 p-5"><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-200/60" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Model boundary</p></div><p className="mt-2 text-xs leading-6 text-slate-500">The result reproduces a published equation or screening score. It does not diagnose disease, predict an individual outcome with certainty, or issue fitness-for-duty clearance.</p></div>
          </section>

          <aside className="bg-[#070b10]">
            <div className="sticky top-0 p-5"><div className="flex items-center gap-2"><HeartPulse size={15} className="text-cyan-200/55" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Clinical result</p></div>{output ? <><div className="mt-7 text-5xl font-black tracking-[-.055em] text-white">{output.value}</div><p className="mt-4 text-sm leading-6 text-slate-300">{output.interpretation}</p>{output.secondary?.length ? <div className="mt-6 divide-y divide-white/[.06] border-y border-white/8">{output.secondary.map((item) => <div key={item.label} className="grid grid-cols-[1fr_auto] gap-4 py-3"><span className="text-[10px] leading-5 text-slate-500">{item.label}</span><strong className="text-sm text-white">{item.value}</strong></div>)}</div> : null}{output.note ? <div className="mt-5 border-l border-amber-200/25 pl-3 text-[10px] leading-5 text-amber-100/65">{output.note}</div> : null}<div className="mt-6 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Reference</p><p className="mt-2 text-[10px] leading-5 text-slate-400">{output.reference}</p>{active.sourceUrl ? <a href={active.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[10px] font-black text-cyan-200/70">Open source ↗</a> : null}</div><button type="button" onClick={downloadPdfReport} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-black"><FileDown size={15} />Generate PDF Report</button></> : <div className="mt-12 text-center"><div className="mx-auto grid h-14 w-14 place-items-center border border-white/10 text-slate-600"><Calculator size={22} /></div><h3 className="mt-5 text-lg font-black text-slate-300">Ready for calculation</h3><p className="mt-2 text-[11px] leading-5 text-slate-600">Complete the required inputs. The result stays pinned here while you review the equation, interpretation, source, and limitations.</p></div>}</div>
          </aside>
        </div>
      </section>
    </main>
  );
}
