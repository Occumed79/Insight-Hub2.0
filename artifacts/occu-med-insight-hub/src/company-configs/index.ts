export type { CompanyConfig, ChartDefinition, SignalDefinition, ChartSeriesDefinition, ReferenceLineDefinition, SourceFilterDefinition, DossierSectionType, DossierSectionDefinition, RiskMatrixPoint, OpportunityMatrixPoint, MetricDefinition, TooltipFormat, ChartInteractionConfig, CompanyInteractionConfig, TooltipBehavior, DrillDownDefinition, ChartFilterDefinition, LinkedChartDefinition, DetailPanelDefinition, TransitionConfig, AdvancedVisualizationConfig, SemanticZoomLevel, DepthLayerConfig, FocusEffectConfig, GridEffectConfig, PathEffectConfig, InteractionPreset } from "./types";

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
import { v2xDbaCarrierAccessConfig } from "./v2x-dba-carrier-access";
import { perfectCoverageProspectsConfig } from "./perfect-coverage-prospects";
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
import { jacobsConfig, baeConfig, alutiiqConfig, internationalSosConfig, hiiMissionTechConfig, sosiConfig, sierraConfig, datapathConfig, omniplexConfig, ssiConfig, platformAerospaceConfig } from "./stub-companies";

import type { CompanyConfig } from "./types";

const allConfigs: CompanyConfig[] = [
  masterPortfolioIntelligenceConfig,
  networkExpansionIntelligenceConfig,
  referralDemandIntelligenceConfig,
  prospectPipelineIntelligenceConfig,
  perfectCoverageProspectsConfig,
  v2xDbaCarrierAccessConfig,
  worldVisionConfig,
  v2xConfig,
  idsConfig,
  kbrConfig,
  paeAmentumConfig,
  amentumClaimsDbaConfig,
  s3InternationalConfig,
  traceSystemsConfig,
  weatherfordConfig,
  valiantConfig,
  peratonConfig,
  caciConfig,
  iapConfig,
  constellisConfig,
  parsonsConfig,
  peckhamConfig,
  dbaCarrierNetworkConfig,
  qinetiqConfig,
  sercoConfig,
  magAerospaceConfig,
  maximusFederalConfig,
  northropGrummanConfig,
  rheinmetallConfig,
  rtxConfig,
  saicConfig,
  leidosConfig,
  kongsbergConfig,
  kapsuunConfig,
  missionEssentialConfig,
  sourceGroupConfig,
  thalesConfig,
  tecmotivConfig,
  c3elConfig,
  asrcFederalConfig,
  freeportConfig,
  leonardoConfig,
  fluorConfig,
  dynamicAviationConfig,
  gditConfig,
  clovehitchConfig,
  versarConfig,
  jacobsConfig,
  baeConfig,
  alutiiqConfig,
  internationalSosConfig,
  hiiMissionTechConfig,
  sosiConfig,
  sierraConfig,
  datapathConfig,
  omniplexConfig,
  ssiConfig,
  platformAerospaceConfig,
];

const configMap = new Map<string, CompanyConfig>();
for (const config of allConfigs) {
  configMap.set(config.companyId, config);
}

export function getCompanyConfig(companyId: string): CompanyConfig | undefined {
  return configMap.get(companyId);
}

export function getAllCompanyConfigs(): CompanyConfig[] {
  return allConfigs;
}

export function getCompanyConfigOrDefault(companyId: string): CompanyConfig {
  return configMap.get(companyId) ?? {
    companyId,
    displayName: companyId,
    shortName: companyId,
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
