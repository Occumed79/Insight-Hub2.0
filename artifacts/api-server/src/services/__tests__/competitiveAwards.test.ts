import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "@workspace/db";
import {
  approveCompetitiveCandidate,
  ensureCompetitiveAwardsPersistence,
  getCompetitiveOverview,
  matchCompetitiveIdentity,
  normalizeCompetitiveName,
  type CompetitiveWatchlistRecord,
} from "../competitiveAwardsService";

const axiom: CompetitiveWatchlistRecord = {
  id: "axiom-medical",
  displayName: "Axiom Medical",
  canonicalName: "Axiom Medical Consulting LLC",
  website: "https://www.axiomllc.com",
  aliases: ["Axiom Medical", "Axiom Medical Consulting"],
  uei: null,
  cage: null,
  recipientId: null,
  relationshipType: "direct-national",
  sourceScope: "both",
  status: "review",
  evidenceUrl: null,
  evidenceNote: null,
  updatedAt: new Date().toISOString(),
};

test("competitive identity normalization removes legal suffix noise", () => {
  assert.equal(normalizeCompetitiveName("QTC Medical Services, Inc."), "qtc medical services");
  assert.equal(normalizeCompetitiveName("Acuity International LLC"), "acuity international");
});

test("competitive identity matching rejects unrelated same-brand federal contractors", () => {
  assert.equal(matchCompetitiveIdentity("Axiom Resource Management Inc", null, [axiom]), null);
  assert.equal(matchCompetitiveIdentity("Axiom Corporation", null, [axiom]), null);
  const exact = matchCompetitiveIdentity("Axiom Medical Consulting LLC", null, [axiom]);
  assert.equal(exact?.competitor.id, "axiom-medical");
  assert.equal(exact?.method, "exact-name-or-alias");
});

test("competitive identity matching prefers a verified UEI", () => {
  const verified = { ...axiom, uei: "ABCDEF123456" };
  const match = matchCompetitiveIdentity("Completely Different Display Name", "ABCDEF123456", [verified]);
  assert.equal(match?.competitor.id, "axiom-medical");
  assert.equal(match?.method, "uei");
  assert.equal(match?.confidence, 1);
});

test("competitive persistence seeds the expanded researched watchlist", async () => {
  await ensureCompetitiveAwardsPersistence();
  const overview = await getCompetitiveOverview(365);
  const names = new Set(overview.watchlist.map((item) => item.displayName));
  assert.ok(overview.watchlist.length >= 25, `expected expanded watchlist, received ${overview.watchlist.length}`);
  for (const required of [
    "Concentra",
    "Leidos QTC Health Services",
    "Acuity International",
    "OptumServe Health Services / LHI",
    "Loyal Source Government Services",
    "Veterans Evaluation Services",
    "eScreen / Abbott",
    "DISA Global Solutions",
    "First Advantage",
  ]) {
    assert.ok(names.has(required), `watchlist is missing ${required}`);
  }
});

test("reverse-discovered candidate can be promoted to the watchlist", async () => {
  await ensureCompetitiveAwardsPersistence();
  const normalized = "integration test occupational health";
  const candidateId = "candidate-integration-test-occupational-health";
  await pool.query(`DELETE FROM competitive_candidates WHERE id = $1 OR normalized_name = $2`, [candidateId, normalized]);
  await pool.query(`DELETE FROM competitive_watchlist WHERE id LIKE 'discovered-%' AND canonical_name = $1`, ["Integration Test Occupational Health"]);
  await pool.query(
    `INSERT INTO competitive_candidates
      (id, display_name, normalized_name, award_count, total_value, source_scopes, sample_awards, status)
     VALUES ($1,$2,$3,3,1250000,'["federal","state"]'::jsonb,'[]'::jsonb,'candidate')`,
    [candidateId, "Integration Test Occupational Health", normalized],
  );

  const approved = await approveCompetitiveCandidate(candidateId);
  assert.equal(approved.displayName, "Integration Test Occupational Health");
  assert.equal(approved.status, "active");
  assert.equal(approved.relationshipType, "discovered-award-winner");

  const { rows } = await pool.query(`SELECT status, approved_competitor_id FROM competitive_candidates WHERE id = $1`, [candidateId]);
  assert.equal(rows[0]?.status, "approved");
  assert.equal(rows[0]?.approved_competitor_id, approved.id);

  await pool.query(`DELETE FROM competitive_candidates WHERE id = $1`, [candidateId]);
  await pool.query(`DELETE FROM competitive_watchlist WHERE id = $1`, [approved.id]);
});
