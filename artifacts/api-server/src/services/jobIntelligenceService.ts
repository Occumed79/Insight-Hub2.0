import { randomUUID } from "node:crypto";

type DbModule = typeof import("@workspace/db");
let dbModulePromise: Promise<DbModule> | null = null;
let ensurePromise: Promise<void> | null = null;

export type JobDuty = {
  id: string;
  duty: string;
  sourceKind: "onet-task" | "onet-work-context" | "onet-ability" | "onet-work-activity" | "onet-detailed-activity" | "reviewer";
  sourceLabel: string;
  sourceId?: string;
  sourceValue?: number;
  sourceResponse?: Array<{ percentage?: number; description?: string }>;
  domains: string[];
  essentiality: "essential" | "supporting" | "unknown";
  frequency: "rare" | "occasional" | "frequent" | "constant" | "unknown";
  duration: string;
  maxLiftLbs: number | null;
  postures: string[];
  exposures: string[];
  ppe: string[];
  driving: boolean;
  heights: boolean;
  emergencyResponse: boolean;
  shiftWork: boolean;
  heavyEquipment: boolean;
  firearms: boolean;
  reviewerNotes: string;
};

export type JobProfile = {
  id: string;
  profileName: string;
  companyName: string;
  jobTitle: string;
  location: string;
  onetCode: string;
  onetTitle: string;
  onetDescription: string;
  onetMatchScore: number | null;
  duties: JobDuty[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

async function getDbModule(): Promise<DbModule> {
  if (!dbModulePromise) dbModulePromise = import("@workspace/db");
  return dbModulePromise;
}

function configured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanDuty(value: unknown): JobDuty | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const duty = text(row.duty, 4000);
  if (!duty) return null;
  const sourceKindValues = new Set(["onet-task", "onet-work-context", "onet-ability", "onet-work-activity", "onet-detailed-activity", "reviewer"]);
  const essentialityValues = new Set(["essential", "supporting", "unknown"]);
  const frequencyValues = new Set(["rare", "occasional", "frequent", "constant", "unknown"]);
  const sourceKind = sourceKindValues.has(String(row.sourceKind)) ? String(row.sourceKind) : "reviewer";
  const essentiality = essentialityValues.has(String(row.essentiality)) ? String(row.essentiality) : "unknown";
  const frequency = frequencyValues.has(String(row.frequency)) ? String(row.frequency) : "unknown";
  const response = Array.isArray(row.sourceResponse)
    ? row.sourceResponse.slice(0, 20).map((item) => {
        const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const percentage = numberOrNull(entry.percentage);
        return { percentage: percentage ?? undefined, description: text(entry.description, 500) || undefined };
      })
    : undefined;
  return {
    id: text(row.id, 120) || randomUUID(),
    duty,
    sourceKind: sourceKind as JobDuty["sourceKind"],
    sourceLabel: text(row.sourceLabel, 1000) || (sourceKind === "reviewer" ? "Reviewer entered" : "O*NET Web Services API v2"),
    sourceId: text(row.sourceId, 160) || undefined,
    sourceValue: numberOrNull(row.sourceValue) ?? undefined,
    sourceResponse: response,
    domains: Array.isArray(row.domains) ? row.domains.map((item) => text(item, 80)).filter(Boolean).slice(0, 12) : [],
    essentiality: essentiality as JobDuty["essentiality"],
    frequency: frequency as JobDuty["frequency"],
    duration: text(row.duration, 120),
    maxLiftLbs: numberOrNull(row.maxLiftLbs),
    postures: Array.isArray(row.postures) ? row.postures.map((item) => text(item, 80)).filter(Boolean).slice(0, 20) : [],
    exposures: Array.isArray(row.exposures) ? row.exposures.map((item) => text(item, 100)).filter(Boolean).slice(0, 24) : [],
    ppe: Array.isArray(row.ppe) ? row.ppe.map((item) => text(item, 100)).filter(Boolean).slice(0, 20) : [],
    driving: Boolean(row.driving),
    heights: Boolean(row.heights),
    emergencyResponse: Boolean(row.emergencyResponse),
    shiftWork: Boolean(row.shiftWork),
    heavyEquipment: Boolean(row.heavyEquipment),
    firearms: Boolean(row.firearms),
    reviewerNotes: text(row.reviewerNotes, 3000),
  };
}

function cleanDuties(value: unknown): JobDuty[] {
  return (Array.isArray(value) ? value : []).map(cleanDuty).filter((item): item is JobDuty => Boolean(item)).slice(0, 300);
}

function mapRow(row: Record<string, unknown>): JobProfile {
  return {
    id: String(row.id ?? ""),
    profileName: text(row.profile_name, 500),
    companyName: text(row.company_name, 500),
    jobTitle: text(row.job_title, 500),
    location: text(row.location, 500),
    onetCode: text(row.onet_code, 100),
    onetTitle: text(row.onet_title, 500),
    onetDescription: text(row.onet_description, 4000),
    onetMatchScore: numberOrNull(row.onet_match_score),
    duties: cleanDuties(row.duties),
    notes: text(row.notes, 6000),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ""),
  };
}

export async function ensureJobIntelligencePersistence(): Promise<void> {
  if (!configured()) throw new Error("DATABASE_URL is required for Job Intelligence persistence.");
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const { pool } = await getDbModule();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS job_intelligence_profiles (
          id text PRIMARY KEY,
          profile_name text NOT NULL,
          company_name text NOT NULL DEFAULT '',
          job_title text NOT NULL,
          location text NOT NULL DEFAULT '',
          onet_code text NOT NULL DEFAULT '',
          onet_title text NOT NULL DEFAULT '',
          onet_description text NOT NULL DEFAULT '',
          onet_match_score real,
          duties jsonb NOT NULL DEFAULT '[]'::jsonb,
          notes text NOT NULL DEFAULT '',
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS job_intelligence_profiles_updated_idx ON job_intelligence_profiles (updated_at DESC);
        CREATE INDEX IF NOT EXISTS job_intelligence_profiles_job_idx ON job_intelligence_profiles (lower(job_title));
      `);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export async function listJobProfiles(): Promise<JobProfile[]> {
  await ensureJobIntelligencePersistence();
  const { pool } = await getDbModule();
  const result = await pool.query(`SELECT * FROM job_intelligence_profiles ORDER BY updated_at DESC LIMIT 500`);
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function getJobProfile(id: string): Promise<JobProfile | null> {
  await ensureJobIntelligencePersistence();
  const { pool } = await getDbModule();
  const result = await pool.query(`SELECT * FROM job_intelligence_profiles WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function createJobProfile(input: Record<string, unknown>): Promise<JobProfile> {
  await ensureJobIntelligencePersistence();
  const { pool } = await getDbModule();
  const id = randomUUID();
  const profileName = text(input.profileName, 500) || text(input.jobTitle, 500) || "Untitled job profile";
  const jobTitle = text(input.jobTitle, 500) || text(input.onetTitle, 500) || "Untitled job";
  const duties = cleanDuties(input.duties);
  const result = await pool.query(
    `INSERT INTO job_intelligence_profiles (
      id, profile_name, company_name, job_title, location, onet_code, onet_title, onet_description, onet_match_score, duties, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
    [
      id,
      profileName,
      text(input.companyName, 500),
      jobTitle,
      text(input.location, 500),
      text(input.onetCode, 100),
      text(input.onetTitle, 500),
      text(input.onetDescription, 4000),
      numberOrNull(input.onetMatchScore),
      JSON.stringify(duties),
      text(input.notes, 6000),
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function updateJobProfile(id: string, input: Record<string, unknown>): Promise<JobProfile | null> {
  await ensureJobIntelligencePersistence();
  const existing = await getJobProfile(id);
  if (!existing) return null;
  const { pool } = await getDbModule();
  const duties = "duties" in input ? cleanDuties(input.duties) : existing.duties;
  const result = await pool.query(
    `UPDATE job_intelligence_profiles SET
      profile_name=$2, company_name=$3, job_title=$4, location=$5, onet_code=$6, onet_title=$7,
      onet_description=$8, onet_match_score=$9, duties=$10::jsonb, notes=$11, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      id,
      "profileName" in input ? text(input.profileName, 500) || existing.profileName : existing.profileName,
      "companyName" in input ? text(input.companyName, 500) : existing.companyName,
      "jobTitle" in input ? text(input.jobTitle, 500) || existing.jobTitle : existing.jobTitle,
      "location" in input ? text(input.location, 500) : existing.location,
      "onetCode" in input ? text(input.onetCode, 100) : existing.onetCode,
      "onetTitle" in input ? text(input.onetTitle, 500) : existing.onetTitle,
      "onetDescription" in input ? text(input.onetDescription, 4000) : existing.onetDescription,
      "onetMatchScore" in input ? numberOrNull(input.onetMatchScore) : existing.onetMatchScore,
      JSON.stringify(duties),
      "notes" in input ? text(input.notes, 6000) : existing.notes,
    ],
  );
  return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function deleteJobProfile(id: string): Promise<boolean> {
  await ensureJobIntelligencePersistence();
  const { pool } = await getDbModule();
  const result = await pool.query(`DELETE FROM job_intelligence_profiles WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
