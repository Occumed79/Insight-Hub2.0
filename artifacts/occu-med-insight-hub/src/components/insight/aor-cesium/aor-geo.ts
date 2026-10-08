// Client-side index over the server's country boundary GeoJSON. Used for picking
// (point-in-polygon on a Cesium ground pick), country search and camera framing.

export type Ring = number[][];
export type Polygon = Ring[]; // outer ring first, then holes
export type BBox = { west: number; south: number; east: number; north: number };

export type CountryEntry = {
  iso2: string;
  iso3: string;
  name: string;
  polygons: Polygon[];
  boxes: BBox[]; // one per polygon, same order
  focus: BBox; // bbox of the main polygon cluster, ignoring remote territories
};

export type CountryIndex = { byIso2: Map<string, CountryEntry>; list: CountryEntry[] };

type RawFeature = { properties: { iso2: string; iso3: string; name: string }; geometry: { type: string; coordinates: unknown } };

function ringBox(ring: Ring): BBox {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

const area = (box: BBox) => Math.max(0, box.east - box.west) * Math.max(0, box.north - box.south);

export function indexBoundaries(collection: { features: RawFeature[] }): CountryIndex {
  const byIso2 = new Map<string, CountryEntry>();
  for (const feature of collection.features) {
    const { iso2, iso3, name } = feature.properties;
    const polygons = (feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates) as Polygon[];
    let entry = byIso2.get(iso2);
    if (!entry) {
      entry = { iso2, iso3, name, polygons: [], boxes: [], focus: { west: 0, south: 0, east: 0, north: 0 } };
      byIso2.set(iso2, entry);
    }
    for (const polygon of polygons) {
      entry.polygons.push(polygon);
      entry.boxes.push(ringBox(polygon[0]));
    }
  }
  for (const entry of byIso2.values()) {
    const largest = Math.max(...entry.boxes.map(area));
    const main = entry.boxes.filter((box) => area(box) >= largest * 0.08);
    entry.focus = {
      west: Math.min(...main.map((box) => box.west)),
      south: Math.min(...main.map((box) => box.south)),
      east: Math.max(...main.map((box) => box.east)),
      north: Math.max(...main.map((box) => box.north)),
    };
  }
  return { byIso2, list: [...byIso2.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function findCountryAt(index: CountryIndex, lon: number, lat: number): CountryEntry | null {
  for (const entry of index.list) {
    for (let i = 0; i < entry.polygons.length; i += 1) {
      const box = entry.boxes[i];
      if (lon < box.west || lon > box.east || lat < box.south || lat > box.north) continue;
      const polygon = entry.polygons[i];
      if (!inRing(lon, lat, polygon[0])) continue;
      if (polygon.slice(1).some((hole) => inRing(lon, lat, hole))) continue;
      return entry;
    }
  }
  return null;
}

export function searchCountries(index: CountryIndex, query: string, limit = 6): CountryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const starts = index.list.filter((entry) => entry.name.toLowerCase().startsWith(needle) || entry.iso2.toLowerCase() === needle);
  const contains = index.list.filter((entry) => !starts.includes(entry) && entry.name.toLowerCase().includes(needle));
  return [...starts, ...contains].slice(0, limit);
}
