import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entityDiscoveryRouter from "./entityDiscovery";
import bulkManualLocationsRouter from "./bulkManualLocations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entityDiscoveryRouter);
router.use(bulkManualLocationsRouter);

export default router;
