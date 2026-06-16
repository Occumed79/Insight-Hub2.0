import type { Company, CompanyProfile, SourceRecord } from "./types";
import { getAllCompanyConfigs } from "../company-configs";

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
  };
}

function configToProfile(config: ReturnType<typeof getAllCompanyConfigs>[number]): CompanyProfile {
  return {
    companyId: config.companyId,
    sections: [{
      id: `${config.companyId}-overview`,
      title: "Overview",
      narrative: config.summary,
      bullets: config.tags.map((tag) => tag),
      metrics: [],
    }],
  };
}

function configToSource(config: ReturnType<typeof getAllCompanyConfigs>[number]): SourceRecord {
  return {
    id: `${config.companyId}-config-source`,
    companyId: config.companyId,
    label: `${config.displayName} intelligence configuration`,
    type: "Manual",
    note: `Company configuration loaded from platform config layer. Sector: ${config.sector}. Headquarters: ${config.headquarters}.`,
  };
}

export function getStubCompanies(): Company[] {
  return getAllCompanyConfigs().map(configToCompany);
}

export function getStubProfiles(): CompanyProfile[] {
  return getAllCompanyConfigs().map(configToProfile);
}

export function getStubSources(): SourceRecord[] {
  return getAllCompanyConfigs().map(configToSource);
}
