import { Router, type IRouter, type Request, type Response } from "express";
import {
  approveCompetitiveCandidate,
  getCompetitiveOverview,
  refreshCompetitiveAwards,
  rejectCompetitiveCandidate,
} from "../services/competitiveAwardsService";

const router: IRouter = Router();

function daysFrom(value: unknown, fallback = 365): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(7, Math.min(730, Math.floor(parsed))) : fallback;
}

router.get("/competitive-awards/overview", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    return res.json(await getCompetitiveOverview(daysFrom(req.query.days)));
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load competitive awards intelligence." });
  }
});

router.post("/competitive-awards/refresh", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const result = await refreshCompetitiveAwards(daysFrom(req.body?.days));
    const overview = await getCompetitiveOverview(daysFrom(req.body?.days));
    return res.json({ ok: true, refresh: result, overview });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Competitive awards refresh failed." });
  }
});

router.post("/competitive-awards/candidates/:id/approve", async (req: Request, res: Response) => {
  try {
    const competitor = await approveCompetitiveCandidate(req.params.id);
    return res.json({ ok: true, competitor });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Unable to approve candidate." });
  }
});

router.post("/competitive-awards/candidates/:id/reject", async (req: Request, res: Response) => {
  try {
    await rejectCompetitiveCandidate(req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Unable to reject candidate." });
  }
});

export default router;
