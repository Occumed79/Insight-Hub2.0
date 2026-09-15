import test from "node:test";
import assert from "node:assert/strict";
import {
  AOR_COUNTRY_PROFILE_SOURCE,
  AOR_COUNTRY_PROFILES,
  getAorCountryProfileByIso2,
} from "../../data/aor-country-profiles";
import {
  deriveAorBaselineSignals,
  evaluateDeploymentConditionLens,
} from "../aor-country-factor-service";

test("country baseline contains the exact 197-profile MapTiler dataset with provenance", () => {
  assert.equal(AOR_COUNTRY_PROFILES.length, 197);
  assert.deepEqual(AOR_COUNTRY_PROFILE_SOURCE, {
    name: "AOR_Global_Country_Profiles_MapTiler.xlsx",
    reviewedAt: "2026-08-10",
    profileType: "baseline",
    coverage: 197,
  });

  for (const iso2 of ["AF", "KW", "PL", "DE", "TW", "XK"]) {
    assert.equal(getAorCountryProfileByIso2(iso2)?.iso2, iso2);
  }

  assert.equal(getAorCountryProfileByIso2("ZZ"), null);
  assert.equal(getAorCountryProfileByIso2(""), null);
});

test("country baseline preserves reviewed spreadsheet text for representative countries", () => {
  const afghanistan = getAorCountryProfileByIso2("af");
  assert.ok(afghanistan);
  assert.equal(afghanistan.country, "Afghanistan");
  assert.equal(afghanistan.climateEnvironment, "Mountainous terrain with significant altitude and temperature variation; seismic exposure");
  assert.equal(afghanistan.medicalAccess, "Advanced and specialty care may be limited; confirm referral and evacuation options before they are needed.");
  assert.equal(afghanistan.medicalAccessTier, "Limited / evacuation-sensitive");

  const kuwait = getAorCountryProfileByIso2("KW");
  assert.ok(kuwait);
  assert.equal(kuwait.country, "Kuwait");
  assert.equal(kuwait.climateEnvironment, "Extreme summer heat, dust, and high outdoor thermal load");
  assert.equal(kuwait.medicalAccess, "Urban medical care is available; program/site access still matters.");
  assert.deepEqual(kuwait.reviewWatchItems, ["Heat-sensitive conditions", "Hydration / renal issues", "Cardiovascular exertion", "Medication storage"]);

  const poland = getAorCountryProfileByIso2("PL");
  assert.ok(poland);
  assert.equal(poland.country, "Poland");
  assert.equal(poland.medicalAccessTier, "Advanced");
  assert.equal(poland.travelHealthContext, "Use current destination guidance for routine vaccination, seasonal illness, medication continuity, and location-specific risks.");
});

test("baseline signals are evidence-backed and never invent numeric environmental values", () => {
  const kuwait = getAorCountryProfileByIso2("KW");
  assert.ok(kuwait);
  const kuwaitSignals = deriveAorBaselineSignals(kuwait);
  const keys = new Set(kuwaitSignals.map((signal) => signal.key));
  assert.ok(keys.has("heat"));
  assert.ok(keys.has("dustAir"));
  assert.ok(keys.has("medicationContinuity"));
  assert.ok(kuwaitSignals.every((signal) => signal.evidenceField && signal.evidenceText));
  assert.ok(kuwaitSignals.every((signal) => !/\b(?:aqi|wbgt)\s*[:=]?\s*\d/i.test(signal.evidenceText)));

  const afghanistan = getAorCountryProfileByIso2("AF");
  assert.ok(afghanistan);
  const afghanistanKeys = new Set(deriveAorBaselineSignals(afghanistan).map((signal) => signal.key));
  assert.ok(afghanistanKeys.has("altitude"));
  assert.ok(afghanistanKeys.has("seismic"));
  assert.ok(afghanistanKeys.has("specialtyAccess"));
  assert.ok(afghanistanKeys.has("evacuation"));
});

test("condition lens returns transparent reviewer considerations only when profile evidence supports them", () => {
  const kuwait = getAorCountryProfileByIso2("KW");
  assert.ok(kuwait);

  const asthma = evaluateDeploymentConditionLens({ profile: kuwait, condition: "asthma" });
  assert.ok(asthma.some((item) => item.ruleId === "asthma-dust-air"));
  assert.ok(asthma.every((item) => item.evidenceText.length > 0));
  assert.ok(asthma.every((item) => /review consideration/i.test(item.classification)));
  assert.ok(asthma.every((item) => !/\b(?:fit|unfit|cleared|not cleared)\b/i.test(item.summary)));

  const cardiac = evaluateDeploymentConditionLens({ profile: kuwait, condition: "cardiac history", workContext: "heavy exertion outdoors" });
  assert.ok(cardiac.some((item) => item.ruleId === "cardiac-heat-exertion"));

  const diabetes = evaluateDeploymentConditionLens({ profile: kuwait, condition: "diabetes", medication: "insulin" });
  assert.ok(diabetes.some((item) => item.ruleId === "diabetes-insulin-continuity"));

  const poland = getAorCountryProfileByIso2("PL");
  assert.ok(poland);
  const unsupportedAsthma = evaluateDeploymentConditionLens({ profile: poland, condition: "asthma" });
  assert.equal(unsupportedAsthma.some((item) => item.ruleId === "asthma-dust-air"), false);
});
