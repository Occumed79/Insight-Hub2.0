import { Router, type IRouter, type Request, type Response } from "express";
import { getOshaCaseImportInfo, getOshaCaseOverview } from "../services/oshaCaseDataService";

const router: IRouter = Router();

router.get("/occupational-discovery/osha-case-overview", async (req: Request, res: Response) => {
  try {
    const yearValue = Number(req.query.year);
    const year = Number.isFinite(yearValue) && yearValue >= 2023 ? yearValue : undefined;
    const importInfo = await getOshaCaseImportInfo();
    if (importInfo.storage === "unconfigured") {
      return res.json({
        ok: true,
        configured: false,
        imported: false,
        importInfo,
        overview: null,
        warning: "DATABASE_URL is not configured for OSHA case-detail persistence.",
      });
    }
    if (importInfo.totalCases === 0) {
      return res.json({
        ok: true,
        configured: true,
        imported: false,
        importInfo,
        overview: null,
        warning: "OSHA case-detail storage is ready but no case-detail dataset has been imported. Run pnpm --filter @workspace/api-server sync:osha-cases in an environment with DATABASE_URL.",
      });
    }
    const overview = await getOshaCaseOverview(year);
    return res.json({
      ok: true,
      configured: true,
      imported: true,
      importInfo,
      overview,
      source: "OSHA ITA Form 300/301 Case Detail Data",
      officialSource: "https://www.osha.gov/itadata",
      limitation: "OSHA ITA case-detail data covers establishments subject to electronic submission requirements and is not representative of every employer or worker. OIICS and SOC classifications are source-provided/assigned fields and should be reviewed with the OSHA data dictionary and quality guidance.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 400) : "OSHA case-detail overview failed.",
    });
  }
});

export default router;
