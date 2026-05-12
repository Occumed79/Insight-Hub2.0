import { Router, type IRouter } from "express";
import {
  createMockSearchRun,
  filterByCompany,
  findCompany,
  getSearchRuns,
  insightDataset,
  type SearchRun,
} from "../lib/insightDataset";

const router: IRouter = Router();

const validTargets = new Set<SearchRun["target"]>([
  "company",
  "opportunity",
  "provider",
  "agency",
  "competitor",
]);

router.get("/insight/dataset", (req, res) => {
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;

  if (!companyId) {
    res.json(insightDataset);
    return;
  }

  const company = findCompany(companyId);

  if (!company) {
    res.status(404).json({
      error: "Company not found",
      companyId,
    });
    return;
  }

  res.json({
    ...insightDataset,
    companies: [company],
    profiles: filterByCompany(insightDataset.profiles, companyId),
    metrics: filterByCompany(insightDataset.metrics, companyId),
    locations: filterByCompany(insightDataset.locations, companyId),
    sources: filterByCompany(insightDataset.sources, companyId),
    reports: filterByCompany(insightDataset.reports, companyId),
  });
});

router.get("/insight/companies", (_req, res) => {
  res.json({ companies: insightDataset.companies });
});

router.get("/insight/companies/:companyId", (req, res) => {
  const { companyId } = req.params;
  const company = findCompany(companyId);

  if (!company) {
    res.status(404).json({
      error: "Company not found",
      companyId,
    });
    return;
  }

  res.json({
    company,
    profile: insightDataset.profiles.find((profile) => profile.companyId === companyId),
    metrics: filterByCompany(insightDataset.metrics, companyId),
    locations: filterByCompany(insightDataset.locations, companyId),
    sources: filterByCompany(insightDataset.sources, companyId),
    report: insightDataset.reports.find((report) => report.companyId === companyId),
  });
});

router.get("/insight/search-runs", (_req, res) => {
  res.json({ searchRuns: getSearchRuns() });
});

router.post("/insight/search-runs", (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  const target = typeof req.body?.target === "string" ? req.body.target : "company";

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  if (!validTargets.has(target as SearchRun["target"])) {
    res.status(400).json({
      error: "Invalid target",
      allowedTargets: Array.from(validTargets),
    });
    return;
  }

  const searchRun = createMockSearchRun(query, target as SearchRun["target"]);
  res.status(201).json({ searchRun });
});

export default router;
