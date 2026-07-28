import { Router, type IRouter } from "express";

// Retired compatibility module.
// FEC, USAspending, travel-advisory, and CourtListener endpoints are owned by
// the hardened public-api-repairs.ts and courtlistener-rich.ts routers.
const router: IRouter = Router();

export default router;
