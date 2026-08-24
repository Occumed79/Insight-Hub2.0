import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BriefcaseBusiness, Database, HeartPulse, Loader2, Search, Sparkles, Stethoscope } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { ReviewerInjuryHologram } from "./reviewer-injury-hologram";

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
};
type Condition = { id: string; label: string; category: string; focus: string[]; questions: string[]; evidence: string[]; terms: string[] };

const CONDITIONS: Condition[] = [
  { id: "diabetes", label: "Diabetes", category: "Endocrine", terms: ["a1c","glucose","insulin"], focus: ["glycemic stability","hypoglycemia","medication access","heat / hydration"], questions: ["Current A1C and treatment route?","Any severe hypoglycemia or impaired awareness?","Can medication, monitoring supplies, meals, and storage be maintained at the duty location?"], evidence: ["Recent A1C","Medication list","Glucose-monitoring history","Complication records when relevant"] },
  { id: "osa", label: "Obstructive Sleep Apnea", category: "Sleep", terms: ["osa","cpap","pap","sleep apnea"], focus: ["alertness","PAP adherence","fatigue","equipment access"], questions: ["Current AHI/RDI?","Objective PAP compliance available?","Residual daytime sleepiness or safety-sensitive symptoms?"], evidence: ["Sleep study","30–90 day PAP download","Symptom history","Device / battery plan when relevant"] },
  { id: "hypertension", label: "Hypertension", category: "Cardiovascular", terms: ["blood pressure","bp"], focus: ["BP control","medication tolerance","exertion","cardiac risk"], questions: ["Repeated resting measurements available?","Any dizziness, syncope, or medication effects?","Does the controlling program require additional cardiac review?"], evidence: ["Serial blood pressures","Medication history","Cardiology records when indicated"] },
  { id: "coronary", label: "Coronary / Ischemic Heart Disease", category: "Cardiovascular", terms: ["mi","stent","ischemia","cad"], focus: ["ischemia","functional capacity","symptoms","secondary prevention"], questions: ["Chest pain, dyspnea, or exertional symptoms?","Most recent functional / ischemia evaluation?","Recent intervention, MI, stent, or medication change?"], evidence: ["Cardiology note","ECG","Stress test / imaging","Procedure records"] },
  { id: "arrhythmia", label: "Arrhythmia / Rhythm Disorder", category: "Cardiovascular", terms: ["afib","svt","pacemaker"], focus: ["rhythm stability","syncope","rate control","anticoagulation"], questions: ["What rhythm and how often?","Syncope, presyncope, palpitations, or exercise intolerance?","Device or anticoagulation follow-up relevant to duties?"], evidence: ["ECG / rhythm monitor","Cardiology / EP note","Device interrogation when applicable","Medication list"] },
  { id: "asthma", label: "Asthma / Reactive Airway", category: "Respiratory", terms: ["bronchospasm","reactive airway"], focus: ["respiratory reserve","trigger exposure","rescue medication","respirator tolerance"], questions: ["Current severity and symptom frequency?","Recent ER visit, hospitalization, or systemic steroids?","Can required respiratory protection be used?"], evidence: ["Spirometry / PFT","Symptom history","Recent urgent-care records","Medication plan"] },
  { id: "seizure", label: "Seizure Disorder", category: "Neurologic", terms: ["epilepsy","convulsion"], focus: ["loss of consciousness","recurrence","medication stability","driving / heights"], questions: ["Date and circumstances of last seizure?","Current treatment and stability?","Do duties involve driving, weapons, heights, or machinery?"], evidence: ["Neurology note","Seizure history","Medication list / levels when applicable","Duty description"] },
  { id: "migraine", label: "Migraine / Recurrent Headache", category: "Neurologic", terms: ["aura","headache"], focus: ["frequency","visual / neurologic symptoms","medication effects","attendance"], questions: ["Frequency and functional severity?","Aura, visual deficit, syncope, or focal symptoms?","Do medications affect vigilance?"], evidence: ["Headache history","Neurology records when indicated","Medication list"] },
  { id: "behavioral", label: "Depression / Anxiety / PTSD", category: "Behavioral Health", terms: ["mental health","ptsd","depression","anxiety"], focus: ["stability","sleep","judgment","medication effects"], questions: ["Current treatment stability?","Recent hospitalization or major functional change?","Medication effects relevant to safety-sensitive work?"], evidence: ["Treating clinician summary","Medication history","Functional / stability documentation"] },
  { id: "spine", label: "Back / Neck / Spine", category: "Musculoskeletal", terms: ["lumbar","cervical","disc","back"], focus: ["lifting","bending / rotation","prolonged posture","neurologic deficit"], questions: ["Which loads or postures provoke symptoms?","Radiculopathy, weakness, numbness, red flags, or surgery?","Are restrictions compatible with essential duties?"], evidence: ["Orthopedic / spine note","PT / functional testing","Restriction history","Imaging when relevant"] },
  { id: "vision", label: "Vision Disorder", category: "Sensory", terms: ["glaucoma","retina","color vision"], focus: ["acuity","fields","color / depth","night / glare"], questions: ["What function is impaired and corrected?","Do duties require color, depth, peripheral, or night vision?","Stable or progressive?"], evidence: ["Optometry / ophthalmology exam","Acuity","Field / color testing when relevant","Job visual requirements"] },
  { id: "hearing", label: "Hearing Loss / Tinnitus", category: "Sensory", terms: ["audiogram","tinnitus","hearing"], focus: ["speech","warning signals","hearing protection","threshold shift"], questions: ["What does the current audiogram show?","Can alarms, speech, radio, and warning signals be detected?","Are hearing protection and communication systems compatible?"], evidence: ["Current and baseline audiograms","ENT / audiology note","Hearing protection information","Communication requirements"] },
  { id: "renal", label: "Chronic Kidney / Renal Disorder", category: "Renal", terms: ["ckd","dialysis","kidney"], focus: ["renal function","fluid / electrolyte stability","medication dosing","care access"], questions: ["Current creatinine/eGFR and trend?","Dialysis, electrolyte instability, or recent hospitalization?","Can monitoring and specialty care be maintained?"], evidence: ["Recent renal labs","Nephrology note","Medication list","Dialysis plan if applicable"] },
  { id: "bleeding", label: "Anticoagulation / Bleeding Risk", category: "Hematologic", terms: ["warfarin","eliquis","apixaban","clotting"], focus: ["bleeding risk","thrombosis history","monitoring","trauma exposure"], questions: ["Indication and recurrence history?","Current anticoagulant and monitoring?","Does the job involve trauma, remote care, weapons, or heights?"], evidence: ["Specialist note when indicated","Medication list","Monitoring history","Thrombosis / bleeding history"] },
];

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}
function formatNumber(value?: number | null) { return Number(value || 0).toLocaleString(); }

function Distribution({ title, items, denominator }: { title: string; items: CaseDimension[]; denominator: number }) {
  const max = Math.max(1, ...items.slice(0, 7).map((item) => item.share));
  return <div className="border-t border-white/9 py-6 first:border-t-0"><div className="grid gap-5 lg:grid-cols-[190px_1fr]"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/38">{title}</p><p className="mt-2 text-[10px] leading-5 text-cyan-50/34">{formatNumber(denominator)} coded cases</p></div><div className="space-y-3">{items.slice(0, 7).map((item) => <div key={`${title}-${item.code}-${item.name}`} className="grid items-center gap-3 sm:grid-cols-[190px_1fr_64px]"><span className="truncate text-xs text-white/70">{item.name}</span><div className="h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300/75 via-blue-300/70 to-violet-300/70" style={{ width: `${Math.max(4, (item.share / max) * 100)}%` }} /></div><span className="text-right text-[10px] font-black text-cyan-50/55">{item.share.toFixed(1)}%</span></div>)}</div></div></div>;
}

export default function ReviewerInjuriesMedicalPage() {
  const [occupation, setOccupation] = useState("");
  const [onet, setOnet] = useState<any>(null);
  const [casePayload, setCasePayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conditionQuery, setConditionQuery] = useState("");
  const [conditionId, setConditionId] = useState("diabetes");

  async function runOccupation() {
    if (!occupation.trim()) return;
    setLoading(true); setError(""); setOnet(null); setCasePayload(null);
    try {
      const onetPayload = await loadJson(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(occupation.trim())}`);
      setOnet(onetPayload);
      const resolved = onetPayload?.profile?.occupation;
      if (resolved?.code || resolved?.title) {
        const params = new URLSearchParams();
        if (resolved.code) params.set("soc", resolved.code);
        if (resolved.title) params.set("title", resolved.title);
        setCasePayload(await loadJson(`/api/occupational-discovery/osha-occupation-profile?${params.toString()}`));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Occupation intelligence failed."); }
    finally { setLoading(false); }
  }

  const profile = onet?.profile || null;
  const caseProfile = (casePayload?.profile || null) as OshaOccupationProfile | null;
  const condition = CONDITIONS.find((item) => item.id === conditionId) || CONDITIONS[0];
  const filteredConditions = useMemo(() => {
    const needle = conditionQuery.trim().toLowerCase();
    if (!needle) return CONDITIONS;
    return CONDITIONS.filter((item) => [item.label,item.category,...item.terms].some((value) => value.toLowerCase().includes(needle)));
  }, [conditionQuery]);

  return <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(16,185,129,.20),transparent_31%),radial-gradient(circle_at_54%_30%,rgba(14,165,233,.17),transparent_35%),radial-gradient(circle_at_86%_22%,rgba(99,102,241,.18),transparent_28%),linear-gradient(150deg,#020817,#052737_50%,#090d2c)]" />
    <Sidebar />
    <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[224px] lg:px-12 lg:pt-8">
      <HeaderBar eyebrow="Clinical + injury intelligence · one continuous workspace" title="Injuries & Medical Conditions" subtitle="One reviewer flow: resolve the job, see reported injury anatomy, then connect the same duty context to a medical-condition review. No nested Injury versus Medical tabs." />

      <section className="mt-10 grid gap-10 xl:grid-cols-[.65fr_1.35fr]">
        <div className="self-start xl:sticky xl:top-8">
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-100/40">01 · Resolve the work</p>
          <h2 className="mt-3 text-5xl font-black tracking-[-.06em]">Start with what the worker actually does.</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-cyan-50/50">A job title resolves to O*NET/SOC evidence and imported OSHA case detail. That same job context stays visible while you review a medical condition, so the page behaves like one clinical story instead of two disconnected tools.</p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[.035] px-4 backdrop-blur-xl"><Search size={16} className="text-cyan-100/45" /><input value={occupation} onChange={(event) => setOccupation(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runOccupation()} placeholder="Firefighter, electrician, truck driver…" className="min-h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-cyan-100/25" /><button onClick={() => void runOccupation()} disabled={loading || !occupation.trim()} className="rounded-xl bg-cyan-300/12 px-4 py-2 text-[10px] font-black text-cyan-50 disabled:opacity-35">{loading ? <Loader2 size={15} className="animate-spin" /> : "Build profile"}</button></div>
          {error ? <div className="mt-4 rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-xs text-rose-100"><AlertTriangle size={14} className="mr-2 inline" />{error}</div> : null}
          {profile ? <div className="mt-6 border-l border-cyan-100/18 pl-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/35">Resolved occupation</p><h3 className="mt-2 text-xl font-black">{profile.occupation?.title}</h3><p className="mt-1 text-[10px] text-cyan-100/40">SOC {profile.occupation?.code || "—"}</p><p className="mt-3 text-xs leading-6 text-cyan-50/45">{profile.occupation?.description}</p></div> : null}
        </div>

        <div>
          <ReviewerInjuryHologram profile={profile} caseProfile={caseProfile} />
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 md:grid-cols-4">
            {[ ["Reported cases", caseProfile ? formatNumber(caseProfile.totalCases) : "—"], ["Days away", caseProfile ? formatNumber(caseProfile.totalDaysAway) : "—"], ["Restricted days", caseProfile ? formatNumber(caseProfile.totalRestrictedDays) : "—"], ["Body-part coded", caseProfile ? formatNumber(caseProfile.codedBodyPartCases) : "—"] ].map(([label,value]) => <div key={label} className="bg-[#04111f]/92 p-5"><p className="text-[8px] font-black uppercase tracking-[.15em] text-cyan-100/34">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>)}
          </div>
        </div>
      </section>

      <section className="mt-16 border-t border-white/10 pt-12">
        <div className="grid gap-10 xl:grid-cols-[.72fr_1.28fr]">
          <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-100/40">02 · Injury pattern</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em]">What the reported cases say.</h2><p className="mt-4 text-sm leading-7 text-cyan-50/48">These are distributions of coded reported cases, not probabilities that a worker will be injured. The point is to expose the anatomical and event pattern around the selected occupation.</p></div>
          <div className="rounded-[30px] border border-white/10 bg-white/[.025] px-6 md:px-8">
            {caseProfile ? <><Distribution title="Body parts affected" items={caseProfile.bodyParts} denominator={caseProfile.codedBodyPartCases} /><Distribution title="Events / exposures" items={caseProfile.events} denominator={caseProfile.codedEventCases} /><Distribution title="Nature of injury / illness" items={caseProfile.natures} denominator={caseProfile.codedNatureCases} /></> : <div className="py-16 text-sm text-cyan-50/40">Resolve an occupation to load reported OSHA case anatomy.</div>}
          </div>
        </div>
      </section>

      <section className="mt-16 border-t border-white/10 pt-12">
        <div className="grid gap-10 xl:grid-cols-[.72fr_1.28fr]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-100/45">03 · Medical condition lens</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-.05em]">Now connect the condition to the same work.</h2>
            <p className="mt-4 text-sm leading-7 text-cyan-50/48">The diagnosis label never becomes an automatic restriction. The reviewer sees the functional domains, questions, evidence, and the already-resolved job context together.</p>
            <div className="mt-7 flex items-center gap-3 border-b border-white/12 py-3"><Search size={15} className="text-cyan-100/40" /><input value={conditionQuery} onChange={(event) => setConditionQuery(event.target.value)} placeholder="Search diabetes, OSA, hearing, anticoagulation…" className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/25" /></div>
            <div className="mt-4 max-h-[360px] overflow-y-auto pr-2">{filteredConditions.map((item) => <button key={item.id} onClick={() => setConditionId(item.id)} className={`group flex w-full items-center justify-between border-b border-white/7 py-3 text-left transition ${conditionId === item.id ? "text-white" : "text-cyan-50/50 hover:text-white"}`}><span><span className="block text-[9px] font-black uppercase tracking-[.13em] text-cyan-100/28">{item.category}</span><strong className="mt-1 block text-sm">{item.label}</strong></span><ArrowRight size={14} className={conditionId === item.id ? "text-cyan-100" : "opacity-0 transition group-hover:opacity-60"} /></button>)}</div>
          </div>

          <div className="overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(145deg,rgba(6,39,53,.82),rgba(25,38,85,.72))] shadow-[0_30px_90px_rgba(0,0,0,.32)]">
            <div className="grid xl:grid-cols-[1.05fr_.95fr]">
              <div className="p-7 md:p-9"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-100/45">{condition.category}</p><h3 className="mt-2 text-3xl font-black tracking-[-.04em]">{condition.label}</h3></div><HeartPulse className="text-emerald-200/45" /></div><div className="mt-8"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/35">Questions to resolve</p><div className="mt-4 space-y-4">{condition.questions.map((question,index) => <div key={question} className="flex gap-4"><span className="mt-0.5 text-[10px] font-black text-cyan-100/30">0{index+1}</span><p className="text-sm leading-6 text-white/72">{question}</p></div>)}</div></div></div>
              <aside className="border-t border-white/10 bg-black/12 p-7 md:p-9 xl:border-l xl:border-t-0"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/35">Functional attention</p><div className="mt-4 flex flex-wrap gap-2">{condition.focus.map((item) => <span key={item} className="rounded-full border border-cyan-100/12 bg-cyan-300/[.04] px-3 py-1.5 text-[10px] font-bold capitalize text-cyan-50/58">{item}</span>)}</div><p className="mt-8 text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/35">Evidence to collect</p><div className="mt-4 space-y-3">{condition.evidence.map((item) => <div key={item} className="flex items-start gap-3 text-xs leading-5 text-cyan-50/55"><Database size={13} className="mt-1 shrink-0 text-cyan-100/35" />{item}</div>)}</div>{profile ? <div className="mt-8 border-t border-white/10 pt-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-100/38">Duty context remains active</p><p className="mt-2 text-sm font-black">{profile.occupation?.title}</p><p className="mt-2 text-xs leading-5 text-cyan-50/42">Use the job-demand evidence above when deciding which symptoms, restrictions, PPE, vigilance, lifting, egress, driving, or remote-access questions matter.</p></div> : null}</aside>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-8 border-t border-white/10 pt-12 lg:grid-cols-3">
        <div><BriefcaseBusiness className="text-violet-100/45" /><p className="mt-4 text-[9px] font-black uppercase tracking-[.16em] text-violet-100/38">O*NET</p><h3 className="mt-2 text-lg font-black">Job demand evidence</h3><p className="mt-2 text-xs leading-6 text-cyan-50/44">Tasks and work context describe demand; they are not injury rates.</p></div>
        <div><Activity className="text-cyan-100/45" /><p className="mt-4 text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">OSHA</p><h3 className="mt-2 text-lg font-black">Reported case distribution</h3><p className="mt-2 text-xs leading-6 text-cyan-50/44">Imported case detail shows patterns among reported coded cases.</p></div>
        <div><Stethoscope className="text-emerald-100/45" /><p className="mt-4 text-[9px] font-black uppercase tracking-[.16em] text-emerald-100/38">Reviewer lens</p><h3 className="mt-2 text-lg font-black">Function before diagnosis</h3><p className="mt-2 text-xs leading-6 text-cyan-50/44">Medical context supports reviewer questioning; it does not independently determine clearance.</p></div>
      </section>
    </section>
  </main>;
}
