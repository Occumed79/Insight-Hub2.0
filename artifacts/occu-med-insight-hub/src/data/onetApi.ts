export type OnetOccupationMatch = {
  title: string;
  code: string;
  score?: number;
  href?: string;
};

export type OnetSearchResponse = {
  ok: boolean;
  keyword?: string;
  matches?: OnetOccupationMatch[];
  count?: number;
  source?: string;
  sourceEndpoint?: string;
  error?: string;
};

export type OnetNamedItem = {
  name: string;
  description?: string;
  value?: unknown;
  response?: unknown;
};

export type OnetOccupationProfile = {
  code: string;
  title: string;
  description: string;
  tasks: (string | OnetNamedItem)[];
  work_activities: (string | OnetNamedItem)[];
  detailed_work_activities: (string | OnetNamedItem)[];
  abilities: (string | OnetNamedItem)[];
  work_context: (string | OnetNamedItem)[];
  skills: (string | OnetNamedItem)[];
  knowledge: (string | OnetNamedItem)[];
  related_occupations: (string | OnetNamedItem)[];
  technology_skills: (string | OnetNamedItem)[];
  rawSummary?: Record<string, unknown>;
  rawDetails?: Record<string, unknown>;
};

export type OnetOccupationResponse = {
  ok: boolean;
  occupation?: OnetOccupationProfile;
  source?: string;
  partialErrors?: Array<{ section: string; error: string }>;
  error?: string;
};

export type OnetDemandCategory = {
  summary: string;
  abilities: (string | OnetNamedItem)[];
  work_activities: (string | OnetNamedItem)[];
  work_context?: (string | OnetNamedItem)[];
  detailed_work_activities?: (string | OnetNamedItem)[];
  tasks?: (string | OnetNamedItem)[];
};

export type OnetSafetyIndicators = {
  safety_sensitive: boolean;
  indicators: string[];
  work_context: (string | OnetNamedItem)[];
  work_activities: (string | OnetNamedItem)[];
  tasks: (string | OnetNamedItem)[];
};

export type OnetJobContext = {
  occupation: {
    code: string;
    title: string;
    score?: number;
    description: string;
  };
  matches: OnetOccupationMatch[];
  physical_demands: OnetDemandCategory;
  cognitive_demands: OnetDemandCategory;
  safety_sensitive_indicators: OnetSafetyIndicators;
  environmental_indicators: {
    summary: string;
    work_context: (string | OnetNamedItem)[];
  };
  essential_function_suggestions: string[];
  partialErrors?: Array<{ section: string; error: string }>;
  raw?: {
    tasks: (string | OnetNamedItem)[];
    work_context: (string | OnetNamedItem)[];
    abilities: (string | OnetNamedItem)[];
    work_activities: (string | OnetNamedItem)[];
  };
};

export type OnetJobContextResponse = {
  ok: boolean;
  keyword?: string;
  context?: OnetJobContext | null;
  message?: string;
  source?: string;
  classification?: string;
  error?: string;
};

const OCCUPATIONAL_ONET_BASE = "/api/occupational-onet";

export async function searchOnetOccupations(
  keyword: string,
): Promise<OnetSearchResponse> {
  const response = await fetch(
    `${OCCUPATIONAL_ONET_BASE}/search?keyword=${encodeURIComponent(keyword)}`,
  );
  return (await response.json()) as OnetSearchResponse;
}

export async function fetchOnetOccupation(
  code: string,
): Promise<OnetOccupationResponse> {
  const response = await fetch(
    `${OCCUPATIONAL_ONET_BASE}/occupation/${encodeURIComponent(code)}`,
  );
  return (await response.json()) as OnetOccupationResponse;
}

export async function fetchOnetJobContext(
  keyword: string,
): Promise<OnetJobContextResponse> {
  const response = await fetch(
    `${OCCUPATIONAL_ONET_BASE}/job-context?keyword=${encodeURIComponent(keyword)}`,
  );
  return (await response.json()) as OnetJobContextResponse;
}

export function itemName(item: string | OnetNamedItem): string {
  if (typeof item === "string") return item;
  return item.name || "";
}

export function itemDescription(
  item: string | OnetNamedItem,
): string | undefined {
  if (typeof item === "string") return undefined;
  return item.description;
}
