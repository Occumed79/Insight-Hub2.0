export type {
  CompanyConfig,
  ChartDefinition,
  SignalDefinition,
  ChartSeriesDefinition,
  ReferenceLineDefinition,
  SourceFilterDefinition,
  DossierSectionType,
  DossierSectionDefinition,
  RiskMatrixPoint,
  OpportunityMatrixPoint,
  MetricDefinition,
  TooltipFormat,
  ChartInteractionConfig,
  CompanyInteractionConfig,
  TooltipBehavior,
  DrillDownDefinition,
  ChartFilterDefinition,
  LinkedChartDefinition,
  DetailPanelDefinition,
  TransitionConfig,
  AdvancedVisualizationConfig,
  SemanticZoomLevel,
  DepthLayerConfig,
  FocusEffectConfig,
  GridEffectConfig,
  PathEffectConfig,
  InteractionPreset,
} from "./types";
export { resolveConfigCompanyId, getConfigIdAliases } from "./configIds";

import type { CompanyConfig } from "./types";
import { resolveConfigCompanyId } from "./configIds";

export type ConfigEntityType = "company" | "portfolio" | "dashboard" | "network" | "methodology" | "temporary";

export function getConfigEntityType(_companyId: string): ConfigEntityType {
  return "company";
}

export function getCompanyConfig(_companyId: string): CompanyConfig | undefined {
  return undefined;
}

export function getAllCompanyConfigs(): CompanyConfig[] {
  return [];
}

export function getCompanyConfigOrDefault(companyId: string): CompanyConfig {
  const resolvedId = resolveConfigCompanyId(companyId.trim());
  const displayName = resolvedId || "Runtime employer";

  return {
    companyId: resolvedId,
    displayName,
    shortName: displayName,
    sector: "Not stored",
    headquarters: "Not stored",
    employees: 0,
    employeesAsOf: "Not stored",
    summary: "No committed static employer profile is stored. Run a manual public-source research action to populate employer-specific intelligence.",
    tags: [],
    executiveSignals: [],
    chartDefinitions: [],
  };
}
