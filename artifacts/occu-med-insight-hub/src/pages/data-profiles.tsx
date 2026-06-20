import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { MetricCard } from "@/components/insight/MetricCard";
import { ChartBlock } from "@/components/insight/ChartBlock";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { IntelligenceStatusBadge } from "@/components/insight/IntelligenceStatusBadge";
import { DataQualityBanner } from "@/components/insight/DataQualityBanner";
import { CompanyChartRenderer } from "@/components/company/CompanyChartRenderer";
import { CompanyRiskRenderer } from "@/components/company/CompanyRiskRenderer";
import { CompanyOpportunityRenderer } from "@/components/company/CompanyOpportunityRenderer";
import { CompanySourceFilters } from "@/components/company/CompanySourceFilters";
import { CompanyDossierRenderer } from "@/components/company/CompanyDossierRenderer";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { getIntelligenceStatus } from "@/company-configs/intelligenceNavigation";

export default function DataProfiles() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const status = getIntelligenceStatus(config);
  const profile = dataset.profiles.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const companyMetrics = config.metricDefinitions?.length
    ? config.metricDefinitions.slice(0, 6).map((metric) => ({ ...metric, companyId: resolvedCompanyId }))
    : dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId).slice(0, 6);
  const chartData = companyMetrics.map((metric) => ({ name: metric.label.replace("Estimated annual ", "").slice(0, 16), value: metric.unit === "usd" ? metric.value / 1000000 : metric.value }));
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  const curveTitle = config.curveTitle ?? `${company?.shortName || "Entity"} exposure curve`;
  const curveSubtitle = config.curveSubtitle ?? "Workbook values normalized for executive scanability.";

  return (
    <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
      <HeaderBar eyebrow="Portal 01" title="Data Profiles" subtitle="Reusable entity intelligence dossiers with source-backed sections, executive metrics, and structured records." actions={<IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />} status={<IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} />} />
      <DataQualityBanner warnings={status.dataQualityWarnings} />
      <GlassCard className="executive-strip mb-5 p-5"><div className="mb-4 flex items-center justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Key intelligence signals</p><h2 className="mt-2 text-2xl font-black text-white">{company?.shortName} executive readout</h2></div><IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} /></div><div className="grid gap-3 md:grid-cols-4">{config.executiveSignals.map((signal) => <div key={signal.label} className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]"><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{signal.label}</p><p className="mt-2 text-lg font-black text-cyan-50">{signal.value}</p><p className="mt-2 text-xs leading-5 text-cyan-100/58">{signal.note}</p></div>)}</div></GlassCard>
      {companyMetrics.length > 0 ? <><div className="grid gap-4 md:grid-cols-3">{companyMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div><div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><ChartBlock title={curveTitle} subtitle={curveSubtitle} height={320} sourceStatus={status.sourceStatus}><AreaChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><Area type="monotone" dataKey="value" stroke="#67e8f9" fill="#67e8f94d" strokeWidth={2} /></AreaChart></ChartBlock><GlassCard className="p-6"><p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Entity dossier</p><h2 className="mt-2 text-2xl font-black text-white">{company?.name}</h2><p className="mt-3 text-sm leading-6 text-cyan-100/60">{company?.summary}</p><div className="mt-5 flex flex-wrap gap-2">{company?.tags.map((tag) => <span key={tag} className="rounded-full border border-cyan-100/15 bg-cyan-100/5 px-3 py-1 text-xs text-cyan-50/70">{tag}</span>)}</div></GlassCard></div></> : null}
      {config.chartDefinitions.length > 0 ? <CompanyChartRenderer charts={config.chartDefinitions} companyInteraction={config.interactionConfig} /> : null}
      {config.riskMatrix?.length ? <CompanyRiskRenderer data={config.riskMatrix} companyName={config.shortName} /> : null}
      {config.opportunityMatrix?.length ? <CompanyOpportunityRenderer data={config.opportunityMatrix} companyName={config.shortName} /> : null}
      <CompanySourceFilters filters={config.sourceFilters} />
      {profile ? <CompanyDossierRenderer profile={profile} metrics={dataset.metrics} /> : null}
      {sources.length > 0 ? <GlassCard className="mt-5 p-6"><h3 className="text-lg font-bold text-white">Source Library</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{sources.slice(0, 8).map((source) => <div key={source.id} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4"><p className="text-sm font-semibold text-cyan-50">{source.label}</p><p className="mt-1 text-xs text-cyan-100/52">{source.type}</p><p className="mt-3 text-sm leading-6 text-cyan-100/58">{source.note}</p></div>)}</div></GlassCard> : null}
    </section></main>
  );
}
