import assert from "node:assert/strict";
import test from "node:test";
import { FUNGAL_SOURCE_NOTE_LABELS, FUNGAL_SOURCE_NOTES } from "../../routes/aor-fungal-source-notes";

test("fungal burden source evidence preserves published table comments and assumptions", () => {
  assert.equal(Object.keys(FUNGAL_SOURCE_NOTES.candidemia ?? {}).length, 39);
  assert.equal(Object.keys(FUNGAL_SOURCE_NOTES["invasive-aspergillosis"] ?? {}).length, 40);
  assert.equal(Object.keys(FUNGAL_SOURCE_NOTES.pcp ?? {}).length, 40);
  assert.equal(Object.keys(FUNGAL_SOURCE_NOTES.abpa ?? {}).length, 43);
  assert.equal(Object.keys(FUNGAL_SOURCE_NOTES["fungal-keratitis"] ?? {}).length, 13);

  assert.equal(FUNGAL_SOURCE_NOTE_LABELS.candidemia, "Source comment");
  assert.match(FUNGAL_SOURCE_NOTES.candidemia?.BR ?? "", /No local incidence data/i);
  assert.match(FUNGAL_SOURCE_NOTES["invasive-aspergillosis"]?.DK ?? "", /COPD admissions/i);
  assert.match(FUNGAL_SOURCE_NOTES.pcp?.UG ?? "", /pneumonia/i);
  assert.match(FUNGAL_SOURCE_NOTES.abpa?.GB ?? "", /cystic fibrosis/i);
  assert.match(FUNGAL_SOURCE_NOTES["fungal-keratitis"]?.PH ?? "", /tertiary government hospital/i);

  // Tables 5 (CPA) and 7 (SAFS) do not publish a fourth country-level
  // comments/assumptions column, so no synthetic notes may be invented.
  assert.equal(FUNGAL_SOURCE_NOTES.cpa, undefined);
  assert.equal(FUNGAL_SOURCE_NOTES.safs, undefined);
});
