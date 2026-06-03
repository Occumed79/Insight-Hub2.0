import { useEffect, useMemo, useState } from "react";
import { loadInsightDataset } from "./ingestion";
import { seedDataset } from "./seed";
import type { Company, InsightDataset } from "./types";
import { mergeVisualDossiers, visualCompanies, visualLocations, visualMetrics, visualProfiles, visualReports, visualSources } from "./visualDossiers";

function withVisualDossiers(dataset: InsightDataset): InsightDataset {
  return {
    ...dataset,
    companies: mergeVisualDossiers(dataset.companies, visualCompanies),
    profiles: mergeVisualDossiers(dataset.profiles, visualProfiles),
    metrics: mergeVisualDossiers(dataset.metrics, visualMetrics),
    locations: mergeVisualDossiers(dataset.locations, visualLocations),
    sources: mergeVisualDossiers(dataset.sources, visualSources),
    reports: mergeVisualDossiers(dataset.reports, visualReports),
  };
}

export function useInsightData() {
  const [dataset, setDataset] = useState<InsightDataset>(withVisualDossiers(seedDataset));
  useEffect(() => {
    let active = true;
    loadInsightDataset().then((loaded) => {
      if (active) setDataset(withVisualDossiers(loaded));
    });
    return () => {
      active = false;
    };
  }, []);
  const defaultCompany = useMemo(() => dataset.companies.find((company) => company.id === "v2x") || dataset.companies[0], [dataset.companies]);
  return { dataset, defaultCompany };
}

export function useSelectedCompany(companies: Company[], defaultId = "v2x") {
  const [companyId, setCompanyId] = useState(defaultId);
  const company = companies.find((item) => item.id === companyId) || companies[0];
  return { companyId: company?.id || defaultId, setCompanyId, company };
}
