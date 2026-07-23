export type CorporateConfidence = "confirmed" | "probable" | "inferred";
export type CorporateRelationship = "parent" | "subsidiary" | "division" | "brand" | "dba" | "affiliate" | "unknown";
export type CorporateSourceType = "official" | "sec" | "public-web";

export type CorporateEvidence = {
  url: string;
  label: string;
  sourceType: CorporateSourceType;
  snippet: string;
  fetchedAt: string;
};

export type CorporateEntity = {
  id: string;
  name: string;
  relationship: CorporateRelationship;
  jurisdiction?: string;
  description?: string;
  confidence: CorporateConfidence;
  sourceUrls: string[];
  evidence: CorporateEvidence[];
};

export type CorporateSource = {
  url: string;
  label: string;
  sourceType: CorporateSourceType;
  status: "analyzed" | "failed" | "skipped";
  note: string;
};

export type CorporateStructureResponse = {
  companyName: string;
  startedAt: string;
  completedAt: string;
  entities: CorporateEntity[];
  sources: CorporateSource[];
  warnings: string[];
  gaps: string[];
  summary: {
    totalEntities: number;
    relationshipCounts: Record<string, number>;
    confidenceCounts: Record<string, number>;
    jurisdictions: number;
    analyzedSources: number;
    failedSources: number;
  };
  limitation: string;
};

export async function analyzeCorporateStructure(input: {
  companyName: string;
  primaryUrl?: string;
  tickerOrCik?: string;
  supportingUrls?: string[];
}): Promise<CorporateStructureResponse> {
  const response = await fetch("/api/corporate-structure/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json() as CorporateStructureResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Corporate structure analysis failed.");
  return payload;
}
