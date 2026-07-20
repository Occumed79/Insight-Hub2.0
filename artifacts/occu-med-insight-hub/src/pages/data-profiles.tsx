import { Database, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { MetricCard } from "@/components/insight/MetricCard";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { IntelligenceStatusBadge } from "@/components/insight/IntelligenceStatusBadge";
import { DataQualityBanner } from "@/components/insight/DataQualityBanner";
import { CinematicPortalHero, CinematicSection, EvidenceAperture } from "@/components/insight/CinematicPortal";
import { CompanyChartRenderer } from "@/components/company/CompanyChartRenderer";
import { CompanyRiskRenderer } from "@/components/company/CompanyRiskRenderer";
import { CompanyOpportunityRenderer } from "@/components/company/CompanyOpportunityRenderer";
import { CompanySourceFilters } from "@/components/company/CompanySourceFilters";
import { CompanyDossierRenderer } from "@/components/company/CompanyDossierRenderer";
import { LiveIntelligencePanel } from "@/components/company/LiveIntelligencePanel";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { getIntelligenceStatus } from "@/company-configs/intelligenceNavigation";
import { buildMetricCharts } from "@/data/visualizationValidity";

export default function DataProfiles() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const status = getIntelligenceStatus(config);
  const profile = dataset.profiles.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const configMetrics = (config.metricDefinitions ?? []).map((metric) => ({ ...metric, companyId: resolvedCompanyId }));
  const companyMetrics = configMetrics.length
    ? configMetrics.slice(0, 6)
    : dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId).slice(0, 6);
  const dossierMetrics = [...dataset.metrics, ...configMetrics.filter((metric) => !dataset.metrics.some((existing) => existing.id === metric.id))];
  const metricCharts = buildMetricCharts(companyMetrics, `${resolvedCompanyId}-profile-metrics`);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  const intelligence = dataset.intelligence.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const liveFacts = intelligence?.facts.filter((fact) => fact.confidence !== "link-only") ?? [];
  const sourceLeads = intelligence?.facts.filter((fact) => fact.confidence === "link-only") ?? [];
  const chartCount = metricCharts.length + config.chartDefinitions.length;

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-4 py-6 lg:ml-[210px] lg:px-8 xl:px-10">
        <CinematicPortalHero
          eyebrow="Portal 01 · Entity intelligence dossier"
          title={`${company?.shortName ?? "Company"} in full context.`}
          subtitle="Move from executive signals to quantified evidence, risk, opportunity, dossier narrative, and source provenance without losing the company-specific context that makes each record useful."
          actions={
            <>
              <IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />
              <IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} />
            </>
          }
          stats={[
            { label: "Executive signals", value: config.executiveSignals.length, note: "Company-specific readout" },
            { label: "Profile metrics", value: companyMetrics.length, note: "Comparable quantified fields" },
            { label: "Visual scenes", value: chartCount, note: "Validated charts only" },
            { label: "Source records", value: sources.length + liveFacts.length, note: "Static and live evidence" },
          ]}
          visual={
            <EvidenceAperture
              centerLabel="Evidence constellation"
              centerValue={company?.shortName ?? resolvedCompanyId}
              centerNote={`${liveFacts.length} live facts, ${sourceLeads.length} source leads, and ${sources.length} curated source records.`}
              segments={[
                { label: "Live facts", value: liveFacts.length, color: "#34d399" },
                { label: "Source leads", value: sourceLeads.length, color: "#fbbf24" },
                { label: "Curated sources", value: sources.length, color: "#a78bfa" },
                { label: "Signals", value: config.executiveSignals.length, color: "#67e8f9" },
              ]}
            />
          }
        />

        <DataQualityBanner warnings={status.dataQualityWarnings} />

        <CinematicSection
          index="01"
          eyebrow="Executive runway"
          title="The company readout, before the detail."
          description="Signals remain tied to this company configuration. They are presented as an editorial runway rather than a dense dashboard strip so the most consequential facts are visible first."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {config.executiveSignals.map((signal, index) => (
              <GlassCard key={signal.label} className={`group min-h-[230px] overflow-hidden p-6 ${index === 0 ? "md:col-span-2 md:min-h-[310px]" : ""}`}>
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-200/52">Signal {String(index + 1).padStart(2, "0")}</p>
                      <h2 className={`mt-4 font-black leading-[.95] tracking-[-.045em] text-white ${index === 0 ? "text-4xl md:text-6xl" : "text-3xl"}`}>{signal.value}</h2>
                    </div>
                    <Sparkles className="h-5 w-5 text-violet-200/38 transition duration-500 group-hover:rotate-12 group-hover:text-violet-100" />
                  </div>
                  <div className="mt-8">
                    <p className="text-sm font-bold text-violet-50">{signal.label}</p>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/52">{signal.note}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </CinematicSection>

        <CinematicSection
          index="02"
          eyebrow="Quantified profile"
          title="Metrics that earn the visual treatment."
          description="Comparable fields remain separated by unit, and any chart without enough evidence falls back to a proof object instead of manufacturing a trend."
        >
          {companyMetrics.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {companyMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
              </div>
              <div className="mt-5"><CompanyChartRenderer charts={metricCharts} /></div>
            </>
          ) : (
            <GlassCard className="p-7"><p className="text-lg font-bold text-white">No quantified metrics available</p><p className="mt-2 text-sm leading-6 text-slate-200/52">This profile remains narrative and source-led until comparable numeric evidence is available.</p></GlassCard>
          )}
        </CinematicSection>

        <CinematicSection
          index="03"
          eyebrow="Company narrative"
          title="A dossier designed to be read, not scanned."
          description="The company summary, tags, configured charts, risk plane, and opportunity plane are staged as a continuous intelligence story rather than unrelated cards."
        >
          <GlassCard className="mb-5 overflow-hidden p-7 md:p-9">
            <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-violet-100/15 bg-violet-200/8 text-violet-100 shadow-[0_0_38px_rgba(139,92,246,.14)]"><FileText className="h-6 w-6" /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.24em] text-violet-200/48">Entity dossier</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-.045em] text-white md:text-5xl">{company?.name}</h2>
                <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-200/56">{company?.summary}</p>
                <div className="mt-6 flex flex-wrap gap-2">{company?.tags.map((tag) => <span key={tag} className="rounded-full border border-violet-100/13 bg-violet-100/[0.045] px-3 py-1.5 text-[11px] text-violet-50/68">{tag}</span>)}</div>
              </div>
            </div>
          </GlassCard>
          {config.chartDefinitions.length > 0 ? <CompanyChartRenderer charts={config.chartDefinitions} companyInteraction={config.interactionConfig} /> : null}
          {config.riskMatrix?.length ? <CompanyRiskRenderer data={config.riskMatrix} companyName={config.shortName} /> : null}
          {config.opportunityMatrix?.length ? <CompanyOpportunityRenderer data={config.opportunityMatrix} companyName={config.shortName} /> : null}
        </CinematicSection>

        <CinematicSection
          index="04"
          eyebrow="Source architecture"
          title="Every conclusion keeps its evidence trail."
          description="Filters, dossier records, live intelligence, and the curated source library stay visible as the final layer so the polished presentation never obscures provenance or confidence."
          compact
        >
          <div className="space-y-5">
            <CompanySourceFilters filters={config.sourceFilters} />
            {profile ? <CompanyDossierRenderer profile={profile} metrics={dossierMetrics} /> : null}
            <LiveIntelligencePanel intelligence={intelligence} companyId={resolvedCompanyId} companyName={company?.name ?? resolvedCompanyId} />
            {sources.length > 0 ? (
              <GlassCard className="p-6 md:p-8">
                <div className="flex items-center gap-3"><Database className="h-5 w-5 text-violet-100" /><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-violet-200/45">Curated evidence</p><h3 className="mt-1 text-xl font-bold text-white">Source library</h3></div></div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {sources.slice(0, 8).map((source) => (
                    <div key={source.id} className="group rounded-[22px] border border-violet-100/10 bg-white/[0.028] p-5 transition duration-500 hover:-translate-y-1 hover:border-violet-100/22 hover:bg-violet-100/[0.05]">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-50">{source.label}</p><p className="mt-1 text-[10px] uppercase tracking-[.16em] text-violet-100/42">{source.type}</p></div><ShieldCheck className="h-4 w-4 text-violet-100/30" /></div>
                      <p className="mt-4 text-sm leading-6 text-slate-200/50">{source.note}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ) : null}
          </div>
        </CinematicSection>
      </section>
    </main>
  );
}
