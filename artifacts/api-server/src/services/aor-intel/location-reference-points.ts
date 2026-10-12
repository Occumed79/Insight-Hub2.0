// Camera / marker reference points for directory locations. These are NAVIGATION ANCHORS ONLY: they place a marker and aim the camera.
// They are not boundaries, not centroids of a disputed area, and they carry no measurement. Locations without a polygon in the
// repository's boundary file keep a point and never receive an invented outline.
//
// Source order:
//   1. world-countries (mledoze/countries, already a dependency) `latlng` by ISO 3166-1 alpha-3 / alpha-2 — a country-level point.
//   2. The small published-coordinate table below, for the directory rows that have no ISO 3166-1 code (GENC/workbook-only
//      codes and sub-national entities). Values are the published location of the named island, island group or town,
//      rounded to 0.01°, with the chosen anchor stated where the entity is dispersed.

import countries from "world-countries";

export interface ReferencePoint {
  lat: number;
  lon: number;
  source: "world-countries" | "published-coordinate";
  /** What the point marks, stated where it is not obvious. */
  note: string | null;
}

type Entry = { lat: number; lon: number; note?: string };

/** Keyed by directory record id. */
export const PUBLISHED_COORDINATES: Record<string, Entry> = {
  XQZ: { lat: 34.62, lon: 32.97, note: "Akrotiri Sovereign Base Area (RAF Akrotiri)" },
  "GEO:ASCENSION_ISLAND": { lat: -7.95, lon: -14.36 },
  XAC: { lat: -12.23, lon: 123.08, note: "Ashmore Reef; Cartier Island lies about 50 km to the east" },
  XBK: { lat: 0.19, lon: -176.48 },
  "GEO:AZORES": { lat: 38.65, lon: -28.0, note: "Archipelago midpoint" },
  "GEO:BONAIRE": { lat: 12.15, lon: -68.27 },
  "GEO:CANARY_ISLANDS": { lat: 28.3, lon: -16.0, note: "Archipelago midpoint" },
  "GEO:CEUTA": { lat: 35.89, lon: -5.32 },
  CPT: { lat: 10.3, lon: -109.22 },
  XCS: { lat: -18.0, lon: 152.0, note: "Coral Sea Islands Territory is dispersed; point marks the territory's general position" },
  XXD: { lat: 34.98, lon: 33.75, note: "Dhekelia Sovereign Base Area" },
  "GEO:FRENCH_SOUTHERN_TERRITORIES_AMSTERDAM_AND_SAINT_PAUL_ISLANDS": { lat: -37.83, lon: 77.55, note: "Amsterdam Island" },
  "GEO:FRENCH_SOUTHERN_TERRITORIES_CROZET_ISLANDS": { lat: -46.43, lon: 51.77, note: "Île de la Possession" },
  "GEO:FRENCH_SOUTHERN_TERRITORIES_KERGUELEN_ISLANDS": { lat: -49.35, lon: 70.22, note: "Grande Terre" },
  "GEO:FRENCH_SOUTHERN_TERRITORIES_ILES_EPARSES": { lat: -17.05, lon: 42.72, note: "Juan de Nova Island; the Îles Éparses are scattered around the Mozambique Channel and Madagascar" },
  "GEO:GAZA_STRIP": { lat: 31.42, lon: 34.35 },
  XHO: { lat: 0.81, lon: -176.62 },
  XJM: { lat: 71.0, lon: -8.5 },
  XJV: { lat: -0.37, lon: -159.99 },
  XJA: { lat: 16.73, lon: -169.53 },
  XKR: { lat: 6.38, lon: -162.42 },
  "GEO:MADEIRA": { lat: 32.76, lon: -16.96 },
  "GEO:MELILLA": { lat: 35.29, lon: -2.94 },
  XMW: { lat: 28.21, lon: -177.37 },
  XNV: { lat: 18.41, lon: -75.01 },
  XPL: { lat: 5.89, lon: -162.08 },
  XPR: { lat: 16.5, lon: 112.0, note: "General position of the Paracel Islands (sovereignty disputed)" },
  "GEO:SABA": { lat: 17.63, lon: -63.23 },
  "GEO:SAINT_HELENA_ISLAND": { lat: -15.95, lon: -5.72 },
  "GEO:SINT_EUSTATIUS": { lat: 17.49, lon: -62.98 },
  XSP: { lat: 10.0, lon: 114.0, note: "General position of the Spratly Islands (sovereignty disputed)" },
  XSV: { lat: 78.0, lon: 16.0 },
  "GEO:TRISTAN_DA_CUNHA": { lat: -37.11, lon: -12.28 },
  "GEO:UNITED_STATES_ALASKA": { lat: 64.2, lon: -152.5, note: "Marks Alaska; the United States outline on the map is shared by three commands and is not shaded as one AOR" },
  "GEO:UNITED_STATES_CONTIGUOUS_48_STATES_AND_WASHINGTON_DC": { lat: 39.8, lon: -98.6, note: "Marks the contiguous 48 states; the United States outline on the map is shared by three commands and is not shaded as one AOR" },
  "GEO:UNITED_STATES_HAWAII": { lat: 20.8, lon: -156.3, note: "Marks Hawaii; the United States outline on the map is shared by three commands and is not shaded as one AOR" },
  XWK: { lat: 19.28, lon: 166.65 },
  "GEO:WEST_BANK": { lat: 31.95, lon: 35.25 },
};

const BY_ALPHA3 = new Map(countries.map((entry) => [entry.cca3, entry.latlng as [number, number]]));
const BY_ALPHA2 = new Map(countries.map((entry) => [entry.cca2, entry.latlng as [number, number]]));

export function referencePointFor(recordId: string, iso3: string | null, iso2: string | null): ReferencePoint | null {
  const published = PUBLISHED_COORDINATES[recordId];
  if (published) return { lat: published.lat, lon: published.lon, source: "published-coordinate", note: published.note ?? null };
  const latlng = (iso3 ? BY_ALPHA3.get(iso3) : undefined) ?? (iso2 ? BY_ALPHA2.get(iso2) : undefined);
  if (!latlng || latlng.length < 2) return null;
  return { lat: latlng[0], lon: latlng[1], source: "world-countries", note: null };
}
