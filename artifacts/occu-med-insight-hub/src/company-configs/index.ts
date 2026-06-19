export type { CompanyConfig, ChartDefinition, SignalDefinition, ChartSeriesDefinition, ReferenceLineDefinition, SourceFilterDefinition, DossierSectionType, DossierSectionDefinition, RiskMatrixPoint, OpportunityMatrixPoint, MetricDefinition, TooltipFormat, ChartInteractionConfig, CompanyInteractionConfig, TooltipBehavior, DrillDownDefinition, ChartFilterDefinition, LinkedChartDefinition, DetailPanelDefinition, TransitionConfig, AdvancedVisualizationConfig, SemanticZoomLevel, DepthLayerConfig, FocusEffectConfig, GridEffectConfig, PathEffectConfig, InteractionPreset } from "./types";

import { v2xConfig } from "./v2x";
import { idsConfig } from "./ids";
import { kbrConfig } from "./kbr";
import { paeAmentumConfig } from "./pae-amentum";
import { s3InternationalConfig } from "./s3-international";
import { traceSystemsConfig } from "./trace-systems";
import { weatherfordConfig } from "./weatherford";
import { valiantConfig } from "./valiant";
import { peratonConfig } from "./peraton";
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
import { freeportConfig } from "./freeport";
import { masterPortfolioIntelligenceConfig } from "./master-portfolio-intelligence";
import { versarConfig } from "./versar";
import { clovehitchConfig } from "./clovehitch";
import { caciConfig, fluorConfig, gditConfig, dynamicAviationConfig } from "./dossier-companies";
import { jacobsConfig, baeConfig, asrcFederalConfig, alutiiqConfig, internationalSosConfig, hiiMissionTechConfig, sosiConfig, sierraConfig, datapathConfig, omniplexConfig, ssiConfig, platformAerospaceConfig, celConfig } from "./stub-companies";

import type { CompanyConfig } from "./types";

const allConfigs: CompanyConfig[] = [
  masterPortfolioIntelligenceConfig,
  v2xConfig,
  idsConfig,
  kbrConfig,
  paeAmentumConfig,
  s3InternationalConfig,
  traceSystemsConfig,
  weatherfordConfig,
  valiantConfig,
  peratonConfig,
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
  freeportConfig,
  caciConfig,
  fluorConfig,
  gditConfig,
  clovehitchConfig,
  versarConfig,
  dynamicAviationConfig,
  jacobsConfig,
  baeConfig,
  asrcFederalConfig,
  alutiiqConfig,
  internationalSosConfig,
  hiiMissionTechConfig,
  sosiConfig,
  sierraConfig,
  datapathConfig,
  omniplexConfig,
  ssiConfig,
  platformAerospaceConfig,
  celConfig,
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
