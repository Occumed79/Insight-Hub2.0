import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import boundariesJson from "../../data/aor-countries-50m.geo.json";
import { getAorCountryProfileByIso2 } from "../../data/aor-country-profiles";
import type { CountryRef } from "./types";

type CountryProps = { iso2: string; iso3: string; name: string };
type CountryFeature = Feature<Polygon | MultiPolygon, CountryProps>;

/** Natural Earth 50m country polygons, antimeridian-repaired (see scripts/build-aor-boundaries.mjs). */
export const countryBoundaries = boundariesJson as unknown as FeatureCollection<Polygon | MultiPolygon, CountryProps>;

function features(): CountryFeature[] {
  return countryBoundaries.features as CountryFeature[];
}

function polygonsOf(item: CountryFeature): number[][][][] {
  return item.geometry.type === "Polygon" ? [item.geometry.coordinates as number[][][]] : (item.geometry.coordinates as number[][][][]);
}

function ringBbox(ring: number[][]): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function mergeBbox(a: [number, number, number, number] | null, b: [number, number, number, number]): [number, number, number, number] {
  if (!a) return [...b] as [number, number, number, number];
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * Query boxes for a country. Countries spanning the antimeridian (Russia, Fiji,
 * United States, ...) are split into an eastern and western box so each box
 * satisfies minLon < maxLon and spans < 180 degrees.
 */
export function countryBboxes(iso2: string): Array<[number, number, number, number]> {
  const code = iso2.toUpperCase();
  let all: [number, number, number, number] | null = null;
  let east: [number, number, number, number] | null = null;
  let west: [number, number, number, number] | null = null;
  for (const item of features()) {
    if (item.properties.iso2 !== code) continue;
    for (const polygon of polygonsOf(item)) {
      const box = ringBbox(polygon[0]);
      all = mergeBbox(all, box);
      const mid = (box[0] + box[2]) / 2;
      if (mid >= 0) east = mergeBbox(east, box); else west = mergeBbox(west, box);
    }
  }
  if (!all) return [];
  if (all[2] - all[0] <= 180) return [all];
  return [east, west].filter((box): box is [number, number, number, number] => Boolean(box));
}

function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when the point lies inside any polygon of the country (holes honoured). */
export function pointInCountry(iso2: string, lon: number, lat: number): boolean {
  const code = iso2.toUpperCase();
  for (const item of features()) {
    if (item.properties.iso2 !== code) continue;
    for (const polygon of polygonsOf(item)) {
      if (!inRing(lon, lat, polygon[0])) continue;
      if (polygon.slice(1).some((hole) => inRing(lon, lat, hole))) continue;
      return true;
    }
  }
  return false;
}

export function hasCountryPolygon(iso2: string): boolean {
  const code = iso2.toUpperCase();
  return features().some((item) => item.properties.iso2 === code);
}

export function resolveCountry(iso2Input: string): CountryRef | null {
  const iso2 = String(iso2Input || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) return null;
  const profile = getAorCountryProfileByIso2(iso2);
  const polygonMeta = features().find((item) => item.properties.iso2 === iso2)?.properties;
  if (!profile && !polygonMeta) return null;
  const lon = profile?.longitude ?? null;
  const lat = profile?.latitude ?? null;
  return {
    iso2,
    iso3: profile?.iso3 || polygonMeta?.iso3 || "",
    name: profile?.country || polygonMeta?.name || iso2,
    center: lon !== null && lat !== null ? [lon, lat] : null,
    capital: profile?.capital || null,
    aorRegion: profile?.aorRegion || null,
    bboxes: countryBboxes(iso2),
  };
}
