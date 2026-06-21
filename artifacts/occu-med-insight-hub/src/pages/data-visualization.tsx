import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { IntelligenceStatusBadge } from "@/components/insight/IntelligenceStatusBadge";
import { DataQualityBanner } from "@/components/insight/DataQualityBanner";
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
  sourceRecords: any[];
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
    sourceRecords: sources,
    riskMatrix: config.riskMatrix ?? [],
    opportunityMatrix: config.opportunityMatrix ?? []
  };
}

interface VisualizationMethodCardProps {
  title: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
  effectClass: string;
  dataCount: number;
}

function VisualizationMethodCard({ title, description, isActive, onClick, effectClass, dataCount }: VisualizationMethodCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-cyan-100/12 bg-black/18 p-5 transition-all duration-300 ${isActive ? 'border-cyan-200/30 bg-cyan-300/8 shadow-[0_0_30px_rgba(34,211,238,.12),inset_0_0_30px_rgba(34,211,238,.08)]' : 'hover:border-cyan-100/20 hover:bg-white/[0.05]'} ${effectClass}`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{title}</p>
          <span className="rounded-full bg-cyan-100/10 px-2 py-0.5 text-[10px] font-bold text-cyan-50">{dataCount}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-cyan-100/58">{description}</p>
      </div>
    </motion.div>
  );
}

interface VisualizationDataNodeProps {
  label: string;
  value: string | number;
  type: 'metric' | 'signal' | 'chart' | 'source' | 'dossier' | 'risk' | 'opportunity';
  isSelected: boolean;
  onClick: () => void;
  effectStyle: string;
}

function VisualizationDataNode({ label, value, type, isSelected, onClick, effectStyle }: VisualizationDataNodeProps) {
  const typeColors = {
    metric: 'border-cyan-100/20 bg-cyan-100/5',
    signal: 'border-emerald-100/20 bg-emerald-100/5',
    chart: 'border-purple-100/20 bg-purple-100/5',
    source: 'border-amber-100/20 bg-amber-100/5',
    dossier: 'border-rose-100/20 bg-rose-100/5',
    risk: 'border-red-100/20 bg-red-100/5',
    opportunity: 'border-green-100/20 bg-green-100/5'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-3 transition-all ${typeColors[type]} ${isSelected ? 'ring-2 ring-cyan-400/50' : ''} ${effectStyle}`}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/60">{label}</p>
      <p className="mt-1 text-sm font-bold text-cyan-50">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </motion.div>
  );
}

interface VisualizationDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selection: any;
}

function VisualizationDetailDrawer({ isOpen, onClose, selection }: VisualizationDetailDrawerProps) {
  if (!selection) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-0 right-0 z-50 w-full max-w-md border-t border-cyan-100/20 bg-[#030813]/95 p-6 backdrop-blur-xl lg:bottom-0 lg:right-8 lg:top-auto lg:rounded-t-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Detail View</h3>
            <button onClick={onClose} className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-100/10">
              Close
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Label</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.label || selection.name || 'N/A'}</p>
            </div>
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Value</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.value !== undefined ? selection.value.toLocaleString() : 'N/A'}</p>
            </div>
            {selection.unit && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Unit</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.unit}</p>
              </div>
            )}
            {selection.category && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Category</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.category}</p>
              </div>
            )}
            {selection.note && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Note</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.note}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface VisualizationFilterBarProps {
  filters: {
    showMetrics: boolean;
    showSignals: boolean;
    showCharts: boolean;
    showSources: boolean;
    showDossier: boolean;
    showRisk: boolean;
    showOpportunity: boolean;
  };
  onFilterChange: (key: string, value: boolean) => void;
}

function VisualizationFilterBar({ filters, onFilterChange }: VisualizationFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(filters).map(([key, value]) => (
        <button
          key={key}
          onClick={() => onFilterChange(key, !value)}
          className={`rounded-lg border px-3 py-1.5 text-xs transition ${
            value
              ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
              : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
          }`}
        >
          {key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}
        </button>
      ))}
    </div>
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
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [semanticZoomLevel, setSemanticZoomLevel] = useState<'overview' | 'detail'>('overview');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [filters, setFilters] = useState({
    showMetrics: true,
    showSignals: true,
    showCharts: true,
    showSources: true,
    showDossier: true,
    showRisk: true,
    showOpportunity: true
  });

  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    profile,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources
  });

  const handleFilterChange = (key: string, value: boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleNodeClick = (node: any) => {
    setActiveSelection(node);
    setDetailDrawerOpen(true);
  };

  const getFilteredData = () => {
    let data: any[] = [];
    if (filters.showMetrics) {
      data = [...data, ...vizModel.metrics.map(m => ({ ...m, type: 'metric' }))];
    }
    if (filters.showSignals) {
      data = [...data, ...vizModel.signals.map(s => ({ ...s, type: 'signal' }))];
    }
    if (filters.showCharts) {
      data = [...data, ...vizModel.charts.map(c => ({ ...c, type: 'chart' }))];
    }
    if (filters.showSources) {
      data = [...data, ...vizModel.sourceRecords.map(s => ({ ...s, type: 'source' }))];
    }
    if (filters.showDossier) {
      data = [...data, ...vizModel.dossierSections.map(d => ({ ...d, type: 'dossier' }))];
    }
    if (filters.showRisk) {
      data = [...data, ...vizModel.riskMatrix.map(r => ({ ...r, type: 'risk' }))];
    }
    if (filters.showOpportunity) {
      data = [...data, ...vizModel.opportunityMatrix.map(o => ({ ...o, type: 'opportunity' }))];
    }
    return data;
  };

  const filteredData = getFilteredData();

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

  const getMethodDataCount = (methodId: string) => {
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
        return vizModel.metrics.length;
      case "semantic-zoom":
        return vizModel.metrics.length + vizModel.signals.length;
      case "interactive-filter":
      case "zoom-pan":
      case "linked-visualizations":
        return filteredData.length;
      case "click-reveal":
        return activeSelection ? 1 : 0;
      default:
        return 0;
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
              <p className="mt-2 text-lg font-black text-cyan-50">{vizModel.sourceRecords.length}</p>
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
                dataCount={getMethodDataCount(method.id)}
              />
            ))}
          </div>
        </div>

        {/* Active Method Canvas */}
        {activeMethod && (
          <GlassCard className={`p-6 transition-all ${isExpanded ? 'min-h-[600px]' : ''}`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/35">Active method canvas</p>
                <h3 className="mt-1 text-xl font-bold text-white">
                  {visualizationMethods.find(m => m.id === activeMethod)?.title}
                </h3>
              </div>
              {activeMethod === 'zoom-pan' && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10"
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>
              )}
            </div>
            
            {activeMethod === 'semantic-zoom' && (
              <div className="mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSemanticZoomLevel('overview')}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      semanticZoomLevel === 'overview'
                        ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
                        : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setSemanticZoomLevel('detail')}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      semanticZoomLevel === 'detail'
                        ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
                        : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
                    }`}
                  >
                    Detail
                  </button>
                </div>
              </div>
            )}

            {activeMethod === 'interactive-filter' && (
              <div className="mb-4">
                <VisualizationFilterBar filters={filters} onFilterChange={handleFilterChange} />
              </div>
            )}

            <div className={`grid gap-3 ${isExpanded ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {(() => {
                const dataToRender = activeMethod === 'interactive-filter' ? filteredData :
                  activeMethod === 'semantic-zoom' && semanticZoomLevel === 'overview' ? 
                    [...vizModel.metrics.slice(0, 6), ...vizModel.signals.slice(0, 3)] :
                    activeMethod === 'semantic-zoom' && semanticZoomLevel === 'detail' ?
                      [...vizModel.metrics, ...vizModel.signals] :
                    vizModel.metrics;

                if (dataToRender.length === 0) {
                  return <p className="col-span-full text-center text-sm text-cyan-100/40">No data available for current filter/zoom level</p>;
                }

                return dataToRender.slice(0, isExpanded ? 20 : 12).map((item, index) => {
                  const effectStyles: Record<string, string> = {
                    'vector-displacement': 'hover:shadow-[0_0_30px_rgba(34,211,238,.2)]',
                    'chromatic-aberration': 'hover:shadow-[0_0_30px_rgba(239,68,68,.2),0_0_30px_rgba(6,182,212,.2)]',
                    'geometric-anchor': 'hover:shadow-[0_0_30px_rgba(16,185,129,.2)]',
                    'subtractive-masking': 'hover:shadow-[inset_0_0_30px_rgba(34,211,238,.15)]',
                    'procedural-grid': 'hover:shadow-[0_0_30px_rgba(34,211,238,.25),0_0_60px_rgba(34,211,238,.15)]',
                    'algorithmic-edge': 'hover:shadow-[0_0_2px_rgba(34,211,238,1),0_0_10px_rgba(34,211,238,.6)]',
                    'concentric-ripple': 'hover:shadow-[0_0_0_6px_rgba(34,211,238,.4),0_0_0_12px_rgba(34,211,238,.2)]',
                    'negative-space': 'hover:shadow-[inset_0_0_30px_rgba(0,0,0,.9),0_0_15px_rgba(34,211,238,.4)]',
                    'vector-lattice': 'hover:shadow-[0_0_30px_rgba(168,85,247,.2)]',
                    'color-shift': 'hover:shadow-[0_0_30px_rgba(236,72,153,.2)]',
                    'synchronous-path': 'hover:shadow-[0_0_30px_rgba(251,191,36,.2)]',
                    'vector-node': 'hover:shadow-[0_0_30px_rgba(34,211,238,.3)]',
                    'radiant-gradient': 'hover:shadow-[0_0_50px_rgba(34,211,238,.25),0_0_80px_rgba(34,211,238,.15)]',
                    'isometric-slice': 'hover:shadow-[6px_6px_0_rgba(34,211,238,.25)]',
                    'holographic-depth': 'hover:shadow-[0_0_30px_rgba(34,211,238,.2),0_0_60px_rgba(34,211,238,.08)]',
                    'kinetic-vector': 'hover:shadow-[0_0_30px_rgba(20,184,166,.2)]',
                    'contextual-morph': 'hover:shadow-[0_0_30px_rgba(139,92,246,.2)]',
                    'semantic-zoom': 'hover:shadow-[0_0_30px_rgba(99,102,241,.2)]',
                    'interactive-filter': 'hover:shadow-[0_0_30px_rgba(234,88,12,.2)]',
                    'zoom-pan': 'hover:shadow-[0_0_30px_rgba(14,165,233,.2)]',
                    'linked-visualizations': 'hover:shadow-[0_0_30px_rgba(22,163,74,.2)]',
                    'click-reveal': 'hover:shadow-[0_0_30px_rgba(244,63,94,.2)]'
                  };

                  const isSelected = activeSelection && activeSelection.id === item.id;
                  const isRelated = activeSelection && activeSelection.category === item.category;
                  const opacity = activeMethod === 'contextual-morph' && activeSelection ? 
                    (isSelected ? 1 : isRelated ? 0.8 : 0.3) : 1;

                  return (
                    <motion.div
                      key={item.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      style={{ opacity }}
                    >
                      <VisualizationDataNode
                        label={item.label || item.name || item.title || 'Unknown'}
                        value={item.value || item.revenue || item.workers || item.data?.length || 0}
                        type={item.type || 'metric'}
                        isSelected={isSelected}
                        onClick={() => handleNodeClick(item)}
                        effectStyle={effectStyles[activeMethod] || ''}
                      />
                    </motion.div>
                  );
                });
              })()}
            </div>
          </GlassCard>
        )}

        {/* Click-to-Reveal Detail Drawer */}
        <VisualizationDetailDrawer
          isOpen={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          selection={activeSelection}
        />
      </section>
    </main>
  );
}
