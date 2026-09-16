import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

test("AOR globe mounts the approved transparent shell as a click-through overlay", () => {
  const live = source("../occu-med-insight-hub/src/pages/reviewer-aor-factors-live.tsx");
  const overlay = source("../occu-med-insight-hub/src/components/insight/AorOrbOverlay.tsx");

  assert.match(live, /<AorOrbOverlay/);
  assert.match(overlay, /aor-orb-shell\.webp/);
  assert.match(overlay, /pointer-events-none/);
  assert.match(overlay, /aria-hidden="true"/);
  assert.match(overlay, /data-testid="aor-orb-overlay"/);
  assert.match(overlay, /aor:projection-change/);
  assert.match(live, /aor:projection-change/);
  assert.match(live, /detail:\s*\{\s*mode/);
  assert.match(live, /halo: options\?\.halo \?\? false/);
  assert.doesNotMatch(overlay, /conic-gradient/);
  assert.doesNotMatch(overlay, /canvas|getContext\(|WebGL|three/i);
});
