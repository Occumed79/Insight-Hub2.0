export type WarCostsRow = Record<string, unknown>;

const WRAPPED_ARRAY_KEYS = [
  "topRecipients",
  "countries",
  "states",
  "items",
  "examples",
  "records",
  "data",
  "results",
  "rankings",
  "deployments",
  "programs",
  "systems",
] as const;

function objectRows(value: unknown): WarCostsRow[] {
  return Array.isArray(value)
    ? value.filter((item): item is WarCostsRow => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

export function wcRows(data: unknown): WarCostsRow[] {
  const direct = objectRows(data);
  if (direct.length) return direct;
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];

  const record = data as WarCostsRow;
  for (const key of WRAPPED_ARRAY_KEYS) {
    const rows = objectRows(record[key]);
    if (rows.length) return rows;
  }

  // Last-resort schema resilience for newly added WarCosts feeds: if exactly one
  // object-valued property is an array of records, treat that as the feed body.
  const candidates = Object.values(record).map(objectRows).filter((rows) => rows.length > 0);
  return candidates.length === 1 ? candidates[0] : [];
}

export function wcObject(data: unknown): WarCostsRow {
  return data && typeof data === "object" && !Array.isArray(data) ? data as WarCostsRow : {};
}

export function wcText(row: WarCostsRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function wcNumber(row: WarCostsRow, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[$,%+,]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

export function wcNestedNumber(row: WarCostsRow, parent: string, key: string): number {
  const child = row[parent];
  return child && typeof child === "object" ? wcNumber(child as WarCostsRow, key) : 0;
}

export function wcMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

export function wcInteger(value: number): string { return Math.round(value).toLocaleString(); }
export function wcConflictCost(row: WarCostsRow): number { return wcNumber(row, "costInflationAdjusted", "warCostAdjusted2024", "totalCost", "cost", "amount"); }
export function wcConflictDeaths(row: WarCostsRow): number { return wcNestedNumber(row, "usCasualties", "deaths") || wcNestedNumber(row, "casualties", "military") || wcNumber(row, "totalUSDeaths", "usDeaths", "deaths"); }
export function wcCivilianDeaths(row: WarCostsRow): number { return wcNumber(row, "civilianDeaths", "civilianCasualties"); }
export function wcConflictDuration(row: WarCostsRow): number {
  const computed = row.computed && typeof row.computed === "object" ? row.computed as WarCostsRow : {};
  return wcNumber(computed, "durationYears") || Math.max(0, (wcNumber(row, "endYear") || new Date().getFullYear()) - wcNumber(row, "startYear"));
}
export function wcConflictId(row: WarCostsRow): string { return wcText(row, "id", "slug", "name"); }
export function wcConflictName(row: WarCostsRow): string { return wcText(row, "name", "shortName", "title") || "Unnamed conflict"; }
export function wcStringArray(row: WarCostsRow, key: string): string[] {
  const value = row[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
