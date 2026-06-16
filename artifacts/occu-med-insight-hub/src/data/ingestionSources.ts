export type IngestionSourceType = "sec" | "sam" | "usaSpending" | "careerSite" | "news";

export type IngestionSource = {
  type: IngestionSourceType;
  label: string;
  description: string;
  endpoint?: string;
  status: "ready" | "stub" | "planned";
};

export const ingestionSources: IngestionSource[] = [
  {
    type: "sec",
    label: "SEC EDGAR Filings",
    description: "Annual reports (10-K), quarterly filings (10-Q), and proxy statements (DEF 14A) via EDGAR full-text search and company CIK lookup.",
    endpoint: "https://efts.sec.gov/LATEST/search-index?q=",
    status: "stub",
  },
  {
    type: "sam",
    label: "SAM.gov Entity Registrations",
    description: "System for Award Management entity registrations including UEI, legal names, DBAs, NAICS codes, and socioeconomic status.",
    endpoint: "https://api.sam.gov/entity-information/v3/entities",
    status: "stub",
  },
  {
    type: "usaSpending",
    label: "USASpending Awards",
    description: "Federal contract awards, grant obligations, and spending data by recipient name, parent organization, NAICS, and agency.",
    endpoint: "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    status: "stub",
  },
  {
    type: "careerSite",
    label: "Career Sites & Job Boards",
    description: "LinkedIn, Indeed, company career pages, and ClearanceJobs postings for hiring intelligence and workforce growth signals.",
    status: "planned",
  },
  {
    type: "news",
    label: "News & Acquisitions",
    description: "Acquisitions, leadership changes, contract wins, and regulatory actions from news aggregators and press releases.",
    status: "planned",
  },
];
