import { useMemo, useState, type ReactNode } from "react";
import { Activity, BookOpenCheck, ExternalLink, Flame, Radar, Truck } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  STANDARD_SOURCES,
  evaluateStandards,
  type FindingLevel,
  type ReviewContext,
  type StandardId,
} from "./reviewer-standards-data";

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard
      variant="glass"
      className={`border border-white/24 bg-white/[0.065] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.07)] backdrop-blur-3xl ${className}`}
    >
      <div className="h-full rounded-[27px] border border-white/[0.14] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.17)] md:p-6">
        {children}
      </div>
    </GlassCard>
  );
}

const ICONS: Record<StandardId, typeof Radar> = {
  "centcom-mod18": Radar,
  fmcsa: Truck,
  faa: Activity,
  nfpa1580: Flame,
};

const tone: Record<FindingLevel, string> = {
  info: "border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-50/80",
  review: "border-cyan-200/20 bg-cyan-300/[0.07] text-cyan-50/80",
  waiver: "border-amber-200/20 bg-amber-300/[0.07] text-amber-50/80",
  strict: "border-rose-200/20 bg-rose-300/[0.07] text-rose-50/80",
};

function numeric(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

export default function ReviewerStandardsIntelligencePage() {
  const [frameworks, setFrameworks] = useState<StandardId[]>(["centcom-mod18"]);
  const [values, setValues] = useState<Record<string, string>>({
    occupation: "DoD contractor — CENTCOM deployment",
    condition: "",
    medication: "",
    age: "",
    a1c: "",
    ahi: "",
    papCompliance: "",
    epworth: "",
    sbp: "",
    dbp: "",
    ascvd: "",
    weightLb: "",
  });

  const context = useMemo<ReviewContext>(() => ({
    frameworks,
    occupation: values.occupation || "",
    condition: values.condition || "",
    medication: values.medication || "",
    age: numeric(values.age || ""),
    a1c: numeric(values.a1c || ""),
    ahi: numeric(values.ahi || ""),
    papCompliance: numeric(values.papCompliance || ""),
    epworth: numeric(values.epworth || ""),
    sbp: numeric(values.sbp || ""),
    dbp: numeric(values.dbp || ""),
    ascvd: numeric(values.ascvd || ""),
    weightLb: numeric(values.weightLb || ""),
  }), [frameworks, values]);

  const findings = useMemo(() => evaluateStandards(context), [context]);
  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar
          eyebrow="Standards / Interaction Engine"
          title="Standards Intelligence"
          subtitle="The full Exam Reviewer standards rule engine, rendered natively in Insight Hub 2 with source-linked findings and reviewer actions."
        />

        <Surface>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Controlling frameworks</p>
              <h2 className="mt-2 text-xl font-black">Stack the standards that actually apply</h2>
            </div>
            <BookOpenCheck className="text-cyan-100/52" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(STANDARD_SOURCES) as StandardId[]).map((id) => {
              const source = STANDARD_SOURCES[id];
              const Icon = ICONS[id];
              const active = frameworks.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFrameworks((current) => active ? (current.length === 1 ? current : current.filter((value) => value !== id)) : [...current, id])}
                  className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-100/30 bg-cyan-300/[0.10]" : "border-white/10 bg-white/[0.02] text-cyan-50/55 hover:border-white/20"}`}
                >
                  <Icon size={17} />
                  <strong className="mt-3 block text-sm">{source.shortLabel}</strong>
                  <p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{source.edition}</p>
                  <p className="mt-2 text-[10px] leading-4 text-cyan-100/32">{source.currentAsOf}</p>
                </button>
              );
            })}
          </div>
        </Surface>

        <div className="mt-6 grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
          <Surface>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Scenario builder</p>
            <h2 className="mt-2 text-xl font-black">Reviewer inputs</h2>
            <div className="mt-5 space-y-3">
              <Field label="Occupation / context" value={values.occupation} onChange={(value) => setValue("occupation", value)} />
              <Field label="Condition" value={values.condition} onChange={(value) => setValue("condition", value)} placeholder="OSA, asthma, seizure, diabetes…" />
              <Field label="Medication" value={values.medication} onChange={(value) => setValue("medication", value)} placeholder="Warfarin, insulin, sertraline…" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age" value={values.age} onChange={(value) => setValue("age", value)} type="number" />
                <Field label="Weight lb" value={values.weightLb} onChange={(value) => setValue("weightLb", value)} type="number" />
                <Field label="A1C" value={values.a1c} onChange={(value) => setValue("a1c", value)} type="number" />
                <Field label="AHI" value={values.ahi} onChange={(value) => setValue("ahi", value)} type="number" />
                <Field label="PAP compliance %" value={values.papCompliance} onChange={(value) => setValue("papCompliance", value)} type="number" />
                <Field label="Epworth" value={values.epworth} onChange={(value) => setValue("epworth", value)} type="number" />
                <Field label="SBP" value={values.sbp} onChange={(value) => setValue("sbp", value)} type="number" />
                <Field label="DBP" value={values.dbp} onChange={(value) => setValue("dbp", value)} type="number" />
                <Field label="ASCVD %" value={values.ascvd} onChange={(value) => setValue("ascvd", value)} type="number" />
              </div>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Matched source rules</p>
                <h2 className="mt-2 text-xl font-black">{findings.length} findings</h2>
              </div>
              <span className="rounded-full border border-cyan-100/16 bg-cyan-300/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/65">Full reviewer engine</span>
            </div>

            <div className="mt-5 space-y-3">
              {findings.map((finding) => {
                const source = STANDARD_SOURCES[finding.standardId];
                return (
                  <article key={`${finding.standardId}-${finding.id}`} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${tone[finding.level]}`}>{finding.level}</span>
                      <span className="rounded-full border border-white/12 bg-white/[0.035] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-50/58">{source.shortLabel}</span>
                      {finding.topics.slice(0, 3).map((topic) => <span key={topic} className="text-[9px] text-violet-100/42">{topic}</span>)}
                    </div>
                    <h3 className="mt-3 text-base font-black">{finding.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-cyan-100/56">{finding.summary}</p>
                    <div className="mt-3 rounded-xl border border-cyan-100/10 bg-cyan-300/[0.035] p-3 text-xs leading-5 text-cyan-50/66"><strong>Reviewer action:</strong> {finding.action}</div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-cyan-100/38">{finding.citation}</span>
                      <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-100/70 hover:text-white">Open controlling source <ExternalLink size={11} /></a>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-5 rounded-2xl border border-amber-200/14 bg-amber-300/[0.04] p-4 text-[11px] leading-5 text-amber-50/58">Standards change. This engine surfaces the reviewer logic and citations, but the linked current controlling source still governs the final operational or medical determination.</p>
          </Surface>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/42">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 min-h-11 w-full rounded-2xl border border-white/14 bg-black/20 px-3 text-sm outline-none placeholder:text-cyan-100/25 focus:border-cyan-100/30" />
    </label>
  );
}
