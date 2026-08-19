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
const OIICS_2024_SOURCE = "https://www.osha.gov/sites/default/files/ITA_Case_Detail_Data_2024_through_12-31-2025.zip";

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

router.post("/occupational-discovery/osha-oiics-profile/batch", async (req: Request, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length || rows.length > 100) return res.status(400).json({ ok: false, error: "Provide 1-100 OIICS occupation profile rows." });
    await ensureOshaCasePersistence();
    const { pool } = await import("@workspace/db");
    await pool.query(`
      INSERT INTO osha_oiics_occupation_profiles (
        dataset_year, soc_code, soc_description, case_count,
        coded_body_part_cases, coded_nature_cases, coded_event_cases,
        coded_source_cases, coded_secondary_source_cases,
        body_parts, natures, events, sources, secondary_sources,
        source_url, imported_at
      )
      SELECT x.dataset_year, x.soc_code, COALESCE(x.soc_description,''), COALESCE(x.case_count,0),
        COALESCE(x.coded_body_part_cases,0), COALESCE(x.coded_nature_cases,0), COALESCE(x.coded_event_cases,0),
        COALESCE(x.coded_source_cases,0), COALESCE(x.coded_secondary_source_cases,0),
        COALESCE(x.body_parts,'[]'::jsonb), COALESCE(x.natures,'[]'::jsonb), COALESCE(x.events,'[]'::jsonb),
        COALESCE(x.sources,'[]'::jsonb), COALESCE(x.secondary_sources,'[]'::jsonb), $2, now()
      FROM jsonb_to_recordset($1::jsonb) AS x(
        dataset_year integer,
        soc_code text,
        soc_description text,
        case_count integer,
        coded_body_part_cases integer,
        coded_nature_cases integer,
        coded_event_cases integer,
        coded_source_cases integer,
        coded_secondary_source_cases integer,
        body_parts jsonb,
        natures jsonb,
        events jsonb,
        sources jsonb,
        secondary_sources jsonb
      )
      ON CONFLICT (dataset_year, soc_code) DO UPDATE SET
        soc_description = EXCLUDED.soc_description,
        case_count = EXCLUDED.case_count,
        coded_body_part_cases = EXCLUDED.coded_body_part_cases,
        coded_nature_cases = EXCLUDED.coded_nature_cases,
        coded_event_cases = EXCLUDED.coded_event_cases,
        coded_source_cases = EXCLUDED.coded_source_cases,
        coded_secondary_source_cases = EXCLUDED.coded_secondary_source_cases,
        body_parts = EXCLUDED.body_parts,
        natures = EXCLUDED.natures,
        events = EXCLUDED.events,
        sources = EXCLUDED.sources,
        secondary_sources = EXCLUDED.secondary_sources,
        source_url = EXCLUDED.source_url,
        imported_at = now()
    `, [JSON.stringify(rows), OIICS_2024_SOURCE]);
    return res.status(202).json({ ok: true, accepted: rows.length });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : "OSHA OIICS profile batch failed." });
  }
});

router.get("/occupational-discovery/osha-oiics-profile/status", async (_req: Request, res: Response) => {
  try {
    await ensureOshaCasePersistence();
    const { pool } = await import("@workspace/db");
    const result = await pool.query<{ profiles: string; latest_year: number | null; all_cases: number | null }>(`
      SELECT COUNT(*)::text AS profiles,
        MAX(dataset_year)::int AS latest_year,
        MAX(case_count) FILTER (WHERE soc_code='*')::int AS all_cases
      FROM osha_oiics_occupation_profiles
    `);
    return res.json({
      ok: true,
      profiles: Number(result.rows[0]?.profiles ?? 0),
      latestYear: result.rows[0]?.latest_year ?? null,
      allCases: result.rows[0]?.all_cases ?? null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : "OSHA OIICS profile status failed." });
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
