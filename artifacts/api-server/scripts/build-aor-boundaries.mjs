// Generates src/data/aor-countries-50m.geo.json from Natural Earth (world-atlas)
// and ISO codes (world-countries). The committed output keeps runtime free of data
// dependencies and repairs antimeridian wrap artifacts (Russia, Fiji) that break
// planar renderers such as Cesium. Run: node scripts/build-aor-boundaries.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const topo = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const countries = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve("world-countries/package.json")), "countries.json"), "utf8"));

const byNumeric = new Map(countries.map((c) => [String(c.ccn3 || "").padStart(3, "0"), c]));
// Natural Earth features that carry no numeric code in world-atlas.
const NAME_OVERRIDES = {
  Kosovo: { iso2: "XK", iso3: "XKX", name: "Kosovo" },
  Somaliland: { iso2: "SO", iso3: "SOM", name: "Somalia" },
  "N. Cyprus": { iso2: "CY", iso3: "CYP", name: "Cyprus" },
};
const DROP_ISO2 = new Set(["AQ"]); // pole-enclosing polygon; not an AOR geography

const round = (n) => Math.round(n * 1000) / 1000;
const clampLon = (n) => Math.max(-180, Math.min(180, round(n)));

// Make longitudes continuous along a ring (may exceed +/-180 afterwards).
function unwrap(ring) {
  const out = [];
  let offset = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [lon, lat] = ring[i];
    if (i > 0) {
      const prevRaw = ring[i - 1][0];
      if (lon - prevRaw > 180) offset -= 360;
      else if (lon - prevRaw < -180) offset += 360;
    }
    out.push([lon + offset, lat]);
  }
  return out;
}

// Sutherland-Hodgman clip of a ring against a vertical half-plane.
function clipRing(ring, edgeLon, keepGreater) {
  const inside = (p) => (keepGreater ? p[0] >= edgeLon : p[0] <= edgeLon);
  const cross = (a, b) => {
    const t = (edgeLon - a[0]) / (b[0] - a[0]);
    return [edgeLon, a[1] + t * (b[1] - a[1])];
  };
  const out = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (inside(a)) {
      out.push(a);
      if (!inside(b)) out.push(cross(a, b));
    } else if (inside(b)) {
      out.push(cross(a, b));
    }
  }
  if (out.length < 4) return null;
  out.push(out[0]);
  return out;
}

function repairPolygon(polygon) {
  const outer = unwrap(polygon[0]);
  const lons = outer.map((p) => p[0]);
  const min = Math.min(...lons);
  const max = Math.max(...lons);
  if (min >= -180 && max <= 180) return [polygon.map((ring) => ring.map(([lon, lat]) => [lon, lat]))];
  const pieces = [];
  const east = max > 180 ? clipRing(outer, 180, false) : outer;
  if (east && (min < 180)) pieces.push(east);
  if (max > 180) {
    const wrapped = clipRing(outer, 180, true);
    if (wrapped) pieces.push(wrapped.map(([lon, lat]) => [lon - 360, lat]));
  }
  if (min < -180) {
    const west = clipRing(outer, -180, true);
    if (west) pieces.push(west);
    const wrappedWest = clipRing(outer, -180, false);
    if (wrappedWest) pieces.push(wrappedWest.map(([lon, lat]) => [lon + 360, lat]));
  }
  // Holes are rare for the affected polygons; keep none rather than emit wrapped holes.
  return pieces.map((piece) => [piece]);
}

const collection = feature(topo, topo.objects.countries);
const out = [];
const dropped = [];
for (const item of collection.features) {
  const name = item.properties?.name || "";
  let meta = null;
  if (item.id != null && item.id !== "") {
    const match = byNumeric.get(String(item.id).padStart(3, "0"));
    if (match) meta = { iso2: match.cca2, iso3: match.cca3, name: match.name.common };
  }
  if (!meta && NAME_OVERRIDES[name]) meta = NAME_OVERRIDES[name];
  if (!meta || DROP_ISO2.has(meta.iso2)) { dropped.push(name || String(item.id)); continue; }
  const polygons = item.geometry.type === "Polygon" ? [item.geometry.coordinates] : item.geometry.coordinates;
  const repaired = polygons.flatMap(repairPolygon).map((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => [clampLon(lon), round(lat)])));
  out.push({ type: "Feature", id: meta.iso2, properties: meta, geometry: { type: "MultiPolygon", coordinates: repaired } });
}

const file = path.join(root, "src/data/aor-countries-50m.geo.json");
fs.writeFileSync(file, JSON.stringify({ type: "FeatureCollection", features: out }));
fs.rmSync(path.join(root, "src/data/aor-countries-50m.topo.json"), { force: true });
console.log(`features=${out.length} unique iso2=${new Set(out.map((f) => f.id)).size} dropped=${dropped.join(", ")}`);
console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
