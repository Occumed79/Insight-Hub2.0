import { wcNumber, wcText, type WarCostsRow } from "./war-costs-utils";

export type ResolvedMapInputs = {
  bases: WarCostsRow[];
  personnel: WarCostsRow[];
  conflicts: WarCostsRow[];
  strikes: WarCostsRow[];
  operations: WarCostsRow[];
  deployments: WarCostsRow[];
  unresolved: number;
};

type ResolveRequest = {
  query: string;
  kind: "country" | "site" | "installation" | "event";
  expectedCountry?: string;
  expectedRegion?: string;
  city?: string;
};

type Resolution = {
  status?: string;
  validated?: boolean;
  coordinates?: { lat?: number; lon?: number };
  provider?: string;
  matchedAddress?: string;
  confidence?: number;
};

type PreparedLayer = {
  direct: WarCostsRow[];
  pending: Array<{ row: WarCostsRow; request: ResolveRequest }>;
  originalCount: number;
};

function directionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const direction = raw.match(/\b([NSEW])\b/i)?.[1]?.toUpperCase() || raw.match(/([NSEW])\s*$/i)?.[1]?.toUpperCase() || "";
  const numericMatch = raw.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  if (!numericMatch) return null;
  let parsed = Number(numericMatch[0]);
  if (!Number.isFinite(parsed)) return null;
  if (direction === "S" || direction === "W") parsed = -Math.abs(parsed);
  if (direction === "N" || direction === "E") parsed = Math.abs(parsed);
  return parsed;
}

function numericField(row: WarCostsRow, ...keys: string[]): number | null {
  for (const key of keys) {
    const parsed = directionalNumber(row[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function warCostsSourceCoordinate(row: WarCostsRow): [number, number] | null {
  const lat = numericField(row, "latitude", "lat");
  const lon = numericField(row, "longitude", "lon", "lng", "long");
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
  const coordinates = row.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const first = directionalNumber(coordinates[0]);
    const second = directionalNumber(coordinates[1]);
    if (first !== null && second !== null) {
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
    }
  }
  return null;
}

function stringArray(row: WarCostsRow, key: string): string[] {
  return Array.isArray(row[key])
    ? (row[key] as unknown[]).filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function country(row: WarCostsRow): string {
  return stringArray(row, "countries")[0] || wcText(row, "country", "countryName", "hostCountry", "targetCountry");
}

function baseName(row: WarCostsRow): string {
  return wcText(row, "name", "baseName", "installation", "site", "facility") || "Defense installation";
}

function place(row: WarCostsRow): string {
  return stringArray(row, "countries")[0] || wcText(row, "country", "countryName", "location", "city", "region", "targetCountry", "hostCountry", "aor", "target");
}

function requestFor(row: WarCostsRow, kind: ResolveRequest["kind"]): ResolveRequest | null {
  const expectedCountry = country(row);
  if (kind === "installation") {
    const query = baseName(row);
    if (!query) return null;
    return {
      query,
      kind,
      city: wcText(row, "city", "location") || undefined,
      expectedRegion: wcText(row, "state", "region") || undefined,
      expectedCountry: expectedCountry || undefined,
    };
  }
  const query = place(row);
  if (!query) return null;
  return { query, kind, expectedCountry: expectedCountry || undefined };
}

function prepareLayer(rows: WarCostsRow[], kind: ResolveRequest["kind"]): PreparedLayer {
  const direct: WarCostsRow[] = [];
  const pending: PreparedLayer["pending"] = [];
  for (const row of rows) {
    if (warCostsSourceCoordinate(row)) direct.push(row);
    else {
      const request = requestFor(row, kind);
      if (request) pending.push({ row, request });
    }
  }
  return { direct, pending, originalCount: rows.length };
}

function applyResolution(row: WarCostsRow, resolution: Resolution | undefined): WarCostsRow | null {
  const lat = Number(resolution?.coordinates?.lat);
  const lon = Number(resolution?.coordinates?.lon);
  if (resolution?.status !== "resolved" || resolution?.validated !== true || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    ...row,
    latitude: lat,
    longitude: lon,
    geospatialProvider: resolution.provider || "resolver",
    geospatialMatchedAddress: resolution.matchedAddress || "",
    geospatialConfidence: resolution.confidence ?? null,
  };
}

async function resolveRequests(requests: ResolveRequest[], force = false): Promise<Resolution[]> {
  if (!requests.length) return [];
  const output: Resolution[] = [];
  for (let index = 0; index < requests.length; index += 250) {
    const chunk = requests.slice(index, index + 250).map((request) => ({ ...request, forceRefresh: force }));
    const response = await fetch("/api/geospatial/resolve-batch", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ requests: chunk }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload?.resolutions)) throw new Error(payload?.error || `Geospatial resolver returned ${response.status}.`);
    output.push(...payload.resolutions);
  }
  return output;
}

function finishLayer(layer: PreparedLayer, resolutions: Resolution[], offset: number) {
  const resolved = layer.pending
    .map((item, index) => applyResolution(item.row, resolutions[offset + index]))
    .filter((row): row is WarCostsRow => Boolean(row));
  return {
    rows: [...layer.direct, ...resolved],
    unresolved: layer.originalCount - layer.direct.length - resolved.length,
    nextOffset: offset + layer.pending.length,
  };
}

export async function resolveDefenseMapInputs(input: {
  bases: WarCostsRow[];
  personnel: WarCostsRow[];
  conflicts: WarCostsRow[];
  strikes: WarCostsRow[];
  operations: WarCostsRow[];
  deployments: WarCostsRow[];
  force?: boolean;
}): Promise<ResolvedMapInputs> {
  const directBases = input.bases.filter((row) => warCostsSourceCoordinate(row));
  const fallbackBases = input.bases
    .filter((row) => !warCostsSourceCoordinate(row))
    .sort((a, b) => wcNumber(b, "personnel", "troops", "size") - wcNumber(a, "personnel", "troops", "size"))
    .slice(0, 50);

  const layers = [
    prepareLayer([...directBases, ...fallbackBases], "installation"),
    prepareLayer(input.personnel, "country"),
    prepareLayer(input.conflicts, "event"),
    prepareLayer(input.strikes, "event"),
    prepareLayer(input.operations, "event"),
    prepareLayer(input.deployments, "event"),
  ] as const;
  const resolutions = await resolveRequests(layers.flatMap((layer) => layer.pending.map((item) => item.request)), input.force);

  let offset = 0;
  const finished = layers.map((layer) => {
    const value = finishLayer(layer, resolutions, offset);
    offset = value.nextOffset;
    return value;
  });

  return {
    bases: finished[0].rows,
    personnel: finished[1].rows,
    conflicts: finished[2].rows,
    strikes: finished[3].rows,
    operations: finished[4].rows,
    deployments: finished[5].rows,
    unresolved: finished.reduce((sum, layer) => sum + layer.unresolved, 0),
  };
}
