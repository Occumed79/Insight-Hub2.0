import type { Company, CompanyProfile, Metric, SourceRecord } from "./types";
import { getAllCompanyConfigs, getConfigEntityType } from "../company-configs";

function configToCompany(config: ReturnType<typeof getAllCompanyConfigs>[number]): Company {
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
    entityType: getConfigEntityType(config.companyId),
  };
}

function configToProfile(config: ReturnType<typeof getAllCompanyConfigs>[number]): CompanyProfile {
  if (config.dossierSections && config.dossierSections.length > 0) {
    return {
      companyId: config.companyId,
      sections: config.dossierSections.map((section, index) => ({
        id: config.companyId + "-" + section.type + "-" + index,
        title: section.title,
        narrative: section.narrative,
        bullets: section.bullets,
        metrics: section.metricIds,
      })),
    };
  }

  return {
    companyId: config.companyId,
    sections: [{
      id: config.companyId + "-overview",
      title: "Overview",
      narrative: config.summary,
      bullets: config.tags.map((tag) => tag),
      metrics: [],
    }],
  };
}

function configToMetrics(config: ReturnType<typeof getAllCompanyConfigs>[number]): Metric[] {
  return (config.metricDefinitions || []).map((metric) => ({ ...metric, companyId: config.companyId, status: "modeled" }));
}

function configToSource(config: ReturnType<typeof getAllCompanyConfigs>[number]): SourceRecord {
  return {
    id: config.companyId + "-config-source",
    companyId: config.companyId,
    label: config.displayName + " configuration",
    type: "Manual",
    note: "Configuration loaded from the platform config layer.",
  };
}

export function getStubCompanies(): Company[] {
  return getAllCompanyConfigs().map(configToCompany);
}

export function getStubProfiles(): CompanyProfile[] {
  return getAllCompanyConfigs().map(configToProfile);
}

export function getStubMetrics(): Metric[] {
  return getAllCompanyConfigs().flatMap(configToMetrics);
}

export function getStubSources(): SourceRecord[] {
  return getAllCompanyConfigs().map(configToSource);
}
