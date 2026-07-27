import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const DATA_WARNING =
  "Defense Base Act case counts are administrative claims-system records. They do not necessarily represent unique injuries, accepted claims, compensable events, employer fault, legal liability, safety performance, or official casualty statistics. Source workbooks include privacy suppression and blank detail rows; missing values must not be interpreted as zero.";

router.get("/dba/hub", async (_req, res) => {
  try {
    const [recordsResult, sourcesResult, employersResult] = await Promise.all([
      pool.query<{
        id: string;
        dimension: "employer" | "country" | "carrier";
        fiscalYear: number;
        sourceName: string;
        canonicalName: string;
        entityId: number | null;
        sourceRow: number;
        nlt: number | null;
        cop: number | null;
        lto3: number | null;
        lto4: number | null;
        dea: number | null;
        oth: number | null;
        total: number | null;
        suppressed: boolean;
        redacted: boolean;
        sourceFile: string;
      }>(`
        SELECT
          id::text,
          dimension,
          fiscal_year AS "fiscalYear",
          source_name AS "sourceName",
          canonical_name AS "canonicalName",
          entity_id AS "entityId",
          source_row AS "sourceRow",
          nlt,
          cop,
          lto3,
          lto4,
          dea,
          oth,
          total,
          suppressed,
          redacted,
          source_file AS "sourceFile"
        FROM dba_hub_records
        ORDER BY dimension, fiscal_year, COALESCE(total, -1) DESC, source_name
      `),
      pool.query<{
        sourceFile: string;
        dimension: "employer" | "country" | "carrier";
        fiscalYear: number;
        sourceRows: number;
        analyticRows: number;
        suppressedOrBlankRows: number;
        reportedTotal: number | null;
        redacted: boolean;
        importedAt: string;
      }>(`
        SELECT
          source_file AS "sourceFile",
          dimension,
          fiscal_year AS "fiscalYear",
          source_rows AS "sourceRows",
          analytic_rows AS "analyticRows",
          suppressed_or_blank_rows AS "suppressedOrBlankRows",
          reported_total AS "reportedTotal",
          redacted,
          imported_at::text AS "importedAt"
        FROM dba_hub_sources
        ORDER BY dimension, fiscal_year
      `),
      pool.query<{
        canonicalName: string;
        entityId: number | null;
        aliases: string[];
        years: number[];
        reportedTotal: number;
      }>(`
        SELECT
          canonical_name AS "canonicalName",
          MAX(entity_id) AS "entityId",
          array_agg(DISTINCT source_name ORDER BY source_name) AS aliases,
          array_agg(DISTINCT fiscal_year ORDER BY fiscal_year) AS years,
          SUM(COALESCE(total, 0))::integer AS "reportedTotal"
        FROM dba_hub_records
        WHERE dimension = 'employer'
        GROUP BY canonical_name
        ORDER BY SUM(COALESCE(total, 0)) DESC, canonical_name
      `),
    ]);

    const years = Array.from(
      new Set(sourcesResult.rows.map((source) => source.fiscalYear)),
    ).sort((left, right) => left - right);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      years,
      records: recordsResult.rows,
      sources: sourcesResult.rows,
      employers: employersResult.rows,
      warning: DATA_WARNING,
      sourceModel: "User-provided DOL/FOIA employer, country, and carrier workbooks stored in Neon",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "The DBA Data Hub could not be loaded from Neon.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
