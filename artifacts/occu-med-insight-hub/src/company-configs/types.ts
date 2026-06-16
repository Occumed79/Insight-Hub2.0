export type TooltipFormat = "currencyM" | "currencyK" | "percent" | "hoursM" | "plain";

export type ChartSeriesDefinition = {
  dataKey: string;
  name?: string;
  color?: string;
  stackId?: string;
  radius?: [number, number, number, number];
};

export type ReferenceLineDefinition = {
  y: number;
  stroke: string;
  strokeDasharray?: string;
  label?: { value: string; fill: string; fontSize: number };
};

export type TooltipBehavior = {
  mode?: "hover" | "click" | "focus";
  showCrosshair?: boolean;
  persistOnClick?: boolean;
  customFields?: { label: string; dataKey: string; formatter?: TooltipFormat }[];
};

export type DrillDownDefinition = {
  targetChartId?: string;
  targetPanel?: string;
  dataKey: string;
  label?: string;
  detailData?: Record<string, string | number>[];
};

export type ChartFilterDefinition = {
  id: string;
  label: string;
  type: "select" | "multi-select" | "range" | "toggle";
  dataKey: string;
  options?: string[];
  defaultValue?: string | string[] | [number, number] | boolean;
};

export type LinkedChartDefinition = {
  targetChartIds: string[];
  highlightKey: string;
  syncTooltip?: boolean;
  syncSelection?: boolean;
};

export type DetailPanelDefinition = {
  title: string;
  triggerOn: "click" | "hover" | "select";
  position: "right" | "bottom" | "modal";
  fields: { label: string; dataKey: string; formatter?: TooltipFormat }[];
  narrative?: string;
};

export type TransitionConfig = {
  enter?: "fade" | "slide" | "scale" | "kinetic" | "morph" | "none";
  duration?: number;
  staggerChildren?: boolean;
  animateData?: boolean;
};

export type SemanticZoomLevel = {
  threshold: number;
  visibleSeries?: string[];
  labelDetail?: "minimal" | "standard" | "full";
  aggregation?: "none" | "average" | "sum";
};

export type DepthLayerConfig = {
  layer: "foreground" | "midground" | "background";
  parallaxFactor?: number;
  blur?: number;
  opacity?: number;
};

export type FocusEffectConfig = {
  type: "radiant-gradient" | "chromatic-highlight" | "displacement-lens" | "color-shift" | "negative-inversion" | "subtractive-mask";
  intensity?: number;
  radius?: number;
  color?: string;
};

export type GridEffectConfig = {
  type: "procedural-resonance" | "lattice-distortion" | "concentric-ripple" | "isometric-slice" | "algorithmic-edge-trace";
  amplitude?: number;
  frequency?: number;
  animate?: boolean;
};

export type PathEffectConfig = {
  type: "synchronous-illumination" | "vector-node-expansion" | "anchor-snapping";
  color?: string;
  trailLength?: number;
  speed?: number;
};

export type AdvancedVisualizationConfig = {
  semanticZoom?: SemanticZoomLevel[];
  depthLayers?: DepthLayerConfig;
  focusEffect?: FocusEffectConfig;
  gridEffect?: GridEffectConfig;
  pathEffect?: PathEffectConfig;
  enableZoomPan?: boolean;
  enableBrushing?: boolean;
  contextualMorph?: { triggerKey: string; morphType: "reshape" | "recolor" | "redistribute" };
};

export type ChartInteractionConfig = {
  tooltip?: TooltipBehavior;
  drillDown?: DrillDownDefinition;
  filters?: ChartFilterDefinition[];
  linkedCharts?: LinkedChartDefinition;
  detailPanel?: DetailPanelDefinition;
  transition?: TransitionConfig;
  visualization?: AdvancedVisualizationConfig;
};

export type ChartDefinition = {
  id: string;
  title: string;
  subtitle: string;
  type: "bar" | "area" | "line" | "scatter" | "stacked" | "grouped";
  data: Record<string, string | number>[];
  xKey: string;
  series: ChartSeriesDefinition[];
  formatter?: TooltipFormat;
  headline?: string;
  domain?: [number, number];
  referenceLines?: ReferenceLineDefinition[];
  fullWidth?: boolean;
  interaction?: ChartInteractionConfig;
};

export type SignalDefinition = {
  label: string;
  value: string;
  note: string;
};

export type RiskMatrixPoint = {
  name: string;
  revenue: number;
  risk: number;
  workers: number;
};

export type OpportunityMatrixPoint = {
  name: string;
  revenuePotential: number;
  implementationComplexity: number;
  strategicValue: number;
};

export type MetricDefinition = {
  id: string;
  label: string;
  value: number;
  unit: "usd" | "count" | "percent" | "score";
  category: "workforce" | "safety" | "financial" | "risk";
  trend?: number;
  sourceId?: string;
};

export type SourceFilterDefinition = {
  sec?: { cik?: string; ticker?: string; legalEntities?: string[]; formerNames?: string[] };
  sam?: { uei?: string; legalNames?: string[]; dbas?: string[] };
  usaSpending?: { recipientNames?: string[]; parentOrgs?: string[] };
  jobSources?: { linkedin?: string; indeed?: string; careerSite?: string; clearanceJobs?: string };
  newsSources?: { aliases?: string[]; acquisitionAliases?: string[]; subsidiaries?: string[] };
};

export type DossierSectionType =
  | "overview"
  | "contracts"
  | "locations"
  | "competitors"
  | "acquisitions"
  | "hiring"
  | "workforce"
  | "safety"
  | "esg"
  | "procurement"
  | "medical-opportunities";

export type DossierSectionDefinition = {
  type: DossierSectionType;
  title: string;
  narrative: string;
  bullets: string[];
  metricIds: string[];
};

export type InteractionPreset =
  | "executive-summary"
  | "deep-analysis"
  | "real-time-monitor"
  | "comparative-benchmark"
  | "holographic-detail"
  | "kinetic-flow"
  | "minimal-static";

export type CompanyInteractionConfig = {
  preset?: InteractionPreset;
  defaultTransition?: TransitionConfig;
  enableLinkedHighlighting?: boolean;
  enableDrillDown?: boolean;
  enableFilters?: boolean;
  enableZoomPan?: boolean;
  enableBrushing?: boolean;
  enableSemanticZoom?: boolean;
  detailPanelPosition?: "right" | "bottom" | "modal";
  defaultFocusEffect?: FocusEffectConfig;
  defaultGridEffect?: GridEffectConfig;
  defaultDepthLayers?: boolean;
};

export type CompanyConfig = {
  companyId: string;
  displayName: string;
  shortName: string;
  sector: string;
  headquarters: string;
  employees: number;
  employeesAsOf: string;
  summary: string;
  tags: string[];
  aliases?: string[];
  sourceFilters?: SourceFilterDefinition;
  executiveSignals: SignalDefinition[];
  chartDefinitions: ChartDefinition[];
  metricDefinitions?: MetricDefinition[];
  riskMatrix?: RiskMatrixPoint[];
  opportunityMatrix?: OpportunityMatrixPoint[];
  dossierSections?: DossierSectionDefinition[];
  curveTitle?: string;
  curveSubtitle?: string;
  interactionConfig?: CompanyInteractionConfig;
};
