import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Readable } from "node:stream";
import { ensureOshaCasePersistence } from "../src/services/oshaCaseDataService";

const DEFAULT_SOURCE_URL = process.env.OSHA_CASE_DETAIL_URL || "https://www.osha.gov/sites/default/largefiles/ITA_Case_Detail_Data_2025_through_3-15-2026.csv";
const DEFAULT_DATASET_YEAR = Number(process.env.OSHA_CASE_DETAIL_YEAR || 2025);
const DEFAULT_DATASET_NAME = process.env.OSHA_CASE_DETAIL_DATASET_NAME || `OSHA ITA Case Detail ${DEFAULT_DATASET_YEAR}`;
const BATCH_SIZE = Math.max(25, Math.min(500, Number(process.env.OSHA_CASE_IMPORT_BATCH_SIZE || 150)));

type Options = { input?: string; url?: string; year: number; name: string; append: boolean };
type StreamStats = { bytes: number };

type ParsedCase = {
  sourceRecordId: string; sourceEstablishmentId: string; establishmentName: string; companyName: string; ein: string;
  streetAddress: string; city: string; state: string; zipCode: string; naicsCode: string; naicsYear?: number;
  industryDescription: string; establishmentType?: number; establishmentSize?: number; annualAverageEmployees?: number;
  totalHoursWorked?: number; caseNumber: string; dateOfIncident: string; incidentOutcome?: number; daysAway?: number;
  restrictedDays?: number; typeOfIncident?: number; timeStartedWork: string; timeOfIncident: string; timeUnknown?: number;
  dateOfDeath: string; createdTimestamp: string; yearOfFiling?: number; jobDescription: string; socCode: string;
  socDescription: string; socProbability?: number; socReviewed?: number; unexpectedNaicsSocCombo: string;
  incidentLocation: string; incidentDescription: string; narrativeBeforeIncident: string; narrativeWhatHappened: string;
  narrativeInjuryIllness: string; narrativeObjectSubstance: string; natureCode: string; natureTitle: string;
  bodyPartCode: string; bodyPartTitle: string; eventCode: string; eventTitle: string; sourceCode: string; sourceTitle: string;
  secondarySourceCode: string; secondarySourceTitle: string;
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

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function* parseCsvRows(
  stream: AsyncIterable<Uint8Array | string>,
  hash: ReturnType<typeof createHash>,
  stats: StreamStats,
): AsyncGenerator<string[]> {
  const decoder = new TextDecoder("utf-8");
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let pendingQuote = false;
  let skipLf = false;

  const processText = function* (text: string): Generator<string[]> {
    let index = 0;
    if (pendingQuote) {
      if (text[0] === '"') { field += '"'; quoted = true; index = 1; }
      else quoted = false;
      pendingQuote = false;
    }
    for (; index < text.length; index += 1) {
      const char = text[index];
      if (skipLf) {
        skipLf = false;
        if (char === "\n") continue;
      }
      if (quoted) {
        if (char === '"') {
          if (index + 1 < text.length) {
            if (text[index + 1] === '"') { field += '"'; index += 1; }
            else quoted = false;
          } else pendingQuote = true;
        } else field += char;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n" || char === "\r") {
        row.push(field); field = "";
        const completed = row; row = [];
        if (char === "\r") skipLf = true;
        yield completed;
      } else field += char;
    }
  };

  for await (const chunk of stream) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    hash.update(buffer);
    stats.bytes += buffer.byteLength;
    const text = decoder.decode(buffer, { stream: true });
    yield* processText(text);
  }
  const tail = decoder.decode();
  if (tail) yield* processText(tail);
  if (pendingQuote) { quoted = false; pendingQuote = false; }
  if (field.length || row.length) { row.push(field); yield row; }
}

function buildCase(row: string[], indexByHeader: Map<string, number>, fallbackYear: number): ParsedCase | null {
  const get = (...names: string[]): string => {
    for (const name of names) {
      const index = indexByHeader.get(normalizeHeader(name));
      if (index !== undefined) return row[index]?.trim() || "";
    }
    return "";
  };
  if (!row.length || row.every((value) => !value.trim())) return null;
  const sourceRecordId = get("ID", "record_id");
  const establishmentName = get("establishment_name");
  const companyName = get("company_name") || establishmentName;
  if (!sourceRecordId && !establishmentName && !companyName) return null;
  return {
    sourceRecordId,
    sourceEstablishmentId: get("establishment_ID", "establishment_id"),
    establishmentName,
    companyName,
    ein: get("ein"),
    streetAddress: get("street_address"),
    city: get("city"),
    state: get("state").toUpperCase(),
    zipCode: get("zip_code", "zip"),
    naicsCode: get("naics_code", "naics"),
    naicsYear: toNumber(get("naics_year")),
    industryDescription: get("industry_description"),
    establishmentType: toNumber(get("establishment_type")),
    establishmentSize: toNumber(get("size")),
    annualAverageEmployees: toNumber(get("annual_average_employees")),
    totalHoursWorked: toNumber(get("total_hours_worked")),
    caseNumber: get("case_number"),
    dateOfIncident: get("date_of_incident"),
    incidentOutcome: toNumber(get("incident_outcome")),
    daysAway: toNumber(get("dafw_num_away")),
    restrictedDays: toNumber(get("djtr_num_tr")),
    typeOfIncident: toNumber(get("type_of_incident")),
    timeStartedWork: get("time_started_work"),
    timeOfIncident: get("time_of_incident"),
    timeUnknown: toNumber(get("time_unknown")),
    dateOfDeath: get("date_of_death"),
    createdTimestamp: get("created_timestamp"),
    yearOfFiling: toNumber(get("year_of_filing")) ?? fallbackYear,
    jobDescription: get("job_description", "job_title"),
    socCode: get("SOC_code1", "SOC_code", "soc_code1", "soc_code"),
    socDescription: get("SOC_description1", "SOC_description", "soc_description1", "soc_description"),
    socProbability: toNumber(get("SOC_probability1", "SOC_probability", "soc_probability1", "soc_probability")),
    socReviewed: toNumber(get("SOC_reviewed1", "SOC_reviewed", "soc_reviewed1", "soc_reviewed")),
    unexpectedNaicsSocCombo: get("Unexpected_NAICS_SOC_Combo1", "unexpected_naics_soc_combo1"),
    incidentLocation: get("New_incident_location2", "New_incident_location", "new_incident_location2", "new_incident_location"),
    incidentDescription: get("New_incident_description2", "New_incident_description", "new_incident_description2", "new_incident_description"),
    narrativeBeforeIncident: get("New_nar_before_incident2", "New_nar_before_incident", "new_nar_before_incident2", "new_nar_before_incident"),
    narrativeWhatHappened: get("New_nar_what_happened2", "New_nar_what_happened", "new_nar_what_happened2", "new_nar_what_happened"),
    narrativeInjuryIllness: get("New_nar_injury_illness2", "New_nar_injury_illness", "new_nar_injury_illness2", "new_nar_injury_illness"),
    narrativeObjectSubstance: get("New_nar_object_substance2", "New_nar_object_substance", "new_nar_object_substance2", "new_nar_object_substance"),
    natureCode: get("Nature_code_pred3", "Nature_code_pred", "nature_code_pred3", "nature_code_pred"),
    natureTitle: get("Nature_title_pred3", "Nature_title_pred", "nature_title_pred3", "nature_title_pred"),
    bodyPartCode: get("Part_code_pred3", "Part_code_pred", "part_code_pred3", "part_code_pred"),
    bodyPartTitle: get("Part_title_pred3", "Part_title_pred", "part_title_pred3", "part_title_pred"),
    eventCode: get("Event_code_pred3", "Event_code_pred", "event_code_pred3", "event_code_pred"),
    eventTitle: get("Event_title_pred3", "Event_title_pred", "event_title_pred3", "event_title_pred"),
    sourceCode: get("Source_code_pred3", "Source_code_pred", "source_code_pred3", "source_code_pred"),
    sourceTitle: get("Source_title_pred3", "Source_title_pred", "source_title_pred3", "source_title_pred"),
    secondarySourceCode: get("Sec_source_code_pred3", "Sec_source_code_pred", "sec_source_code_pred3", "sec_source_code_pred"),
    secondarySourceTitle: get("Sec_source_title_pred3", "Sec_source_title_pred", "sec_source_title_pred3", "sec_source_title_pred"),
  };
}

async function openInput(options: Options): Promise<{ stream: AsyncIterable<Uint8Array | string>; sourceUrl: string; fileName: string }> {
  if (options.input) {
    const filePath = resolve(options.input);
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    return { stream: createReadStream(filePath), sourceUrl: options.url || "https://www.osha.gov/itadata", fileName: basename(filePath) };
  }
  const sourceUrl = options.url || DEFAULT_SOURCE_URL;
  const response = await fetch(sourceUrl, { headers: { "User-Agent": "Occu-Med-Insight-Hub/2.0 OSHA case importer" } });
  if (!response.ok || !response.body) throw new Error(`OSHA case-detail download failed with HTTP ${response.status}.`);
  return {
    stream: Readable.fromWeb(response.body as never),
    sourceUrl,
    fileName: sourceUrl.split("/").pop() || `osha-case-detail-${options.year}.csv`,
  };
}

const columns = [
  "import_run_id","source_record_id","source_establishment_id","establishment_name","company_name","ein","street_address","city","state","zip_code","naics_code","naics_year","industry_description","establishment_type","establishment_size","annual_average_employees","total_hours_worked","case_number","date_of_incident","incident_outcome","days_away","restricted_days","type_of_incident","time_started_work","time_of_incident","time_unknown","date_of_death","created_timestamp","year_of_filing","job_description","soc_code","soc_description","soc_probability","soc_reviewed","unexpected_naics_soc_combo","incident_location","incident_description","narrative_before_incident","narrative_what_happened","narrative_injury_illness","narrative_object_substance","nature_code","nature_title","body_part_code","body_part_title","event_code","event_title","source_code","source_title","secondary_source_code","secondary_source_title","dataset_name","dataset_year","source_url","imported_at"
];

async function insertBatch(client: { query: (sql: string, values?: unknown[]) => Promise<unknown> }, batch: ParsedCase[], importRunId: number, options: Options, sourceUrl: string, importedAt: Date) {
  if (!batch.length) return;
  const values: unknown[] = [];
  const placeholders = batch.map((record) => {
    const row: unknown[] = [
      importRunId, record.sourceRecordId || null, record.sourceEstablishmentId || null, record.establishmentName, record.companyName,
      record.ein || null, record.streetAddress || null, record.city || null, record.state || null, record.zipCode || null,
      record.naicsCode || null, record.naicsYear ?? null, record.industryDescription || null, record.establishmentType ?? null,
      record.establishmentSize ?? null, record.annualAverageEmployees ?? null, record.totalHoursWorked ?? null, record.caseNumber || null,
      record.dateOfIncident || null, record.incidentOutcome ?? null, record.daysAway ?? null, record.restrictedDays ?? null,
      record.typeOfIncident ?? null, record.timeStartedWork || null, record.timeOfIncident || null, record.timeUnknown ?? null,
      record.dateOfDeath || null, record.createdTimestamp || null, record.yearOfFiling ?? options.year, record.jobDescription || null,
      record.socCode || null, record.socDescription || null, record.socProbability ?? null, record.socReviewed ?? null,
      record.unexpectedNaicsSocCombo || null, record.incidentLocation || null, record.incidentDescription || null,
      record.narrativeBeforeIncident || null, record.narrativeWhatHappened || null, record.narrativeInjuryIllness || null,
      record.narrativeObjectSubstance || null, record.natureCode || null, record.natureTitle || null, record.bodyPartCode || null,
      record.bodyPartTitle || null, record.eventCode || null, record.eventTitle || null, record.sourceCode || null, record.sourceTitle || null,
      record.secondarySourceCode || null, record.secondarySourceTitle || null, options.name, options.year, sourceUrl, importedAt,
    ];
    const start = values.length;
    values.push(...row);
    return `(${row.map((_, index) => `$${start + index + 1}`).join(",")})`;
  });
  await client.query(`INSERT INTO osha_case_details (${columns.join(",")}) VALUES ${placeholders.join(",")}`, values);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for OSHA case-detail persistence.");
  const options = parseArgs();
  if (process.env.OSHA_CASE_SKIP_ENSURE !== "true") await ensureOshaCasePersistence();
  const input = await openInput(options);
  const hash = createHash("sha256");
  const stats: StreamStats = { bytes: 0 };
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  const importedAt = new Date();
  let recordCount = 0;
  let importRunId = 0;
  let headers: string[] | null = null;
  let indexByHeader: Map<string, number> | null = null;
  let batch: ParsedCase[] = [];

  try {
    await client.query("BEGIN");
    if (!options.append) await client.query("DELETE FROM osha_case_import_runs WHERE dataset_name = $1 AND dataset_year = $2", [options.name, options.year]);
    const run = await client.query<{ id: number }>(`
      INSERT INTO osha_case_import_runs (dataset_name, dataset_year, source_url, imported_at, record_count, sha256, metadata)
      VALUES ($1,$2,$3,$4,0,NULL,$5::jsonb) RETURNING id
    `, [options.name, options.year, input.sourceUrl, importedAt, JSON.stringify({ fileName: input.fileName, append: options.append, streaming: true })]);
    importRunId = run.rows[0].id;

    for await (const row of parseCsvRows(input.stream, hash, stats)) {
      if (!headers) {
        headers = row;
        indexByHeader = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
        continue;
      }
      const parsed = buildCase(row, indexByHeader!, options.year);
      if (!parsed) continue;
      batch.push(parsed);
      recordCount += 1;
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch, importRunId, options, input.sourceUrl, importedAt);
        batch = [];
        if (recordCount % 15000 === 0) console.log(`[osha-case-import] streamed ${recordCount.toLocaleString()} rows`);
      }
    }
    if (batch.length) await insertBatch(client, batch, importRunId, options, input.sourceUrl, importedAt);
    if (!headers || recordCount === 0) throw new Error("No OSHA case-detail records were parsed.");

    const sha256 = hash.digest("hex");
    await client.query(
      "UPDATE osha_case_import_runs SET record_count = $1, sha256 = $2, metadata = $3::jsonb WHERE id = $4",
      [recordCount, sha256, JSON.stringify({ fileName: input.fileName, append: options.append, streaming: true, bytes: stats.bytes, batchSize: BATCH_SIZE }), importRunId],
    );
    await client.query("COMMIT");
    console.log(JSON.stringify({ ok: true, storage: "postgres", datasetName: options.name, datasetYear: options.year, records: recordCount, sourceUrl: input.sourceUrl, fileName: input.fileName, sha256, bytes: stats.bytes, batchSize: BATCH_SIZE }, null, 2));
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
