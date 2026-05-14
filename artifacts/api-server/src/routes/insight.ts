import { Router, type IRouter } from "express";
import { getCompanyById, getInsightDataset } from "../lib/insightDataset";

const router: IRouter = Router();

router.get("/insight/status", (_req, res) => {
  res.json({ status: "ok", mode: "frontend-workbook" });
});

router.get("/insight/dataset", (_req, res) => {
  res.json(getInsightDataset());
});

router.get("/insight/companies", (_req, res) => {
  const dataset = getInsightDataset();
  res.json({ companies: dataset.companies });
});

router.get("/insight/companies/:companyId", (req, res) => {
  const company = getCompanyById(req.params.companyId);

  if (!company) {
    res.status(404).json({ error: "Company not found", companyId: req.params.companyId });
    return;
  }

  res.json({ company });
});

export default router;
