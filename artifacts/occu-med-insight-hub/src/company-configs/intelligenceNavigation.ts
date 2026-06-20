import type { Company } from "../data/types";
import type { CompanyConfig } from "./types";
import { resolveConfigCompanyId } from "./configIds";
import type { IntelligenceSourceStatus } from "@/components/insight/IntelligenceStatusBadge";

export const INTELLIGENCE_CATEGORIES = [
  "Portfolio Intelligence",
  "Referral Demand",
  "Provider Network",
  "Network Expansion",
  "Multi-Client Location Intelligence",
  "DBA / Carrier Exposure",
  "Prospect Pipeline",
  "Entity Profiles",
  "Methodology / Data Quality",
  "Temporary Intake",
] as const;

export type IntelligenceCategory = (typeof INTELLIGENCE_CATEGORIES)[number];

const CATEGORY_BY_COMPANY_ID: Record<string, IntelligenceCategory> = {
  "master-portfolio-intelligence": "Portfolio Intelligence",
  "core-client-stats-dashboard": "Portfolio Intelligence",
  "referral-demand-intelligence": "Referral Demand",
  "global-operational-sites-intelligence": "Provider Network",
  "prospect-network-intelligence": "Provider Network",
  "network-expansion-intelligence": "Network Expansion",
  "multi-client-location-intelligence": "Multi-Client Location Intelligence",
  "dba-carrier-network": "DBA / Carrier Exposure",
  "insurance-carrier-mapping": "DBA / Carrier Exposure",
  "v2x-dba-carrier-access": "DBA / Carrier Exposure",
  "amentum-claims-dba-intelligence": "DBA / Carrier Exposure",
  "prospect-pipeline-intelligence": "Prospect Pipeline",
  "perfect-coverage-prospects": "Prospect Pipeline",
  "missing-federal-prospects": "Prospect Pipeline",
  "network-gap-research-intelligence": "Prospect Pipeline",
  "report-methodology-intelligence": "Methodology / Data Quality",
  "uploaded-pdf-fifth-intelligence": "Temporary Intake",
};

export function getIntelligenceCategory(companyId: string): IntelligenceCategory {
  return CATEGORY_BY_COMPANY_ID[resolveConfigCompanyId(companyId)] ?? "Entity Profiles";
}

export type IntelligenceSelectorOption = {
  id: string;
  label: string;
  searchText: string;
  category: IntelligenceCategory;
  sourceStatus: IntelligenceSourceStatus;
};

export function buildIntelligenceSelectorOptions(companies: Company[]): IntelligenceSelectorOption[] {
  return companies
    .map((company) => ({
      id: resolveConfigCompanyId(company.id),
      label: company.name,
      searchText: [company.name, company.shortName, company.sector, ...company.tags].join(" "),
      category: getIntelligenceCategory(company.id),
      sourceStatus: getIntelligenceStatusFromCompany(company),
    }))
    .filter((option, index, all) => all.findIndex((item) => item.id === option.id) === index)
    .sort((a, b) => {
      const categoryDelta = INTELLIGENCE_CATEGORIES.indexOf(a.category) - INTELLIGENCE_CATEGORIES.indexOf(b.category);
      if (categoryDelta !== 0) return categoryDelta;
      return a.label.localeCompare(b.label);
    });
}

function getIntelligenceStatusFromCompany(company: Company): IntelligenceSourceStatus {
  const text = `${company.id} ${company.name} ${company.summary} ${company.tags.join(" ")}`.toLowerCase();
  if (text.includes("temporary") || text.includes("directional")) return "directional";
  if (text.includes("modeled")) return "modeled";
  return "uploaded";
}

export function getIntelligenceStatus(config: CompanyConfig): {
  sourceStatus: IntelligenceSourceStatus;
  lastUpdated?: string;
  dataQualityWarnings: string[];
} {
  const extended = config as CompanyConfig & { sourceStatus?: IntelligenceSourceStatus; lastUpdated?: string; dataQualityWarnings?: string[] };
  const lastUpdated = extended.lastUpdated ?? config.employeesAsOf;
  const dataQualityWarnings = extended.dataQualityWarnings ?? [];
  if (extended.sourceStatus) return { sourceStatus: extended.sourceStatus, lastUpdated, dataQualityWarnings };
  const text = `${config.companyId} ${config.displayName} ${config.summary} ${config.tags.join(" ")} ${config.curveSubtitle ?? ""}`.toLowerCase();
  if (text.includes("temporary") || text.includes("directional")) return { sourceStatus: "directional", lastUpdated, dataQualityWarnings };
  if (text.includes("modeled")) return { sourceStatus: "modeled", lastUpdated, dataQualityWarnings };
  return { sourceStatus: "uploaded", lastUpdated, dataQualityWarnings };
}

export function groupSelectorOptions(options: IntelligenceSelectorOption[]) {
  return INTELLIGENCE_CATEGORIES
    .map((category) => ({ category, options: options.filter((option) => option.category === category) }))
    .filter((group) => group.options.length > 0);
}
