import { gunzipSync } from "node:zlib";
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const DATA_WARNING =
  "Defense Base Act case counts are administrative claims-system records. They do not necessarily represent unique injuries, accepted claims, compensable events, employer fault, legal liability, safety performance, or official casualty statistics. Source workbooks include privacy suppression and blank detail rows; missing values must not be interpreted as zero.";

type DbaDimension = "employer" | "country" | "carrier";
type CumulativeTuple = [
  DbaDimension,
  number,
  number,
  string,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean,
  boolean,
  string,
];

function normalizeName(value: string): string {
  return value
    .replace(/&/g, " AND ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

router.get("/dba/hub", async (_req, res) => {
  try {
    const [
      recordsResult,
      sourcesResult,
      employersResult,
      cumulativePayloadResult,
      cumulativeSourcesResult,
      aliasesResult,
      entitiesResult,
    ] = await Promise.all([
      pool.query<{
        id: string;
        dimension: DbaDimension;
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
        dimension: DbaDimension;
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
      pool.query<{
        datasetKey: string;
        periodStartYear: number;
        periodEndYear: number;
        recordCount: number;
        encoding: string;
        payload: Buffer;
        importedAt: string;
      }>(`
        SELECT
          dataset_key AS "datasetKey",
          period_start_year AS "periodStartYear",
          period_end_year AS "periodEndYear",
          record_count AS "recordCount",
          encoding,
          payload,
          imported_at::text AS "importedAt"
        FROM dba_hub_cumulative_payloads
        WHERE dataset_key = 'dba-cumulative-2001-2024'
        LIMIT 1
      `),
      pool.query<{
        sourceFile: string;
        dimension: DbaDimension;
        periodStartYear: number;
        periodEndYear: number;
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
          period_start_year AS "periodStartYear",
          period_end_year AS "periodEndYear",
          source_rows AS "sourceRows",
          analytic_rows AS "analyticRows",
          suppressed_or_blank_rows AS "suppressedOrBlankRows",
          reported_total AS "reportedTotal",
          redacted,
          imported_at::text AS "importedAt"
        FROM dba_hub_cumulative_sources
        ORDER BY dimension
      `),
      pool.query<{
        normalizedSourceName: string;
        canonicalName: string;
        entityId: number | null;
      }>(`
        SELECT
          btrim(normalized_source_name) AS "normalizedSourceName",
          canonical_name AS "canonicalName",
          entity_id AS "entityId"
        FROM dba_hub_company_aliases
        WHERE approved = true
      `),
      pool.query<{
        id: number;
        name: string;
        displayName: string;
      }>(`
        SELECT id, name, display_name AS "displayName"
        FROM entities
      `),
    ]);

    const approvedAliases = new Map(
      aliasesResult.rows.map((row) => [row.normalizedSourceName, row] as const),
    );
    const exactEntities = new Map<string, { canonicalName: string; entityId: number }>();
    for (const entity of entitiesResult.rows) {
      const resolved = { canonicalName: entity.displayName || entity.name, entityId: entity.id };
      exactEntities.set(normalizeName(entity.name), resolved);
      exactEntities.set(normalizeName(entity.displayName), resolved);
    }

    const payloadRow = cumulativePayloadResult.rows[0];
    const tuples: CumulativeTuple[] = payloadRow
      ? JSON.parse(gunzipSync(payloadRow.payload).toString("utf8")) as CumulativeTuple[]
      : [];
    const cumulativeRecords = tuples.map((tuple, index) => {
      const [
        dimension,
        periodStartYear,
        periodEndYear,
        sourceName,
        sourceRow,
        nlt,
        cop,
        lto3,
        lto4,
        dea,
        oth,
        total,
        suppressed,
        redacted,
        sourceFile,
      ] = tuple;
      const normalized = normalizeName(sourceName);
      const employerMatch = dimension === "employer"
        ? approvedAliases.get(normalized) || exactEntities.get(normalized)
        : undefined;
      return {
        id: `cumulative-${dimension}-${sourceRow}-${index}`,
        dimension,
        periodStartYear,
        periodEndYear,
        sourceName,
        canonicalName: employerMatch?.canonicalName || sourceName,
        entityId: employerMatch?.entityId ?? null,
        sourceRow,
        nlt,
        cop,
        lto3,
        lto4,
        dea,
        oth,
        total,
        suppressed,
        redacted,
        sourceFile,
      };
    });

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
      cumulativeRecords,
      cumulativeSources: cumulativeSourcesResult.rows,
      cumulativePeriod: payloadRow
        ? { startYear: payloadRow.periodStartYear, endYear: payloadRow.periodEndYear }
        : null,
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
