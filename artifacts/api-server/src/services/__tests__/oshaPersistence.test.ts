import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { pool } from "@workspace/db";
import {
  ensureOshaPersistence,
  queryOshaEstablishments,
  recordOshaEntityMatch,
  upsertEmployerAlias,
} from "../oshaDataService";

const databaseUrl = process.env.DATABASE_URL;

async function resetOshaTables() {
  await pool.query(`
    DELETE FROM osha_entity_matches;
    DELETE FROM osha_establishments;
    DELETE FROM osha_source_files;
    DELETE FROM employer_aliases;
    DELETE FROM osha_import_runs;
  `);
}

before(async () => {
  assert.ok(databaseUrl, "DATABASE_URL must be configured for OSHA persistence integration tests");
  await ensureOshaPersistence();
  await resetOshaTables();
});

after(async () => {
  await resetOshaTables();
  await pool.end();
});

test("OSHA persistence stores and queries establishment evidence from Postgres", async () => {
  const run = await pool.query<{ id: number }>(
    `
      INSERT INTO osha_import_runs (
        dataset_name, dataset_year, source_url, source_file_type, record_count
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    ["OSHA ITA Test 2025", 2025, "https://www.osha.gov/test", "csv", 1],
  );

  const source = await pool.query<{ id: number }>(
    `
      INSERT INTO osha_source_files (
        import_run_id, file_name, source_url, source_file_type, dataset_year, sha256
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [run.rows[0].id, "osha-test.csv", "https://www.osha.gov/test", "csv", 2025, "test-sha"],
  );

  const establishment = await pool.query<{ id: number }>(
    `
      INSERT INTO osha_establishments (
        import_run_id,
        source_file_id,
        establishment_name,
        company_name,
        normalized_establishment_name,
        normalized_company_name,
        address,
        city,
        state,
        zip,
        naics,
        year,
        total_hours_worked,
        total_cases,
        dart_cases,
        days_away_cases,
        source_url,
        dataset_name,
        dataset_year,
        source_file_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING id
    `,
    [
      run.rows[0].id,
      source.rows[0].id,
      "Acme Manufacturing - Fresno",
      "Acme Manufacturing LLC",
      "acme manufacturing fresno",
      "acme manufacturing",
      "100 Industrial Way",
      "Fresno",
      "CA",
      "93721",
      "541330",
      2025,
      200000,
      8,
      3,
      2,
      "https://www.osha.gov/test",
      "OSHA ITA Test 2025",
      2025,
      "csv",
    ],
  );

  const result = await queryOshaEstablishments("Acme Manufacturing", "CA", "541", "2025");
  assert.equal(result.dataSource, "database");
  assert.equal(result.count, 1);
  assert.equal(result.records[0].id, establishment.rows[0].id);
  assert.equal(result.records[0].companyName, "Acme Manufacturing LLC");
  assert.equal(result.records[0].trcRate, 8);
  assert.equal(result.records[0].dartRate, 3);
  assert.equal(result.records[0].daysAwayRate, 2);
});

test("OSHA employer aliases resolve to persisted establishment records", async () => {
  await upsertEmployerAlias("Acme Manufacturing", "Acme Mfg", "integration-test", 0.99);

  const aliased = await queryOshaEstablishments("Acme Mfg", "CA");
  assert.equal(aliased.dataSource, "database");
  assert.equal(aliased.count, 1);
  assert.equal(aliased.records[0].companyName, "Acme Manufacturing LLC");
});

test("OSHA entity-match decisions persist independently of source evidence", async () => {
  const establishment = await pool.query<{ id: number }>(
    "SELECT id FROM osha_establishments LIMIT 1",
  );
  assert.ok(establishment.rows[0]?.id);

  const matchId = await recordOshaEntityMatch({
    oshaEstablishmentId: establishment.rows[0].id,
    canonicalName: "Acme Manufacturing",
    matchedName: "Acme Manufacturing LLC",
    matchType: "name",
    confidence: 0.97,
    reviewed: true,
    metadata: { test: true },
  });

  const stored = await pool.query<{
    id: number;
    confidence: number;
    reviewed: boolean;
    metadata: { test?: boolean } | null;
  }>(
    "SELECT id, confidence, reviewed, metadata FROM osha_entity_matches WHERE id = $1",
    [matchId],
  );

  assert.equal(stored.rows[0].id, matchId);
  assert.equal(Number(stored.rows[0].confidence), 0.97);
  assert.equal(stored.rows[0].reviewed, true);
  assert.equal(stored.rows[0].metadata?.test, true);
});
