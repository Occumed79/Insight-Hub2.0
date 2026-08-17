import { Router, type IRouter, type Request, type Response } from "express";
import { fetchBlsHistory } from "../services/blsService";

const router: IRouter = Router();

router.get("/occupational-discovery/bls-history", async (req: Request, res: Response) => {
  const naics = String(req.query.naics ?? "").replace(/\D/g, "").slice(0, 6);
  if (naics.length < 2) {
    return res.status(400).json({ ok: false, error: "A 2- to 6-digit NAICS code is required." });
  }
  const startYear = Number(req.query.startYear) || new Date().getUTCFullYear() - 7;
  const endYear = Number(req.query.endYear) || new Date().getUTCFullYear() - 1;
  const history = await fetchBlsHistory(naics, startYear, endYear);
  return res.json({ ok: true, history });
});

export default router;
