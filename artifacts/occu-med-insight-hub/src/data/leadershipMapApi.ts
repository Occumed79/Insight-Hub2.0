export type LeadershipConfidence = "confirmed" | "probable" | "inferred";
export type LeadershipLevel = "board" | "executive" | "senior-leadership" | "director" | "manager" | "individual-contributor" | "unknown";
export type LeadershipSourceType = "official" | "sec" | "press" | "public-web";

export type LeadershipEvidence = {
  url: string;
  label: string;
  sourceType: LeadershipSourceType;
  snippet: string;
  fetchedAt: string;
};

export type LeadershipPerson = {
  id: string;
  name: string;
  title: string;
  level: LeadershipLevel;
  department?: string;
  location?: string;
  bio?: string;
  confidence: LeadershipConfidence;
  sourceUrls: string[];
  evidence: LeadershipEvidence[];
};

export type LeadershipEdge = {
  fromId: string;
  toId: string;
  relationship: "explicit-reporting-line" | "inferred-title-hierarchy";
  confidence: LeadershipConfidence;
  note: string;
};

export type LeadershipGap = {
  level: LeadershipLevel;
  label: string;
  reason: string;
};

export type LeadershipSourceRecord = {
  url: string;
  label: string;
  sourceType: LeadershipSourceType;
  status: "analyzed" | "failed" | "skipped";
  note: string;
};

export type LeadershipProviderDiagnostic = {
  source: "langsearch" | "groq" | "cloudflare" | "gemini" | "cerebras";
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type LeadershipMapResponse = {
  companyName: string;
  startedAt: string;
  completedAt: string;
  people: LeadershipPerson[];
  edges: LeadershipEdge[];
  gaps: LeadershipGap[];
  sources: LeadershipSourceRecord[];
  warnings: string[];
  issuer?: { cik: string; name: string; ticker?: string; exchange?: string };
  summary: {
    people: number;
    confirmed: number;
    probable: number;
    inferred: number;
    levels: number;
    sourcesAnalyzed: number;
    gaps: number;
  };
  methodology: string;
  providerDiagnostics?: LeadershipProviderDiagnostic[];
  cacheHit?: boolean;
  entityId?: number;
  savedAt?: string;
  savedToDatabase?: boolean;
  pagesConsidered?: number;
  aiPagesRead?: number;
};

export type SavedOrganizationalChart = {
  id: number;
  companyName: string;
  savedAt: string;
  people: number;
  confirmed: number;
  sourcesAnalyzed: number;
};

export type SavedOrganizationalChartsResponse = {
  ok: true;
  companies: SavedOrganizationalChart[];
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

export async function analyzeLeadershipMap(input: {
  companyName: string;
  primaryUrl?: string;
  supportingUrls?: string[];
  secQuery?: string;
  refresh?: boolean;
}): Promise<LeadershipMapResponse> {
  const response = await fetch("/api/leadership-map/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await readJson<LeadershipMapResponse>(response);
  if (result.savedToDatabase === false) {
    const persistenceWarning = result.warnings.find((warning) => /could not be saved to Neon/i.test(warning));
    throw new Error(persistenceWarning || "The organizational chart was built but could not be saved to Neon.");
  }
  return result;
}

export async function getSavedOrganizationalCharts(): Promise<SavedOrganizationalChartsResponse> {
  const response = await fetch("/api/leadership-map/saved");
  return readJson<SavedOrganizationalChartsResponse>(response);
}

export async function getSavedOrganizationalChart(entityId: number): Promise<LeadershipMapResponse> {
  const response = await fetch(`/api/leadership-map/saved/${entityId}`);
  return readJson<LeadershipMapResponse>(response);
}
