export type { CompanyConfig, ChartDefinition, SignalDefinition, ChartSeriesDefinition, ReferenceLineDefinition, SourceFilterDefinition, DossierSectionType, DossierSectionDefinition, RiskMatrixPoint, OpportunityMatrixPoint, MetricDefinition, TooltipFormat } from "./types";

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
import {
  caciConfig,
  fluorConfig,
  gditConfig,
  clovehitchConfig,
  freeportConfig,
  versarConfig,
  dynamicAviationConfig,
  idsInternationalConfig,
} from "./dossier-companies";
import {
  jacobsConfig,
  baeConfig,
  qinetiqConfig,
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
} from "./stub-companies";

import type { CompanyConfig } from "./types";

const allConfigs: CompanyConfig[] = [
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
  caciConfig,
  fluorConfig,
  gditConfig,
  clovehitchConfig,
  freeportConfig,
  versarConfig,
  dynamicAviationConfig,
  idsInternationalConfig,
  jacobsConfig,
  baeConfig,
  qinetiqConfig,
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
    summary: "Company profile pending.",
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
