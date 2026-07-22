import type { Company } from "../data/types";
import type { CompanyConfig } from "./types";
import { resolveConfigCompanyId } from "./configIds";
import type { IntelligenceSourceStatus } from "@/components/insight/IntelligenceStatusBadge";

export const INTELLIGENCE_CATEGORIES = ["Runtime Intelligence"] as const;
export type IntelligenceCategory = (typeof INTELLIGENCE_CATEGORIES)[number];

export function getIntelligenceCategory(_companyId: string): IntelligenceCategory {
  return "Runtime Intelligence";
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
      category: "Runtime Intelligence" as const,
      sourceStatus: "uploaded" as IntelligenceSourceStatus,
    }))
    .filter((option, index, all) => all.findIndex((item) => item.id === option.id) === index)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getIntelligenceStatus(config: CompanyConfig): {
  sourceStatus: IntelligenceSourceStatus;
  lastUpdated?: string;
  dataQualityWarnings: string[];
} {
  const extended = config as CompanyConfig & {
    sourceStatus?: IntelligenceSourceStatus;
    lastUpdated?: string;
    dataQualityWarnings?: string[];
  };

  return {
    sourceStatus: extended.sourceStatus ?? "directional",
    lastUpdated: extended.lastUpdated,
    dataQualityWarnings: extended.dataQualityWarnings ?? [],
  };
}

export function groupSelectorOptions(options: IntelligenceSelectorOption[]) {
  return options.length > 0 ? [{ category: "Runtime Intelligence" as const, options }] : [];
}
