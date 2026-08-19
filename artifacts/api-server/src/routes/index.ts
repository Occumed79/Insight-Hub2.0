import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aorSourcePolicyRouter from "./aor-source-policy";
import stateMapGeometryRouter from "./state-map-geometry";
import coreLiveSearchRouter from "./core-live-search";
import fmcsaRouter from "./fmcsa";
import coreIntelligenceRouter from "./core-intelligence";
import locationDiscoveryCacheRouter from "./locationDiscoveryCache";
import entityDiscoveryRouter from "./entityDiscovery";
import locationsCerebrasV2Router from "./locations-cerebras-v2";
import locationsAiRouter from "./locations-ai";
import bulkManualLocationsRouter from "./bulkManualLocations";
import intelligenceRouter from "./intelligence";
import publicApiRepairsRouter from "./public-api-repairs";
import employerIntelligenceRouter from "./employer-intelligence";
import companyLiveIntelligenceRouter from "./company-live-intelligence";
import courtlistenerRichRouter from "./courtlistener-rich";
import crisiswatchRouter from "./crisiswatch";
import aorRiskIntelligenceRouter from "./aor-risk-intelligence";
import aorProductionRepairRouter from "./aor-production-repair";
import aorTravelHealthRouter from "./aor-travel-health";
import workersCompCoverageRouter from "./workers-comp-coverage";
import dbaIntelligenceRouter from "./dba-intelligence";
import dbaHubRouter from "./dba-hub";
import sourceGovernanceRouter from "./source-governance";
import dataVisualizationRouter from "./dataVisualization";
import portalLinksRouter from "./portalLinks";
import secFilingsRouter from "./sec-filings";
import hiringIntelligenceRouter from "./hiring-intelligence";
import leadershipMapManualSnapshotsRouter from "./leadership-map-manual-snapshots";
import leadershipMapQualityRouter from "./leadership-map-quality";
import leadershipMapCerebrasV2Router from "./leadership-map-cerebras-v2";
import leadershipMapLangSearchRouter from "./leadership-map-langsearch";
import leadershipMapOrchestrationRouter from "./leadership-map-orchestration";
import corporateStructureRouter from "./corporate-structure";
import occupationalToolsRouter from "./occupational-tools";
import occupationalDiscoveryRouter from "./occupational-discovery";
import occupationalCaseDetailRouter from "./occupational-case-detail";
import occupationalBlsHistoryRouter from "./occupational-bls-history";
import occupationalDatagovWorkbenchRouter from "./occupational-datagov-workbench";
import occupationalOnetDatabaseRouter from "./occupational-onet-database";
import occupationalSourceBrowserRouter from "./occupational-source-browser";
import officialSourceWebviewRouter from "./official-source-webview";
import reviewerToolsRouter from "./reviewer-tools";
import drugIntelligenceRouter from "./drug-intelligence";
import jobIntelligenceRouter from "./job-intelligence";
import standardsIntelligenceRouter from "./standards-intelligence";

const router: IRouter = Router();

[
  healthRouter,
  aorSourcePolicyRouter,
  stateMapGeometryRouter,
  coreLiveSearchRouter,
  fmcsaRouter,
  coreIntelligenceRouter,
  locationDiscoveryCacheRouter,
  entityDiscoveryRouter,
  locationsCerebrasV2Router,
  locationsAiRouter,
  bulkManualLocationsRouter,
  intelligenceRouter,
  publicApiRepairsRouter,
  employerIntelligenceRouter,
  companyLiveIntelligenceRouter,
  courtlistenerRichRouter,
  crisiswatchRouter,
  aorTravelHealthRouter,
  aorProductionRepairRouter,
  aorRiskIntelligenceRouter,
  reviewerToolsRouter,
  standardsIntelligenceRouter,
  drugIntelligenceRouter,
  workersCompCoverageRouter,
  dbaIntelligenceRouter,
].forEach((child) => router.use(child));

router.use("/dba/hub", (_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      delete (body as Record<string, unknown>).warning;
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
});

[
  dbaHubRouter,
  sourceGovernanceRouter,
  dataVisualizationRouter,
  portalLinksRouter,
  secFilingsRouter,
  hiringIntelligenceRouter,
  leadershipMapManualSnapshotsRouter,
  leadershipMapQualityRouter,
  leadershipMapCerebrasV2Router,
  leadershipMapLangSearchRouter,
  leadershipMapOrchestrationRouter,
  corporateStructureRouter,
  occupationalToolsRouter,
  occupationalDiscoveryRouter,
  occupationalCaseDetailRouter,
  occupationalBlsHistoryRouter,
  occupationalDatagovWorkbenchRouter,
  occupationalOnetDatabaseRouter,
  occupationalSourceBrowserRouter,
  jobIntelligenceRouter,
  officialSourceWebviewRouter,
].forEach((child) => router.use(child));

export default router;