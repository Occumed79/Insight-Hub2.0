import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entityDiscoveryRouter from "./entityDiscovery";
import bulkManualLocationsRouter from "./bulkManualLocations";
import intelligenceRouter from "./intelligence";
import onetRouter from "./onet";
import employerIntelligenceRouter from "./employer-intelligence";
import companyLiveIntelligenceRouter from "./company-live-intelligence";
import workersCompCoverageRouter from "./workers-comp-coverage";
import dbaIntelligenceRouter from "./dba-intelligence";
import sourceGovernanceRouter from "./source-governance";
import dataVisualizationRouter from "./dataVisualization";
import portalLinksRouter from "./portalLinks";
import secFilingsRouter from "./sec-filings";
import hiringIntelligenceRouter from "./hiring-intelligence";
import leadershipMapRouter from "./leadership-map";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entityDiscoveryRouter);
router.use(bulkManualLocationsRouter);
router.use(intelligenceRouter);
router.use(onetRouter);
router.use(employerIntelligenceRouter);
router.use(companyLiveIntelligenceRouter);
router.use(workersCompCoverageRouter);
router.use(dbaIntelligenceRouter);
router.use(sourceGovernanceRouter);
router.use(dataVisualizationRouter);
router.use(portalLinksRouter);
router.use(secFilingsRouter);
router.use(hiringIntelligenceRouter);
router.use(leadershipMapRouter);

export default router;
