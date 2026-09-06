from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text()


def write(rel, text):
    (ROOT / rel).write_text(text)


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label, flags=re.S):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"expected one regex match for {label}, got {count}")
    return updated

# 1) Harden the ACTIVE WHO country route, including Guinea-family disambiguation.
path = "artifacts/api-server/src/routes/aor-country-resilience.ts"
text = read(path)
pattern = r"function countryTerms\(country: string\): string\[\] \{.*?\n\}\n\nfunction matchesCountry\(country: string, \.\.\.values: unknown\[\]\): boolean \{.*?\n\}\n"
replacement = r'''function countryTerms(country: string): string[] {
  const normalized = normalize(country);
  const aliases: Record<string, string[]> = {
    "democratic republic of the congo": ["democratic republic of the congo", "democratic republic of congo", "dr congo", "drc", "congo kinshasa"],
    "democratic republic of congo": ["democratic republic of the congo", "democratic republic of congo", "dr congo", "drc", "congo kinshasa"],
    "republic of the congo": ["republic of the congo", "republic of congo", "congo brazzaville"],
    "republic of congo": ["republic of the congo", "republic of congo", "congo brazzaville"],
    "guinea": ["guinea", "republic of guinea"],
    "guinea bissau": ["guinea bissau", "republic of guinea bissau"],
    "equatorial guinea": ["equatorial guinea", "republic of equatorial guinea"],
    "papua new guinea": ["papua new guinea"],
    "cote d ivoire": ["cote d ivoire", "ivory coast"],
    "czechia": ["czechia", "czech republic"],
    "timor leste": ["timor leste", "east timor"],
    "myanmar": ["myanmar", "burma"],
    "turkiye": ["turkiye", "turkey"],
    "south korea": ["south korea", "republic of korea", "korea republic of"],
    "north korea": ["north korea", "democratic peoples republic of korea", "dprk"],
  };
  return [...new Set([normalized, ...(aliases[normalized] ?? [])].map(normalize).filter(Boolean))];
}

function matchesCountry(country: string, ...values: unknown[]): boolean {
  const terms = countryTerms(country);
  const selected = normalize(country);
  return values.some((value) => {
    let candidate = normalize(text(value));
    if (!candidate) return false;
    // "Guinea" must not match Guinea-Bissau, Equatorial Guinea or Papua New Guinea.
    if (selected === "guinea" || selected === "republic of guinea") {
      candidate = candidate
        .replace(/\bpapua new guinea\b/g, " ")
        .replace(/\bequatorial guinea\b/g, " ")
        .replace(/\b(?:republic of )?guinea bissau\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return terms.some((term) => candidate === term || (` ${candidate} `).includes(` ${term} `));
  });
}
'''
text = regex_once(text, pattern, replacement, "active WHO country matcher")
write(path, text)

# 2) CDC destination validation + fresh/stale last-known-good without disturbing Travel Notices cache.
path = "artifacts/api-server/src/routes/aor-travel-health.ts"
text = read(path)
text = replace_once(
    text,
    'const CACHE_TTL = 6 * 60 * 60_000;\nconst NOTICE_CACHE_TTL = 30 * 60_000;\nconst cache = new Map<string, { expiresAt: number; value: string }>();',
    'const CACHE_TTL = 6 * 60 * 60_000;\nconst DESTINATION_STALE_TTL = 24 * 60 * 60_000;\nconst NOTICE_CACHE_TTL = 30 * 60_000;\nconst cache = new Map<string, { expiresAt: number; value: string }>();\nconst destinationCache = new Map<string, { expiresAt: number; staleUntil: number; raw: string; sourceUrl: string; slug: string }>();',
    "travel cache constants",
)
pattern = r"async function fetchDestination\(country: string\) \{.*?\n\}\n\nfunction diseaseCategory"
replacement = r'''function validateDestinationPage(raw: string) {
  if (!/<html|<!doctype/i.test(raw)) throw new Error("CDC Travelers' Health returned an unexpected response format.");
  const hasVaccines = /Vaccines and Medicines/i.test(raw);
  const hasSafety = /Non-Vaccine-Preventable Diseases|Stay Healthy and Safe/i.test(raw);
  if (!hasVaccines || !hasSafety) throw new Error("CDC Travelers' Health destination page did not contain the expected destination guidance sections.");
}

async function fetchDestination(country: string) {
  const key = normalize(country);
  const now = Date.now();
  const hit = destinationCache.get(key);
  if (hit && hit.expiresAt > now) return { ...hit, cacheState: "fresh" as const };

  let lastError: unknown = null;
  try {
    for (const slug of slugCandidates(country)) {
      const sourceUrl = `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${encodeURIComponent(slug)}`;
      try {
        // The destination cache owns the six-hour freshness window; use a zero-TTL
        // fetch here so an expired destination entry genuinely attempts refresh.
        const raw = await fetchText(sourceUrl, 18_000, 0);
        validateDestinationPage(raw);
        const cached = { raw, sourceUrl, slug, expiresAt: Date.now() + CACHE_TTL, staleUntil: Date.now() + CACHE_TTL + DESTINATION_STALE_TTL };
        destinationCache.set(key, cached);
        return { ...cached, cacheState: "refreshed" as const };
      } catch (error) {
        lastError = error;
        const status = (error as Error & { status?: number })?.status;
        if (status !== 404) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("CDC destination page was not found.");
  } catch (error) {
    if (hit && hit.staleUntil > now) return { ...hit, cacheState: "stale" as const };
    throw error;
  }
}

function diseaseCategory'''
text = regex_once(text, pattern, replacement, "CDC destination loader")
text = replace_once(text, 'function parseTravelHealth(country: string, raw: string, sourceUrl: string) {', 'function parseTravelHealth(country: string, raw: string, sourceUrl: string, cacheState: "fresh" | "refreshed" | "stale") {', "travel parser signature")
text = replace_once(text, '    retrievedAt: new Date().toISOString(),\n    sourceUpdated:', '    retrievedAt: new Date().toISOString(),\n    cacheState,\n    sourceUpdated:', "travel cache state response")
text = replace_once(text, '    const { raw, sourceUrl } = await fetchDestination(country);\n    const parsed = parseTravelHealth(country, raw, sourceUrl);', '    const { raw, cacheState, sourceUrl } = await fetchDestination(country);\n    const parsed = parseTravelHealth(country, raw, sourceUrl, cacheState);', "travel route loader")
text = replace_once(text, '      return res.json({\n        ok: true,\n        available: false,', '      return res.status(502).json({\n        ok: false,\n        available: false,', "travel invalid parse status")
text = replace_once(text, '  } catch {\n    return res.json({\n      ok: true,\n      available: false,', '  } catch (error) {\n    return res.status(502).json({\n      ok: false,\n      available: false,', "travel failure status")
text = replace_once(text, '      clinicalGuidanceLinks: [],\n      sourceNotice: "CDC Travelers\' Health is temporarily unavailable for this destination. Other country intelligence remains active.",', '      clinicalGuidanceLinks: [],\n      error: error instanceof Error ? error.message.slice(0, 240) : "CDC Travelers\' Health request failed.",\n      sourceNotice: "CDC Travelers\' Health is temporarily unavailable for this destination; no values were substituted.",', "travel failure message")
write(path, text)

# 3) Re-run state-driven MapTiler synchronization once layers/sources actually attach.
path = "artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v2.tsx"
text = read(path)
text = replace_once(text, '  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");\n  const [mapError, setMapError] = useState("");', '  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");\n  const [mapLayersRevision, setMapLayersRevision] = useState(0);\n  const [mapError, setMapError] = useState("");', "map revision state")
text = replace_once(text, '          map.addLayer({ id: "aor-live-events-points", type: "circle", source: "aor-live-events", paint: { "circle-radius": ["match", ["get", "kind"], "GDACS", 5.5, 4.5], "circle-color": ["match", ["get", "kind"], "GDACS", "#a785ff", "#65eff4"], "circle-stroke-color": "#ecfeff", "circle-stroke-width": 1.1, "circle-opacity": 0.96 } });\n\n          map.on("mousemove", "aor-country-hit"', '          map.addLayer({ id: "aor-live-events-points", type: "circle", source: "aor-live-events", paint: { "circle-radius": ["match", ["get", "kind"], "GDACS", 5.5, 4.5], "circle-color": ["match", ["get", "kind"], "GDACS", "#a785ff", "#65eff4"], "circle-stroke-color": "#ecfeff", "circle-stroke-width": 1.1, "circle-opacity": 0.96 } });\n\n          // Effects can run before the MapTiler style has attached these layers.\n          // Bump a revision so paint, filters and live GeoJSON synchronize immediately.\n          setMapLayersRevision((revision) => revision + 1);\n\n          map.on("mousemove", "aor-country-hit"', "map attach revision")
text = replace_once(text, '  }, [command, mapMode, selectedCommand]);', '  }, [command, mapMode, mapLayersRevision, selectedCommand]);', "AOR paint revision dependency")
text = replace_once(text, '  }, [mapMode, selectedCountry]);', '  }, [mapLayersRevision, mapMode, selectedCountry]);', "selected country revision dependency")
text = replace_once(text, '  useEffect(() => { mapRef.current?.getSource?.("aor-live-events")?.setData?.(eventGeoJson); }, [eventGeoJson]);', '  useEffect(() => { mapRef.current?.getSource?.("aor-live-events")?.setData?.(eventGeoJson); }, [eventGeoJson, mapLayersRevision]);', "live event revision dependency")
write(path, text)

# 4) Respiratory: partial is valid, all-source failure is not; retain last-known-good stale response.
path = "artifacts/api-server/src/routes/aor-respiratory-surveillance.ts"
text = read(path)
text = replace_once(text, 'const CACHE_TTL = 45 * 60_000;\n\nexport type CsvRow = Record<string, string>;\ntype CachedPayload = { expiresAt: number; value: unknown };', 'const CACHE_TTL = 45 * 60_000;\nconst CACHE_STALE_TTL = 24 * 60 * 60_000;\n\nexport type CsvRow = Record<string, string>;\ntype CachedPayload = { expiresAt: number; staleUntil: number; value: Record<string, unknown> };', "respiratory cache type")
text = replace_once(text, '  return {\n    ok: sourceHealth.some((source) => source.ok),', '  if (!sourceHealth.some((source) => source.ok)) throw new Error("All CDC respiratory surveillance sources failed or returned unusable schemas.");\n\n  return {\n    ok: true,', "respiratory all-source failure")
pattern = r"async function getPayload\(\) \{.*?\n\}\n\nrouter.get\(\"/aor/respiratory-surveillance\""
replacement = r'''async function getPayload() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return { ...cache.value, cacheState: "fresh" as const };
  if (!inFlight) inFlight = loadPayload();
  try {
    const loaded = await inFlight as Record<string, unknown>;
    if (!loaded?.ok) throw new Error("CDC respiratory surveillance returned no usable source signal.");
    cache = { expiresAt: Date.now() + CACHE_TTL, staleUntil: Date.now() + CACHE_TTL + CACHE_STALE_TTL, value: loaded };
    return { ...loaded, cacheState: "refreshed" as const };
  } catch (error) {
    if (cache && cache.staleUntil > now) return { ...cache.value, cacheState: "stale" as const };
    throw error;
  } finally { inFlight = null; }
}

router.get("/aor/respiratory-surveillance"'''
text = regex_once(text, pattern, replacement, "respiratory stale cache")
write(path, text)

# 5) WHO workbook: lazy fresh cache + last-known-good stale fallback with explicit cacheState.
path = "artifacts/api-server/src/routes/aor-immunization.ts"
text = read(path)
text = replace_once(text, 'const CACHE_TTL = 24 * 60 * 60_000;\n\ntype DatasetKey', 'const CACHE_TTL = 24 * 60 * 60_000;\nconst CACHE_STALE_TTL = 7 * 24 * 60 * 60_000;\n\ntype DatasetKey', "WHO stale ttl")
text = replace_once(text, 'type CachedWorkbook = { expiresAt: number; rows: Row[]; sourceUrl: string };', 'type CachedWorkbook = { expiresAt: number; staleUntil: number; rows: Row[]; sourceUrl: string };', "WHO cache type")
text = replace_once(text, '      return { rows, sourceUrl, expiresAt: Date.now() + CACHE_TTL };', '      return { rows, sourceUrl, expiresAt: Date.now() + CACHE_TTL, staleUntil: Date.now() + CACHE_TTL + CACHE_STALE_TTL };', "WHO cache timestamps")
pattern = r"async function workbook\(dataset: DatasetKey\) \{.*?\n\}\n\nfunction rowCountry"
replacement = r'''async function workbook(dataset: DatasetKey) {
  const now = Date.now();
  const hit = caches.get(dataset);
  if (hit && hit.expiresAt > now) return { loaded: hit, cacheState: "fresh" as const };
  let promise = inFlight.get(dataset);
  if (!promise) { promise = downloadWorkbook(dataset); inFlight.set(dataset, promise); }
  try {
    const loaded = await promise;
    caches.set(dataset, loaded);
    return { loaded, cacheState: "refreshed" as const };
  } catch (error) {
    if (hit && hit.staleUntil > now) return { loaded: hit, cacheState: "stale" as const };
    throw error;
  } finally { inFlight.delete(dataset); }
}

function rowCountry'''
text = regex_once(text, pattern, replacement, "WHO workbook stale cache")
text = replace_once(text, '    const loaded = await workbook(dataset);\n    const recognizableRows = loaded.rows.filter', '    const workbookResult = await workbook(dataset);\n    const loaded = workbookResult.loaded;\n    const recognizableRows = loaded.rows.filter', "WHO route workbook result")
text = replace_once(text, '      ok: true, dataset, retrievedAt: new Date().toISOString(), source: "WHO Immunization Data Portal", sourceUrl: loaded.sourceUrl,', '      ok: true, dataset, cacheState: workbookResult.cacheState, retrievedAt: new Date().toISOString(), source: "WHO Immunization Data Portal", sourceUrl: loaded.sourceUrl,', "WHO response cache state")
write(path, text)

# 6) Mobile surveillance control: keep it clickable above the fixed mobile shell and expose selected WHO metric semantics visibly.
path = "artifacts/occu-med-insight-hub/src/components/insight/AorSurveillanceLayers.tsx"
text = read(path)
text = replace_once(text, 'type RespiratoryPayload = { ok: boolean; partial?: boolean; retrievedAt?: string;', 'type RespiratoryPayload = { ok: boolean; partial?: boolean; cacheState?: "fresh" | "refreshed" | "stale"; retrievedAt?: string;', "respiratory frontend cacheState")
text = replace_once(text, 'type ImmunizationPayload = { ok: boolean; dataset: string;', 'type ImmunizationPayload = { ok: boolean; dataset: string; cacheState?: "fresh" | "refreshed" | "stale";', "immunization frontend cacheState")
text = replace_once(text, '  return <div className="absolute bottom-3 left-3 z-20" data-testid="aor-surveillance-layers">', '  return <div className="pointer-events-auto absolute bottom-3 left-3 z-[950]" data-testid="aor-surveillance-layers">', "mobile surveillance stacking")
needle = '<SmallMetric label="Metric" value={immunization.selected?.item || "—"} />'
replacement = '<SmallMetric label="Metric" value={immunization.selected?.item || "—"} /><p data-testid="who-immunization-selection" className="sm:col-span-3 rounded-lg border border-cyan-100/10 bg-cyan-300/[0.025] px-2 py-1.5 text-[8px] font-black text-cyan-50/58">{immunization.selected?.item || "Metric"} {immDataset === "coverage" ? "coverage" : immDataset === "incidence" ? "incidence rate" : immDataset === "cases" ? "reported cases" : immDataset === "introduction" ? "vaccine introduction" : "program indicator"}{immunization.cacheState === "stale" ? " · stale last-known-good" : ""}</p>'
text = replace_once(text, needle, replacement, "WHO visible selected metric")
write(path, text)

# 7) Focused regression coverage (static guards + active-route disambiguation source assertions).
test_path = ROOT / "artifacts/api-server/src/services/__tests__/aor-regressions.test.ts"
test_path.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport { resolve } from "node:path";\n\nconst root = resolve(import.meta.dirname, "../../../..");\nconst source = (path: string) => readFileSync(resolve(root, path), "utf8");\n\ntest("active WHO route disambiguates Guinea-family country names and never substitutes unrelated items", () => {\n  const text = source("src/routes/aor-country-resilience.ts");\n  assert.match(text, /papua new guinea/);\n  assert.match(text, /equatorial guinea/);\n  assert.match(text, /guinea bissau/);\n  assert.match(text, /fallbackUsed: false/);\n});\n\ntest("CDC destination route validates pages, exposes cache state and fails closed", () => {\n  const text = source("src/routes/aor-travel-health.ts");\n  assert.match(text, /validateDestinationPage/);\n  assert.match(text, /cacheState/);\n  assert.match(text, /DESTINATION_STALE_TTL/);\n  assert.match(text, /status\(502\)/);\n});\n\ntest("MapTiler layer synchronization reruns after sources attach", () => {\n  const text = source("../occu-med-insight-hub/src/pages/reviewer-aor-factors-v2.tsx");\n  assert.match(text, /mapLayersRevision/);\n  assert.match(text, /setMapLayersRevision/);\n});\n\ntest("respiratory feed preserves partial data but rejects total upstream failure and supports stale LKG", () => {\n  const text = source("src/routes/aor-respiratory-surveillance.ts");\n  assert.match(text, /All CDC respiratory surveillance sources failed/);\n  assert.match(text, /CACHE_STALE_TTL/);\n  assert.match(text, /cacheState: "stale"/);\n});\n\ntest("WHO workbooks remain lazy and expose stale last-known-good cache state", () => {\n  const text = source("src/routes/aor-immunization.ts");\n  assert.match(text, /inFlight = new Map<DatasetKey/);\n  assert.match(text, /CACHE_STALE_TTL/);\n  assert.match(text, /cacheState: "stale"/);\n  assert.match(text, /requestedItemNormalized/);\n});\n''')

# 8) Update reviewed repository baseline for the single new regression file.
path = "docs/repository-cleanup-baseline.json"
text = read(path)
text = text.replace('"totalFiles": 317', '"totalFiles": 318', 1)
if 'aor-regressions.test.ts' not in text:
    anchor = '    "artifacts/api-server/src/services/__tests__/oshaPersistence.test.ts",'
    text = replace_once(text, anchor, anchor + '\n    "artifacts/api-server/src/services/__tests__/aor-regressions.test.ts",', "baseline regression test")
text = text.replace('repository file ceiling to 317', 'repository file ceiling to 318')
write(path, text)

print("AOR hardening patch applied successfully")
