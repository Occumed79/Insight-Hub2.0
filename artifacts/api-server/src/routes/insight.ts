import { Router, type IRouter } from "express";
import { filterByCompany, findCompany, type SearchRun } from "../lib/insightDataset";
import {
  createSearchRunRecord,
  getInsightDataset,
  listSearchRuns,
} from "../lib/insightRepository";

const router: IRouter = Router();

const validTargets = new Set<SearchRun["target"]>([
  "company",
  "opportunity",
  "provider",
  "agency",
  "competitor",
]);

router.get("/insight/dataset", async (req, res, next) => {
  try {
    const dataset = await getInsightDataset();
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;

    if (!companyId) {
      res.json(dataset);
      return;
    }

    const company = findCompanyInDataset(dataset, companyId);

    if (!company) {
      res.status(404).json({
        error: "Company not found",
        companyId,
      });
      return;
    }

    res.json({
      ...dataset,
      companies: [company],
      profiles: filterByCompany(dataset.profiles, companyId),
      metrics: filterByCompany(dataset.metrics, companyId),
      locations: filterByCompany(dataset.locations, companyId),
      sources: filterByCompany(dataset.sources, companyId),
      reports: filterByCompany(dataset.reports, companyId),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/insight/companies", async (_req, res, next) => {
  try {
    const dataset = await getInsightDataset();
    res.json({ companies: dataset.companies });
  } catch (error) {
    next(error);
  }
});

router.get("/insight/companies/:companyId", async (req, res, next) => {
  try {
    const dataset = await getInsightDataset();
    const { companyId } = req.params;
    const company = findCompanyInDataset(dataset, companyId) || findCompany(companyId);

    if (!company) {
      res.status(404).json({
        error: "Company not found",
        companyId,
      });
      return;
    }

    res.json({
      company,
      profile: dataset.profiles.find((profile) => profile.companyId === companyId),
      metrics: filterByCompany(dataset.metrics, companyId),
      locations: filterByCompany(dataset.locations, companyId),
      sources: filterByCompany(dataset.sources, companyId),
      report: dataset.reports.find((report) => report.companyId === companyId),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/insight/search-runs", async (_req, res, next) => {
  try {
    res.json({ searchRuns: await listSearchRuns() });
  } catch (error) {
    next(error);
  }
});

router.post("/insight/search-runs", async (req, res, next) => {
  try {
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

    const searchRun = await createSearchRunRecord(query, target as SearchRun["target"]);
    res.status(201).json({ searchRun });
  } catch (error) {
    next(error);
  }
});

function findCompanyInDataset(dataset: Awaited<ReturnType<typeof getInsightDataset>>, companyId: string) {
  return dataset.companies.find((company) => company.id === companyId);
}

export default router;
