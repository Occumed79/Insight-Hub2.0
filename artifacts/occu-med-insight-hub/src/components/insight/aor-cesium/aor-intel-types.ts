// Mirrors artifacts/api-server/src/services/aor-intel/types.ts (response shape only).

export type Freshness =
  | "NEAR_REAL_TIME" | "CURRENT_NOTICE" | "WEEKLY_SURVEILLANCE" | "CURRENT_GUIDANCE"
  | "HISTORICAL_CLIMATOLOGICAL" | "STRUCTURAL_DATA" | "STALE_CACHE";

export type Dimension = "health_vaccines" | "malaria" | "outbreaks" | "environment" | "disasters" | "security" | "medical_access";

export type SourceStatus =
  | "ok" | "no_current_matching_finding" | "source_returned_no_data" | "source_unavailable"
  | "not_configured" | "not_applicable" | "not_evaluated" | "stale_cache";

export type GeoGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "Country"; iso2: string }
  | { type: "None" };

export interface EvidenceRecord {
  id: string;
  dimension: Dimension;
  category: string;
  subtype: string;
  title: string;
  summary: string;
  evidence: string;
  severity: string | null;
  severityLevel: number | null;
  recommendationType: string | null;
  requirementType: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string;
  country: string;
  iso2: string;
  iso3: string;
  region: string | null;
  geometry: GeoGeometry;
  geographyLevel: "point" | "admin_region" | "multi_region" | "country" | "text_only" | "unresolved";
  geographyNote: string | null;
  freshness: Freshness;
  extra?: Record<string, unknown>;
}

export interface Observation {
  id: string;
  dimension: Dimension;
  headline: string;
  detail: string;
  kind: "finding" | "caveat" | "gap";
  evidenceIds: string[];
  freshness: Freshness | null;
}

export interface SourceSummary {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  dimension: Dimension | "multi";
  status: SourceStatus;
  freshness: Freshness | null;
  retrievedAt: string;
  note: string | null;
  recordCount: number;
}

export interface CountryIntel {
  ok: true;
  country: { iso2: string; iso3: string; name: string; center: [number, number] | null; capital: string | null; aorRegion: string | null };
  generatedAt: string;
  whatMattersNow: { method: string; llmSynthesis: "not_configured" | "available"; summary: string; observations: Observation[] };
  sources: SourceSummary[];
  evidence: EvidenceRecord[];
  limitations: string[];
}

export interface SynthesisResponse {
  ok: true;
  iso2: string;
  status: "applied" | "not_configured" | "failed" | "rejected";
  model: string | null;
  generatedAt: string;
  statements: Array<{ text: string; evidenceIds: string[] }>;
  discarded: number;
  note: string;
}

export type EnvironmentKey = "heat" | "cold" | "altitude" | "poorAir" | "fatigue" | "ppe" | "night";
export const ENVIRONMENT_LABELS: Record<EnvironmentKey, string> = {
  heat: "Heat exposure",
  cold: "Cold exposure",
  altitude: "Altitude",
  poorAir: "Poor air / dust",
  fatigue: "Fatigue / long shift",
  ppe: "PPE burden",
  night: "Night / circadian disruption",
};
export const ENVIRONMENT_KEYS = Object.keys(ENVIRONMENT_LABELS) as EnvironmentKey[];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  health_vaccines: "Health & Vaccines",
  malaria: "Malaria",
  outbreaks: "Outbreaks",
  environment: "Environment",
  disasters: "Disasters",
  security: "Security",
  medical_access: "Medical access",
};

export const DIMENSION_COLORS: Record<Dimension, string> = {
  health_vaccines: "#34d399",
  malaria: "#fbbf24",
  outbreaks: "#f87171",
  environment: "#fb923c",
  disasters: "#a78bfa",
  security: "#60a5fa",
  medical_access: "#e879f9",
};

export const DIMENSIONS = Object.keys(DIMENSION_LABELS) as Dimension[];

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  NEAR_REAL_TIME: "Near real-time",
  CURRENT_NOTICE: "Current notice",
  WEEKLY_SURVEILLANCE: "Weekly surveillance",
  CURRENT_GUIDANCE: "Current guidance",
  HISTORICAL_CLIMATOLOGICAL: "Historical / climatological",
  STRUCTURAL_DATA: "Structural data",
  STALE_CACHE: "Stale cache",
};

export const STATUS_LABELS: Record<SourceStatus, string> = {
  ok: "Findings returned",
  no_current_matching_finding: "No current matching finding",
  source_returned_no_data: "Source returned no data",
  source_unavailable: "Source unavailable",
  not_configured: "Not configured",
  not_applicable: "Not applicable",
  not_evaluated: "Not evaluated",
  stale_cache: "Stale cached copy",
};

export type WorldEvent = { id: string; kind: "earthquake" | "disaster"; title: string; lon: number; lat: number; detail: string; url: string };
