import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BookOpenCheck, ExternalLink, Flame, FlaskConical, HeartPulse, Loader2, Radar, ShieldCheck, Stethoscope, Truck, Volume2 } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";

type FindingLevel = "info" | "review" | "waiver" | "strict";
type Coverage = "automated-medical" | "trigger-based" | "reference";
type StandardSource = { id: string; shortLabel: string; title: string; edition: string; authority: string; category: string; sourceUrl: string; description: string; currentAsOf: string; lastVerified: string; coverage: Coverage; topics: string[] };
type Finding = { id: string; standardId: string; level: FindingLevel; title: string; summary: string; action: string; citation: string; sourceUrl: string; topics: string[]; matchedBy: string[] };
type Catalog = { ok: boolean; architectureVersion: string; totalSources: number; automatedSources: number; categories: string[]; sources: StandardSource[] };
type Evaluation = { ok: boolean; evaluatedAt: string; selectedSources: StandardSource[]; findings: Finding[]; recommendations: Array<{ standardId: string; reason: string }>; coverage: { selected: number; matched: number; automatedSelected: number; referenceSelected: number } };

const levelColor: Record<FindingLevel,string> = { info: "#34d399", review: "#67e8f9", waiver: "#a78bfa", strict: "#fb7185" };
const levelLabel: Record<FindingLevel,string> = { info: "information", review: "review", waiver: "waiver / escalation", strict: "strict requirement" };
function numeric(value: string) { const number = Number(value); return value.trim() && Number.isFinite(number) ? number : undefined; }
function iconFor(source: StandardSource) { const text = `${source.category} ${source.topics.join(" ")}`.toLowerCase(); if (/transport|dot/.test(text)) return Truck; if (/noise|hearing/.test(text)) return Volume2; if (/drug|alcohol/.test(text)) return FlaskConical; if (/fire|emergency/.test(text)) return Flame; if (/deployment|centcom/.test(text)) return Radar; return Stethoscope; }

export default function ReviewerStandardsIntelligencePage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["centcom-mod18"]);
  const [values, setValues] = useState<Record<string,string>>({ occupation: "DoD contractor — CENTCOM deployment", condition: "", medication: "", age: "", a1c: "", ahi: "", papCompliance: "", sbp: "", dbp: "", ascvd: "", noiseTwaDba: "" });
  const [flags, setFlags] = useState<Record<string,boolean>>({ respiratorRequired: false, hazwoperCovered: false, bloodborneExposure: false, leadSurveillance: false, asbestosSurveillance: false, cadmiumSurveillance: false, dotTesting: false });
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");

  useEffect(() => { const controller = new AbortController(); fetch("/api/standards/catalog", { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(`Standards catalog returned ${response.status}`); return response.json(); }).then((body) => setCatalog(body)).catch((reason) => !controller.signal.aborted && setCatalogError(reason instanceof Error ? reason.message : "Standards catalog unavailable.")); return () => controller.abort(); }, []);
  const request = useMemo(() => ({ frameworks, occupation: values.occupation, condition: values.condition, medication: values.medication, age: numeric(values.age), a1c: numeric(values.a1c), ahi: numeric(values.ahi), papCompliance: numeric(values.papCompliance), sbp: numeric(values.sbp), dbp: numeric(values.dbp), ascvd: numeric(values.ascvd), noiseTwaDba: numeric(values.noiseTwaDba), ...flags }), [flags,frameworks,values]);
  useEffect(() => {
    if (!catalog || !frameworks.length) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => { setEvaluating(true); fetch("/api/standards/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(`Standards evaluator returned ${response.status}`); return response.json(); }).then((body) => { setEvaluation(body); setEvaluationError(""); }).catch((reason) => !controller.signal.aborted && setEvaluationError(reason instanceof Error ? reason.message : "Standards evaluation failed.")).finally(() => !controller.signal.aborted && setEvaluating(false)); }, 250); return () => { window.clearTimeout(timer); controller.abort(); };
  }, [catalog,frameworks,request]);

  const selectedSources = useMemo(() => (catalog?.sources || []).filter((source) => frameworks.includes(source.id)), [catalog,frameworks]);
  const findings = evaluation?.findings || [];
  const top = findings[0] || null;
  const coverage = evaluation?.coverage;
  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const toggle = (id: string) => setFrameworks((current) => current.includes(id) ? (current.length > 1 ? current.filter((value) => value !== id) : current) : [...current,id]);

  return <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,.18),transparent_31%),radial-gradient(circle_at_55%_22%,rgba(14,165,233,.17),transparent_34%),radial-gradient(circle_at_88%_24%,rgba(99,102,241,.18),transparent_30%),linear-gradient(150deg,#020817,#052535_50%,#0b0c2e)]" />
    <Sidebar />
    <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[224px] lg:px-12 lg:pt-8">
      <HeaderBar eyebrow="Standards intelligence · evidence graph" title="Standards Intelligence" subtitle="The point is not where the standards are stored. The point is which authority applies to the case, what triggered it, what the reviewer needs next, and where the official evidence lives." />

      <section className="mt-10 grid gap-10 xl:grid-cols-[.7fr_1.3fr]">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-100/40">01 · Case signal</p>
          <h2 className="mt-3 text-5xl font-black tracking-[-.06em]">Enter the facts. Watch the standards graph change.</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-cyan-50/50">A condition, medication, exposure, or job trigger can light up a controlling standard. Automated logic, trigger-based routing, and reference-only sources remain visibly different.</p>
          <div className="mt-8 space-y-3">{[["occupation","Occupation / work context"],["condition","Condition"],["medication","Medication"]].map(([key,label]) => <label key={key} className="block border-b border-white/11 py-3"><span className="block text-[8px] font-black uppercase tracking-[.14em] text-cyan-100/32">{label}</span><input value={values[key]} onChange={(event) => setValue(key,event.target.value)} className="mt-2 w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/20" placeholder={key === "condition" ? "OSA, asthma, diabetes…" : key === "medication" ? "Warfarin, insulin, sertraline…" : undefined} /></label>)}</div>
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-3">{[["age","Age"],["a1c","A1C"],["ahi","AHI"],["papCompliance","PAP %"],["sbp","SBP"],["dbp","DBP"],["ascvd","ASCVD %"],["noiseTwaDba","Noise TWA dBA"]].map(([key,label]) => <label key={key} className="border-b border-white/9 py-2"><span className="block text-[8px] uppercase tracking-[.12em] text-cyan-100/28">{label}</span><input type="number" value={values[key]} onChange={(event) => setValue(key,event.target.value)} className="mt-1 w-full bg-transparent text-sm font-black outline-none" /></label>)}</div>
          <div className="mt-7"><p className="text-[8px] font-black uppercase tracking-[.14em] text-cyan-100/30">Workplace triggers</p><div className="mt-3 flex flex-wrap gap-2">{Object.keys(flags).map((key) => <button key={key} onClick={() => setFlags((current) => ({ ...current, [key]: !current[key] }))} className={`rounded-full border px-3 py-2 text-[9px] font-black ${flags[key] ? "border-emerald-200/28 bg-emerald-300/10 text-white" : "border-white/9 text-cyan-50/40"}`}>{key.replace(/([A-Z])/g," $1")}</button>)}</div></div>
        </div>

        <div className="overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(145deg,rgba(4,37,51,.88),rgba(29,40,91,.76))] shadow-[0_38px_110px_rgba(0,0,0,.36)]">
          <div className="relative min-h-[520px] p-7 md:p-10">
            <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(103,232,249,.28)_1px,transparent_1px)] [background-size:30px_30px]" />
            <div className="relative z-10 flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/38">Live evidence graph</p><h2 className="mt-2 text-3xl font-black tracking-[-.045em]">{top ? top.title : evaluating ? "Evaluating selected standards…" : "Add a case signal"}</h2><p className="mt-3 max-w-2xl text-xs leading-6 text-cyan-50/48">{top?.summary || "Selected standards appear as nodes. Findings create evidence paths from the case facts to the controlling authority."}</p></div>{evaluating ? <Loader2 size={18} className="animate-spin text-cyan-100/50" /> : <Activity className="text-cyan-100/45" />}</div>

            <div className="relative z-10 mt-12 grid min-h-[330px] place-items-center">
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/20 bg-cyan-300/[.07] shadow-[0_0_70px_rgba(34,211,238,.12)]"><div className="grid h-full place-items-center p-6 text-center"><div><HeartPulse size={24} className="mx-auto text-cyan-100/65" /><strong className="mt-3 block text-sm">Reviewer case</strong><small className="mt-1 block text-[9px] text-cyan-50/35">{values.condition || values.occupation || "Awaiting facts"}</small></div></div></div>
              {selectedSources.slice(0,8).map((source,index,all) => { const angle = (Math.PI*2*index)/Math.max(1,all.length)-Math.PI/2; const radius = 150; const x = Math.cos(angle)*radius; const y = Math.sin(angle)*radius; const Icon = iconFor(source); const finding = findings.find((item) => item.standardId === source.id); const color = finding ? levelColor[finding.level] : source.coverage === "automated-medical" ? "#67e8f9" : source.coverage === "trigger-based" ? "#a78bfa" : "#64748b"; return <div key={source.id} className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${x}px),calc(-50% + ${y}px))` }}><div className="relative"><div className="absolute left-1/2 top-1/2 h-px origin-left opacity-30" style={{ width: radius, background: color, transform: `rotate(${Math.atan2(-y,-x)}rad)` }} /><button onClick={() => toggle(source.id)} title={source.title} className="relative z-10 grid h-24 w-24 place-items-center rounded-full border bg-[#06131f]/92 p-3 text-center shadow-[0_12px_40px_rgba(0,0,0,.35)]" style={{ borderColor: `${color}66`, boxShadow: finding ? `0 0 34px ${color}24` : undefined }}><div><Icon size={16} className="mx-auto" style={{ color }} /><strong className="mt-2 block text-[9px] leading-3">{source.shortLabel}</strong><small className="mt-1 block text-[7px] uppercase tracking-[.08em] text-cyan-50/28">{source.coverage.replace(/-/g," ")}</small></div></button></div></div>; })}
            </div>

            <div className="relative z-10 grid gap-px overflow-hidden rounded-2xl border border-white/9 bg-white/9 md:grid-cols-4">{[["Selected",coverage?.selected],["Matched",coverage?.matched],["Automated",coverage?.automatedSelected],["Reference",coverage?.referenceSelected]].map(([label,value]) => <div key={String(label)} className="bg-[#071522]/90 p-4"><p className="text-[8px] font-black uppercase tracking-[.13em] text-cyan-100/30">{label}</p><strong className="mt-1 block text-xl">{value ?? 0}</strong></div>)}</div>
          </div>
        </div>
      </section>

      {catalogError || evaluationError ? <div className="mt-6 rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-sm text-rose-100"><AlertTriangle size={15} className="mr-2 inline" />{catalogError || evaluationError}</div> : null}

      <section className="mt-16 border-t border-white/10 pt-12">
        <div className="grid gap-10 xl:grid-cols-[.7fr_1.3fr]"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/38">02 · What fired</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em]">Findings, not source cards.</h2><p className="mt-4 text-sm leading-7 text-cyan-50/46">Each result keeps the trigger, action, citation, severity, and official source together. Reference-only standards remain available without pretending they were fully automated.</p></div><div className="divide-y divide-white/8 border-y border-white/8">{findings.map((finding) => <article key={finding.id} className="grid gap-4 py-6 md:grid-cols-[110px_1fr_auto]"><div><span className="inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[.12em]" style={{ borderColor: `${levelColor[finding.level]}55`, color: levelColor[finding.level] }}>{levelLabel[finding.level]}</span></div><div><h3 className="text-base font-black">{finding.title}</h3><p className="mt-2 text-xs leading-6 text-cyan-50/48">{finding.summary}</p><p className="mt-3 text-[10px] font-bold text-white/68">Next: {finding.action}</p><p className="mt-2 text-[9px] text-cyan-100/34">{finding.citation}</p>{finding.matchedBy?.length ? <p className="mt-2 text-[9px] text-violet-100/40">Triggered by: {finding.matchedBy.join(" · ")}</p> : null}</div>{finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 text-cyan-100/45 hover:text-white"><ExternalLink size={15} /></a> : null}</article>)}{!findings.length ? <div className="py-16 text-sm text-cyan-50/40">No current finding. Enter a condition, medication, measurement, or workplace trigger to evaluate the selected authorities.</div> : null}</div></div>
      </section>

      <section className="mt-16 border-t border-white/10 pt-12"><div className="flex items-end justify-between gap-6"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/38">03 · Authority library</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Turn frameworks on and off.</h2></div><span className="text-[10px] text-cyan-50/32">{catalog?.totalSources || 0} registered sources</span></div><div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(catalog?.sources || []).map((source) => { const active = frameworks.includes(source.id); const Icon = iconFor(source); return <button key={source.id} onClick={() => toggle(source.id)} className={`group min-h-[120px] rounded-[24px] border p-5 text-left transition ${active ? "border-cyan-200/24 bg-cyan-300/[.06]" : "border-white/8 bg-white/[.02] opacity-60 hover:opacity-100"}`}><div className="flex items-start justify-between gap-4"><Icon size={18} className={active ? "text-cyan-100" : "text-cyan-100/35"} />{active ? <ShieldCheck size={15} className="text-emerald-200/55" /> : null}</div><strong className="mt-4 block text-sm">{source.shortLabel}</strong><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-cyan-50/38">{source.title}</p><div className="mt-3 flex gap-2 text-[8px] uppercase tracking-[.1em] text-cyan-100/28"><span>{source.category}</span><span>·</span><span>{source.coverage.replace(/-/g," ")}</span></div></button>; })}</div></section>
    </section>
  </main>;
}
