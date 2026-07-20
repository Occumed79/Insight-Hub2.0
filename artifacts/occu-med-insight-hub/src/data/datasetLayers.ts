import { seedDataset } from "./seed";
import type { InsightDataset } from "./types";
import { assembleCanonicalDataset, type InsightDatasetLayer } from "./canonicalDataset";
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
import { visualCompanies, visualLocations, visualMetrics, visualProfiles, visualReports, visualSources } from "./visualDossiers";
import { uploadedReportCompanies, uploadedReportLocations, uploadedReportMetrics, uploadedReportProfiles, uploadedReportReports, uploadedReportSources } from "./uploadedReportDossiers";
import { getStubCompanies, getStubMetrics, getStubProfiles, getStubSources } from "./stubCompanies";

const seedLayer: InsightDatasetLayer = { name: "seed", priority: 0, data: seedDataset };
const configurationLayer: InsightDatasetLayer = {
  name: "configuration-registry",
  priority: 10,
  data: {
    companies: getStubCompanies(),
    profiles: getStubProfiles(),
    metrics: getStubMetrics(),
    sources: getStubSources(),
  },
};

const curatedDossierLayers: InsightDatasetLayer[] = [
  { name: "v2x-visual-dossier", priority: 30, data: { metrics: v2xVisualMetrics, locations: v2xVisualLocations, sources: v2xVisualSources, reports: v2xVisualReports } },
  { name: "core-visual-dossiers", priority: 31, data: { companies: visualCompanies, profiles: visualProfiles, metrics: visualMetrics, locations: visualLocations, sources: visualSources, reports: visualReports } },
  { name: "valiant-dossier", priority: 32, data: { companies: valiantCompanies, profiles: valiantProfiles, metrics: valiantMetrics, locations: valiantLocations, sources: valiantSources, reports: valiantReports } },
  { name: "iap-dossier", priority: 32, data: { companies: iapCompanies, profiles: iapProfiles, metrics: iapMetrics, locations: iapLocations, sources: iapSources, reports: iapReports } },
  { name: "constellis-dossier", priority: 32, data: { companies: constellisCompanies, profiles: constellisProfiles, metrics: constellisMetrics, locations: constellisLocations, sources: constellisSources, reports: constellisReports } },
  { name: "caci-dossier", priority: 32, data: { companies: caciCompanies, profiles: caciProfiles, metrics: caciMetrics, locations: caciLocations, sources: caciSources, reports: caciReports } },
  { name: "clovehitch-dossier", priority: 32, data: { companies: clovehitchCompanies, profiles: clovehitchProfiles, metrics: clovehitchMetrics, locations: clovehitchLocations, sources: clovehitchSources, reports: clovehitchReports } },
  { name: "peraton-dossier", priority: 32, data: { companies: peratonCompanies, profiles: peratonProfiles, metrics: peratonMetrics, locations: peratonLocations, sources: peratonSources, reports: peratonReports } },
  { name: "gdit-dossier", priority: 32, data: { companies: gditCompanies, profiles: gditProfiles, metrics: gditMetrics, locations: gditLocations, sources: gditSources, reports: gditReports } },
  { name: "freeport-weatherford-dossier", priority: 32, data: { companies: freeportWeatherfordCompanies, profiles: freeportWeatherfordProfiles, metrics: freeportWeatherfordMetrics, locations: freeportWeatherfordLocations, sources: freeportWeatherfordSources, reports: freeportWeatherfordReports } },
  { name: "fluor-dossier", priority: 32, data: { companies: fluorCompanies, profiles: fluorProfiles, metrics: fluorMetrics, locations: fluorLocations, sources: fluorSources, reports: fluorReports } },
  { name: "ids-international-dossier", priority: 32, data: { companies: idsInternationalCompanies, profiles: idsInternationalProfiles, metrics: idsInternationalMetrics, locations: idsInternationalLocations, sources: idsInternationalSources, reports: idsInternationalReports } },
  { name: "versar-global-solutions-dossier", priority: 32, data: { companies: versarGlobalSolutionsCompanies, profiles: versarGlobalSolutionsProfiles, metrics: versarGlobalSolutionsMetrics, locations: versarGlobalSolutionsLocations, sources: versarGlobalSolutionsSources, reports: versarGlobalSolutionsReports } },
  {
    name: "uploaded-report-dossiers",
    priority: 40,
    replaceCompanyIds: uploadedReportCompanies.map((company) => company.id),
    data: {
      companies: uploadedReportCompanies,
      profiles: uploadedReportProfiles,
      metrics: uploadedReportMetrics,
      locations: uploadedReportLocations,
      sources: uploadedReportSources,
      reports: uploadedReportReports,
    },
  },
];

export function buildCanonicalDataset(workbookDataset?: InsightDataset): InsightDataset {
  const workbookLayer: InsightDatasetLayer[] = workbookDataset
    ? [{ name: "uploaded-workbooks", priority: 20, data: workbookDataset }]
    : [];
  return assembleCanonicalDataset([seedLayer, configurationLayer, ...workbookLayer, ...curatedDossierLayers]);
}
