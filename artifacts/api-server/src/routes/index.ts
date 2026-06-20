import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entityDiscoveryRouter from "./entityDiscovery";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entityDiscoveryRouter);

export default router;
