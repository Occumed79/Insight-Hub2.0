import { Router, type IRouter } from "express";
import { protectSharedWrites } from "../lib/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import entityDiscoveryRouter from "./entityDiscovery";
import bulkManualLocationsRouter from "./bulkManualLocations";
import intelligenceRouter from "./intelligence";
import onetRouter from "./onet";
import employerIntelligenceRouter from "./employer-intelligence";
import dataVisualizationRouter from "./dataVisualization";
import portalLinksRouter from "./portalLinks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(protectSharedWrites);
router.use(entityDiscoveryRouter);
router.use(bulkManualLocationsRouter);
router.use(intelligenceRouter);
router.use(onetRouter);
router.use(employerIntelligenceRouter);
router.use(dataVisualizationRouter);
router.use(portalLinksRouter);

export default router;
