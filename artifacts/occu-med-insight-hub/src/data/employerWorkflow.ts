export type EmployerWorkflowContext = {
  employer: string;
  legalName: string;
  state: string;
  jobTitle: string;
  naics: string;
  country: string;
  notes: string;
};

export type WorkflowStepId =
  | "employer-intelligence"
  | "entity-resolution"
  | "occupational-exposure"
  | "company-live-intelligence"
  | "workers-comp-coverage"
  | "dba-intelligence"
  | "source-governance";

export type WorkflowStep = {
  id: WorkflowStepId;
  number: number;
  label: string;
  shortLabel: string;
  route: string;
  scope: "employer" | "employer-position" | "state" | "country" | "system";
  purpose: string;
  output: string;
  requiredFields: Array<keyof EmployerWorkflowContext>;
  optionalFields: Array<keyof EmployerWorkflowContext>;
};

export const EMPTY_EMPLOYER_WORKFLOW_CONTEXT: EmployerWorkflowContext = {
  employer: "",
  legalName: "",
  state: "",
  jobTitle: "",
  naics: "",
  country: "",
  notes: "",
};

export const EMPLOYER_WORKFLOW_STORAGE_KEY = "occu-med:employer-workflow:v1";

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    id: "employer-intelligence",
    number: 1,
    label: "Employer Injury & Opportunity Intelligence",
    shortLabel: "Employer Intel",
    route: "/employer-intelligence",
    scope: "employer-position",
    purpose: "Establish the employer, injury-record, industry-benchmark, occupation, and service-opportunity baseline.",
    output: "Employer evidence summary, position risk lens, source notes, and service-opportunity signal.",
    requiredFields: ["employer"],
    optionalFields: ["state", "jobTitle", "naics"],
  },
  {
    id: "entity-resolution",
    number: 2,
    label: "Entity & DBA Resolution",
    shortLabel: "Entity Resolution",
    route: "/entity-resolution",
    scope: "employer",
    purpose: "Resolve the searched name against legal entities, DBAs, aliases, subsidiaries, and OSHA establishment names.",
    output: "Canonical identity, match confidence, evidence, warnings, and unresolved-name queue.",
    requiredFields: ["employer"],
    optionalFields: ["legalName", "state", "naics"],
  },
  {
    id: "occupational-exposure",
    number: 3,
    label: "Occupational Exposure & Service Fit",
    shortLabel: "Exposure Matrix",
    route: "/occupational-exposure",
    scope: "employer-position",
    purpose: "Translate the position and industry context into explainable occupational-exposure and Occu-Med service-fit signals.",
    output: "Exposure matrix, ranked service opportunities, evidence drilldowns, and source confidence.",
    requiredFields: ["employer", "jobTitle"],
    optionalFields: ["state", "naics"],
  },
  {
    id: "company-live-intelligence",
    number: 4,
    label: "Company Live Intelligence",
    shortLabel: "Company Live Intel",
    route: "/company-live-intelligence",
    scope: "employer",
    purpose: "Run a manual current-source scan for entity, filing, litigation-reference, and federal-award footprint signals.",
    output: "Source-status rail, normalized signals, timeline, filters, and evidence panel.",
    requiredFields: ["employer"],
    optionalFields: ["state", "legalName"],
  },
  {
    id: "workers-comp-coverage",
    number: 5,
    label: "Workers’ Compensation Source Coverage",
    shortLabel: "Workers’ Comp",
    route: "/workers-comp-coverage",
    scope: "state",
    purpose: "Review the public workers’ compensation source landscape for the employer’s state context.",
    output: "State source coverage, publication type, review status, freshness, and limitations.",
    requiredFields: ["state"],
    optionalFields: ["employer"],
  },
  {
    id: "dba-intelligence",
    number: 6,
    label: "Defense Base Act Intelligence",
    shortLabel: "DBA Intelligence",
    route: "/dba-intelligence",
    scope: "country",
    purpose: "Review public DOL DBA employer, carrier, country, waiver, jurisdiction, and adjudication-reference intelligence.",
    output: "Employer-name matches, global case atlas, carrier trends, waiver explorer, and source limitations.",
    requiredFields: ["employer"],
    optionalFields: ["country", "legalName"],
  },
  {
    id: "source-governance",
    number: 7,
    label: "Source Governance & Provenance",
    shortLabel: "Source Governance",
    route: "/source-governance",
    scope: "system",
    purpose: "Confirm which sources are configured, enabled, manual, current, authoritative, and limited before relying on results.",
    output: "Source registry, dependency map, confidence, freshness, safeguards, and environment-key names.",
    requiredFields: [],
    optionalFields: ["employer"],
  },
] as const;

export function buildWorkflowQuery(context: EmployerWorkflowContext): string {
  const params = new URLSearchParams();
  const entries: Array<[string, string]> = [
    ["employer", context.employer],
    ["legalName", context.legalName],
    ["state", context.state],
    ["job", context.jobTitle],
    ["naics", context.naics],
    ["country", context.country],
  ];

  for (const [key, value] of entries) {
    const trimmed = value.trim();
    if (trimmed) params.set(key, trimmed);
  }

  return params.toString();
}

export function buildWorkflowHref(route: string, context: EmployerWorkflowContext): string {
  const query = buildWorkflowQuery(context);
  return query ? `${route}?${query}` : route;
}

export function getMissingRequiredFields(
  step: WorkflowStep,
  context: EmployerWorkflowContext,
): Array<keyof EmployerWorkflowContext> {
  return step.requiredFields.filter((field) => !context[field].trim());
}

export function workflowContextLabel(field: keyof EmployerWorkflowContext): string {
  const labels: Record<keyof EmployerWorkflowContext, string> = {
    employer: "Employer",
    legalName: "Legal name",
    state: "State",
    jobTitle: "Position",
    naics: "NAICS",
    country: "Country",
    notes: "Notes",
  };
  return labels[field];
}
