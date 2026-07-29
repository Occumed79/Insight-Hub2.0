import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/aor/source-readiness", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    ok: true,
    sources: [
      {
        id: "state",
        name: "U.S. Department of State",
        configured: true,
        live: true,
        requirement: null,
      },
      {
        id: "who",
        name: "WHO Disease Outbreak News",
        configured: true,
        live: true,
        requirement: null,
      },
      {
        id: "gdacs",
        name: "GDACS",
        configured: true,
        live: true,
        requirement: null,
      },
      {
        id: "crisiswatch",
        name: "International Crisis Group CrisisWatch",
        configured: true,
        live: true,
        requirement: null,
      },
    ],
  });
});

router.all("/aor/conflict-events", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    ok: false,
    configured: false,
    removed: true,
    error: "The ACLED integration has been removed from Insight Hub 2.0.",
  });
});

export default router;
