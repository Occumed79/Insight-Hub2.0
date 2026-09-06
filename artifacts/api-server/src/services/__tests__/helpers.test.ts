/**
 * Unit tests for employer-intelligence and source-normalization helper functions.
 *
 * Run with: npx tsx src/services/__tests__/helpers.test.ts
 *
 * These tests cover pure helper functions — no network calls, no env deps.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateRate,
  normalizeName,
  nameSimilarity,
} from "../oshaDataService";
import { deriveServiceTags, getOccupationFamily } from "../onetService";
import {
  normalizeAriRows,
  normalizePositivityRows,
  normalizeRtRows,
  normalizeWastewaterRows,
} from "../../routes/aor-respiratory-surveillance";

describe("calculateRate", () => {
  it("returns undefined for zero hours", () => {
    assert.equal(calculateRate(5, 0), undefined);
  });

  it("calculates TRC rate correctly", () => {
    assert.equal(calculateRate(10, 200000), 10);
  });

  it("calculates rate with fractional result", () => {
    assert.equal(calculateRate(3, 100000), 6);
  });

  it("handles large numbers", () => {
    assert.equal(calculateRate(50, 500000), 20);
  });
});

describe("normalizeName", () => {
  it("lowercases and strips suffixes", () => {
    assert.equal(normalizeName("Acme Construction Inc."), "acme construction");
  });

  it("handles multiple suffixes", () => {
    assert.equal(normalizeName("The Global Logistics Corp"), "global logistics");
  });

  it("handles LLC", () => {
    assert.equal(normalizeName("Delta Manufacturing LLC"), "delta manufacturing");
  });

  it("handles extra whitespace and commas", () => {
    assert.equal(normalizeName("  Acme,  Inc.  "), "acme");
  });

  it("handles Ltd", () => {
    assert.equal(normalizeName("Smith Engineering Ltd"), "smith engineering");
  });
});

describe("nameSimilarity", () => {
  it("returns 1.0 for identical normalized names", () => {
    assert.equal(nameSimilarity("Acme Inc", "Acme Inc."), 1.0);
  });

  it("returns 0.85 for a real substring match", () => {
    assert.equal(nameSimilarity("Acme", "Acme Construction Inc"), 0.85);
  });

  it("returns 0 for no common words", () => {
    assert.equal(nameSimilarity("Acme Construction", "Global Logistics"), 0);
  });

  it("returns partial match for shared words", () => {
    const sim = nameSimilarity("Acme Construction Services", "Acme Logistics Services");
    assert.ok(sim > 0 && sim <= 0.8);
  });

  it("returns 0 for empty strings", () => {
    assert.equal(nameSimilarity("", ""), 0);
  });
});

describe("deriveServiceTags", () => {
  it("returns fitness-for-duty tags for physical lifting indicators", () => {
    const tags = deriveServiceTags(
      ["Spend Time Lifting/Carrying: Continually (5.5+ hours/day)"],
      [],
      [],
    );
    assert.ok(tags.includes("fitness-for-duty"));
    assert.ok(tags.includes("return-to-work"));
    assert.ok(tags.includes("functional-capacity"));
    assert.ok(tags.includes("physical-exams"));
  });

  it("returns respirator tags for respiratory exposure indicators", () => {
    const tags = deriveServiceTags([], ["Exposed to Contaminants: Yes"], []);
    assert.ok(tags.includes("respirator-clearance"));
    assert.ok(tags.includes("pulmonary-function"));
    assert.ok(tags.includes("osha-medical-surveillance"));
  });

  it("returns hearing tags for noise exposure indicators", () => {
    const tags = deriveServiceTags([], ["Exposed to Noise: Yes"], []);
    assert.ok(tags.includes("audiograms"));
    assert.ok(tags.includes("hearing-conservation"));
  });

  it("returns DOT tags for driving indicators", () => {
    const tags = deriveServiceTags([], [], ["Operate Vehicles: Yes"]);
    assert.ok(tags.includes("dot-exams"));
    assert.ok(tags.includes("drug-screens"));
    assert.ok(tags.includes("sleep-apnea-screening"));
  });

  it("returns heat stress tags for outdoor/heat indicators", () => {
    const tags = deriveServiceTags(
      [],
      ["Outdoors, Exposed to Weather: Yes", "Exposed to Heat: Yes"],
      [],
    );
    assert.ok(tags.includes("heat-stress-surveillance"));
    assert.ok(tags.includes("annual-exams"));
  });

  it("returns medical surveillance tags for hazardous exposure", () => {
    const tags = deriveServiceTags([], [], ["Wear Common Protective/Safety Equipment: Yes"]);
    assert.ok(tags.includes("occupational-medical-surveillance"));
    assert.ok(tags.includes("labs"));
    assert.ok(tags.includes("respirator-evaluations"));
  });

  it("returns empty array for no relevant indicators", () => {
    assert.deepEqual(deriveServiceTags([], [], []), []);
  });

  it("deduplicates tags", () => {
    const tags = deriveServiceTags(
      ["Lifting required", "Carrying heavy objects"],
      ["Exposed to Contaminants"],
      ["Wear Protective Equipment"],
    );
    const unique = new Set(tags);
    assert.equal(tags.length, unique.size);
  });
});

describe("getOccupationFamily", () => {
  it("maps 47- prefix to Construction and Extraction", () => {
    assert.equal(getOccupationFamily("47-2061"), "Construction and Extraction");
  });

  it("maps 53- prefix to Transportation and Material Moving", () => {
    assert.equal(getOccupationFamily("53-3032"), "Transportation and Material Moving");
  });

  it("maps 29- prefix to Healthcare Practitioners", () => {
    assert.equal(getOccupationFamily("29-1141"), "Healthcare Practitioners");
  });

  it("maps 33- prefix to Protective Service", () => {
    assert.equal(getOccupationFamily("33-9032"), "Protective Service");
  });

  it("returns Other for unknown prefix", () => {
    assert.equal(getOccupationFamily("99-9999"), "Other");
  });
});

describe("CDC respiratory source schema normalization", () => {
  it("normalizes current ARI week_end/geography/label columns", () => {
    const rows = normalizeAriRows([
      { week_end: "2026-08-22", geography: "California", label: "Low", BuildNumber: "2026-08-28" },
      { week_end: "2026-08-22", geography: "Virgin Islands", label: "Data Unavailable", BuildNumber: "2026-08-28" },
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { date: "2026-08-22", location: "California", stateAbbreviation: "", level: "Low" });
    assert.equal(rows[1].location, "Virgin Islands");
    assert.equal(rows[1].level, "Data Unavailable");
  });

  it("normalizes current Rt archive columns and keeps the newest model run", () => {
    const rows = normalizeRtRows([
      { as_of: "2026-07-15", disease: "COVID-19", state: "CA", date: "2026-07-13", median: "0.92", lower: "0.81", upper: "1.04", interval_width: "0.23", p_growing: "0.21", category: "Likely declining" },
      { as_of: "2026-07-22", disease: "COVID-19", state: "CA", date: "2026-07-20", median: "1.12", lower: "0.98", upper: "1.29", interval_width: "0.31", p_growing: "0.88", category: "Likely growing" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].location, "CA");
    assert.equal(rows[0].pathogen, "COVID-19");
    assert.equal(rows[0].rtEstimate, 1.12);
    assert.equal(rows[0].rtLower, 0.98);
    assert.equal(rows[0].rtUpper, 1.29);
    assert.equal(rows[0].pGrowing, 0.88);
    assert.equal(rows[0].epidemicTrend, "Likely growing");
    assert.equal(rows[0].asOf, "2026-07-22");
  });

  it("preserves the compact Rt interval and ED visit level from the CDC map export schema", () => {
    const rows = normalizeRtRows([
      { Date: "2026-08-25", Location: "Alabama", pathogen: "COVID-19", state_abbreviation: "AL", "Epidemic Trend": "Growing", "Rt Estimate": "1.17 (1.12 - 1.22)", "Emergency Department Visit Level": "Very Low" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].location, "Alabama");
    assert.equal(rows[0].stateAbbreviation, "AL");
    assert.equal(rows[0].rtEstimate, 1.17);
    assert.equal(rows[0].rtLower, 1.12);
    assert.equal(rows[0].rtUpper, 1.22);
    assert.ok(Math.abs(Number(rows[0].intervalWidth) - 0.1) < 1e-9);
    assert.equal(rows[0].emergencyDepartmentVisitLevel, "Very Low");
  });

  it("normalizes current national positivity columns", () => {
    const rows = normalizePositivityRows([
      { week_end: "2026-07-18", pathogen: "Influenza", percent_test_positivity: "1.7" },
      { week_end: "2026-07-18", pathogen: "RSV", percent_test_positivity: "0.8" },
    ]);
    assert.deepEqual(rows[0], { date: "2026-07-18", pathogen: "Influenza", percentPositive: 1.7 });
    assert.deepEqual(rows[1], { date: "2026-07-18", pathogen: "RSV", percentPositive: 0.8 });
  });

  it("normalizes WVAL columns and ignores non-All Results collection periods", () => {
    const rows = normalizeWastewaterRows([
      { Week_Ending_Date: "2026-08-22", "State/Territory": "California", Data_Collection_Period: "All Results", "State/Territory_WVAL": "3.4", WVAL_Category: "Low", date_updated: "2026-08-28" },
      { Week_Ending_Date: "2026-08-22", "State/Territory": "California", Data_Collection_Period: "15 days", "State/Territory_WVAL": "7.8", WVAL_Category: "High", date_updated: "2026-08-28" },
    ], "COVID-19");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].location, "California");
    assert.equal(rows[0].pathogen, "COVID-19");
    assert.equal(rows[0].activityLevel, "Low");
    assert.equal(rows[0].activityValue, 3.4);
    assert.equal(rows[0].dataCollectionPeriod, "All Results");
  });
});
