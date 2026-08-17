import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { ensureOshaCasePersistence } from "../src/services/oshaCaseDataService";

const DEFAULT_SOURCE_URL = process.env.OSHA_CASE_DETAIL_URL || "https://www.osha.gov/sites/default/largefiles/ITA_Case_Detail_Data_2025_through_3-15-2026.csv";
const DEFAULT_DATASET_YEAR = Number(process.env.OSHA_CASE_DETAIL_YEAR || 2025);
const DEFAULT_DATASET_NAME = process.env.OSHA_CASE_DETAIL_DATASET_NAME || `OSHA ITA Case Detail ${DEFAULT_DATASET_YEAR}`;

type Options = { input?: string; url?: string; year: number; name: string; append: boolean };

type ParsedCase = {
  sourceRecordId: string;
  sourceEstablishmentId: string;
  establishmentName: string;
  companyName: string;
  ein: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  naicsCode: string;
  naicsYear?: number;
  industryDescription: string;
  establishmentType?: number;
  establishmentSize?: number;
  annualAverageEmployees?: number;
  totalHoursWorked?: number;
  caseNumber: string;
  dateOfIncident: string;
  incidentOutcome?: number;
  daysAway?: number;
  restrictedDays?: number;
  typeOfIncident?: number;
  timeStartedWork: string;
  timeOfIncident: string;
  timeUnknown?: number;
  dateOfDeath: string;
  createdTimestamp: string;
  yearOfFiling?: number;
  jobDescription: string;
  socCode: string;
  socDescription: string;
  socProbability?: number;
  socReviewed?: number;
  unexpectedNaicsSocCombo: string;
  incidentLocation: string;
  incidentDescription: string;
  narrativeBeforeIncident: string;
  narrativeWhatHappened: string;
  narrativeInjuryIllness: string;
  narrativeObjectSubstance: string;
  natureCode: string;
  natureTitle: string;
  bodyPartCode: string;
  bodyPartTitle: string;
  eventCode: string;
  eventTitle: string;
  sourceCode: string;
  sourceTitle: string;
  secondarySourceCode: string;
  secondarySourceTitle: string;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let input: string | undefined;
  let url: string | undefined;
  let year = DEFAULT_DATASET_YEAR;
  let name = DEFAULT_DATASET_NAME;
  let append = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") input = args[++index];
    else if (arg === "--url") url = args[++index];
    else if (arg === "--year") year = Number(args[++index]);
    else if (arg === "--name") name = args[++index];
    else if (arg === "--append") append = true;
    else if (!arg.startsWith("--")) input = arg;
  }
  if (!Number.isFinite(year) || year < 2023 || year > 2100) throw new Error("--year must be a valid case-detail reporting year (2023 or later).");
  return { input, url, year, name, append };
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCases(content: string, fallbackYear: number): ParsedCase[] {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error("OSHA case-detail CSV has no data rows.");
  const headers = rows[0];
  const indexByHeader = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const get = (row: string[], ...names: string[]): string => {
    for (const name of names) {
      const index = indexByHeader.get(normalizeHeader(name));
      if (index !== undefined) return row[index]?.trim() || "";
    }
    return "";
  };

  const parsed: ParsedCase[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row.length || row.every((value) => !value.trim())) continue;
    const sourceRecordId = get(row, "ID", "record_id");
    const establishmentName = get(row, "establishment_name");
    const companyName = get(row, "company_name") || establishmentName;
    if (!sourceRecordId && !establishmentName && !companyName) continue;
    parsed.push({
      sourceRecordId,
      sourceEstablishmentId: get(row, "establishment_ID", "establishment_id"),
      establishmentName,
      companyName,
      ein: get(row, "ein"),
      streetAddress: get(row, "street_address"),
      city: get(row, "city"),
      state: get(row, "state").toUpperCase(),
      zipCode: get(row, "zip_code", "zip"),
      naicsCode: get(row, "naics_code", "naics"),
      naicsYear: toNumber(get(row, "naics_year")),
      industryDescription: get(row, "industry_description"),
      establishmentType: toNumber(get(row, "establishment_type")),
      establishmentSize: toNumber(get(row, "size")),
      annualAverageEmployees: toNumber(get(row, "annual_average_employees")),
      totalHoursWorked: toNumber(get(row, "total_hours_worked")),
      caseNumber: get(row, "case_number"),
      dateOfIncident: get(row, "date_of_incident"),
      incidentOutcome: toNumber(get(row, "incident_outcome")),
      daysAway: toNumber(get(row, "dafw_num_away")),
      restrictedDays: toNumber(get(row, "djtr_num_tr")),
      typeOfIncident: toNumber(get(row, "type_of_incident")),
      timeStartedWork: get(row, "time_started_work"),
      timeOfIncident: get(row, "time_of_incident"),
      timeUnknown: toNumber(get(row, "time_unknown")),
      dateOfDeath: get(row, "date_of_death"),
      createdTimestamp: get(row, "created_timestamp"),
      yearOfFiling: toNumber(get(row, "year_of_filing")) ?? fallbackYear,
      jobDescription: get(row, "job_description", "job_title"),
      socCode: get(row, "SOC_code1", "SOC_code", "soc_code1", "soc_code"),
      socDescription: get(row, "SOC_description1", "SOC_description", "soc_description1", "soc_description"),
      socProbability: toNumber(get(row, "SOC_probability1", "SOC_probability", "soc_probability1", "soc_probability")),
      socReviewed: toNumber(get(row, "SOC_reviewed1", "SOC_reviewed", "soc_reviewed1", "soc_reviewed")),
      unexpectedNaicsSocCombo: get(row, "Unexpected_NAICS_SOC_Combo1", "unexpected_naics_soc_combo1"),
      incidentLocation: get(row, "New_incident_location2", "New_incident_location", "new_incident_location2", "new_incident_location"),
      incidentDescription: get(row, "New_incident_description2", "New_incident_description", "new_incident_description2", "new_incident_description"),
      narrativeBeforeIncident: get(row, "New_nar_before_incident2", "New_nar_before_incident", "new_nar_before_incident2", "new_nar_before_incident"),
      narrativeWhatHappened: get(row, "New_nar_what_happened2", "New_nar_what_happened", "new_nar_what_happened2", "new_nar_what_happened"),
      narrativeInjuryIllness: get(row, "New_nar_injury_illness2", "New_nar_injury_illness", "new_nar_injury_illness2", "new_nar_injury_illness"),
      narrativeObjectSubstance: get(row, "New_nar_object_substance2", "New_nar_object_substance", "new_nar_object_substance2", "new_nar_object_substance"),
      natureCode: get(row, "Nature_code_pred3", "Nature_code_pred", "nature_code_pred3", "nature_code_pred"),
      natureTitle: get(row, "Nature_title_pred3", "Nature_title_pred", "nature_title_pred3", "nature_title_pred"),
      bodyPartCode: get(row, "Part_code_pred3", "Part_code_pred", "part_code_pred3", "part_code_pred"),
      bodyPartTitle: get(row, "Part_title_pred3", "Part_title_pred", "part_title_pred3", "part_title_pred"),
      eventCode: get(row, "Event_code_pred3", "Event_code_pred", "event_code_pred3", "event_code_pred"),
      eventTitle: get(row, "Event_title_pred3", "Event_title_pred", "event_title_pred3", "event_title_pred"),
      sourceCode: get(row, "Source_code_pred3", "Source_code_pred", "source_code_pred3", "source_code_pred"),
      sourceTitle: get(row, "Source_title_pred3", "Source_title_pred", "source_title_pred3", "source_title_pred"),
      secondarySourceCode: get(row, "Sec_source_code_pred3", "Sec_source_code_pred", "sec_source_code_pred3", "sec_source_code_pred"),
      secondarySourceTitle: get(row, "Sec_source_title_pred3", "Sec_source_title_pred", "sec_source_title_pred3", "sec_source_title_pred"),
    });
  }
  return parsed;
}

async function loadInput(options: Options): Promise<{ bytes: Buffer; sourceUrl: string; fileName: string }> {
  if (options.input) {
    const filePath = resolve(options.input);
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    return { bytes: readFileSync(filePath), sourceUrl: options.url || "https://www.osha.gov/itadata", fileName: basename(filePath) };
  }
  const sourceUrl = options.url || DEFAULT_SOURCE_URL;
  const response = await fetch(sourceUrl, { headers: { "User-Agent": "Occu-Med-Insight-Hub/2.0 OSHA case importer" } });
  if (!response.ok) throw new Error(`OSHA case-detail download failed with HTTP ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { bytes: buffer, sourceUrl, fileName: sourceUrl.split("/").pop() || `osha-case-detail-${options.year}.csv` };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for OSHA case-detail persistence.");
  const options = parseArgs();
  const input = await loadInput(options);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const cases = parseCases(input.bytes.toString("utf-8"), options.year);
  if (!cases.length) throw new Error("No OSHA case-detail records were parsed.");

  await ensureOshaCasePersistence();
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  const importedAt = new Date();
  try {
    await client.query("BEGIN");
    if (!options.append) {
      await client.query("DELETE FROM osha_case_import_runs WHERE dataset_name = $1 AND dataset_year = $2", [options.name, options.year]);
    }
    const run = await client.query<{ id: number }>(`
      INSERT INTO osha_case_import_runs (dataset_name, dataset_year, source_url, imported_at, record_count, sha256, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id
    `, [options.name, options.year, input.sourceUrl, importedAt, cases.length, sha256, JSON.stringify({ fileName: input.fileName, append: options.append, bytes: input.bytes.byteLength })]);
    const importRunId = run.rows[0].id;

    const columns = [
      "import_run_id","source_record_id","source_establishment_id","establishment_name","company_name","ein","street_address","city","state","zip_code","naics_code","naics_year","industry_description","establishment_type","establishment_size","annual_average_employees","total_hours_worked","case_number","date_of_incident","incident_outcome","days_away","restricted_days","type_of_incident","time_started_work","time_of_incident","time_unknown","date_of_death","created_timestamp","year_of_filing","job_description","soc_code","soc_description","soc_probability","soc_reviewed","unexpected_naics_soc_combo","incident_location","incident_description","narrative_before_incident","narrative_what_happened","narrative_injury_illness","narrative_object_substance","nature_code","nature_title","body_part_code","body_part_title","event_code","event_title","source_code","source_title","secondary_source_code","secondary_source_title","dataset_name","dataset_year","source_url","imported_at"
    ];
    const batchSize = 150;
    for (let offset = 0; offset < cases.length; offset += batchSize) {
      const batch = cases.slice(offset, offset + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((record) => {
        const row: unknown[] = [
          importRunId, record.sourceRecordId || null, record.sourceEstablishmentId || null, record.establishmentName, record.companyName, record.ein || null, record.streetAddress || null, record.city || null, record.state || null, record.zipCode || null, record.naicsCode || null, record.naicsYear ?? null, record.industryDescription || null, record.establishmentType ?? null, record.establishmentSize ?? null, record.annualAverageEmployees ?? null, record.totalHoursWorked ?? null, record.caseNumber || null, record.dateOfIncident || null, record.incidentOutcome ?? null, record.daysAway ?? null, record.restrictedDays ?? null, record.typeOfIncident ?? null, record.timeStartedWork || null, record.timeOfIncident || null, record.timeUnknown ?? null, record.dateOfDeath || null, record.createdTimestamp || null, record.yearOfFiling ?? options.year, record.jobDescription || null, record.socCode || null, record.socDescription || null, record.socProbability ?? null, record.socReviewed ?? null, record.unexpectedNaicsSocCombo || null, record.incidentLocation || null, record.incidentDescription || null, record.narrativeBeforeIncident || null, record.narrativeWhatHappened || null, record.narrativeInjuryIllness || null, record.narrativeObjectSubstance || null, record.natureCode || null, record.natureTitle || null, record.bodyPartCode || null, record.bodyPartTitle || null, record.eventCode || null, record.eventTitle || null, record.sourceCode || null, record.sourceTitle || null, record.secondarySourceCode || null, record.secondarySourceTitle || null, options.name, options.year, input.sourceUrl, importedAt,
        ];
        const start = values.length;
        values.push(...row);
        return `(${row.map((_, index) => `$${start + index + 1}`).join(",")})`;
      });
      await client.query(`INSERT INTO osha_case_details (${columns.join(",")}) VALUES ${placeholders.join(",")}`, values);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ ok: true, storage: "postgres", datasetName: options.name, datasetYear: options.year, records: cases.length, sourceUrl: input.sourceUrl, fileName: input.fileName, sha256 }, null, 2));
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
