import type { AdapterContext, AdapterResult, CountryRef, Dimension, EvidenceRecord, Freshness, SourceStatus } from "./types";

export type Row = Record<string, unknown>;

export function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}
export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function isoOrNull(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || "Source request failed.")).slice(0, 240);
}
export function slug(value: string): string {
  return normalize(value).replace(/\s+/g, "-").slice(0, 60) || "item";
}

type RecordInit = Partial<EvidenceRecord> & Pick<EvidenceRecord, "dimension" | "category" | "subtype" | "title" | "summary" | "sourceName" | "sourceUrl" | "freshness">;

export function makeRecord(ctx: AdapterContext, sourceId: string, init: RecordInit): EvidenceRecord {
  const { country } = ctx;
  return {
    evidence: "",
    severity: null,
    severityLevel: null,
    recommendationType: null,
    requirementType: null,
    publishedAt: null,
    updatedAt: null,
    retrievedAt: ctx.now().toISOString(),
    country: country.name,
    iso2: country.iso2,
    iso3: country.iso3,
    region: null,
    geometry: { type: "None" },
    geographyLevel: "unresolved",
    geographyNote: null,
    ...init,
    id: init.id || `${sourceId}:${country.iso2}:${slug(init.subtype)}:${slug(init.title)}`,
  };
}

export function result(
  ctx: AdapterContext,
  meta: { sourceId: string; sourceName: string; sourceUrl: string; dimension: Dimension | "multi"; freshness: Freshness | null },
  status: SourceStatus,
  records: EvidenceRecord[],
  note: string | null = null,
): AdapterResult {
  return { ...meta, status, records, note, retrievedAt: ctx.now().toISOString() };
}

export function countryNameMatches(country: CountryRef, candidate: string): boolean {
  const needle = normalize(country.name);
  const hay = ` ${normalize(candidate)} `;
  if (!needle || !hay.trim()) return false;
  if (hay.includes(` ${needle} `)) return true;
  const aliases: Record<string, string[]> = {
    "united states": ["usa", "u s", "united states of america"],
    "united kingdom": ["uk", "great britain"],
    "democratic republic of the congo": ["drc", "dr congo", "democratic republic of congo"],
    "czechia": ["czech republic"],
    "turkiye": ["turkey"],
    "myanmar": ["burma"],
  };
  return (aliases[needle] || []).some((alias) => hay.includes(` ${alias} `));
}
