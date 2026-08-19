import { Router, type IRouter, type Request, type Response } from "express";
import {
  getOshaCaseImportInfo,
  getOshaCaseOverview,
  getOshaOccupationCaseProfile,
} from "../services/oshaCaseDataService";

const router: IRouter = Router();
const LIMITATION = "OSHA ITA case-detail data covers establishments subject to electronic submission requirements and is not representative of every employer or worker. OIICS and SOC classifications are source-provided/assigned fields and should be reviewed with the OSHA data dictionary and quality guidance.";
const SOURCE = "OSHA ITA Form 300/301 Case Detail Data";
const OFFICIAL_SOURCE = "https://www.osha.gov/itadata";

async function caseStorageState() {
  const importInfo = await getOshaCaseImportInfo();
  if (importInfo.storage === "unconfigured") {
    return {
      importInfo,
      response: {
        ok: true,
        configured: false,
        imported: false,
        importInfo,
        warning: "DATABASE_URL is not configured for OSHA case-detail persistence.",
      },
    };
  }
  if (importInfo.totalCases === 0) {
    return {
      importInfo,
      response: {
        ok: true,
        configured: true,
        imported: false,
        importInfo,
        warning: "OSHA case-detail storage is ready but no case-detail dataset has been imported. Run pnpm --filter @workspace/api-server sync:osha-cases in an environment with DATABASE_URL.",
      },
    };
  }
  return { importInfo, response: null };
}

router.get("/occupational-discovery/osha-case-overview", async (req: Request, res: Response) => {
  try {
    const yearValue = Number(req.query.year);
    const year = Number.isFinite(yearValue) && yearValue >= 2023 ? yearValue : undefined;
    const state = await caseStorageState();
    if (state.response) return res.json({ ...state.response, overview: null });
    const overview = await getOshaCaseOverview(year);
    return res.json({
      ok: true,
      configured: true,
      imported: true,
      importInfo: state.importInfo,
      overview,
      source: SOURCE,
      officialSource: OFFICIAL_SOURCE,
      limitation: LIMITATION,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 400) : "OSHA case-detail overview failed.",
    });
  }
});

router.get("/occupational-discovery/osha-occupation-profile", async (req: Request, res: Response) => {
  try {
    const socCode = String(req.query.soc || "").trim().slice(0, 32);
    const occupationTitle = String(req.query.title || "").trim().slice(0, 180);
    const yearValue = Number(req.query.year);
    const year = Number.isFinite(yearValue) && yearValue >= 2023 ? yearValue : undefined;
    if (!socCode && !occupationTitle) {
      return res.status(400).json({ ok: false, error: "Provide an SOC code or resolved occupation title." });
    }

    const state = await caseStorageState();
    if (state.response) return res.json({ ...state.response, profile: null });
    const profile = await getOshaOccupationCaseProfile({ socCode, occupationTitle, year });

    return res.json({
      ok: true,
      configured: true,
      imported: true,
      importInfo: state.importInfo,
      profile,
      source: SOURCE,
      officialSource: OFFICIAL_SOURCE,
      limitation: LIMITATION,
      warning: profile ? "" : "No OSHA case-detail records matched the resolved occupation in the imported years. This is not evidence that the occupation has no injuries or illnesses.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 400) : "OSHA occupation case profile failed.",
    });
  }
});

export default router;
