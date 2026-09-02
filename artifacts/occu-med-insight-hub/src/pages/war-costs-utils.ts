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
    const value = numericValue(row[key]);
    if (value !== null) return value;
  }

  // WarCosts uses several purpose-specific field names across its downloadable
  // datasets. Resolve only aliases implied by the requested semantic key so a
  // tool can follow source-schema changes without accidentally grabbing an
  // unrelated numeric field.
  const requested = new Set(keys);
  const aliases: string[] = [];
  if (requested.has("aid")) aliases.push("annual2023", "annual2024", "totalSince2001");
  if (requested.has("spending") || requested.has("militarySpending")) aliases.push("spending2024", "spending2026", "latestSpending", "budget", "budget2024", "budget2026");
  if (requested.has("gdpPercent") || requested.has("percentGdp") || requested.has("gdpShare")) aliases.push("pctGDP", "percentGDP", "shareGDP");
  if (requested.has("globalShare") || requested.has("percentWorld") || requested.has("worldShare")) aliases.push("pctWorld", "shareGlobal", "worldPercent");
  if (requested.has("perCapita") || requested.has("spendingPerCapita")) aliases.push("perCapitaSpend", "perCapitaSpending");
  if (requested.has("jobs") || requested.has("directJobs")) aliases.push("defenseJobs", "militaryJobs");
  if (requested.has("dodSpending") || requested.has("contractValue")) aliases.push("defenseSpending", "dodContracts", "contracts");
  if (requested.has("bases") || requested.has("installations")) aliases.push("baseCount", "installationCount", "totalBases");

  for (const key of aliases) {
    const value = numericValue(row[key]);
    if (value !== null) return value;
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

function textFromArrayItem(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object" || Array.isArray(item)) return "";
  return wcText(item as WarCostsRow, "event", "text", "name", "title", "description", "note", "statement");
}

export function wcStringArray(row: WarCostsRow, key: string): string[] {
  const value = row[key];
  if (!Array.isArray(value)) return [];
  return value.map(textFromArrayItem).filter(Boolean);
}

export function wcObjectArray(row: WarCostsRow, key: string): WarCostsRow[] {
  return objectRows(row[key]);
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function dateFromText(text: string, fallbackYear: number): number | null {
  const full = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,)?\s+(\d{4})\b/i);
  const partial = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})\b/i);
  const match = full ?? partial;
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = full ? Number(match[3]) : fallbackYear;
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  return Date.UTC(year, month, day);
}

export function wcConflictStartTimestamp(row: WarCostsRow): number {
  const explicit = wcText(row, "startDate", "dateStarted", "began");
  if (explicit) {
    const parsed = Date.parse(explicit);
    if (Number.isFinite(parsed)) return parsed;
  }
  const startYear = wcNumber(row, "startYear", "year") || new Date().getUTCFullYear();
  const descriptionDate = dateFromText(wcText(row, "description", "summary"), startYear);
  if (descriptionDate !== null) return descriptionDate;
  for (const event of wcStringArray(row, "keyEvents")) {
    const eventDate = dateFromText(event, startYear);
    if (eventDate !== null) return eventDate;
  }
  return Date.UTC(startYear, 0, 1);
}
