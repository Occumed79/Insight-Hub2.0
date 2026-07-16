import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entityDiscoveryRouter from "./entityDiscovery";
import bulkManualLocationsRouter from "./bulkManualLocations";
import intelligenceRouter from "./intelligence";
import onetRouter from "./onet";
import employerIntelligenceRouter from "./employer-intelligence";
import dataVisualizationRouter from "./dataVisualization";
import portalLinksRouter from "./portalLinks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entityDiscoveryRouter);
router.use(bulkManualLocationsRouter);
router.use(intelligenceRouter);
router.use(onetRouter);
router.use(employerIntelligenceRouter);
router.use(dataVisualizationRouter);
router.use(portalLinksRouter);

export default router;
