export type GovernedSourceCategory = "injury" | "occupation" | "entity" | "company" | "workers-comp" | "dba";
export type GovernedSourceMode = "live-api" | "manual-live" | "cached-import" | "static-index" | "official-workbook";
export type GovernedSourceState = "ready" | "partial" | "disabled" | "not-configured";
export type GovernedConfidenceTier = "high" | "moderate" | "context-only";

export type GovernedSource = {
  id: string;
  label: string;
  authority: string;
  category: GovernedSourceCategory;
  mode: GovernedSourceMode;
  workspaces: string[];
  configured: boolean;
  enabled: boolean;
  state: GovernedSourceState;
  environmentKeys: string[];
  internalEndpoint: string;
  sourceUrl: string;
  provenance: {
    official: boolean;
    serverSide: boolean;
    reviewRequired: boolean;
    evidenceUnit: string;
  };
  confidence: {
    tier: GovernedConfidenceTier;
    rationale: string;
  };
  freshness: {
    policy: string;
    lastKnown?: string;
  };
  limitations: string[];
  safeguards: string[];
};

export type SourceWorkflow = {
  id: string;
  label: string;
  dependsOn: string[];
};

export type SourceGovernanceResponse = {
  ok: boolean;
  generatedAt: string;
  summary: {
    totalSources: number;
    readySources: number;
    partialSources: number;
    disabledSources: number;
    notConfiguredSources: number;
    officialSources: number;
    manualOnlySources: number;
  };
  sources: GovernedSource[];
  workflows: SourceWorkflow[];
  governance: {
    manualOnly: string;
    partialResults: string;
    provenance: string;
    confidence: string;
    secrets: string;
  };
  error?: string;
};

export async function loadSourceGovernance(): Promise<SourceGovernanceResponse> {
  const response = await fetch("/api/source-governance/overview");
  const payload = await response.json() as SourceGovernanceResponse;
  if (!response.ok) {
    throw new Error(payload.error || `Source governance request failed with HTTP ${response.status}`);
  }
  return payload;
}
