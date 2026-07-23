export type SecTrackedIssuer = {
  cik: string;
  name: string;
  ticker?: string;
  exchange?: string;
};

export type SecFiling = {
  id: string;
  cik: string;
  companyName: string;
  ticker?: string;
  exchange?: string;
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate?: string;
  acceptanceDateTime?: string;
  primaryDocument?: string;
  primaryDocumentDescription?: string;
  items?: string;
  isXbrl: boolean;
  isInlineXbrl: boolean;
  filingUrl: string;
  documentUrl?: string;
};

export type SecIssuerSearchResponse = {
  query: string;
  issuers: SecTrackedIssuer[];
  source: string;
  fetchedAt: string;
};

export type SecFilingsFeedResponse = {
  startedAt: string;
  completedAt: string;
  source: string;
  freshness: string;
  issuerCount: number;
  filingCount: number;
  forms: string[];
  filings: SecFiling[];
  errors: Array<{ cik: string; companyName: string; error: string }>;
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

export async function searchSecIssuers(query: string): Promise<SecIssuerSearchResponse> {
  const response = await fetch(`/api/sec-filings/search?q=${encodeURIComponent(query)}`);
  return readJson<SecIssuerSearchResponse>(response);
}

export async function loadSecFilingsFeed(
  issuers: SecTrackedIssuer[],
  forms: string[],
): Promise<SecFilingsFeedResponse> {
  const response = await fetch("/api/sec-filings/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issuers, forms, limitPerIssuer: 60 }),
  });
  return readJson<SecFilingsFeedResponse>(response);
}
