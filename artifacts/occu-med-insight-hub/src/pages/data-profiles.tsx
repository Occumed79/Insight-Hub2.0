import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { MetricCard } from "@/components/insight/MetricCard";
import { ChartBlock } from "@/components/insight/ChartBlock";
import { SectionPanel } from "@/components/insight/SectionPanel";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";

export default function DataProfiles() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const profile = dataset.profiles.find((item) => item.companyId === companyId) || dataset.profiles[0];
  const companyMetrics = dataset.metrics.filter((metric) => metric.companyId === companyId || (companyId !== "v2x" && metric.companyId === "v2x")).slice(0, 6);
  const chartData = companyMetrics.map((metric) => ({ name: metric.label.replace("Estimated annual ", "").slice(0, 16), value: metric.unit === "usd" ? metric.value / 1000000 : metric.value }));
  const sources = dataset.sources.filter((source) => source.companyId === companyId || source.companyId === "v2x");
  const executiveSignals = [
    { label: "Global workforce exposure", value: `${(company?.employees || 0).toLocaleString()} employees`, note: "Large distributed workforce creates a broad occupational-health service aperture." },
    { label: "WC reserve signal", value: "$9.5M", note: "Public reserve/accrual disclosure elevates claims-control relevance." },
    { label: "Footprint intensity", value: `${dataset.locations.length} mapped sites`, note: "Workbook geography indicates multi-region operating complexity." },
    { label: "Operating environment", value: "High complexity", note: "Defense, aviation, logistics, and overseas support increase readiness needs." },
  ];
  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow="Portal 01" title="Data Profiles" subtitle="Reusable company intelligence dossiers with expandable source-backed sections, executive metrics, and structured records for future company uploads." actions={<select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none">{dataset.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} />
        <GlassCard className="executive-strip mb-5 p-5">
          <div className="mb-4 flex items-center justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Key intelligence signals</p>
              <h2 className="mt-2 text-2xl font-black text-white">{company?.shortName} executive readout</h2>
            </div>
            <span className="rounded-full border border-cyan-100/18 bg-cyan-200/10 px-4 py-2 text-xs text-cyan-50/75">Live dossier view</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {executiveSignals.map((signal) => <div key={signal.label} className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]"><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{signal.label}</p><p className="mt-2 text-lg font-black text-cyan-50">{signal.value}</p><p className="mt-2 text-xs leading-5 text-cyan-100/58">{signal.note}</p></div>)}
          </div>
        </GlassCard>
        <div className="grid gap-4 md:grid-cols-3">
          {companyMetrics.slice(0, 6).map((metric) => <MetricCard key={metric.id} metric={metric} />)}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <ChartBlock title={`${company?.shortName || "Company"} exposure curve`} subtitle="Workbook values normalized for executive scanability.">
            <AreaChart data={chartData}><defs><linearGradient id="profileGlow" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#5eead4" stopOpacity={0.45} /><stop offset="95%" stopColor="#5eead4" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><Area type="monotone" dataKey="value" stroke="#67e8f9" fill="url(#profileGlow)" strokeWidth={2} /></AreaChart>
          </ChartBlock>
          <GlassCard className="p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Company dossier</p>
            <h2 className="mt-2 text-2xl font-black text-white">{company?.name}</h2>
            <p className="mt-3 text-sm leading-6 text-cyan-100/60">{company?.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">{company?.tags.map((tag) => <span key={tag} className="rounded-full border border-cyan-100/15 bg-cyan-100/5 px-3 py-1 text-xs text-cyan-50/70">{tag}</span>)}</div>
          </GlassCard>
        </div>
        <div className="mt-5 space-y-4">
          {profile.sections.map((section, index) => (
            <SectionPanel key={section.id} title={section.title} narrative={section.narrative} defaultOpen={index < 2}>
              <div className="grid gap-4 md:grid-cols-[1fr_.8fr]">
                <ul className="space-y-2 text-sm text-cyan-50/72">{section.bullets.map((bullet) => <li key={bullet} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] px-4 py-3">{bullet}</li>)}</ul>
                <div className="grid gap-3">{section.metrics.map((id) => dataset.metrics.find((metric) => metric.id === id)).filter(Boolean).map((metric) => metric ? <MetricCard key={metric.id} metric={metric} /> : null)}</div>
              </div>
            </SectionPanel>
          ))}
        </div>
        <GlassCard className="mt-5 p-6">
          <h3 className="text-lg font-bold text-white">Source Library</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{sources.slice(0, 8).map((source) => <div key={source.id} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4"><p className="text-sm font-semibold text-cyan-50">{source.label}</p><p className="mt-1 text-xs text-cyan-100/52">{source.type}</p><p className="mt-3 text-sm leading-6 text-cyan-100/58">{source.note}</p>{source.url ? <a className="mt-3 inline-block text-xs font-semibold text-emerald-200" href={source.url} target="_blank" rel="noreferrer">Open source</a> : null}</div>)}</div>
        </GlassCard>
      </section>
    </main>
  );
}
