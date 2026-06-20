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
  IntelligenceSourceStatus,
} from "./types";

export { resolveConfigCompanyId, getConfigIdAliases } from "./configIds";
export {
  INTELLIGENCE_CATEGORIES,
  buildIntelligenceEntities,
  buildIntelligenceSelectorOptions,
  getIntelligenceCategory,
  getIntelligenceStatus,
  groupSelectorOptions,
} from "./intelligenceNavigation";
export type { IntelligenceCategory, IntelligenceSelectorOption } from "./intelligenceNavigation";

import type { CompanyConfig } from "./types";
import { resolveConfigCompanyId } from "./configIds";
import { getAllCompanyConfigs, getCompanyConfigById } from "./registeredConfigs";

export function getCompanyConfig(companyId: string): CompanyConfig | undefined {
  return getCompanyConfigById(resolveConfigCompanyId(companyId));
}

export { getAllCompanyConfigs };

export function getCompanyConfigOrDefault(companyId: string): CompanyConfig {
  const resolvedId = resolveConfigCompanyId(companyId);
  return (
    getCompanyConfigById(resolvedId) ?? {
      companyId: resolvedId,
      displayName: resolvedId,
      shortName: resolvedId,
      sector: "Unknown",
      headquarters: "Unknown",
      employees: 0,
      employeesAsOf: "Unknown",
      summary: "Entity profile pending.",
      tags: [],
      executiveSignals: [
        { label: "Status", value: "Pending", note: "Detailed intelligence report not yet uploaded." },
        { label: "Sector", value: "—", note: "Sector-specific signals will populate when data is available." },
        { label: "Workforce", value: "—", note: "Workforce sizing pending uploaded report." },
        { label: "Risk profile", value: "—", note: "Risk profile pending uploaded report analysis." },
      ],
      chartDefinitions: [],
    }
  );
}
