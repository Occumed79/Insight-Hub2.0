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
  "programs",
] as const;

function objectRows(value: unknown): WarCostsRow[] {
  return Array.isArray(value)
    ? value.filter((item): item is WarCostsRow => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%+,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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

  const candidates = Object.values(record).map(objectRows).filter((rows) => rows.length > 0);
  return candidates.length === 1 ? candidates[0] : [];
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
    const value = numericValue(row[key]);
    if (value !== null) return value;
  }

  const requested = new Set(keys);
  const aliases: string[] = [];
  if (requested.has("spending") || requested.has("amount") || requested.has("total")) aliases.push("spending2024", "spending2026", "latestSpending", "projectValue", "constructionValue");
  if (requested.has("personnel") || requested.has("troops")) aliases.push("assignedPersonnel", "totalPersonnel", "personnelCount");
  if (requested.has("bases") || requested.has("installations")) aliases.push("baseCount", "installationCount", "totalBases");

  for (const key of aliases) {
    const value = numericValue(row[key]);
    if (value !== null) return value;
  }
  return 0;
}

export function wcMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}
