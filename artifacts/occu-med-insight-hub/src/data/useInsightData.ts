import { useEffect, useMemo, useState } from "react";
import { loadInsightDataset } from "./ingestion";
import { seedDataset } from "./seed";
import type { Company, InsightDataset } from "./types";
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

  const withClovehitch = {
    ...withConstellis,
    companies: mergeVisualDossiers(withConstellis.companies, clovehitchCompanies),
    profiles: mergeVisualDossiers(withConstellis.profiles, clovehitchProfiles),
    metrics: mergeVisualDossiers(withConstellis.metrics, clovehitchMetrics),
    locations: mergeVisualDossiers(withConstellis.locations, clovehitchLocations),
    sources: mergeVisualDossiers(withConstellis.sources, clovehitchSources),
    reports: mergeVisualDossiers(withConstellis.reports, clovehitchReports),
  };

  const withPeraton = {
    ...withClovehitch,
    companies: mergeVisualDossiers(withClovehitch.companies, peratonCompanies),
    profiles: mergeVisualDossiers(withClovehitch.profiles, peratonProfiles),
    metrics: mergeVisualDossiers(withClovehitch.metrics, peratonMetrics),
    locations: mergeVisualDossiers(withClovehitch.locations, peratonLocations),
    sources: mergeVisualDossiers(withClovehitch.sources, peratonSources),
    reports: mergeVisualDossiers(withClovehitch.reports, peratonReports),
  };

  const withGdit = {
    ...withPeraton,
    companies: mergeVisualDossiers(withPeraton.companies, gditCompanies),
    profiles: mergeVisualDossiers(withPeraton.profiles, gditProfiles),
    metrics: mergeVisualDossiers(withPeraton.metrics, gditMetrics),
    locations: mergeVisualDossiers(withPeraton.locations, gditLocations),
    sources: mergeVisualDossiers(withPeraton.sources, gditSources),
    reports: mergeVisualDossiers(withPeraton.reports, gditReports),
  };

  const withFreeportWeatherford = {
    ...withGdit,
    companies: mergeVisualDossiers(withGdit.companies, freeportWeatherfordCompanies),
    profiles: mergeVisualDossiers(withGdit.profiles, freeportWeatherfordProfiles),
    metrics: mergeVisualDossiers(withGdit.metrics, freeportWeatherfordMetrics),
    locations: mergeVisualDossiers(withGdit.locations, freeportWeatherfordLocations),
    sources: mergeVisualDossiers(withGdit.sources, freeportWeatherfordSources),
    reports: mergeVisualDossiers(withGdit.reports, freeportWeatherfordReports),
  };

  const withFluor = {
    ...withFreeportWeatherford,
    companies: mergeVisualDossiers(withFreeportWeatherford.companies, fluorCompanies),
    profiles: mergeVisualDossiers(withFreeportWeatherford.profiles, fluorProfiles),
    metrics: mergeVisualDossiers(withFreeportWeatherford.metrics, fluorMetrics),
    locations: mergeVisualDossiers(withFreeportWeatherford.locations, fluorLocations),
    sources: mergeVisualDossiers(withFreeportWeatherford.sources, fluorSources),
    reports: mergeVisualDossiers(withFreeportWeatherford.reports, fluorReports),
  };

  const withIdsInternational = {
    ...withFluor,
    companies: mergeVisualDossiers(withFluor.companies, idsInternationalCompanies),
    profiles: mergeVisualDossiers(withFluor.profiles, idsInternationalProfiles),
    metrics: mergeVisualDossiers(withFluor.metrics, idsInternationalMetrics),
    locations: mergeVisualDossiers(withFluor.locations, idsInternationalLocations),
    sources: mergeVisualDossiers(withFluor.sources, idsInternationalSources),
    reports: mergeVisualDossiers(withFluor.reports, idsInternationalReports),
  };

  return {
    ...withIdsInternational,
    companies: mergeVisualDossiers(withIdsInternational.companies, versarGlobalSolutionsCompanies),
    profiles: mergeVisualDossiers(withIdsInternational.profiles, versarGlobalSolutionsProfiles),
    metrics: mergeVisualDossiers(withIdsInternational.metrics, versarGlobalSolutionsMetrics),
    locations: mergeVisualDossiers(withIdsInternational.locations, versarGlobalSolutionsLocations),
    sources: mergeVisualDossiers(withIdsInternational.sources, versarGlobalSolutionsSources),
    reports: mergeVisualDossiers(withIdsInternational.reports, versarGlobalSolutionsReports),
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

  const companies = useMemo<Company[]>(() => dataset.companies, [dataset]);
  return { dataset, companies };
}
