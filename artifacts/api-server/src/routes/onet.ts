import { Router, type IRouter } from "express";

// Retired compatibility module.
// O*NET endpoints are owned by public-api-repairs.ts so a future accidental
// import of this file cannot shadow the hardened v2 routes.
const router: IRouter = Router();

export default router;
