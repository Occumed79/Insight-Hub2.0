import { seedDataset } from "../../../occu-med-insight-hub/src/data/seed";
import type { Company, InsightDataset } from "../../../occu-med-insight-hub/src/data/types";

export function getInsightDataset(): InsightDataset {
  return seedDataset;
}

export function getCompanyById(companyId: string): Company | undefined {
  return seedDataset.companies.find((company) => company.id === companyId);
}
