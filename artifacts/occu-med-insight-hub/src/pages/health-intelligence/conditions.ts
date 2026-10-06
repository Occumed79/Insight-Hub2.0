/**
 * Medical-condition reference list for the Health intelligence page.
 * id / label / category / terms / domains mirror CONDITIONS in reviewer-injuries-medical-legacy.tsx;
 * `primary` / `secondary` are the anatomical association groups used to light the hologram.
 * Anatomical association is context only — it is never a fitness-for-duty determination.
 */
import type { GroupKey } from "./anatomy";

export interface HealthCondition {
  id: string;
  label: string;
  category: string;
  terms: string[];
  domains: string[];
  primary: GroupKey[];
  secondary: GroupKey[];
}

export const HEALTH_CONDITIONS: HealthCondition[] = [
  { id: "diabetes", label: "Diabetes", category: "Endocrine / Metabolic", terms: ["diabetes", "a1c", "glucose", "insulin"], domains: ["glycemic stability", "hypoglycemia", "medication access", "renal / cardiovascular context"], primary: ["gut"], secondary: ["calves", "feet"] },
  { id: "osa", label: "Obstructive Sleep Apnea", category: "Sleep", terms: ["osa", "sleep apnea", "pap", "cpap"], domains: ["alertness", "PAP adherence", "fatigue", "power / equipment access"], primary: ["neck"], secondary: ["head", "chest"] },
  { id: "sleep-other", label: "Insomnia / Narcolepsy / Other Sleep Disorder", category: "Sleep", terms: ["insomnia", "narcolepsy", "hypersomnia", "sleep disorder"], domains: ["wakefulness", "circadian stability", "medication effects", "shift tolerance"], primary: ["head"], secondary: [] },
  { id: "hypertension", label: "Hypertension", category: "Cardiovascular", terms: ["hypertension", "blood pressure", "bp"], domains: ["blood pressure control", "medication tolerance", "cardiovascular risk", "exertion"], primary: ["chest"], secondary: ["head"] },
  { id: "coronary", label: "Coronary / Ischemic Heart Disease", category: "Cardiovascular", terms: ["coronary", "ischemia", "mi", "heart attack", "stent"], domains: ["ischemia", "functional capacity", "symptoms", "secondary prevention"], primary: ["chest"], secondary: ["neck", "arms"] },
  { id: "arrhythmia", label: "Arrhythmia / Rhythm Disorder", category: "Cardiovascular", terms: ["arrhythmia", "afib", "atrial fibrillation", "svt", "vt", "pacemaker"], domains: ["rhythm stability", "syncope", "rate control", "anticoagulation"], primary: ["chest"], secondary: ["neck"] },
  { id: "heart-failure", label: "Heart Failure / Cardiomyopathy", category: "Cardiovascular", terms: ["heart failure", "cardiomyopathy", "ejection fraction", "chf"], domains: ["functional capacity", "volume status", "arrhythmia", "medication tolerance"], primary: ["chest"], secondary: ["calves", "gut"] },
  { id: "syncope", label: "Syncope / Loss of Consciousness", category: "Neurologic / Cardiovascular", terms: ["syncope", "faint", "loss of consciousness", "presyncope"], domains: ["recurrence risk", "driving / heights", "cardiac / neurologic cause", "emergency access"], primary: ["head", "chest"], secondary: [] },
  { id: "asthma", label: "Asthma / Reactive Airway Disease", category: "Respiratory", terms: ["asthma", "reactive airway", "bronchospasm"], domains: ["respiratory reserve", "trigger exposure", "rescue medication", "PPE / respirator tolerance"], primary: ["chest"], secondary: ["neck"] },
  { id: "copd", label: "COPD / Chronic Lung Disease", category: "Respiratory", terms: ["copd", "emphysema", "chronic bronchitis", "lung disease"], domains: ["ventilatory reserve", "oxygenation", "exertion", "respirator tolerance"], primary: ["chest"], secondary: ["neck"] },
  { id: "seizure", label: "Seizure Disorder", category: "Neurologic", terms: ["seizure", "epilepsy", "convulsion"], domains: ["loss of consciousness", "medication stability", "driving / heights", "emergency access"], primary: ["head"], secondary: [] },
  { id: "migraine", label: "Migraine / Recurrent Headache", category: "Neurologic", terms: ["migraine", "headache", "aura"], domains: ["frequency", "neurologic symptoms", "medication effects", "attendance / safety"], primary: ["head"], secondary: ["neck"] },
  { id: "tbi", label: "TBI / Concussion / Neurologic Residuals", category: "Neurologic", terms: ["tbi", "concussion", "brain injury", "neurologic"], domains: ["cognition", "balance", "headache", "seizure / LOC history"], primary: ["head"], secondary: ["neck"] },
  { id: "behavioral", label: "Depression / Anxiety / PTSD / Behavioral Health", category: "Behavioral Health", terms: ["depression", "anxiety", "ptsd", "behavioral", "mental health"], domains: ["stability", "sleep", "judgment", "medication effects"], primary: ["head"], secondary: [] },
  { id: "adhd", label: "ADHD / Attention Disorder", category: "Behavioral Health", terms: ["adhd", "attention deficit", "stimulant"], domains: ["attention", "impulse control", "treatment stability", "medication effects"], primary: ["head"], secondary: [] },
  { id: "substance", label: "Substance Use Disorder / Recovery", category: "Behavioral Health", terms: ["substance", "alcohol", "opioid", "recovery", "sobriety"], domains: ["stability", "relapse risk", "medication-assisted treatment", "safety-sensitive duties"], primary: ["head"], secondary: ["gut"] },
  { id: "musculoskeletal", label: "General Musculoskeletal Condition", category: "Musculoskeletal", terms: ["musculoskeletal", "orthopedic", "pain", "injury"], domains: ["lifting / carrying", "mobility", "pain", "PPE / emergency egress"], primary: ["lowBack", "knees", "shoulders"], secondary: ["hips"] },
  { id: "spine", label: "Back / Neck / Spine Disorder", category: "Musculoskeletal", terms: ["back", "neck", "spine", "lumbar", "cervical", "disc"], domains: ["lifting", "bending / rotation", "prolonged posture", "neurologic deficit"], primary: ["neck", "lowBack"], secondary: ["hips"] },
  { id: "arthritis", label: "Arthritis / Degenerative Joint Disease", category: "Musculoskeletal", terms: ["arthritis", "osteoarthritis", "joint", "degenerative"], domains: ["range of motion", "load tolerance", "mobility", "pain / medication"], primary: ["knees", "hands", "hips"], secondary: ["shoulders"] },
  { id: "renal", label: "Chronic Kidney Disease / Renal Disorder", category: "Renal", terms: ["kidney", "renal", "ckd", "dialysis"], domains: ["renal function", "fluid / electrolyte stability", "medication dosing", "dialysis / access"], primary: ["gut", "lowBack"], secondary: ["calves"] },
  { id: "thyroid", label: "Thyroid Disorder", category: "Endocrine / Metabolic", terms: ["thyroid", "hypothyroid", "hyperthyroid"], domains: ["control", "cardiovascular effects", "fatigue", "medication stability"], primary: ["neck"], secondary: ["head", "chest"] },
  { id: "obesity", label: "Obesity / Metabolic Risk", category: "Endocrine / Metabolic", terms: ["obesity", "bmi", "weight", "metabolic"], domains: ["functional capacity", "heat burden", "PPE fit", "cardiometabolic risk"], primary: ["gut"], secondary: ["knees", "lowBack", "chest"] },
  { id: "vision", label: "Vision Disorder", category: "Sensory", terms: ["vision", "eye", "glaucoma", "retina", "color vision"], domains: ["acuity", "fields", "color / depth", "night / glare"], primary: ["head"], secondary: [] },
  { id: "hearing", label: "Hearing Loss / Tinnitus", category: "Sensory", terms: ["hearing", "tinnitus", "audiogram", "deaf"], domains: ["speech communication", "warning signals", "hearing protection", "progression"], primary: ["head"], secondary: [] },
  { id: "liver", label: "Liver Disease / Chronic GI Condition", category: "GI / Hepatic", terms: ["liver", "hepatic", "cirrhosis", "hepatitis", "gi"], domains: ["hepatic function", "bleeding / encephalopathy", "nutrition", "medication tolerance"], primary: ["gut"], secondary: [] },
  { id: "bleeding", label: "Bleeding / Clotting Disorder or Anticoagulation", category: "Hematologic", terms: ["bleeding", "clotting", "anticoagulant", "warfarin", "eliquis", "apixaban"], domains: ["bleeding risk", "thrombosis history", "monitoring", "trauma exposure"], primary: ["calves"], secondary: ["chest", "gut"] },
];
