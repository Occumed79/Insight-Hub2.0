import { useEffect, useMemo, useState } from "react";
import { loadInsightDataset } from "./ingestion";
import { seedDataset } from "./seed";
import type { Company, InsightDataset } from "./types";
import { caciCompanies, caciLocations, caciMetrics, caciProfiles, caciReports, caciSources } from "./caciDossier";
import { clovehitchCompanies, clovehitchLocations, clovehitchMetrics, clovehitchProfiles, clovehitchReports, clovehitchSources } from "./clovehitchDossier";
import { constellisCompanies, constellisLocations, constellisMetrics, constellisProfiles, constellisReports, constellisSources } from "./constellisDossier";
import { fluorCompanies, fluorLocations, fluorMetrics, fluorProfiles, fluorReports, fluorSources } from "./fluorDossier";
import { freeportWeatherfordCompanies, freeportWeatherfordLocations, freeportWeatherfordMetrics, freeportWeatherfordProfiles, freeportWeatherfordReports, freeportWeatherfordSources } from "./freeportWeatherfordDossier";
import { gditCompanies, gditLocations, gditMetrics, gditProfiles, gditReports, gditSources } from "./gditDossier";
import { iapCompanies, iapLocations, iapMetrics, iapProfiles, iapReports, iapSources } from "./iapDossier";
import { idsInternationalCompanies, idsInternationalLocations, idsInternationalMetrics, idsInternationalProfiles, idsInternationalReports, idsInternationalSources } from "./idsInternationalDossier";
import { peratonCompanies, peratonLocations, peratonMetrics, peratonProfiles, peratonReports, peratonSources } from "./peratonDossier";
import { valiantCompanies, valiantLocations, valiantMetrics, valiantProfiles, valiantReports, valiantSources } from "./valiantDossier";
import { versarGlobalSolutionsCompanies, versarGlobalSolutionsLocations, versarGlobalSolutionsMetrics, versarGlobalSolutionsProfiles, versarGlobalSolutionsReports, versarGlobalSolutionsSources } from "./versarGlobalSolutionsDossier";
import { v2xVisualLocations, v2xVisualMetrics, v2xVisualReports, v2xVisualSources } from "./v2xVisualDossier";
import { mergeVisualDossiers, visualCompanies, visualLocations, visualMetrics, visualProfiles, visualReports, visualSources } from "./visualDossiers";
import { uploadedReportCompanies, uploadedReportLocations, uploadedReportMetrics, uploadedReportProfiles, uploadedReportReports, uploadedReportSources } from "./uploadedReportDossiers";
import { getStubCompanies, getStubProfiles, getStubSources } from "./stubCompanies";

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

  const dossierLayers: Array<{
    companies: Company[];
    profiles: InsightDataset["profiles"];
    metrics: InsightDataset["metrics"];
    locations: InsightDataset["locations"];
    sources: InsightDataset["sources"];
    reports: InsightDataset["reports"];
  }> = [
    { companies: valiantCompanies, profiles: valiantProfiles, metrics: valiantMetrics, locations: valiantLocations, sources: valiantSources, reports: valiantReports },
    { companies: iapCompanies, profiles: iapProfiles, metrics: iapMetrics, locations: iapLocations, sources: iapSources, reports: iapReports },
    { companies: constellisCompanies, profiles: constellisProfiles, metrics: constellisMetrics, locations: constellisLocations, sources: constellisSources, reports: constellisReports },
    { companies: caciCompanies, profiles: caciProfiles, metrics: caciMetrics, locations: caciLocations, sources: caciSources, reports: caciReports },
    { companies: clovehitchCompanies, profiles: clovehitchProfiles, metrics: clovehitchMetrics, locations: clovehitchLocations, sources: clovehitchSources, reports: clovehitchReports },
    { companies: peratonCompanies, profiles: peratonProfiles, metrics: peratonMetrics, locations: peratonLocations, sources: peratonSources, reports: peratonReports },
    { companies: gditCompanies, profiles: gditProfiles, metrics: gditMetrics, locations: gditLocations, sources: gditSources, reports: gditReports },
    { companies: freeportWeatherfordCompanies, profiles: freeportWeatherfordProfiles, metrics: freeportWeatherfordMetrics, locations: freeportWeatherfordLocations, sources: freeportWeatherfordSources, reports: freeportWeatherfordReports },
    { companies: fluorCompanies, profiles: fluorProfiles, metrics: fluorMetrics, locations: fluorLocations, sources: fluorSources, reports: fluorReports },
    { companies: idsInternationalCompanies, profiles: idsInternationalProfiles, metrics: idsInternationalMetrics, locations: idsInternationalLocations, sources: idsInternationalSources, reports: idsInternationalReports },
    { companies: versarGlobalSolutionsCompanies, profiles: versarGlobalSolutionsProfiles, metrics: versarGlobalSolutionsMetrics, locations: versarGlobalSolutionsLocations, sources: versarGlobalSolutionsSources, reports: versarGlobalSolutionsReports },
  ];

  let result = withCoreVisuals;
  for (const layer of dossierLayers) {
    result = {
      ...result,
      companies: mergeVisualDossiers(result.companies, layer.companies),
      profiles: mergeVisualDossiers(result.profiles, layer.profiles),
      metrics: mergeVisualDossiers(result.metrics, layer.metrics),
      locations: mergeVisualDossiers(result.locations, layer.locations),
      sources: mergeVisualDossiers(result.sources, layer.sources),
      reports: mergeVisualDossiers(result.reports, layer.reports),
    };
  }
  return result;
}

function withUploadedReportDossiers(dataset: InsightDataset): InsightDataset {
  const replacementCompanyIds = new Set(uploadedReportCompanies.map((company) => company.id));
  return {
    ...dataset,
    companies: [...dataset.companies.filter((company) => !replacementCompanyIds.has(company.id)), ...uploadedReportCompanies],
    profiles: [...dataset.profiles.filter((profile) => !replacementCompanyIds.has(profile.companyId)), ...uploadedReportProfiles],
    metrics: [...dataset.metrics.filter((metric) => !replacementCompanyIds.has(metric.companyId)), ...uploadedReportMetrics],
    locations: [...dataset.locations.filter((location) => !replacementCompanyIds.has(location.companyId)), ...uploadedReportLocations],
    sources: [...dataset.sources.filter((source) => !replacementCompanyIds.has(source.companyId)), ...uploadedReportSources],
    reports: [...dataset.reports.filter((report) => !replacementCompanyIds.has(report.companyId)), ...uploadedReportReports],
  };
}

function withStubCompanies(dataset: InsightDataset): InsightDataset {
  const existingIds = new Set(dataset.companies.map((c) => c.id));
  const stubs = getStubCompanies().filter((c) => !existingIds.has(c.id));
  const stubIds = new Set(stubs.map((c) => c.id));
  const stubProfiles = getStubProfiles().filter((p) => stubIds.has(p.companyId));
  const stubSources = getStubSources().filter((s) => stubIds.has(s.companyId));
  return {
    ...dataset,
    companies: [...dataset.companies, ...stubs],
    profiles: [...dataset.profiles, ...stubProfiles],
    sources: [...dataset.sources, ...stubSources],
  };
}

function buildDataset(dataset: InsightDataset): InsightDataset {
  return withStubCompanies(withUploadedReportDossiers(withVisualDossiers(dataset)));
}

export function useInsightData() {
  const [dataset, setDataset] = useState<InsightDataset>(buildDataset(seedDataset));
  useEffect(() => {
    let active = true;
    loadInsightDataset().then((loaded) => {
      if (active) setDataset(buildDataset(loaded));
    });
    return () => { active = false; };
  }, []);
  const companies = useMemo<Company[]>(() => dataset.companies, [dataset]);
  return { dataset, companies };
}

export function useSelectedCompany(companies: Company[]) {
  const getDefaultCompanyId = () => companies.find((item) => item.id === "v2x")?.id || companies[0]?.id || "";
  const [companyId, setCompanyId] = useState<string>(() => getDefaultCompanyId());

  useEffect(() => {
    if (!companies.some((item) => item.id === companyId)) {
      setCompanyId(getDefaultCompanyId());
    }
  }, [companies, companyId]);

  const company = useMemo(() => companies.find((item) => item.id === companyId) || companies[0], [companies, companyId]);

  return { companyId, setCompanyId, company };
}
