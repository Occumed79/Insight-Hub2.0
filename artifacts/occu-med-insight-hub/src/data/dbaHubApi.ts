export type DbaHubDimension = "employer" | "country" | "carrier";

export type DbaHubCounts = {
  nlt: number | null;
  cop: number | null;
  lto3: number | null;
  lto4: number | null;
  dea: number | null;
  oth: number | null;
  total: number | null;
};

export type DbaHubRecord = DbaHubCounts & {
  id: string;
  dimension: DbaHubDimension;
  fiscalYear: number;
  sourceName: string;
  canonicalName: string;
  entityId: number | null;
  sourceRow: number;
  suppressed: boolean;
  redacted: boolean;
  sourceFile: string;
};

export type DbaHubSource = {
  sourceFile: string;
  dimension: DbaHubDimension;
  fiscalYear: number;
  sourceRows: number;
  analyticRows: number;
  suppressedOrBlankRows: number;
  reportedTotal: number | null;
  redacted: boolean;
  importedAt: string;
};

export type DbaHubEmployer = {
  canonicalName: string;
  entityId: number | null;
  aliases: string[];
  years: number[];
  reportedTotal: number;
};

export type DbaHubResponse = {
  ok: boolean;
  generatedAt: string;
  years: number[];
  records: DbaHubRecord[];
  sources: DbaHubSource[];
  employers: DbaHubEmployer[];
  warning: string;
  sourceModel: string;
  error?: string;
};

export async function loadDbaHub(): Promise<DbaHubResponse> {
  const response = await fetch("/api/dba/hub");
  const payload = await response.json() as DbaHubResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `DBA Data Hub request failed with HTTP ${response.status}`);
  }
  return payload;
}
