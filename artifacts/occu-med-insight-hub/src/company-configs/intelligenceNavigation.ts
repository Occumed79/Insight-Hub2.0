import type { Company } from "../data/types";
import type { CompanyConfig, IntelligenceSourceStatus } from "./types";
import { resolveConfigCompanyId } from "./configIds";
import { getAllCompanyConfigs, getCompanyConfigById } from "./registeredConfigs";

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

const DUPLICATE_SEED_IDS = new Set(["caci-international-inc", "fluor-corporation"]);

export function getIntelligenceCategory(companyId: string): IntelligenceCategory {
  const resolvedId = resolveConfigCompanyId(companyId);
  return CATEGORY_BY_COMPANY_ID[resolvedId] ?? "Entity Profiles";
}

export function companyFromConfig(config: CompanyConfig): Company {
  return {
    id: config.companyId,
    name: config.displayName,
    shortName: config.shortName,
    sector: config.sector,
    headquarters: config.headquarters,
    employees: config.employees,
    employeesAsOf: config.employeesAsOf,
    summary: config.summary,
    tags: config.tags,
  };
}

export function buildIntelligenceEntities(companies: Company[]): Company[] {
  const byId = new Map<string, Company>();

  for (const company of companies) {
    if (DUPLICATE_SEED_IDS.has(company.id)) continue;
    const resolvedId = resolveConfigCompanyId(company.id);
    const existing = byId.get(resolvedId);
    if (!existing || company.tags.length > existing.tags.length) {
      byId.set(resolvedId, resolvedId === company.id ? company : { ...company, id: resolvedId });
    }
  }

  for (const config of getAllCompanyConfigs()) {
    if (!byId.has(config.companyId)) {
      byId.set(config.companyId, companyFromConfig(config));
    }
  }

  return [...byId.values()];
}

export type IntelligenceSelectorOption = {
  id: string;
  label: string;
  searchText: string;
  category: IntelligenceCategory;
  sourceStatus: IntelligenceSourceStatus;
};

export function buildIntelligenceSelectorOptions(companies: Company[]): IntelligenceSelectorOption[] {
  return buildIntelligenceEntities(companies)
    .map((company) => {
      const config = getCompanyConfigById(company.id);
      const label = config?.displayName ?? company.name;
      return {
        id: company.id,
        label,
        searchText: [label, company.shortName, company.sector, ...(config?.aliases ?? []), ...(config?.tags ?? [])].join(" "),
        category: getIntelligenceCategory(company.id),
        sourceStatus: getIntelligenceStatus(config ?? getCompanyConfigOrDefaultShell(company)).sourceStatus,
      };
    })
    .sort((a, b) => {
      const categoryDelta = INTELLIGENCE_CATEGORIES.indexOf(a.category) - INTELLIGENCE_CATEGORIES.indexOf(b.category);
      if (categoryDelta !== 0) return categoryDelta;
      return a.label.localeCompare(b.label);
    });
}

function getCompanyConfigOrDefaultShell(company: Company): CompanyConfig {
  return {
    companyId: company.id,
    displayName: company.name,
    shortName: company.shortName,
    sector: company.sector,
    headquarters: company.headquarters,
    employees: company.employees,
    employeesAsOf: company.employeesAsOf,
    summary: company.summary,
    tags: company.tags,
    executiveSignals: [],
    chartDefinitions: [],
  };
}

export function getIntelligenceStatus(config: CompanyConfig): {
  sourceStatus: IntelligenceSourceStatus;
  lastUpdated?: string;
  dataQualityWarnings: string[];
} {
  if (config.sourceStatus) {
    return {
      sourceStatus: config.sourceStatus,
      lastUpdated: config.lastUpdated,
      dataQualityWarnings: config.dataQualityWarnings ?? [],
    };
  }

  const warnings = config.dataQualityWarnings ?? [];
  const lastUpdated = config.lastUpdated ?? config.employeesAsOf;

  if (config.companyId === "uploaded-pdf-fifth-intelligence") {
    return { sourceStatus: "directional", lastUpdated, dataQualityWarnings: warnings };
  }
  if (config.companyId === "report-methodology-intelligence") {
    return { sourceStatus: "uploaded", lastUpdated, dataQualityWarnings: warnings };
  }
  if (config.companyId.endsWith("-intelligence") || config.companyId.endsWith("-dashboard") || config.companyId.includes("-prospects")) {
    return { sourceStatus: "uploaded", lastUpdated, dataQualityWarnings: warnings };
  }
  if (config.summary.toLowerCase().includes("modeled") || config.curveSubtitle?.toLowerCase().includes("modeled")) {
    return { sourceStatus: "modeled", lastUpdated, dataQualityWarnings: warnings };
  }

  return { sourceStatus: "uploaded", lastUpdated, dataQualityWarnings: warnings };
}

export function groupSelectorOptions(options: IntelligenceSelectorOption[]) {
  const groups = new Map<IntelligenceCategory, IntelligenceSelectorOption[]>();
  for (const category of INTELLIGENCE_CATEGORIES) {
    groups.set(category, []);
  }
  for (const option of options) {
    groups.get(option.category)?.push(option);
  }
  return INTELLIGENCE_CATEGORIES.map((category) => ({
    category,
    options: groups.get(category) ?? [],
  })).filter((group) => group.options.length > 0);
}
