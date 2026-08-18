import { useMemo, useState } from "react";
import { Activity, BookOpenCheck, ExternalLink, Flame, Radar, Truck } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import {
  STANDARD_SOURCES,
  evaluateStandards,
  type FindingLevel,
  type ReviewContext,
  type StandardId,
} from "./reviewer-standards-data";
import "./reviewer-tool-hierarchy.css";

const ICONS: Record<StandardId, typeof Radar> = {
  "centcom-mod18": Radar,
  fmcsa: Truck,
  faa: Activity,
  nfpa1580: Flame,
};
const tone: Record<FindingLevel,string> = {
  info:"border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-50/80",
  review:"border-cyan-200/20 bg-cyan-300/[0.07] text-cyan-50/80",
  waiver:"border-violet-200/22 bg-violet-300/[0.08] text-violet-50/85",
  strict:"border-rose-200/22 bg-rose-300/[0.08] text-rose-50/85",
};
const severity:Record<FindingLevel,number>={info:0,review:1,waiver:2,strict:3};
function numeric(value:string){const parsed=Number(value);return value.trim()&&Number.isFinite(parsed)?parsed:undefined;}

export default function ReviewerStandardsIntelligencePage(){
  const [frameworks,setFrameworks]=useState<StandardId[]>(["centcom-mod18"]);
  const [values,setValues]=useState<Record<string,string>>({occupation:"DoD contractor — CENTCOM deployment",condition:"",medication:"",age:"",a1c:"",ahi:"",papCompliance:"",epworth:"",sbp:"",dbp:"",ascvd:"",weightLb:""});
  const context=useMemo<ReviewContext>(()=>({frameworks,occupation:values.occupation||"",condition:values.condition||"",medication:values.medication||"",age:numeric(values.age||""),a1c:numeric(values.a1c||""),ahi:numeric(values.ahi||""),papCompliance:numeric(values.papCompliance||""),epworth:numeric(values.epworth||""),sbp:numeric(values.sbp||""),dbp:numeric(values.dbp||""),ascvd:numeric(values.ascvd||""),weightLb:numeric(values.weightLb||"")}),[frameworks,values]);
  const findings=useMemo(()=>evaluateStandards(context),[context]);
  const primary=useMemo(()=>[...findings].sort((a,b)=>severity[b.level]-severity[a.level])[0]??null,[findings]);
  const supporting=useMemo(()=>primary?findings.filter((finding)=>finding!==primary):findings,[findings,primary]);
  const setValue=(key:string,value:string)=>setValues((current)=>({...current,[key]:value}));

  return <main className="aurora-bg reviewer-native-page min-h-screen pb-24 text-white"><Sidebar/><section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8"><HeaderBar eyebrow="Standards / Interaction Engine" title="Standards Intelligence" subtitle="Choose the controlling frameworks, enter one scenario, then read the primary determination before drilling into supporting rules and citations."/>
    <div className="rh-stack">
      <section className="rh-primary-action">
        <div className="flex items-start justify-between gap-4"><div><div className="rh-kicker">01 · Controlling frameworks</div><h2 className="rh-section-title">Stack only the standards that actually apply.</h2><p className="rh-section-copy">The selected frameworks drive one shared scenario and one ranked finding set. Nothing below is a generic card directory.</p></div><BookOpenCheck className="text-cyan-100/55"/></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(Object.keys(STANDARD_SOURCES) as StandardId[]).map((id)=>{const source=STANDARD_SOURCES[id];const Icon=ICONS[id];const active=frameworks.includes(id);return <button key={id} onClick={()=>setFrameworks((current)=>active?(current.length===1?current:current.filter((value)=>value!==id)):[...current,id])} className={`rounded-2xl border p-4 text-left transition ${active?"border-cyan-100/30 bg-gradient-to-br from-cyan-300/[.11] to-violet-300/[.07]":"border-white/10 bg-white/[.02] text-cyan-50/55 hover:border-white/20"}`}><Icon size={17}/><strong className="mt-3 block text-sm">{source.shortLabel}</strong><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{source.edition}</p><p className="mt-2 text-[10px] leading-4 text-cyan-100/32">{source.currentAsOf}</p></button>})}</div>
      </section>

      <section className="rh-hero"><div className="rh-hero-grid"><div className="rh-hero-main"><div className="rh-kicker">02 · Scenario inputs</div><h2 className="rh-section-title">Reviewer scenario</h2><p className="rh-section-copy">Enter only the details relevant to the case. The rule engine updates the determination and supporting citations continuously.</p><div className="mt-6 space-y-3"><Field label="Occupation / context" value={values.occupation} onChange={(value)=>setValue("occupation",value)}/><Field label="Condition" value={values.condition} onChange={(value)=>setValue("condition",value)} placeholder="OSA, asthma, seizure, diabetes…"/><Field label="Medication" value={values.medication} onChange={(value)=>setValue("medication",value)} placeholder="Warfarin, insulin, sertraline…"/><div className="grid grid-cols-2 gap-3"><Field label="Age" value={values.age} onChange={(value)=>setValue("age",value)} type="number"/><Field label="Weight lb" value={values.weightLb} onChange={(value)=>setValue("weightLb",value)} type="number"/><Field label="A1C" value={values.a1c} onChange={(value)=>setValue("a1c",value)} type="number"/><Field label="AHI" value={values.ahi} onChange={(value)=>setValue("ahi",value)} type="number"/><Field label="PAP compliance %" value={values.papCompliance} onChange={(value)=>setValue("papCompliance",value)} type="number"/><Field label="Epworth" value={values.epworth} onChange={(value)=>setValue("epworth",value)} type="number"/><Field label="SBP" value={values.sbp} onChange={(value)=>setValue("sbp",value)} type="number"/><Field label="DBP" value={values.dbp} onChange={(value)=>setValue("dbp",value)} type="number"/><Field label="ASCVD %" value={values.ascvd} onChange={(value)=>setValue("ascvd",value)} type="number"/></div></div></div>
        <aside className="rh-hero-side"><div className="rh-kicker">03 · Primary determination</div>{primary?<div className="rh-result mt-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] ${tone[primary.level]}`}>{primary.level}</span><span className="rounded-full border border-white/12 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-cyan-50/60">{STANDARD_SOURCES[primary.standardId].shortLabel}</span></div><h3 className="mt-5 text-2xl font-black leading-tight">{primary.title}</h3><p className="rh-result-copy">{primary.summary}</p><div className="mt-5 rounded-2xl border border-cyan-100/12 bg-cyan-300/[.035] p-4 text-xs leading-6 text-cyan-50/70"><strong>Reviewer action:</strong> {primary.action}</div><div className="mt-4 text-[10px] text-cyan-100/40">{primary.citation}</div><a href={primary.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-cyan-100/70 hover:text-white">Open controlling source <ExternalLink size={11}/></a></div>:<div className="mt-5 rounded-2xl border border-white/10 bg-white/[.02] p-5 text-sm leading-6 text-cyan-100/50">No rule has matched the current scenario yet.</div>}</aside>
      </div></section>

      <section className="rh-support-grid">
        <div className="rh-card is-full"><div className="flex items-center justify-between gap-4"><div><div className="rh-label">04 · Supporting matched rules</div><h3 className="mt-2">{supporting.length} supporting finding{supporting.length===1?"":"s"} across {frameworks.length} framework{frameworks.length===1?"":"s"}</h3></div><span className="rounded-full border border-cyan-100/14 px-3 py-1 text-[9px] font-black uppercase tracking-[.13em] text-cyan-100/60">Full reviewer engine</span></div>{supporting.length?<div className="mt-5 grid gap-3 xl:grid-cols-2">{supporting.map((finding)=>{const source=STANDARD_SOURCES[finding.standardId];return <article key={`${finding.standardId}-${finding.id}`} className="rounded-2xl border border-white/10 bg-white/[.022] p-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] ${tone[finding.level]}`}>{finding.level}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-cyan-50/55">{source.shortLabel}</span>{finding.topics.slice(0,2).map((topic)=><span key={topic} className="text-[9px] text-violet-100/42">{topic}</span>)}</div><h4 className="mt-3 text-sm font-black">{finding.title}</h4><p className="mt-2 text-xs leading-5 text-cyan-100/54">{finding.summary}</p><div className="mt-3 rounded-xl border border-cyan-100/8 bg-cyan-300/[.025] p-3 text-xs leading-5 text-cyan-50/62"><strong>Reviewer action:</strong> {finding.action}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-cyan-100/36">{finding.citation}</span><a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-100/64 hover:text-white">Source <ExternalLink size={10}/></a></div></article>})}</div>:<p className="mt-4 text-sm leading-6 text-cyan-100/48">The primary determination is the only matched rule for the current scenario.</p>}</div>
        <div className="rh-card is-full is-quiet"><div className="rh-label">Interpretation boundary</div><p className="mt-2">Standards change. The engine surfaces reviewer logic, escalation pathways, and citations, but the linked current controlling source still governs the final operational or medical determination.</p></div>
      </section>
    </div>
  </section></main>;
}

function Field({label,value,onChange,placeholder,type="text"}:{label:string;value:string;onChange:(value:string)=>void;placeholder?:string;type?:string}){return <label className="block"><span className="rh-label">{label}</span><input aria-label={label} type={type} value={value} onChange={(event)=>onChange(event.target.value)} placeholder={placeholder} className="rh-input mt-1.5"/></label>}
