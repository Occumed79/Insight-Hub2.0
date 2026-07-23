export type HiringCountItem = {
  label: string;
  count: number;
};

export type HiringJob = {
  id: string;
  title: string;
  url: string;
  companyName?: string;
  locationText: string;
  city?: string;
  region?: string;
  country?: string;
  department?: string;
  jobFamily: string;
  seniority: string;
  employmentType?: string;
  remoteType: "remote" | "hybrid" | "onsite" | "unknown";
  postedAt?: string;
  description?: string;
  source: string;
  adapter: string;
};

export type HiringIntelligenceResponse = {
  startedAt: string;
  completedAt: string;
  sourceUrl: string;
  companyName: string;
  platform: string;
  coverage: {
    complete: boolean;
    analyzedPages: number;
    totalDiscovered: number;
    note: string;
  };
  warnings: string[];
  summary: {
    totalJobs: number;
    uniqueLocations: number;
    countries: number;
    remoteJobs: number;
    topLocations: HiringCountItem[];
    jobFamilies: HiringCountItem[];
    seniority: HiringCountItem[];
    employmentTypes: HiringCountItem[];
    remoteMix: HiringCountItem[];
  };
  jobs: HiringJob[];
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

export async function analyzeCareersPage(url: string): Promise<HiringIntelligenceResponse> {
  const response = await fetch("/api/hiring-intelligence/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return readJson<HiringIntelligenceResponse>(response);
}
