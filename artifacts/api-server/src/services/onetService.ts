/**
 * O*NET Web Services shared service module.
 *
 * Both routes/onet.ts and routes/employer-intelligence.ts use this module
 * to avoid duplicating O*NET API request/parsing logic.
 *
 * O*NET Web Services: https://services.onetcenter.org/ws
 * Auth: X-API-Key header (server-side only, never exposed to client)
 */

const ONET_BASE_URL = "https://services.onetcenter.org/ws";

export type OnetItem = {
  name?: string;
  title?: string;
  element_name?: string;
  description?: string;
  value?: unknown;
  response?: unknown;
  code?: string;
  onetsoc_code?: string;
  href?: string;
  score?: number;
  relevance?: number;
};

export type OnetSearchMatch = {
  title: string;
  code: string;
  score?: number;
  href?: string;
};

function getApiKey(): string | undefined {
  return process.env.ONET_API_KEY;
}

function isConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Fetch JSON from O*NET Web Services.
 * Throws a sanitized error (never includes the API key or full URL).
 */
export async function fetchOnetJson(path: string): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("O*NET API key is not configured. Set ONET_API_KEY on the server.");
  }

  const url = `${ONET_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Sanitize: never log or return the full URL (it may contain encoded params)
    throw new Error(`O*NET request failed (${response.status}): ${body || response.statusText}`);
  }

  return await response.json() as unknown;
}

/**
 * Search O*NET occupations by keyword.
 * Returns normalized match objects.
 */
export async function searchOccupations(keyword: string): Promise<OnetSearchMatch[]> {
  const path = `/mnm/search?keyword=${encodeURIComponent(keyword)}`;
  const data = await fetchOnetJson(path);
  return normalizeSearchResults(data);
}

/**
 * Get occupation summary (MnM endpoint).
 */
export async function getOccupationSummary(code: string): Promise<Record<string, unknown>> {
  const data = await fetchOnetJson(`/mnm/occupation/${encodeURIComponent(code)}`);
  return data as Record<string, unknown>;
}

/**
 * Get occupation details (Online endpoint).
 */
export async function getOccupationDetails(code: string): Promise<Record<string, unknown>> {
  const data = await fetchOnetJson(`/online/occupation/${encodeURIComponent(code)}/details`);
  return data as Record<string, unknown>;
}

/**
 * Get work context for an occupation (Online endpoint).
 */
export async function getWorkContext(code: string): Promise<Record<string, unknown>> {
  const data = await fetchOnetJson(`/online/occupations/${encodeURIComponent(code)}/work_context`);
  return data as Record<string, unknown>;
}

/**
 * Normalize O*NET search results into a common format.
 */
export function normalizeSearchResults(data: unknown): OnetSearchMatch[] {
  const payload = data as Record<string, unknown>;
  const occupations = (payload?.occupation ?? payload?.occupations ?? payload?.results ?? []) as Array<Record<string, unknown>>;
  return occupations.map((item) => ({
    title: String(item.title ?? item.name ?? ""),
    code: String(item.code ?? item.onetsoc_code ?? ""),
    score: typeof item.score === "number" ? item.score : typeof item.relevance === "number" ? item.relevance : undefined,
    href: typeof item.href === "string" ? item.href : undefined,
  })).filter((o) => o.code && o.title);
}

/**
 * Extract an array field from O*NET response data, normalizing items.
 */
export function extractArray(data: Record<string, unknown>, key: string): Array<Record<string, unknown> | string> {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.title ?? record.element_name ?? record.statement ?? "");
    const description = String(record.description ?? "");
    return {
      name,
      description: description && description !== name ? description : undefined,
      value: record.value,
      response: record.response,
    };
  }).filter((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    const record = item as Record<string, unknown>;
    return record.name || record.description;
  });
}

/**
 * Derive service relevance tags from O*NET physical, environmental, and safety indicators.
 * Shared logic used by both job normalization and opportunity scoring.
 */
export function deriveServiceTags(
  physicalIndicators: string[],
  environmentalIndicators: string[],
  safetyIndicators: string[],
): string[] {
  const tags: string[] = [];
  const allContext = (physicalIndicators.join(" ") + " " + environmentalIndicators.join(" ") + " " + safetyIndicators.join(" ")).toLowerCase();

  if (/lifting|carrying|material handling|musculoskeletal|strength|standing|walking|bending/.test(allContext)) {
    tags.push("fitness-for-duty", "return-to-work", "functional-capacity", "physical-exams");
  }
  if (/respirator|respiratory|contaminants|chemical|fumes|dust/.test(allContext)) {
    tags.push("respirator-clearance", "pulmonary-function", "osha-medical-surveillance");
  }
  if (/noise|hearing|auditory/.test(allContext)) {
    tags.push("audiograms", "hearing-conservation");
  }
  if (/driving|vehicle|transportation|truck|bus/.test(allContext)) {
    tags.push("dot-exams", "drug-screens", "sleep-apnea-screening");
  }
  if (/outdoor|heat|weather|hot|cold/.test(allContext)) {
    tags.push("heat-stress-surveillance", "annual-exams");
  }
  if (/hazardous|dangerous|protective equipment|safety equipment/.test(allContext)) {
    tags.push("occupational-medical-surveillance", "labs", "respirator-evaluations");
  }

  return Array.from(new Set(tags));
}

/**
 * Map a SOC code prefix to an occupation family name.
 */
export function getOccupationFamily(socCode: string): string {
  const familyMap: Record<string, string> = {
    "11": "Management",
    "13": "Business and Financial Operations",
    "15": "Computer and Mathematical",
    "17": "Architecture and Engineering",
    "19": "Life, Physical, and Social Science",
    "21": "Community and Social Service",
    "23": "Legal",
    "25": "Education, Training, and Library",
    "27": "Arts, Design, Entertainment, Sports, and Media",
    "29": "Healthcare Practitioners",
    "31": "Healthcare Support",
    "33": "Protective Service",
    "35": "Food Preparation and Serving",
    "37": "Building and Grounds Cleaning and Maintenance",
    "39": "Personal Care and Service",
    "41": "Sales and Related",
    "43": "Office and Administrative Support",
    "45": "Farming, Fishing, and Forestry",
    "47": "Construction and Extraction",
    "49": "Installation, Maintenance, and Repair",
    "51": "Production",
    "53": "Transportation and Material Moving",
  };
  const prefix = socCode.split("-")[0];
  return familyMap[prefix] || "Other";
}

/**
 * Extract work-context indicators (physical, environmental, safety) from O*NET work context data.
 * Shared between routes/onet.ts and routes/employer-intelligence.ts.
 */
export function extractWorkContextIndicators(workContextRaw: unknown) {
  const workContext = (workContextRaw as Array<Record<string, unknown>>) ?? [];

  const physicalIndicators: string[] = [];
  const environmentalIndicators: string[] = [];
  const safetyIndicators: string[] = [];

  for (const ctx of workContext) {
    const name = String(ctx.name ?? ctx.element_name ?? "").toLowerCase();
    const responseArr = ctx.response as Array<Record<string, unknown>> | undefined;
    const value = String(responseArr?.[0]?.name ?? ctx.value ?? "");

    if (/spend time standing|spend time walking|spend time bending|kneeling|crawling|climbing|lifting|carrying|reaching|using hands|repetitive motions|keeping.*balance/.test(name)) {
      physicalIndicators.push(`${ctx.name ?? ctx.element_name}: ${value}`);
    }
    if (/outdoors|exposed to weather|exposed to contaminants|exposed to hazardous|exposed to noise|exposed to vibration|exposed to heat|exposed to cold|exposed to radiation/.test(name)) {
      environmentalIndicators.push(`${ctx.name ?? ctx.element_name}: ${value}`);
    }
    if (/wear.*protective|responsible for others.*safety|exposed to hazardous equipment|exposed to high places|exposed to disease|exposed to infection/.test(name)) {
      safetyIndicators.push(`${ctx.name ?? ctx.element_name}: ${value}`);
    }
  }

  return { physicalIndicators, environmentalIndicators, safetyIndicators };
}

export { isConfigured, getApiKey };
