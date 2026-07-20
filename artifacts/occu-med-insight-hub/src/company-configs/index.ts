export type { CompanyConfig, ChartDefinition, SignalDefinition, ChartSeriesDefinition, ReferenceLineDefinition, SourceFilterDefinition, DossierSectionType, DossierSectionDefinition, RiskMatrixPoint, OpportunityMatrixPoint, MetricDefinition, TooltipFormat, ChartInteractionConfig, CompanyInteractionConfig, TooltipBehavior, DrillDownDefinition, ChartFilterDefinition, LinkedChartDefinition, DetailPanelDefinition, TransitionConfig, AdvancedVisualizationConfig, SemanticZoomLevel, DepthLayerConfig, FocusEffectConfig, GridEffectConfig, PathEffectConfig, InteractionPreset } from "./types";
export { resolveConfigCompanyId, getConfigIdAliases } from "./configIds";

import { v2xConfig } from "./v2x";
import { idsConfig } from "./ids";
import { kbrConfig } from "./kbr";
import { paeAmentumConfig } from "./pae-amentum";
import { amentumClaimsDbaConfig } from "./amentum-claims-dba";
import { s3InternationalConfig } from "./s3-international";
import { traceSystemsConfig } from "./trace-systems";
import { weatherfordConfig } from "./weatherford";
import { valiantConfig } from "./valiant";
import { peratonConfig } from "./peraton";
import { caciConfig } from "./caci";
import { iapConfig } from "./iap";
import { constellisConfig } from "./constellis";
import { parsonsConfig } from "./parsons";
import { peckhamConfig } from "./peckham";
import { dbaCarrierNetworkConfig } from "./dba-carrier-network";
import { insuranceCarrierMappingConfig } from "./insurance-carrier-mapping";
import { qinetiqConfig } from "./qinetiq";
import { sercoConfig } from "./serco";
import { magAerospaceConfig } from "./mag-aerospace";
import { maximusFederalConfig } from "./maximus-federal";
import { northropGrummanConfig } from "./northrop-grumman";
import { rheinmetallConfig } from "./rheinmetall";
import { rtxConfig } from "./rtx";
import { saicConfig } from "./saic";
import { leidosConfig } from "./leidos";
import { kongsbergConfig } from "./kongsberg";
import { kapsuunConfig } from "./kapsuun";
import { missionEssentialConfig } from "./mission-essential";
import { sourceGroupConfig } from "./source-group";
import { thalesConfig } from "./thales";
import { tecmotivConfig } from "./tecmotiv";
import { c3elConfig } from "./c3el";
import { asrcFederalConfig } from "./asrc-federal";
import { referralDemandIntelligenceConfig } from "./referral-demand-intelligence";
import { multiClientLocationIntelligenceConfig } from "./multi-client-location-intelligence";
import { missingFederalProspectsConfig } from "./missing-federal-prospects";
import { prospectNetworkIntelligenceConfig } from "./prospect-network-intelligence";
import { networkGapResearchIntelligenceConfig } from "./network-gap-research-intelligence";
import { globalOperationalSitesIntelligenceConfig } from "./global-operational-sites-intelligence";
import { coreClientStatsDashboardConfig } from "./core-client-stats-dashboard";
import { reportMethodologyIntelligenceConfig } from "./report-methodology-intelligence";
import { uploadedPdfFifthIntelligenceConfig } from "./uploaded-pdf-fifth-intelligence";
import { v2xDbaCarrierAccessConfig } from "./v2x-dba-carrier-access";
import { eccConfig } from "./ecc";
import { perfectCoverageProspectsConfig } from "./perfect-coverage-prospects";
import { sierraNevadaConfig } from "./sierra-nevada";
import { skybridgeTacticalConfig } from "./skybridge-tactical";
import { sosiConfig } from "./sosi";
import { freeportConfig } from "./freeport";
import { leonardoConfig } from "./leonardo";
import { fluorConfig } from "./fluor";
import { dynamicAviationConfig } from "./dynamic-aviation";
import { masterPortfolioIntelligenceConfig } from "./master-portfolio-intelligence";
import { networkExpansionIntelligenceConfig } from "./network-expansion-intelligence";
import { prospectPipelineIntelligenceConfig } from "./prospect-pipeline-intelligence";
import { worldVisionConfig } from "./world-vision";
import { versarConfig } from "./versar";
import { clovehitchConfig } from "./clovehitch";
import { gditConfig } from "./dossier-companies";
import { jacobsConfig, baeConfig, alutiiqConfig, internationalSosConfig, hiiMissionTechConfig, datapathConfig, omniplexConfig, ssiConfig, platformAerospaceConfig } from "./stub-companies";

import type { CompanyConfig } from "./types";
import { resolveConfigCompanyId } from "./configIds";

export type ConfigEntityType = "company" | "portfolio" | "dashboard" | "network" | "methodology" | "temporary";

const CONFIG_ENTITY_TYPES: Record<string, ConfigEntityType> = {
  "master-portfolio-intelligence": "portfolio",
  "core-client-stats-dashboard": "dashboard",
  "report-methodology-intelligence": "methodology",
  "uploaded-pdf-fifth-intelligence": "temporary",
  "network-expansion-intelligence": "network",
  "multi-client-location-intelligence": "network",
  "prospect-network-intelligence": "network",
  "referral-demand-intelligence": "network",
  "prospect-pipeline-intelligence": "network",
  "perfect-coverage-prospects": "network",
  "missing-federal-prospects": "network",
  "network-gap-research-intelligence": "network",
  "global-operational-sites-intelligence": "network",
  "dba-carrier-network": "network",
  "insurance-carrier-mapping": "network",
  "v2x-dba-carrier-access": "network",
  "amentum-claims-dba-intelligence": "network",
};

export function getConfigEntityType(companyId: string): ConfigEntityType {
  return CONFIG_ENTITY_TYPES[resolveConfigCompanyId(companyId)] ?? "company";
}

const allConfigs: CompanyConfig[] = [
  masterPortfolioIntelligenceConfig, coreClientStatsDashboardConfig, reportMethodologyIntelligenceConfig, uploadedPdfFifthIntelligenceConfig, networkExpansionIntelligenceConfig, multiClientLocationIntelligenceConfig, prospectNetworkIntelligenceConfig, referralDemandIntelligenceConfig, prospectPipelineIntelligenceConfig, perfectCoverageProspectsConfig, missingFederalProspectsConfig, networkGapResearchIntelligenceConfig, globalOperationalSitesIntelligenceConfig, dbaCarrierNetworkConfig, insuranceCarrierMappingConfig, v2xDbaCarrierAccessConfig, worldVisionConfig, v2xConfig, idsConfig, kbrConfig, paeAmentumConfig, amentumClaimsDbaConfig, s3InternationalConfig, traceSystemsConfig, weatherfordConfig, valiantConfig, peratonConfig, caciConfig, iapConfig, constellisConfig, parsonsConfig, peckhamConfig, qinetiqConfig, sercoConfig, magAerospaceConfig, maximusFederalConfig, northropGrummanConfig, rheinmetallConfig, rtxConfig, saicConfig, leidosConfig, kongsbergConfig, kapsuunConfig, missionEssentialConfig, sourceGroupConfig, thalesConfig, tecmotivConfig, c3elConfig, asrcFederalConfig, sierraNevadaConfig, skybridgeTacticalConfig, sosiConfig, freeportConfig, leonardoConfig, fluorConfig, dynamicAviationConfig, gditConfig, clovehitchConfig, versarConfig, eccConfig, jacobsConfig, baeConfig, alutiiqConfig, internationalSosConfig, hiiMissionTechConfig, datapathConfig, omniplexConfig, ssiConfig, platformAerospaceConfig,
];

const configMap = new Map<string, CompanyConfig>();
for (const config of allConfigs) configMap.set(config.companyId, config);

export function getCompanyConfig(companyId: string): CompanyConfig | undefined {
  return configMap.get(resolveConfigCompanyId(companyId));
}

export function getAllCompanyConfigs(): CompanyConfig[] {
  return allConfigs;
}

export function getCompanyConfigOrDefault(companyId: string): CompanyConfig {
  const resolvedId = resolveConfigCompanyId(companyId);
  return configMap.get(resolvedId) ?? {
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
  };
}
