import { Router, type IRouter, type Request, type Response } from "express";
import {
  ensureOshaCasePersistence,
  getOshaCaseImportInfo,
  getOshaCaseOverview,
  getOshaOccupationCaseProfile,
} from "../services/oshaCaseDataService";

const router: IRouter = Router();
const LIMITATION = "OSHA ITA case-detail data covers establishments subject to electronic submission requirements and is not representative of every employer or worker. OIICS and SOC classifications are source-provided/assigned fields and should be reviewed with the OSHA data dictionary and quality guidance.";
const SOURCE = "OSHA ITA Form 300/301 Case Detail Data";
const OFFICIAL_SOURCE = "https://www.osha.gov/itadata";
const STAGE_TABLE = "osha_case_details_stage_2025";
const DATASET_NAME = "OSHA ITA Case Detail 2025";
const DATASET_YEAR = 2025;
const DATASET_SOURCE = "https://www.osha.gov/sites/default/largefiles/ITA_Case_Detail_Data_2025_through_3-15-2026.csv";

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
        warning: "OSHA case-detail storage is ready but no completed case-detail dataset has been imported.",
      },
    };
  }
  return { importInfo, response: null };
}

async function stageCount(): Promise<number> {
  const { pool } = await import("@workspace/db");
  const exists = await pool.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${STAGE_TABLE}`]);
  if (!exists.rows[0]?.exists) return 0;
  const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${STAGE_TABLE}`);
  return Number(result.rows[0]?.count ?? 0);
}

router.post("/occupational-discovery/osha-case-stage/init", async (_req: Request, res: Response) => {
  try {
    await ensureOshaCasePersistence();
    const { pool } = await import("@workspace/db");
    const existing = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM osha_case_details WHERE dataset_name = $1 AND dataset_year = $2",
      [DATASET_NAME, DATASET_YEAR],
    );
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      return res.json({ ok: true, initialized: false, reason: "already-imported", rows: Number(existing.rows[0]?.count ?? 0) });
    }
    await pool.query(`DROP TABLE IF EXISTS ${STAGE_TABLE}`);
    await pool.query(`CREATE UNLOGGED TABLE ${STAGE_TABLE} AS SELECT * FROM osha_case_details WITH NO DATA`);
    return res.json({ ok: true, initialized: true, stageTable: STAGE_TABLE, datasetYear: DATASET_YEAR });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : "OSHA staging initialization failed." });
  }
});

router.get("/occupational-discovery/osha-case-stage/status", async (_req: Request, res: Response) => {
  try {
    return res.json({ ok: true, stagedRows: await stageCount(), datasetYear: DATASET_YEAR });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : "OSHA staging status failed." });
  }
});

router.post("/occupational-discovery/osha-case-stage/batch", async (req: Request, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length || rows.length > 2000) return res.status(400).json({ ok: false, error: "Provide 1-2000 OSHA case rows." });
    await ensureOshaCasePersistence();
    const { pool } = await import("@workspace/db");
    const exists = await pool.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${STAGE_TABLE}`]);
    if (!exists.rows[0]?.exists) return res.status(409).json({ ok: false, error: "OSHA staging table is not initialized." });
    const importedAt = new Date().toISOString();
    const stagedRows = rows.map((row: Record<string, unknown>) => ({
      ...row,
      id: null,
      import_run_id: 0,
      dataset_name: DATASET_NAME,
      dataset_year: DATASET_YEAR,
      source_url: DATASET_SOURCE,
      imported_at: importedAt,
    }));
    await pool.query(
      `INSERT INTO ${STAGE_TABLE} SELECT * FROM jsonb_populate_recordset(NULL::${STAGE_TABLE}, $1::jsonb)`,
      [JSON.stringify(stagedRows)],
    );
    return res.status(202).json({ ok: true, accepted: stagedRows.length, stagedRows: await stageCount() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : "OSHA staging batch failed." });
  }
});

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
