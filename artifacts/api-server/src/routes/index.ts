import { Router, type IRouter } from "express";
import healthRouter from "./health";
import insightRouter from "./insight";

const router: IRouter = Router();

router.use(healthRouter);
router.use(insightRouter);

export default router;
