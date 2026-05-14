export type Company = {
  id: string;
  name: string;
  shortName: string;
  sector: string;
  headquarters: string;
  employees: number;
  employeesAsOf: string;
  summary: string;
  tags: string[];
};

export type InsightDataset = {
  companies: Company[];
  profiles: Array<Record<string, unknown>>;
  metrics: Array<Record<string, unknown>>;
  locations: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  assumptions: Array<Record<string, unknown>>;
  status: {
    proxyRows: number;
    methodologyRows: number;
    geographyRows: number;
    loaded: boolean;
    error?: string;
  };
};

const seedDataset: InsightDataset = {
  companies: [
    {
      id: "v2x",
      name: "V2X, Inc.",
      shortName: "V2X",
      sector: "Defense services, logistics, training, and mission support",
      headquarters: "McLean, Virginia",
      employees: 16100,
      employeesAsOf: "2024-12-31",
      summary:
        "Global mission-support contractor with distributed field operations, aviation, logistics, facilities, and expeditionary workforce exposure.",
      tags: ["Federal contractor", "Global footprint", "High operational complexity"],
    },
  ],
  profiles: [],
  metrics: [],
  locations: [],
  sources: [],
  reports: [],
  assumptions: [],
  status: {
    proxyRows: 0,
    methodologyRows: 0,
    geographyRows: 0,
    loaded: false,
  },
};

export function getInsightDataset(): InsightDataset {
  return seedDataset;
}

export function getCompanyById(companyId: string): Company | undefined {
  return seedDataset.companies.find((company) => company.id === companyId);
}
