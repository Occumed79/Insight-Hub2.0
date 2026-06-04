import { useEffect, useMemo, useState } from "react";
import { loadInsightDataset } from "./ingestion";
import { seedDataset } from "./seed";
import type { Company, InsightDataset } from "./types";
import { constellisCompanies, constellisLocations, constellisMetrics, constellisProfiles, constellisReports, constellisSources } from "./constellisDossier";
import { iapCompanies, iapLocations, iapMetrics, iapProfiles, iapReports, iapSources } from "./iapDossier";
import { peratonCompanies, peratonLocations, peratonMetrics, peratonProfiles, peratonReports, peratonSources } from "./peratonDossier";
import { valiantCompanies, valiantLocations, valiantMetrics, valiantProfiles, valiantReports, valiantSources } from "./valiantDossier";
import { v2xVisualLocations, v2xVisualMetrics, v2xVisualReports, v2xVisualSources } from "./v2xVisualDossier";
import { mergeVisualDossiers, visualCompanies, visualLocations, visualMetrics, visualProfiles, visualReports, visualSources } from "./visualDossiers";

function withVisualDossiers(dataset: InsightDataset): InsightDataset {
  const withV2xVisuals = {
    ...dataset,
    metrics: mergeVisualDossiers(dataset.metrics, v2xVisualMetrics),
    locations: mergeVisualDossiers(dataset.locations, v2xVisualLocations),
    sources: mergeVisualDossiers(dataset.sources, v2xVisualSources),
    reports: mergeVisualDossiers(dataset.reports, v2xVisualReports),
  };

  const withCoreVisuals = {
    ...withV2xVisuals,
    companies: mergeVisualDossiers(withV2xVisuals.companies, visualCompanies),
    profiles: mergeVisualDossiers(withV2xVisuals.profiles, visualProfiles),
    metrics: mergeVisualDossiers(withV2xVisuals.metrics, visualMetrics),
    locations: mergeVisualDossiers(withV2xVisuals.locations, visualLocations),
    sources: mergeVisualDossiers(withV2xVisuals.sources, visualSources),
    reports: mergeVisualDossiers(withV2xVisuals.reports, visualReports),
  };

  const withValiant = {
    ...withCoreVisuals,
    companies: mergeVisualDossiers(withCoreVisuals.companies, valiantCompanies),
    profiles: mergeVisualDossiers(withCoreVisuals.profiles, valiantProfiles),
    metrics: mergeVisualDossiers(withCoreVisuals.metrics, valiantMetrics),
    locations: mergeVisualDossiers(withCoreVisuals.locations, valiantLocations),
    sources: mergeVisualDossiers(withCoreVisuals.sources, valiantSources),
    reports: mergeVisualDossiers(withCoreVisuals.reports, valiantReports),
  };

  const withIap = {
    ...withValiant,
    companies: mergeVisualDossiers(withValiant.companies, iapCompanies),
    profiles: mergeVisualDossiers(withValiant.profiles, iapProfiles),
    metrics: mergeVisualDossiers(withValiant.metrics, iapMetrics),
    locations: mergeVisualDossiers(withValiant.locations, iapLocations),
    sources: mergeVisualDossiers(withValiant.sources, iapSources),
    reports: mergeVisualDossiers(withValiant.reports, iapReports),
  };

  const withConstellis = {
    ...withIap,
    companies: mergeVisualDossiers(withIap.companies, constellisCompanies),
    profiles: mergeVisualDossiers(withIap.profiles, constellisProfiles),
    metrics: mergeVisualDossiers(withIap.metrics, constellisMetrics),
    locations: mergeVisualDossiers(withIap.locations, constellisLocations),
    sources: mergeVisualDossiers(withIap.sources, constellisSources),
    reports: mergeVisualDossiers(withIap.reports, constellisReports),
  };

  return {
    ...withConstellis,
    companies: mergeVisualDossiers(withConstellis.companies, peratonCompanies),
    profiles: mergeVisualDossiers(withConstellis.profiles, peratonProfiles),
    metrics: mergeVisualDossiers(withConstellis.metrics, peratonMetrics),
    locations: mergeVisualDossiers(withConstellis.locations, peratonLocations),
    sources: mergeVisualDossiers(withConstellis.sources, peratonSources),
    reports: mergeVisualDossiers(withConstellis.reports, peratonReports),
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
