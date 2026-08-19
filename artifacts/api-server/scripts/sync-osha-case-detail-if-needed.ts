import { spawn } from "node:child_process";
import { pool } from "@workspace/db";
import { ensureOshaCasePersistence } from "../src/services/oshaCaseDataService";

const DATASET_YEAR = Number(process.env.OSHA_CASE_DETAIL_YEAR || 2025);

async function runImporter() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "scripts/import-osha-case-detail.ts", "--year", String(DATASET_YEAR)], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`OSHA case-detail importer exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[osha-case-sync] DATABASE_URL is not configured; skipping startup case-detail sync.");
    return;
  }

  await ensureOshaCasePersistence();
  const result = await pool.query<{ case_count: string }>(
    `SELECT count(*)::text AS case_count FROM osha_case_details WHERE dataset_year = $1`,
    [DATASET_YEAR],
  );
  const caseCount = Number(result.rows[0]?.case_count || 0);

  if (caseCount > 0) {
    console.log(`[osha-case-sync] OSHA ${DATASET_YEAR} case detail already loaded (${caseCount.toLocaleString()} rows); startup sync skipped.`);
    await pool.end();
    return;
  }

  console.log(`[osha-case-sync] OSHA ${DATASET_YEAR} case detail is missing; starting one-time import.`);
  await pool.end();
  await runImporter();
}

void main().catch(async (error) => {
  console.error(`[osha-case-sync] ${error instanceof Error ? error.message : String(error)}`);
  try { await pool.end(); } catch { /* already closed */ }
  console.warn("[osha-case-sync] Continuing API startup; the import will be retried on the next restart while the dataset remains missing.");
  process.exitCode = 0;
});
