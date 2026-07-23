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
  primaryUrl: string;
  supportingUrls: string[];
  secQuery?: string;
}): Promise<LeadershipMapResponse> {
  const response = await fetch("/api/leadership-map/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson<LeadershipMapResponse>(response);
}
