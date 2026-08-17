import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { OfficialSourcePortal } from "@/components/insight/OfficialSourcePortal";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;

export function OccupationalToolShell({ eyebrow, title, subtitle, notice, children }: { eyebrow: string; title: string; subtitle: string; notice: string; children: ReactNode }) {
  return <main className="aurora-bg min-h-screen pb-20 text-white"><Sidebar /><section className="relative z-10 px-5 py-7 lg:ml-[210px] lg:px-10 2xl:px-14"><HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} /><div className="mb-5 rounded-2xl border border-cyan-100/16 bg-[#071321]/92 px-4 py-3 shadow-[0_12px_34px_rgba(0,0,0,.24)]"><div className="flex items-start gap-3 text-xs leading-5 text-cyan-50/72"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-200/75" /><p>{notice}</p></div></div>{title === "Occupational Data Explorer" ? <OfficialSourcePortal mode="occupational" /> : null}{title === "O*NET Master Tool" ? <OfficialSourcePortal mode="onet" /> : null}{children}</section></main>;
}

export function ToolHero({ kicker, title, description, children, accent = "cyan" }: { kicker: string; title: string; description: string; children?: ReactNode; accent?: "cyan" | "violet" | "emerald" | "rose" }) {
  const accentClass = { cyan: "border-cyan-200/18", violet: "border-violet-200/18", emerald: "border-emerald-200/18", rose: "border-rose-200/18" }[accent];
  return <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className={cn("relative mb-5 overflow-hidden rounded-[26px] border bg-[#06101d]/94 shadow-[0_22px_60px_rgba(0,0,0,.3)]", accentClass)}><div className="grid gap-5 p-5 lg:grid-cols-[1.08fr_.92fr] lg:items-center md:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.23em] text-cyan-100/62">{kicker}</p><h1 className="mt-2 max-w-4xl text-2xl font-black tracking-[-0.035em] text-white md:text-3xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-50/70">{description}</p></div>{children ? <div>{children}</div> : null}</div></motion.section>;
}

export function SectionTabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{ id: T; label: string; icon?: IconComponent }>; active: T; onChange: (id: any) => void }) {
  return <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-white/12 bg-[#06101d]/88 p-2 shadow-[0_12px_30px_rgba(0,0,0,.2)]">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition", active === tab.id ? "border-cyan-200/30 bg-cyan-300/14 text-white" : "border-transparent text-cyan-50/62 hover:border-white/12 hover:bg-white/[0.05] hover:text-white")}>{Icon ? <Icon size={15} /> : null}{tab.label}</button>; })}</div>;
}

export function MetricOrb({ label, value, note, icon: Icon = Sparkles, tone = "cyan" }: { label: string; value: string; note: string; icon?: IconComponent; tone?: "cyan" | "violet" | "emerald" | "rose" | "amber" }) {
  const toneClasses = { cyan: "border-cyan-200/18 bg-cyan-300/[0.055] text-cyan-200", violet: "border-violet-200/18 bg-violet-300/[0.055] text-violet-200", emerald: "border-emerald-200/18 bg-emerald-300/[0.055] text-emerald-200", rose: "border-rose-200/18 bg-rose-300/[0.055] text-rose-200", amber: "border-amber-200/18 bg-amber-300/[0.055] text-amber-200" }[tone];
  return <motion.div layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={cn("rounded-2xl border p-4 shadow-[0_14px_34px_rgba(0,0,0,.22)]", toneClasses)}><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-50/65">{label}</p><Icon size={15} className="opacity-75" /></div><p className="mt-2 break-words text-2xl font-black tracking-[-0.035em] text-white">{value}</p><p className="mt-1 text-xs leading-5 text-cyan-50/62">{note}</p></motion.div>;
}

export function NumberField({ label, value, onChange, min = 0, max, step = 1, suffix, hint }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: string; hint?: string }) {
  return <label className="block"><span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/66">{label}{suffix ? <span className="text-cyan-50/45">{suffix}</span> : null}</span><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/18 bg-[#040c16]/92 px-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-200/48 focus:ring-2 focus:ring-cyan-300/10" />{hint ? <span className="mt-1.5 block text-[10px] leading-4 text-cyan-50/50">{hint}</span> : null}</label>;
}

export function RangeField({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "%" }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const progress = ((value - min) / Math.max(max - min, 1)) * 100;
  return <label className="block rounded-xl border border-white/10 bg-[#071321]/78 p-3"><span className="flex items-center justify-between gap-3 text-xs font-semibold text-cyan-50/72">{label}<span className="text-white">{value}{suffix}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} style={{ background: `linear-gradient(90deg, rgba(34,211,238,.72) ${progress}%, rgba(255,255,255,.10) ${progress}%)` }} className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-cyan-300" /></label>;
}

export function RingGauge({ value, label, detail, tone = "cyan" }: { value: number; label: string; detail: string; tone?: "cyan" | "violet" | "emerald" | "rose" | "amber" }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const progressValue = Math.min(100, Math.max(0, safeValue));
  const colors = { cyan: "#67e8f9", violet: "#c4b5fd", emerald: "#6ee7b7", rose: "#fda4af", amber: "#fcd34d" };
  const circumference = 2 * Math.PI * 48;
  return <div className="relative mx-auto grid w-full max-w-[220px] place-items-center text-center"><svg viewBox="0 0 120 120" className="w-full -rotate-90" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="8" /><motion.circle cx="60" cy="60" r="48" fill="none" stroke={colors[tone]} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - progressValue / 100) }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} /></svg><div className="absolute inset-0 grid place-items-center"><div><p className="text-3xl font-black tracking-[-0.04em] text-white">{safeValue.toFixed(0)}</p><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-50/60">{label}</p></div></div><p className="mt-2 text-xs leading-5 text-cyan-50/64">{detail}</p></div>;
}

export function EvidenceGradeBadge({ grade }: { grade: "A" | "B" | "C" | "D" | "Unavailable" }) {
  const classes = grade === "A" ? "border-emerald-200/24 bg-emerald-300/12 text-emerald-50" : grade === "B" ? "border-cyan-200/24 bg-cyan-300/12 text-cyan-50" : grade === "C" ? "border-amber-200/24 bg-amber-300/12 text-amber-50" : grade === "D" ? "border-violet-200/24 bg-violet-300/12 text-violet-50" : "border-rose-200/24 bg-rose-300/12 text-rose-50";
  const label = grade === "A" ? "Source grade A" : grade === "B" ? "Source grade B" : grade === "C" ? "Source grade C" : grade === "D" ? "Scenario only" : "Evidence unavailable";
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em]", classes)}>{label}</span>;
}
