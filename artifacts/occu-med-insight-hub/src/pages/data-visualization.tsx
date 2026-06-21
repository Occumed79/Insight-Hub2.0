import { useState } from "react";
import { motion } from "framer-motion";
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
import { CompanyDossierRenderer } from "@/components/company/CompanyDossierRenderer";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { getIntelligenceStatus } from "@/company-configs/intelligenceNavigation";
import type { ChartDefinition, MetricDefinition, SignalDefinition, RiskMatrixPoint, OpportunityMatrixPoint, DossierSectionDefinition } from "@/company-configs/types";

interface ProfileVisualizationModel {
  company: { name: string; shortName: string; summary: string; tags: string[] } | null;
  metrics: any[];
  charts: ChartDefinition[];
  signals: SignalDefinition[];
  dossierSections: DossierSectionDefinition[];
  sourceRecords: number;
  riskMatrix: RiskMatrixPoint[];
  opportunityMatrix: OpportunityMatrixPoint[];
}

function buildProfileVisualizationModel({
  company,
  config,
  profile,
  metrics,
  sources
}: {
  company: { name: string; shortName: string; summary: string; tags: string[] } | null;
  config: any;
  profile: any;
  metrics: any[];
  sources: any[];
}): ProfileVisualizationModel {
  const configMetrics = (config.metricDefinitions ?? []).map((metric: any) => ({ ...metric, companyId: config.companyId }));
  const mergedMetrics = [...metrics, ...configMetrics.filter((metric: any) => !metrics.some((existing) => existing.id === metric.id))] as any[];
  
  return {
    company,
    metrics: mergedMetrics,
    charts: config.chartDefinitions ?? [],
    signals: config.executiveSignals ?? [],
    dossierSections: config.dossierSections ?? [],
    sourceRecords: sources.length,
    riskMatrix: config.riskMatrix ?? [],
    opportunityMatrix: config.opportunityMatrix ?? []
  };
}

interface VisualizationMethodCardProps {
  title: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  effectClass: string;
}

function VisualizationMethodCard({ title, description, isActive, onClick, children, effectClass }: VisualizationMethodCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-cyan-100/12 bg-black/18 p-5 transition-all duration-300 ${isActive ? 'border-cyan-200/30 bg-cyan-300/8 shadow-[0_0_30px_rgba(34,211,238,.12),inset_0_0_30px_rgba(34,211,238,.08)]' : 'hover:border-cyan-100/20 hover:bg-white/[0.05]'} ${effectClass}`}
    >
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{title}</p>
        <p className="mt-1 text-xs leading-5 text-cyan-100/58">{description}</p>
        <div className="mt-4">{children}</div>
      </div>
    </motion.div>
  );
}

export default function DataVisualization() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const status = getIntelligenceStatus(config);
  const profile = dataset.profiles.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  
  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<any>(null);

  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    profile,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources
  });

  const visualizationMethods = [
    {
      id: "vector-displacement",
      title: "Vector Displacement Mapping",
      description: "Pointer-based lens refraction effect on data cards",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.15)]"
    },
    {
      id: "chromatic-aberration",
      title: "Chromatic Aberration Highlighting",
      description: "RGB split / technical glitch halo on active data",
      effectClass: "hover:shadow-[0_0_40px_rgba(239,68,68,.15),0_0_40px_rgba(6,182,212,.15)]"
    },
    {
      id: "geometric-anchor",
      title: "Geometric Anchor Snapping",
      description: "Precise crosshair-like emphasis on metric values",
      effectClass: "hover:shadow-[0_0_40px_rgba(16,185,129,.15)]"
    },
    {
      id: "subtractive-masking",
      title: "Subtractive Masking Overlays",
      description: "Value labels cut into glass surface",
      effectClass: "hover:shadow-[inset_0_0_40px_rgba(34,211,238,.1)]"
    },
    {
      id: "procedural-grid",
      title: "Procedural Grid Resonances",
      description: "Radial pulse effect around active metrics",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.2),0_0_80px_rgba(34,211,238,.1)]"
    },
    {
      id: "algorithmic-edge",
      title: "Algorithmic Edge-Tracing",
      description: "Hard-edge animated outline on selected elements",
      effectClass: "hover:shadow-[0_0_2px_rgba(34,211,238,.8),0_0_8px_rgba(34,211,238,.4)]"
    },
    {
      id: "concentric-ripple",
      title: "Concentric Ripple Metrics",
      description: "Faint ring feedback on clicked metrics",
      effectClass: "hover:shadow-[0_0_0_4px_rgba(34,211,238,.3),0_0_0_8px_rgba(34,211,238,.15)]"
    },
    {
      id: "negative-space",
      title: "Negative Space Inversion",
      description: "Dark void with neon edge for important metrics",
      effectClass: "hover:shadow-[inset_0_0_40px_rgba(0,0,0,.8),0_0_20px_rgba(34,211,238,.3)]"
    },
    {
      id: "vector-lattice",
      title: "Vector Lattice Distortion",
      description: "Pointer movement warps background grid",
      effectClass: "hover:shadow-[0_0_40px_rgba(168,85,247,.15)]"
    },
    {
      id: "color-shift",
      title: "Color-Shift Isometry",
      description: "Smooth luminous gradient state transitions",
      effectClass: "hover:shadow-[0_0_40px_rgba(236,72,153,.15)]"
    },
    {
      id: "synchronous-path",
      title: "Synchronous Path Illumination",
      description: "Light sweep along selected paths/bars",
      effectClass: "hover:shadow-[0_0_40px_rgba(251,191,36,.15)]"
    },
    {
      id: "vector-node",
      title: "Vector Node Expansion",
      description: "Datapoint blooms into precise vector node",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.25)]"
    },
    {
      id: "radiant-gradient",
      title: "Radiant Gradient Focus",
      description: "Active data glows, supporting data recedes",
      effectClass: "hover:shadow-[0_0_60px_rgba(34,211,238,.2),0_0_100px_rgba(34,211,238,.1)]"
    },
    {
      id: "isometric-slice",
      title: "Isometric Slice-View",
      description: "Selected card lifts with isometric plane effect",
      effectClass: "hover:shadow-[8px_8px_0_rgba(34,211,238,.2)]"
    },
    {
      id: "semantic-zoom",
      title: "Generative Semantic Zoom",
      description: "Toggle between abstract overview and detail mode",
      effectClass: "hover:shadow-[0_0_40px_rgba(99,102,241,.15)]"
    },
    {
      id: "holographic-depth",
      title: "Holographic Depth Layers",
      description: "Layered translucent panels with parallax",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.15),0_0_80px_rgba(34,211,238,.05)]"
    },
    {
      id: "kinetic-vector",
      title: "Kinetic Vector Transitions",
      description: "Clean vector-like motion animations",
      effectClass: "hover:shadow-[0_0_40px_rgba(20,184,166,.15)]"
    },
    {
      id: "contextual-morph",
      title: "Contextual Data Morphing",
      description: "Selected metric emphasizes related values",
      effectClass: "hover:shadow-[0_0_40px_rgba(139,92,246,.15)]"
    },
    {
      id: "interactive-filter",
      title: "Interactive Filtering",
      description: "Method-level filter controls on data",
      effectClass: "hover:shadow-[0_0_40px_rgba(234,88,12,.15)]"
    },
    {
      id: "zoom-pan",
      title: "Zoom and Pan",
      description: "Focused/expanded mode for dense charts",
      effectClass: "hover:shadow-[0_0_40px_rgba(14,165,233,.15)]"
    },
    {
      id: "linked-visualizations",
      title: "Linked Visualizations / Brushing",
      description: "Shared selection highlights across cards",
      effectClass: "hover:shadow-[0_0_40px_rgba(22,163,74,.15)]"
    },
    {
      id: "click-reveal",
      title: "Click-to-Reveal",
      description: "Persistent detail drawer on value click",
      effectClass: "hover:shadow-[0_0_40px_rgba(244,63,94,.15)]"
    }
  ];

  const renderMethodContent = (methodId: string) => {
    const hasMetrics = vizModel.metrics.length > 0;
    const hasCharts = vizModel.charts.length > 0;
    const hasSignals = vizModel.signals.length > 0;
    const hasRiskMatrix = vizModel.riskMatrix.length > 0;
    const hasOpportunityMatrix = vizModel.opportunityMatrix.length > 0;

    if (!hasMetrics && !hasCharts && !hasSignals && !hasRiskMatrix && !hasOpportunityMatrix) {
      return <p className="text-xs text-cyan-100/40">No source-backed values available for this profile.</p>;
    }

    switch (methodId) {
      case "vector-displacement":
      case "chromatic-aberration":
      case "geometric-anchor":
      case "subtractive-masking":
      case "procedural-grid":
      case "algorithmic-edge":
      case "concentric-ripple":
      case "negative-space":
      case "vector-lattice":
      case "color-shift":
      case "synchronous-path":
      case "vector-node":
      case "radiant-gradient":
      case "isometric-slice":
      case "holographic-depth":
      case "kinetic-vector":
      case "contextual-morph":
        if (hasMetrics) {
          return (
            <div className="grid gap-2 md:grid-cols-2">
              {vizModel.metrics.slice(0, 4).map((metric) => (
                <div key={metric.id} className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/42">{metric.label}</p>
                  <p className="mt-1 text-lg font-black text-cyan-50">
                    {metric.unit === "usd" ? `$${(metric.value / 1000000).toFixed(1)}M` : metric.value}
                  </p>
                </div>
              ))}
            </div>
          );
        }
        return <p className="text-xs text-cyan-100/40">No metrics available for this profile.</p>;

      case "semantic-zoom":
        return (
          <div className="flex gap-2">
            <button className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10">Overview</button>
            <button className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10">Detail</button>
          </div>
        );

      case "interactive-filter":
      case "zoom-pan":
      case "linked-visualizations":
        if (hasCharts) {
          return (
            <div className="space-y-2">
              {vizModel.charts.slice(0, 2).map((chart) => (
                <div key={chart.id} className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/42">{chart.title}</p>
                  <p className="mt-1 text-xs text-cyan-100/58">{chart.data.length} data points</p>
                </div>
              ))}
            </div>
          );
        }
        return <p className="text-xs text-cyan-100/40">No charts available for this profile.</p>;

      case "click-reveal":
        if (activeSelection) {
          return (
            <div className="rounded-xl border border-cyan-100/20 bg-cyan-100/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/42">Selected</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{JSON.stringify(activeSelection).slice(0, 50)}...</p>
            </div>
          );
        }
        return <p className="text-xs text-cyan-100/40">Click a value to reveal details.</p>;

      default:
        return <p className="text-xs text-cyan-100/40">Visualization ready.</p>;
    }
  };

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 02"
          title="Data Visualization"
          subtitle="Advanced visualization lab for profile-level intelligence, using the same source data as Data Profiles."
          actions={<IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />}
          status={<IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} />}
        />
        <DataQualityBanner warnings={status.dataQualityWarnings} />

        {/* Profile Summary */}
        <GlassCard className="mb-5 p-5">
          <div className="mb-4 flex items-center justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Profile visualization summary</p>
              <h2 className="mt-2 text-2xl font-black text-white">{vizModel.company?.shortName || "Entity"} visualization model</h2>
            </div>
            <IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Metric definitions</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.metrics.length}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Chart definitions</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.charts.length}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Dossier sections</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.dossierSections.length}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Source records</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.sourceRecords}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Executive signals</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.signals.length}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Risk matrix</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.riskMatrix.length > 0 ? "Available" : "N/A"}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Opportunity matrix</p>
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.opportunityMatrix.length > 0 ? "Available" : "N/A"}</p>
            </div>
          </div>
        </GlassCard>

        {/* Visualization Method Navigator */}
        <div className="mb-5">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-100/35">Visualization method navigator</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visualizationMethods.map((method) => (
              <VisualizationMethodCard
                key={method.id}
                title={method.title}
                description={method.description}
                isActive={activeMethod === method.id}
                onClick={() => setActiveMethod(method.id)}
                effectClass={method.effectClass}
              >
                {renderMethodContent(method.id)}
              </VisualizationMethodCard>
            ))}
          </div>
        </div>

        {/* Primary Visualization Canvas */}
        {vizModel.charts.length > 0 && (
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-100/35">Primary visualization canvas</p>
            <CompanyChartRenderer charts={vizModel.charts} />
          </div>
        )}

        {vizModel.riskMatrix.length > 0 && (
          <div className="mt-5">
            <CompanyRiskRenderer data={vizModel.riskMatrix} companyName={config.shortName} />
          </div>
        )}

        {vizModel.opportunityMatrix.length > 0 && (
          <div className="mt-5">
            <CompanyOpportunityRenderer data={vizModel.opportunityMatrix} companyName={config.shortName} />
          </div>
        )}

        {profile && (
          <div className="mt-5">
            <CompanyDossierRenderer profile={profile} metrics={vizModel.metrics} />
          </div>
        )}
      </section>
    </main>
  );
}
