import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  Radar,
  Search,
  Stethoscope,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { ReviewerInjuryHologram } from "./reviewer-injury-hologram";
import "./reviewer-tool-hierarchy.css";

type CaseDimension = { name: string; code: string; count: number; share: number };
type OshaOccupationProfile = {
  matchedBy: "soc" | "occupation-title";
  requestedSocCode: string;
  matchedSocCode: string;
  occupationTitle: string;
  selectedYear: number | null;
  oiicsYear: number | null;
  totalCases: number;
  codedBodyPartCases: number;
  codedNatureCases: number;
  codedEventCases: number;
  codedSourceCases: number;
  totalDaysAway: number;
  totalRestrictedDays: number;
  outcomes: Array<{ name: string; count: number }>;
  bodyParts: CaseDimension[];
  natures: CaseDimension[];
  events: CaseDimension[];
  sources: CaseDimension[];
  industries: Array<{ name: string; naics: string; count: number }>;
  trend: Array<{ year: number; cases: number; daysAway: number; restrictedDays: number }>;
};

type Condition = {
  id: string;
  label: string;
  category: string;
  domains: string[];
  prompts: string[];
  docs: string[];
  terms: string[];
};

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function Loading({ text = "Loading source data…" }: { text?: string }) {
  return <div className="flex min-h-24 items-center justify-center gap-3 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" />{text}</div>;
}

function ErrorState({ error }: { error: string }) {
  return <div className="border border-rose-300/20 bg-rose-300/[0.04] p-4 text-sm text-rose-100"><AlertTriangle size={16} className="mr-2 inline" />{error}</div>;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="border-b border-white/8 py-3 last:border-b-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</p><p className="mt-1 text-2xl font-black tracking-[-.03em] text-white">{value}</p>{note ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{note}</p> : null}</div>;
}

function BulletList({ items }: { items: string[] }) {
  return <div className="divide-y divide-white/7">{items.map((item) => <div key={item} className="flex gap-3 py-3 text-sm leading-6 text-slate-300"><CheckCircle2 size={15} className="mt-1 shrink-0 text-cyan-200/70" />{item}</div>)}</div>;
}

function Distribution({ title, items, denominatorLabel }: { title: string; items: CaseDimension[]; denominatorLabel: string }) {
  return <section className="border-t border-white/10 pt-4"><div className="mb-3 flex items-end justify-between gap-4"><h3 className="text-sm font-black text-white">{title}</h3><span className="text-[10px] text-slate-500">{denominatorLabel}</span></div><div className="divide-y divide-white/7">{items.slice(0, 8).map((item) => <div key={`${title}-${item.code}-${item.name}`} className="grid grid-cols-[1fr_74px] gap-4 py-3"><div><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-200">{item.name}</span><span className="text-[11px] font-bold text-slate-400">{item.count.toLocaleString()}</span></div><div className="mt-2 h-1 overflow-hidden bg-white/[.05]"><div className="h-full bg-cyan-200/60" style={{ width: `${Math.min(item.share, 100)}%` }} /></div></div><span className="text-right text-sm font-black text-white">{item.share.toFixed(1)}%</span></div>)}</div></section>;
}

const CONDITIONS: Condition[] = [
  { id: "diabetes", label: "Diabetes", category: "Endocrine / Metabolic", terms: ["diabetes", "a1c", "glucose", "insulin"], domains: ["glycemic stability", "hypoglycemia", "medication access", "renal / cardiovascular context"], prompts: ["What is the current A1C and treatment route?", "Any severe hypoglycemia, impaired awareness, or recent medication change?", "Can medication, monitoring supplies, food, and storage be maintained in the work setting?"], docs: ["Recent A1C", "Medication list", "Glucose-monitoring history", "Complication / specialist documentation when applicable"] },
  { id: "osa", label: "Obstructive Sleep Apnea", category: "Sleep", terms: ["osa", "sleep apnea", "pap", "cpap"], domains: ["alertness", "PAP adherence", "fatigue", "power / equipment access"], prompts: ["What was the diagnostic AHI/RDI?", "Is there objective PAP compliance data?", "Any residual daytime sleepiness or safety-sensitive symptoms?"], docs: ["Sleep study", "30–90 day PAP download", "Epworth / symptom history", "Device / battery plan when relevant"] },
  { id: "sleep-other", label: "Insomnia / Narcolepsy / Other Sleep Disorder", category: "Sleep", terms: ["insomnia", "narcolepsy", "hypersomnia", "sleep disorder"], domains: ["wakefulness", "circadian stability", "medication effects", "shift tolerance"], prompts: ["What symptoms affect wakefulness or sleep opportunity?", "Any sudden sleep episodes, cataplexy, or impaired vigilance?", "How do shift timing and medication effects interact with safety-sensitive duties?"], docs: ["Sleep specialist note", "Sleep testing when applicable", "Medication history", "Work / shift schedule"] },
  { id: "hypertension", label: "Hypertension", category: "Cardiovascular", terms: ["hypertension", "blood pressure", "bp"], domains: ["blood pressure control", "medication tolerance", "cardiovascular risk", "exertion"], prompts: ["Are repeated resting blood pressures available?", "Any dizziness, syncope, or medication side effects?", "Is additional cardiac risk assessment required by the controlling program?"], docs: ["Serial blood pressures", "Medication history", "Cardiology records when indicated"] },
  { id: "coronary", label: "Coronary / Ischemic Heart Disease", category: "Cardiovascular", terms: ["coronary", "ischemia", "mi", "heart attack", "stent"], domains: ["ischemia", "functional capacity", "symptoms", "secondary prevention"], prompts: ["Any chest pain, dyspnea, or exertional symptoms?", "What is the most recent functional / ischemia evaluation?", "Any intervention, MI, stent, or medication change that affects current stability?"], docs: ["Cardiology note", "ECG", "Stress test / imaging", "Procedure records", "Medication list"] },
  { id: "arrhythmia", label: "Arrhythmia / Rhythm Disorder", category: "Cardiovascular", terms: ["arrhythmia", "afib", "atrial fibrillation", "svt", "vt", "pacemaker"], domains: ["rhythm stability", "syncope", "rate control", "anticoagulation"], prompts: ["What rhythm diagnosis is present and how often does it occur?", "Any syncope, presyncope, palpitations, or exercise intolerance?", "Is there implanted-device or anticoagulation follow-up that matters to the work setting?"], docs: ["ECG / rhythm monitor", "Cardiology / EP note", "Device interrogation when applicable", "Medication list"] },
  { id: "heart-failure", label: "Heart Failure / Cardiomyopathy", category: "Cardiovascular", terms: ["heart failure", "cardiomyopathy", "ejection fraction", "chf"], domains: ["functional capacity", "volume status", "arrhythmia", "medication tolerance"], prompts: ["What is the current symptom class and exertional tolerance?", "Any recent decompensation, hospitalization, edema, or medication escalation?", "What objective cardiac function data are current?"], docs: ["Cardiology note", "Echocardiogram", "Recent hospitalization records when applicable", "Medication list"] },
  { id: "syncope", label: "Syncope / Loss of Consciousness", category: "Neurologic / Cardiovascular", terms: ["syncope", "faint", "loss of consciousness", "presyncope"], domains: ["recurrence risk", "driving / heights", "cardiac / neurologic cause", "emergency access"], prompts: ["When was the last episode and what were the circumstances?", "Has a cardiac, neurologic, orthostatic, or metabolic cause been established?", "Does the job involve driving, heights, weapons, confined spaces, or hazardous equipment?"], docs: ["Evaluation of episode", "ECG / rhythm testing when applicable", "Neurology or cardiology records", "Work-duty description"] },
  { id: "asthma", label: "Asthma / Reactive Airway Disease", category: "Respiratory", terms: ["asthma", "reactive airway", "bronchospasm"], domains: ["respiratory reserve", "trigger exposure", "rescue medication", "PPE / respirator tolerance"], prompts: ["Current severity and symptom frequency?", "Recent ER visits, hospitalization, or systemic steroids?", "Pulmonary function / FEV1 available and can required respiratory protection be used?"], docs: ["Spirometry / PFT", "ACT or symptom history", "Recent urgent-care records", "Medication plan"] },
  { id: "copd", label: "COPD / Chronic Lung Disease", category: "Respiratory", terms: ["copd", "emphysema", "chronic bronchitis", "lung disease"], domains: ["ventilatory reserve", "oxygenation", "exertion", "respirator tolerance"], prompts: ["What is the baseline exercise tolerance and symptom burden?", "Any oxygen requirement or recent exacerbation / hospitalization?", "Can required PPE or respirator use be tolerated under job demands?"], docs: ["PFT / spirometry", "Pulmonology note", "Oxygen requirement if any", "Recent exacerbation history"] },
  { id: "seizure", label: "Seizure Disorder", category: "Neurologic", terms: ["seizure", "epilepsy", "convulsion"], domains: ["loss of consciousness", "medication stability", "driving / heights", "emergency access"], prompts: ["Date and circumstances of last seizure?", "Current anticonvulsant indication and stability?", "Any duty involving driving, weapons, heights, or hazardous machinery?"], docs: ["Neurology note", "Seizure history", "Medication list / levels when applicable"] },
  { id: "migraine", label: "Migraine / Recurrent Headache", category: "Neurologic", terms: ["migraine", "headache", "aura"], domains: ["frequency", "neurologic symptoms", "medication effects", "attendance / safety"], prompts: ["How frequent, prolonged, and disabling are episodes?", "Any aura, visual deficit, syncope, focal symptoms, or sudden change in pattern?", "Do acute or preventive medications affect alertness or task performance?"], docs: ["Headache history", "Neurology records when indicated", "Medication list", "Imaging if clinically relevant"] },
  { id: "tbi", label: "TBI / Concussion / Neurologic Residuals", category: "Neurologic", terms: ["tbi", "concussion", "brain injury", "neurologic"], domains: ["cognition", "balance", "headache", "seizure / LOC history"], prompts: ["What residual cognitive, vestibular, visual, or headache symptoms remain?", "Any loss-of-consciousness or seizure history?", "Do actual job demands expose deficits in balance, reaction, memory, or judgment?"], docs: ["Neurology / concussion evaluation", "Neurocognitive or vestibular testing when applicable", "Restriction history", "Job-demand description"] },
  { id: "behavioral", label: "Depression / Anxiety / PTSD / Behavioral Health", category: "Behavioral Health", terms: ["depression", "anxiety", "ptsd", "behavioral", "mental health"], domains: ["stability", "sleep", "judgment", "medication effects"], prompts: ["Current diagnosis and treatment stability?", "Any recent hospitalization, self-harm, acute decompensation, or major functional change?", "Any medication side effects relevant to safety-sensitive work?"], docs: ["Treating clinician summary", "Medication history", "Functional / stability documentation"] },
  { id: "adhd", label: "ADHD / Attention Disorder", category: "Behavioral Health", terms: ["adhd", "attention deficit", "stimulant"], domains: ["attention", "impulse control", "treatment stability", "medication effects"], prompts: ["Are symptoms functionally controlled in the actual work environment?", "Any recent medication initiation, dose change, insomnia, palpitations, or appetite effects?", "Does the job require sustained vigilance, multitasking, driving, or weapons handling?"], docs: ["Treating clinician note when needed", "Medication history", "Functional history", "Relevant standard / program guidance"] },
  { id: "substance", label: "Substance Use Disorder / Recovery", category: "Behavioral Health", terms: ["substance", "alcohol", "opioid", "recovery", "sobriety"], domains: ["stability", "relapse risk", "medication-assisted treatment", "safety-sensitive duties"], prompts: ["What is the diagnosis, last use, and current recovery status?", "Any recent impairment, relapse, hospitalization, or legal / occupational event?", "Does treatment medication or monitoring interact with a controlling standard?"], docs: ["Treatment / recovery summary", "Medication list", "Monitoring documentation when applicable", "Controlling program requirements"] },
  { id: "musculoskeletal", label: "General Musculoskeletal Condition", category: "Musculoskeletal", terms: ["musculoskeletal", "orthopedic", "pain", "injury"], domains: ["lifting / carrying", "mobility", "pain", "PPE / emergency egress"], prompts: ["What movements or loads reproduce symptoms?", "Any restrictions, assistive devices, or recent surgery?", "Can the person meet the actual job task and emergency egress demands?"], docs: ["Orthopedic / PT note", "Functional restrictions", "Imaging when clinically relevant", "Job-demand description"] },
  { id: "spine", label: "Back / Neck / Spine Disorder", category: "Musculoskeletal", terms: ["back", "neck", "spine", "lumbar", "cervical", "disc"], domains: ["lifting", "bending / rotation", "prolonged posture", "neurologic deficit"], prompts: ["What lifting, bending, sitting, standing, or rotational loads provoke symptoms?", "Any radiculopathy, weakness, numbness, bowel/bladder red flags, or surgery?", "What restrictions are current and are they compatible with essential job demands?"], docs: ["Orthopedic / spine note", "PT / functional testing", "Restriction history", "Imaging when clinically relevant"] },
  { id: "arthritis", label: "Arthritis / Degenerative Joint Disease", category: "Musculoskeletal", terms: ["arthritis", "osteoarthritis", "joint", "degenerative"], domains: ["range of motion", "load tolerance", "mobility", "pain / medication"], prompts: ["Which joints are affected and what tasks are limited?", "Any instability, reduced range of motion, assistive device, injection, or surgery?", "Does medication or pain interfere with safe performance?"], docs: ["Orthopedic / rheumatology note", "Functional restrictions", "Relevant imaging", "Medication history"] },
  { id: "renal", label: "Chronic Kidney Disease / Renal Disorder", category: "Renal", terms: ["kidney", "renal", "ckd", "dialysis"], domains: ["renal function", "fluid / electrolyte stability", "medication dosing", "dialysis / access"], prompts: ["What are the current creatinine/eGFR and trend?", "Any electrolyte instability, dialysis, volume issues, or recent hospitalization?", "Can monitoring, medications, hydration, and specialty care be maintained in the work setting?"], docs: ["Recent renal labs", "Nephrology note when applicable", "Medication list", "Dialysis plan if applicable"] },
  { id: "thyroid", label: "Thyroid Disorder", category: "Endocrine / Metabolic", terms: ["thyroid", "hypothyroid", "hyperthyroid"], domains: ["control", "cardiovascular effects", "fatigue", "medication stability"], prompts: ["Are thyroid function values stable on current treatment?", "Any palpitations, tremor, severe fatigue, heat intolerance, or cognitive effects?", "Any recent medication change or uncontrolled disease?"], docs: ["TSH / thyroid labs", "Medication history", "Endocrinology note when needed"] },
  { id: "obesity", label: "Obesity / Metabolic Risk", category: "Endocrine / Metabolic", terms: ["obesity", "bmi", "weight", "metabolic"], domains: ["functional capacity", "heat burden", "PPE fit", "cardiometabolic risk"], prompts: ["Does body size affect actual job tasks, emergency egress, PPE, or equipment fit?", "What cardiometabolic conditions or exertional symptoms coexist?", "Is there a controlling program-specific body composition or weight requirement?"], docs: ["Measured height / weight", "Functional assessment when needed", "Relevant cardiometabolic records", "Program-specific body composition documentation"] },
  { id: "vision", label: "Vision Disorder", category: "Sensory", terms: ["vision", "eye", "glaucoma", "retina", "color vision"], domains: ["acuity", "fields", "color / depth", "night / glare"], prompts: ["What visual function is impaired and is it corrected?", "Does the job require color discrimination, depth perception, peripheral vision, or night vision?", "Is the condition stable or progressive?"], docs: ["Optometry / ophthalmology exam", "Corrected and uncorrected acuity", "Field / color testing when relevant", "Job visual requirements"] },
  { id: "hearing", label: "Hearing Loss / Tinnitus", category: "Sensory", terms: ["hearing", "tinnitus", "audiogram", "deaf"], domains: ["speech communication", "warning signals", "hearing protection", "progression"], prompts: ["What does the current audiogram show and is there a significant threshold shift?", "Can alarms, speech, radio, or warning signals be detected under actual noise conditions?", "Are hearing protection and communication systems compatible?"], docs: ["Current and baseline audiograms", "ENT / audiology note when indicated", "Hearing protection information", "Job communication requirements"] },
  { id: "liver", label: "Liver Disease / Chronic GI Condition", category: "GI / Hepatic", terms: ["liver", "hepatic", "cirrhosis", "hepatitis", "gi"], domains: ["hepatic function", "bleeding / encephalopathy", "nutrition", "medication tolerance"], prompts: ["What is the diagnosis and current functional severity?", "Any decompensation, bleeding, encephalopathy, dehydration, or hospitalization?", "Can required medication, diet, hydration, and specialty follow-up be maintained?"], docs: ["Recent liver / GI labs", "Specialist note", "Medication list", "Hospitalization history when relevant"] },
  { id: "bleeding", label: "Bleeding / Clotting Disorder or Anticoagulation", category: "Hematologic", terms: ["bleeding", "clotting", "anticoagulant", "warfarin", "eliquis", "apixaban"], domains: ["bleeding risk", "thrombosis history", "monitoring", "trauma exposure"], prompts: ["What is the indication and recurrence history?", "What anticoagulant / antiplatelet therapy is used and what monitoring is required?", "Does the job involve trauma exposure, remote care, weapons, heights, or delayed emergency access?"], docs: ["Hematology / cardiology note when indicated", "Medication list", "INR / monitoring history when applicable", "Thrombosis / bleeding history"] },
];

export default function ReviewerInjuriesMedicalPage() {
  const [tab, setTab] = useState<"injury" | "conditions">("injury");
  const [occupation, setOccupation] = useState("");
  const [onet, setOnet] = useState<any>(null);
  const [onetLoading, setOnetLoading] = useState(false);
  const [casePayload, setCasePayload] = useState<any>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState("");
  const [conditionId, setConditionId] = useState("diabetes");
  const [conditionQuery, setConditionQuery] = useState("");

  async function runOccupation() {
    if (!occupation.trim()) return;
    setOnetLoading(true);
    setOnet(null);
    setCasePayload(null);
    setCaseError("");
    try {
      const onetPayload = await loadJson(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(occupation.trim())}`);
      setOnet(onetPayload);
      const resolved = onetPayload?.profile?.occupation;
      if (resolved?.code || resolved?.title) {
        setCaseLoading(true);
        try {
          const params = new URLSearchParams();
          if (resolved.code) params.set("soc", resolved.code);
          if (resolved.title) params.set("title", resolved.title);
          setCasePayload(await loadJson(`/api/occupational-discovery/osha-occupation-profile?${params.toString()}`));
        } catch (error) {
          setCaseError(error instanceof Error ? error.message : "OSHA occupation case profile failed.");
        } finally {
          setCaseLoading(false);
        }
      }
    } catch (error) {
      setOnet({ error: error instanceof Error ? error.message : "O*NET request failed." });
    } finally {
      setOnetLoading(false);
    }
  }

  const profile = onet?.profile ?? null;
  const caseProfile = (casePayload?.profile ?? null) as OshaOccupationProfile | null;
  const condition = CONDITIONS.find((item) => item.id === conditionId) ?? CONDITIONS[0];
  const filteredConditions = useMemo(() => {
    const needle = conditionQuery.trim().toLowerCase();
    if (!needle) return CONDITIONS;
    return CONDITIONS.filter((item) => [item.label, item.category, ...item.terms].some((value) => value.toLowerCase().includes(needle)));
  }, [conditionQuery]);
  const conditionGroups = useMemo(() => Array.from(new Set(filteredConditions.map((item) => item.category))), [filteredConditions]);

  return (
    <main className="min-h-screen bg-[#06090d] pb-16 text-white">
      <Sidebar />
      <section className="px-5 py-8 pt-24 lg:ml-[210px] lg:px-8 lg:pt-8 2xl:px-10">
        <HeaderBar eyebrow="Clinical / Occupational Health Intelligence" title="Injuries & Medical Conditions" subtitle="Explore occupation-linked injury evidence and reviewer condition context without turning either into an automatic fitness decision." />

        <div className="mt-4 flex min-h-12 items-end gap-7 border-b border-white/10" role="tablist">
          <button role="tab" aria-selected={tab === "injury"} onClick={() => setTab("injury")} className={`min-h-12 border-b-2 px-0.5 text-sm font-bold transition ${tab === "injury" ? "border-cyan-200 text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}>Injury Intelligence</button>
          <button role="tab" aria-selected={tab === "conditions"} onClick={() => setTab("conditions")} className={`min-h-12 border-b-2 px-0.5 text-sm font-bold transition ${tab === "conditions" ? "border-cyan-200 text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}>Medical Conditions</button>
        </div>

        {tab === "injury" ? (
          <div className="mt-5 grid min-h-[760px] gap-0 border border-white/10 bg-[#090d12] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
            <aside className="border-b border-white/10 p-4 xl:border-b-0 xl:border-r">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500"><Radar size={14} />Occupation resolver</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">Resolve the job first. O*NET supplies the occupation identity; imported OSHA case detail is then matched to that occupation.</p>
              <div className="mt-5 border border-white/10 bg-black/25 px-3">
                <div className="flex min-h-12 items-center gap-2"><Search size={15} className="text-slate-500" /><input value={occupation} onChange={(event) => setOccupation(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runOccupation()} placeholder="Firefighter, electrician, truck driver…" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /></div>
              </div>
              <button type="button" onClick={() => void runOccupation()} disabled={onetLoading || !occupation.trim()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-cyan-200/25 bg-cyan-300/[.08] px-4 text-sm font-black transition hover:bg-cyan-300/[.14] disabled:opacity-40">{onetLoading ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}Build injury profile</button>

              <div className="mt-7 border-t border-white/10 pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Resolved occupation</p>
                {profile ? <><h2 className="mt-2 text-xl font-black tracking-[-.02em] text-white">{profile.occupation?.title}</h2><p className="mt-1 text-xs font-bold text-cyan-100/60">SOC {profile.occupation?.code || "—"}</p><p className="mt-3 text-xs leading-6 text-slate-400">{profile.occupation?.description}</p></> : <p className="mt-3 text-sm leading-6 text-slate-500">No occupation selected.</p>}
              </div>

              <div className="mt-7 border-t border-white/10 pt-5">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500"><BriefcaseBusiness size={13} />Job-demand context</div>
                <h3 className="mt-2 text-sm font-black text-white">Job-demand context — not an injury rate</h3>
                {onetLoading ? <Loading text="Loading O*NET evidence…" /> : onet?.error ? <div className="mt-3"><ErrorState error={onet.error} /></div> : profile ? <div className="mt-3 divide-y divide-white/7">{(profile.serviceMatches || []).slice(0, 8).map((item: any) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><span className="text-xs font-bold text-slate-200">{item.label}</span><span className="text-[10px] font-black text-slate-500">{item.count} refs</span></div><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.description}</p></div>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Demand evidence appears after occupation resolution.</p>}
              </div>
            </aside>

            <section className="min-w-0 border-b border-white/10 bg-[#05080c] xl:border-b-0 xl:border-r">
              <div className="border-b border-white/10 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Anatomical explorer</p><p className="mt-1 text-sm text-slate-300">Reported case distribution projected onto the occupation-linked anatomy view.</p></div><Activity size={18} className="text-cyan-200/60" /></div></div>
              <ReviewerInjuryHologram profile={profile} caseProfile={caseProfile} />
            </section>

            <aside className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-500"><Database size={14} />OSHA case inspector</div>
              <h2 className="mt-2 text-lg font-black text-white">Reported cases for the resolved occupation</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">Matched by {caseProfile?.matchedBy === "soc" ? `SOC ${caseProfile.matchedSocCode || profile?.occupation?.code || "—"}` : caseProfile ? "occupation title fallback" : "resolved SOC when available"}.</p>

              {caseError ? <div className="mt-4"><ErrorState error={caseError} /></div> : caseLoading ? <Loading text="Matching OSHA case detail…" /> : !profile ? <p className="mt-5 text-sm text-slate-500">Select an occupation to inspect its reported case profile.</p> : !casePayload ? <p className="mt-5 text-sm text-slate-500">Waiting for the OSHA case-profile request.</p> : !casePayload.imported ? <div className="mt-5 border border-amber-200/20 bg-amber-300/[.04] p-4 text-xs leading-6 text-amber-100/70">{casePayload.warning || "OSHA case-detail storage is available but no case dataset is imported yet."}</div> : !caseProfile ? <div className="mt-5 border border-white/10 bg-white/[.02] p-4 text-xs leading-6 text-slate-400">{casePayload.warning || "No imported case records matched this SOC. That is not evidence that the occupation has no injuries or illnesses."}</div> : <>
                <div className="mt-5 border-y border-white/10">
                  <Metric label="Reported cases" value={caseProfile.totalCases.toLocaleString()} note={`CY${caseProfile.selectedYear ?? "—"} imported case detail`} />
                  <Metric label="Days away" value={caseProfile.totalDaysAway.toLocaleString()} note="Sum across matched reported cases" />
                  <Metric label="Restricted days" value={caseProfile.totalRestrictedDays.toLocaleString()} note="Job transfer / restriction days" />
                  <Metric label="Body-part coded" value={caseProfile.codedBodyPartCases.toLocaleString()} note={`OIICS CY${caseProfile.oiicsYear ?? "—"}`} />
                </div>
                <div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Outcomes</p><div className="mt-2 divide-y divide-white/7">{caseProfile.outcomes.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 py-2.5 text-xs"><span className="text-slate-400">{item.name}</span><strong className="text-white">{item.count.toLocaleString()}</strong></div>)}</div></div>
                <div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Top body-part signals</p><div className="mt-2 divide-y divide-white/7">{caseProfile.bodyParts.slice(0, 5).map((item) => <div key={item.code} className="flex items-center justify-between gap-3 py-2.5 text-xs"><span className="text-slate-300">{item.name}</span><span className="font-black text-white">{item.share.toFixed(1)}%</span></div>)}</div></div>
              </>}
            </aside>

            {caseProfile ? <div className="col-span-full grid gap-6 border-t border-white/10 bg-[#080c11] p-5 xl:grid-cols-2"><Distribution title={`Body parts affected · OIICS CY${caseProfile.oiicsYear ?? "—"}`} items={caseProfile.bodyParts} denominatorLabel={`${caseProfile.codedBodyPartCases.toLocaleString()} coded`} /><Distribution title={`Events / exposures · OIICS CY${caseProfile.oiicsYear ?? "—"}`} items={caseProfile.events} denominatorLabel={`${caseProfile.codedEventCases.toLocaleString()} coded`} /><Distribution title={`Nature of injury / illness · OIICS CY${caseProfile.oiicsYear ?? "—"}`} items={caseProfile.natures} denominatorLabel={`${caseProfile.codedNatureCases.toLocaleString()} coded`} /><Distribution title={`Primary source · OIICS CY${caseProfile.oiicsYear ?? "—"}`} items={caseProfile.sources} denominatorLabel={`${caseProfile.codedSourceCases.toLocaleString()} coded`} /></div> : null}

            <div className="col-span-full border-t border-white/10 bg-black/20 px-5 py-3 text-[11px] leading-5 text-slate-500">OSHA OIICS percentages describe the distribution of coded cases from the evidence year shown, not an individual worker’s probability of injury. O*NET evidence describes job demands and is never presented as an injury rate.</div>
          </div>
        ) : (
          <div className="mt-5 grid min-h-[720px] border border-white/10 bg-[#090d12] xl:grid-cols-[310px_minmax(0,1fr)_330px]">
            <aside className="border-b border-white/10 p-4 xl:border-b-0 xl:border-r">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-500"><Search size={14} />Condition library</div>
              <div className="mt-4 flex min-h-12 items-center gap-2 border border-white/10 bg-black/25 px-3"><Search size={15} className="text-slate-500" /><input value={conditionQuery} onChange={(event) => setConditionQuery(event.target.value)} placeholder="Search diabetes, migraine, hearing, anticoagulation…" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /><span className="shrink-0 text-[10px] font-black text-slate-500">{filteredConditions.length}</span></div>
              <div className="mt-4 max-h-[610px] overflow-y-auto pr-1">{conditionGroups.map((category) => <section key={category} className="mb-5"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-600">{category}</p><div className="divide-y divide-white/7 border-t border-white/7">{filteredConditions.filter((item) => item.category === category).map((item) => <button key={item.id} onClick={() => setConditionId(item.id)} className={`w-full px-1 py-3 text-left text-sm transition ${conditionId === item.id ? "text-white" : "text-slate-400 hover:text-slate-200"}`}><span className="flex items-center justify-between gap-3"><span className="font-semibold">{item.label}</span>{conditionId === item.id ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" /> : null}</span></button>)}</div></section>)}</div>
            </aside>

            <section className="min-w-0 border-b border-white/10 p-6 xl:border-b-0 xl:border-r">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-100/55">{condition.category}</p><h2 className="mt-2 text-3xl font-black tracking-[-.035em] text-white">{condition.label}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Reviewer context only. Start with current stability, actual symptoms, treatment effects, and the occupational setting rather than assuming restriction from the diagnosis name.</p></div><Stethoscope size={22} className="text-cyan-200/55" /></div>

              <div className="mt-8 border-t border-white/10 pt-5"><div className="flex items-center gap-2"><Activity size={15} className="text-cyan-200/60" /><h3 className="text-sm font-black text-white">Questions to resolve</h3></div><div className="mt-3"><BulletList items={condition.prompts} /></div></div>

              <div className="mt-8 border-t border-white/10 pt-5"><div className="flex items-center gap-2"><FileText size={15} className="text-cyan-200/60" /><h3 className="text-sm font-black text-white">Evidence to collect</h3></div><div className="mt-3"><BulletList items={condition.docs} /></div></div>
            </section>

            <aside className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Functional domains</p>
              <div className="mt-3 divide-y divide-white/7 border-y border-white/10">{condition.domains.map((domain, index) => <div key={domain} className="grid grid-cols-[30px_1fr] gap-3 py-4"><span className="text-[10px] font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span><div><p className="text-sm font-bold capitalize text-white">{domain}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Resolve this domain against the actual job, location, PPE, emergency access, and controlling program.</p></div></div>)}</div>
              <div className="mt-6 border-t border-white/10 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Review boundary</p><p className="mt-2 text-xs leading-6 text-slate-400">Condition context supports reviewer questioning; it does not independently determine fitness, disability, causation, deployability, accommodation, or clearance.</p></div>
              <div className="mt-6 border-t border-white/10 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Review focus</p><p className="mt-2 text-xs leading-6 text-slate-400">Function before label: current stability, symptoms, treatment effects, job demands, PPE/egress needs, emergency access, and controlling program requirements.</p></div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
