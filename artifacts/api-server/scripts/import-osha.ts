import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import {
  calculateRate,
  ensureOshaPersistence,
  normalizeName,
  type OshaEstablishmentRecord,
} from "../src/services/oshaDataService";

type ParsedRecord = Omit<
  OshaEstablishmentRecord,
  "sourceUrl" | "datasetName" | "datasetYear" | "sourceFileType" | "lastImportedDate"
>;

type LegacyPayload = {
  metadata?: {
    datasetName?: string;
    datasetYear?: number;
    sourceUrl?: string;
    sourceFileType?: string;
    importedAt?: string;
    recordCount?: number;
  };
  records?: Array<Partial<OshaEstablishmentRecord>>;
};

type ImportOptions = {
  inputPath: string;
  year?: string;
  name?: string;
  append: boolean;
};

const OSHA_SOURCE_URL =
  "https://www.osha.gov/establishment-specific-injury-and-illness-data";

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: pnpm import:osha -- --input <input.csv|legacy.json> [--year 2025] [--name 'OSHA ITA 2025'] [--append]",
    );
    process.exit(1);
  }

  let inputPath = "";
  let year: string | undefined;
  let name: string | undefined;
  let append = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--year") {
      year = args[++index];
      continue;
    }
    if (arg === "--name") {
      name = args[++index];
      continue;
    }
    if (arg === "--input") {
      inputPath = args[++index];
      continue;
    }
    if (arg === "--append") {
      append = true;
      continue;
    }
    if (!arg.startsWith("--")) inputPath = arg;
  }

  if (!inputPath) {
    console.error("Error: input file path is required.");
    process.exit(1);
  }

  return { inputPath, year, name, append };
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate));
    if (index >= 0) return headers[index];
  }
  return undefined;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          currentField += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[index + 1] === "\n") index++;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function toNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value.trim().replace(/[, $%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCsvRecords(content: string, fallbackYear?: number): ParsedRecord[] {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error("CSV file is empty or has no data rows.");

  const headers = rows[0];
  const colEstablishment = findColumn(headers, ["Establishment Name", "establishment_name", "establishment"]);
  const colCompany = findColumn(headers, ["Company Name", "company_name", "legal_name", "legal_business_name"]);
  const colDba = findColumn(headers, ["DBA Name", "dba_name", "doing_business_as"]);
  const colAddress = findColumn(headers, ["Street Address", "address", "address1", "street"]);
  const colCity = findColumn(headers, ["City", "city"]);
  const colState = findColumn(headers, ["State", "state", "state_code"]);
  const colZip = findColumn(headers, ["ZIP", "zip_code", "zip", "postal_code"]);
  const colNaics = findColumn(headers, ["NAICS", "naics_code", "naics"]);
  const colYear = findColumn(headers, ["Year", "year", "reporting_year"]);
  const colHours = findColumn(headers, ["Total Hours Worked", "total_hours", "total_hours_worked", "hours_worked"]);
  const colTotalCases = findColumn(headers, ["Total Cases", "total_recordable_cases", "total_cases", "trc_cases"]);
  const colDartCases = findColumn(headers, ["DART Cases", "dart_cases", "days_away_restricted_transferred"]);
  const colDaysAway = findColumn(headers, ["Days Away Cases", "days_away_cases", "days_away_from_work"]);
  const colJobTransfer = findColumn(headers, ["Job Transfer or Restriction Cases", "job_transfer_restriction_cases", "jtr_cases"]);

  if (!colEstablishment && !colCompany) {
    throw new Error(`Could not find establishment/company name column. Columns: ${headers.join(", ")}`);
  }

  const records: ParsedRecord[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (row.length === 0 || (row.length === 1 && !row[0]?.trim())) continue;

    const get = (column: string | undefined): string =>
      column ? row[headers.indexOf(column)]?.trim() || "" : "";

    const establishmentName = get(colEstablishment) || get(colCompany);
    const companyName = get(colCompany) || establishmentName;
    if (!establishmentName) continue;

    const totalHoursWorked = toNumber(get(colHours));
    const totalCases = toNumber(get(colTotalCases));
    const dartCases = toNumber(get(colDartCases));
    const daysAwayCases = toNumber(get(colDaysAway));

    records.push({
      establishmentName,
      companyName,
      dbaName: get(colDba) || undefined,
      address: get(colAddress),
      city: get(colCity),
      state: get(colState).toUpperCase(),
      zip: get(colZip),
      naics: get(colNaics),
      year: toNumber(get(colYear)) || fallbackYear || new Date().getFullYear() - 1,
      totalHoursWorked,
      totalCases,
      dartCases,
      daysAwayCases,
      jobTransferRestrictionCases: toNumber(get(colJobTransfer)),
      trcRate:
        totalCases !== undefined && totalHoursWorked !== undefined
          ? calculateRate(totalCases, totalHoursWorked)
          : undefined,
      dartRate:
        dartCases !== undefined && totalHoursWorked !== undefined
          ? calculateRate(dartCases, totalHoursWorked)
          : undefined,
      daysAwayRate:
        daysAwayCases !== undefined && totalHoursWorked !== undefined
          ? calculateRate(daysAwayCases, totalHoursWorked)
          : undefined,
    });
  }

  return records;
}

function parseLegacyRecords(payload: LegacyPayload, fallbackYear?: number): ParsedRecord[] {
  return (payload.records ?? [])
    .filter((record) => record.establishmentName || record.companyName)
    .map((record) => {
      const establishmentName = record.establishmentName || record.companyName || "";
      const companyName = record.companyName || establishmentName;
      const totalHoursWorked = record.totalHoursWorked;
      const totalCases = record.totalCases;
      const dartCases = record.dartCases;
      const daysAwayCases = record.daysAwayCases;

      return {
        establishmentName,
        companyName,
        dbaName: record.dbaName,
        address: record.address || "",
        city: record.city || "",
        state: (record.state || "").toUpperCase(),
        zip: record.zip || "",
        naics: record.naics || "",
        year: record.year || fallbackYear || payload.metadata?.datasetYear || new Date().getFullYear() - 1,
        totalHoursWorked,
        totalCases,
        dartCases,
        daysAwayCases,
        jobTransferRestrictionCases: record.jobTransferRestrictionCases,
        caseCategories: record.caseCategories,
        trcRate:
          record.trcRate ??
          (totalCases !== undefined && totalHoursWorked !== undefined
            ? calculateRate(totalCases, totalHoursWorked)
            : undefined),
        dartRate:
          record.dartRate ??
          (dartCases !== undefined && totalHoursWorked !== undefined
            ? calculateRate(dartCases, totalHoursWorked)
            : undefined),
        daysAwayRate:
          record.daysAwayRate ??
          (daysAwayCases !== undefined && totalHoursWorked !== undefined
            ? calculateRate(daysAwayCases, totalHoursWorked)
            : undefined),
      };
    });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. OSHA imports now persist directly to Postgres.");
  }

  const options = parseArgs();
  const absolutePath = resolve(options.inputPath);
  if (!existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);

  const rawBuffer = readFileSync(absolutePath);
  const rawText = rawBuffer.toString("utf-8");
  const extension = extname(absolutePath).toLowerCase();
  const fallbackYear = options.year ? Number(options.year) : undefined;

  let legacyMetadata: LegacyPayload["metadata"] | undefined;
  let records: ParsedRecord[];

  if (extension === ".csv") {
    records = parseCsvRecords(rawText, fallbackYear);
  } else if (extension === ".json") {
    const payload = JSON.parse(rawText) as LegacyPayload;
    legacyMetadata = payload.metadata;
    records = parseLegacyRecords(payload, fallbackYear);
  } else {
    throw new Error(`Unsupported input type ${extension}. Use CSV or a legacy OSHA JSON cache file.`);
  }

  if (records.length === 0) throw new Error("No OSHA establishment records were parsed.");

  const sourceFileType = extension.replace(".", "") || legacyMetadata?.sourceFileType || "unknown";
  const datasetName = options.name || legacyMetadata?.datasetName || basename(absolutePath, extension);
  const datasetYear =
    fallbackYear || legacyMetadata?.datasetYear || records[0]?.year || new Date().getFullYear() - 1;
  const sourceUrl = legacyMetadata?.sourceUrl || OSHA_SOURCE_URL;
  const importedAt = new Date();
  const sha256 = createHash("sha256").update(rawBuffer).digest("hex");

  await ensureOshaPersistence();
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!options.append) {
      await client.query(
        "DELETE FROM osha_import_runs WHERE dataset_name = $1 AND dataset_year = $2",
        [datasetName, datasetYear],
      );
    }

    const runResult = await client.query<{ id: number }>(
      `
        INSERT INTO osha_import_runs (
          dataset_name, dataset_year, source_url, source_file_type, imported_at, record_count, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING id
      `,
      [
        datasetName,
        datasetYear,
        sourceUrl,
        sourceFileType,
        importedAt,
        records.length,
        JSON.stringify({
          mode: options.append ? "append" : "replace-dataset-year",
          migratedFromLegacyJson: extension === ".json",
        }),
      ],
    );
    const importRunId = runResult.rows[0].id;

    const sourceFileResult = await client.query<{ id: number }>(
      `
        INSERT INTO osha_source_files (
          import_run_id, file_name, source_url, source_file_type, dataset_year, sha256, imported_at, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING id
      `,
      [
        importRunId,
        basename(absolutePath),
        sourceUrl,
        sourceFileType,
        datasetYear,
        sha256,
        importedAt,
        JSON.stringify({ bytes: rawBuffer.byteLength, sourceImportedAt: legacyMetadata?.importedAt ?? null }),
      ],
    );
    const sourceFileId = sourceFileResult.rows[0].id;

    const columns = [
      "import_run_id", "source_file_id", "establishment_name", "company_name", "dba_name",
      "normalized_establishment_name", "normalized_company_name", "normalized_dba_name",
      "address", "city", "state", "zip", "naics", "year", "total_hours_worked", "total_cases",
      "dart_cases", "days_away_cases", "job_transfer_restriction_cases", "case_categories",
      "trc_rate", "dart_rate", "days_away_rate", "source_url", "dataset_name", "dataset_year",
      "source_file_type", "last_imported_date",
    ];

    const batchSize = 250;
    for (let offset = 0; offset < records.length; offset += batchSize) {
      const batch = records.slice(offset, offset + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((record) => {
        const row = [
          importRunId,
          sourceFileId,
          record.establishmentName,
          record.companyName,
          record.dbaName ?? null,
          normalizeName(record.establishmentName),
          normalizeName(record.companyName),
          record.dbaName ? normalizeName(record.dbaName) : null,
          record.address,
          record.city,
          record.state,
          record.zip,
          record.naics,
          record.year,
          record.totalHoursWorked ?? null,
          record.totalCases ?? null,
          record.dartCases ?? null,
          record.daysAwayCases ?? null,
          record.jobTransferRestrictionCases ?? null,
          JSON.stringify(record.caseCategories ?? []),
          record.trcRate ?? null,
          record.dartRate ?? null,
          record.daysAwayRate ?? null,
          sourceUrl,
          datasetName,
          datasetYear,
          sourceFileType,
          importedAt,
        ];

        const start = values.length;
        values.push(...row);
        return `(${row.map((_, index) => `$${start + index + 1}`).join(", ")})`;
      });

      await client.query(
        `INSERT INTO osha_establishments (${columns.join(", ")}) VALUES ${placeholders.join(", ")}`,
        values,
      );
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          storage: "postgres",
          datasetName,
          datasetYear,
          records: records.length,
          file: basename(absolutePath),
          sha256,
          mode: options.append ? "append" : "replace-dataset-year",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
