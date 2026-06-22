/**
 * OSHA ITA Establishment Data Import Script
 *
 * Usage:
 *   npx tsx scripts/import-osha.ts <input.csv> [--year 2022] [--name "OSHA ITA 2022"] [--output <dir>]
 *   npx tsx scripts/import-osha.ts --input <input.csv> --year 2022 --name "OSHA ITA 2022" --output /var/data/osha-ita
 *
 * Output directory resolution (first match wins):
 *   1. --output <dir>          (explicit flag)
 *   2. OSHA_DATA_DIR env var   (e.g. /var/data/osha-ita on Render)
 *   3. process.cwd()/data/osha-ita  (local fallback)
 *
 * This script reads an OSHA ITA establishment-specific injury/illness CSV file
 * (downloaded from https://www.osha.gov/establishment-specific-injury-and-illness-data),
 * parses it, and writes a JSON cache file to the resolved output directory.
 *
 * The JSON file format is:
 * {
 *   "metadata": {
 *     "datasetName": "...",
 *     "datasetYear": 2022,
 *     "sourceUrl": "https://www.osha.gov/establishment-specific-injury-and-illness-data",
 *     "sourceFileType": "csv",
 *     "importedAt": "2024-01-15T...",
 *     "recordCount": 12345
 *   },
 *   "records": [ { ... }, ... ]
 * }
 *
 * CSV expected columns (case-insensitive, flexible):
 *   - Establishment Name / establishment_name
 *   - Company Name / company_name / legal_name
 *   - DBA Name / dba_name
 *   - Street Address / address
 *   - City
 *   - State
 *   - ZIP / zip_code
 *   - NAICS / naics_code
 *   - Year
 *   - Total Hours Worked / total_hours
 *   - Total Cases / total_recordable_cases
 *   - DART Cases / dart_cases
 *   - Days Away Cases / days_away_cases
 *   - Job Transfer or Restriction Cases
 *
 * If columns don't match exactly, the script attempts fuzzy header matching.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";

interface ParsedRecord {
  establishmentName: string;
  companyName: string;
  dbaName?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naics: string;
  year: number;
  totalHoursWorked?: number;
  totalCases?: number;
  dartCases?: number;
  daysAwayCases?: number;
  jobTransferRestrictionCases?: number;
  caseCategories?: string[];
}

function parseArgs(): { inputPath: string; year?: string; name?: string; outputDir?: string } {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/import-osha.ts <input.csv> [--year 2022] [--name 'OSHA ITA 2022'] [--output <dir>]");
    console.error("       npx tsx scripts/import-osha.ts --input <input.csv> --year 2022 --name 'OSHA ITA 2022' --output /var/data/osha-ita");
    process.exit(1);
  }
  let inputPath = "";
  let year: string | undefined;
  let name: string | undefined;
  let outputDir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--year") { year = args[++i]; continue; }
    if (args[i] === "--name") { name = args[++i]; continue; }
    if (args[i] === "--output") { outputDir = args[++i]; continue; }
    if (args[i] === "--input") { inputPath = args[++i]; continue; }
    if (!args[i].startsWith("--")) { inputPath = args[i]; }
  }
  if (!inputPath) {
    console.error("Error: input file path is required");
    console.error("Provide a positional path or use --input <path>");
    process.exit(1);
  }
  return { inputPath, year, name, outputDir };
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const normCandidate = normalizeHeader(candidate);
    const idx = normalized.indexOf(normCandidate);
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && content[i + 1] === '\n') i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

function toNumber(val: string | undefined): number | undefined {
  if (!val || val.trim() === "") return undefined;
  const cleaned = val.trim().replace(/[, $%]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? undefined : num;
}

function resolveOutputDir(explicit?: string): string {
  if (explicit) return resolve(explicit);
  const envDir = process.env.OSHA_DATA_DIR;
  if (envDir) return resolve(envDir);
  return resolve(process.cwd(), "data", "osha-ita");
}

function main() {
  const { inputPath, year, name, outputDir } = parseArgs();
  const absPath = resolve(inputPath);

  if (!existsSync(absPath)) {
    console.error(`Error: File not found: ${absPath}`);
    process.exit(1);
  }

  const ext = extname(absPath).toLowerCase();
  if (ext !== ".csv") {
    console.error(`Error: Only CSV files are supported in this script. Got: ${ext}`);
    console.error("For XLSX files, convert to CSV first using Excel or a tool like `xlsx-to-csv`.");
    process.exit(1);
  }

  const content = readFileSync(absPath, "utf-8");
  const rows = parseCsv(content);

  if (rows.length < 2) {
    console.error("Error: CSV file appears to be empty or has no data rows");
    process.exit(1);
  }

  const headers = rows[0];
  console.log(`Found ${headers.length} columns, ${rows.length - 1} data rows`);

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
    console.error("Error: Could not find establishment name or company name column");
    console.error("Available columns:", headers.join(", "));
    process.exit(1);
  }

  const records: ParsedRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
      skipped++;
      continue;
    }

    const getVal = (col: string | undefined) => col ? row[headers.indexOf(col)]?.trim() || "" : "";

    const establishmentName = getVal(colEstablishment) || getVal(colCompany);
    const companyName = getVal(colCompany) || establishmentName;

    if (!establishmentName) {
      skipped++;
      continue;
    }

    const record: ParsedRecord = {
      establishmentName,
      companyName,
      dbaName: getVal(colDba) || undefined,
      address: getVal(colAddress),
      city: getVal(colCity),
      state: getVal(colState).toUpperCase(),
      zip: getVal(colZip),
      naics: getVal(colNaics),
      year: toNumber(getVal(colYear)) || Number(year) || new Date().getFullYear() - 1,
      totalHoursWorked: toNumber(getVal(colHours)),
      totalCases: toNumber(getVal(colTotalCases)),
      dartCases: toNumber(getVal(colDartCases)),
      daysAwayCases: toNumber(getVal(colDaysAway)),
      jobTransferRestrictionCases: toNumber(getVal(colJobTransfer)),
    };

    records.push(record);
  }

  console.log(`Parsed ${records.length} records, skipped ${skipped} empty rows`);

  const datasetName = name || basename(absPath, extname(absPath));
  const datasetYear = Number(year) || records[0]?.year || new Date().getFullYear() - 1;
  const resolvedOutputDir = resolveOutputDir(outputDir);
  if (!existsSync(resolvedOutputDir)) {
    mkdirSync(resolvedOutputDir, { recursive: true });
  }

  const outputFileName = `${datasetName.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  const outputPath = join(resolvedOutputDir, outputFileName);

  const output = {
    metadata: {
      datasetName,
      datasetYear,
      sourceUrl: "https://www.osha.gov/establishment-specific-injury-and-illness-data",
      sourceFileType: "csv",
      importedAt: new Date().toISOString(),
      recordCount: records.length,
    },
    records,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${records.length} records to ${outputPath}`);
  console.log(`Dataset: ${datasetName} (Year: ${datasetYear})`);
}

main();
