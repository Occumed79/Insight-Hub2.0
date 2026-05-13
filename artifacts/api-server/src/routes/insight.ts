import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/insight/status", (_req, res) => {
  res.json({
    status: "ok",
    mode: "frontend-workbook",
  });
});

export default router;
