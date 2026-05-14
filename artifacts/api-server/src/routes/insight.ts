import { Router, type IRouter } from "express";
import { getCompanyById, getInsightDataset } from "../lib/insightDataset";
import { buildEnrichmentResult } from "../lib/searchProviders";

const router: IRouter = Router();

const enrichmentRuns: ReturnType<typeof buildEnrichmentResult>[] = [];

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


router.get("/insight/search-runs", (_req, res) => {
  res.json({ searchRuns: enrichmentRuns });
});

router.post("/insight/enrich/:companyId", (req, res) => {
  const companyId = req.params.companyId;
  const company = getCompanyById(companyId);

  if (!company) {
    res.status(404).json({ error: "Company not found", companyId });
    return;
  }

  const query = typeof req.body?.query === "string" && req.body.query.trim()
    ? req.body.query.trim()
    : `Latest strategic intelligence for ${company.name}`;

  const run = buildEnrichmentResult(companyId, query);
  enrichmentRuns.unshift(run);

  res.status(201).json({ searchRun: run });
});

export default router;
