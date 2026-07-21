import {
  fetchBlsBenchmark,
  fetchOshaEstablishments,
  fetchSourcesStatus,
  fetchWorkersCompSources,
  normalizeJob,
  resolveEmployer,
  scoreOpportunity,
  type BlsBenchmark,
  type EntityMatch,
  type JobNormalization,
  type OpportunityScore,
  type OshaEstablishment,
  type SourceStatus,
  type WorkersCompSource,
} from "@/data/employerIntelligenceApi";

export type PublicEmployerBriefInput = {
  employer: string;
  state?: string;
  jobTitle?: string;
  naics?: string;
};

export type PublicEmployerBrief = {
  employer: string;
  state?: string;
  jobTitle?: string;
  naics?: string;
  entity: EntityMatch | null;
  oshaRecords: OshaEstablishment[];
  blsBenchmark: BlsBenchmark | null;
  onetMapping: JobNormalization | null;
  workersComp: WorkersCompSource | null;
  opportunity: OpportunityScore | null;
  sourceStatuses: SourceStatus[];
  messages: string[];
  completedAt: string;
};

type SettledValue<T> = { data: T | null; error?: string };

const EXCLUDED_SOURCE_PATTERN = /cms|provider data|hrsa|healthdata|hhs/i;

async function settle<T>(operation: () => Promise<T>): Promise<SettledValue<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

function mostCommonNaics(records: OshaEstablishment[]): string | undefined {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.naics) continue;
    counts.set(record.naics, (counts.get(record.naics) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function responseError(value: { ok: boolean; error?: string } | null): string | undefined {
  return value && !value.ok ? value.error : undefined;
}

/**
 * Runs the substantive public-source baseline used by the unified employer brief.
 * Nothing runs until the user explicitly calls this function.
 */
export async function runPublicEmployerBrief(input: PublicEmployerBriefInput): Promise<PublicEmployerBrief> {
  const employer = input.employer.trim();
  if (!employer) throw new Error("Employer name is required.");

  const state = input.state?.trim().toUpperCase() || undefined;
  const jobTitle = input.jobTitle?.trim() || undefined;
  const requestedNaics = input.naics?.trim() || undefined;

  const [entityCall, oshaCall, onetCall, workersCompCall, sourceStatusCall] = await Promise.all([
    settle(() => resolveEmployer({ companyName: employer, state, naics: requestedNaics })),
    settle(() => fetchOshaEstablishments({ company: employer, state, naics: requestedNaics })),
    jobTitle
      ? settle(() => normalizeJob({ jobTitle, company: employer, location: state }))
      : Promise.resolve({ data: null } as SettledValue<JobNormalization>),
    state
      ? settle(() => fetchWorkersCompSources(state))
      : Promise.resolve({ data: null } as SettledValue<WorkersCompSource>),
    settle(() => fetchSourcesStatus()),
  ] as const);

  const entity = entityCall.data?.ok ? entityCall.data.entity : null;
  const oshaRecords = oshaCall.data?.ok ? oshaCall.data.records : [];
  const onetMapping = onetCall.data?.ok ? onetCall.data : null;
  const workersComp = workersCompCall.data?.ok ? workersCompCall.data : null;
  const resolvedNaics = requestedNaics || entity?.naicsCodes?.[0] || mostCommonNaics(oshaRecords);

  const blsCall = resolvedNaics
    ? await settle(() => fetchBlsBenchmark({ naics: resolvedNaics }))
    : ({ data: null } as SettledValue<Awaited<ReturnType<typeof fetchBlsBenchmark>>>);
  const blsBenchmark = blsCall.data?.ok ? blsCall.data.benchmark : null;

  const opportunityCall = await settle(() => scoreOpportunity({
    companyName: employer,
    oshaEstablishments: oshaRecords,
    blsBenchmark,
    onetMapping,
    workersCompNotes: workersComp,
    locationContext: state,
    entityConfidence: entity?.confidence,
  }));
  const opportunity = opportunityCall.data?.ok ? opportunityCall.data : null;

  const sourceStatuses = sourceStatusCall.data?.ok
    ? sourceStatusCall.data.sources.filter((source) => !EXCLUDED_SOURCE_PATTERN.test(source.source))
    : [];

  const messages = [
    entityCall.error,
    responseError(entityCall.data),
    oshaCall.error,
    responseError(oshaCall.data),
    oshaCall.data?.warning,
    onetCall.error,
    responseError(onetCall.data),
    workersCompCall.error,
    responseError(workersCompCall.data),
    blsCall.error,
    responseError(blsCall.data),
    blsCall.data?.message,
    opportunityCall.error,
    responseError(opportunityCall.data),
    sourceStatusCall.error,
    responseError(sourceStatusCall.data),
  ].filter((message): message is string => Boolean(message));

  return {
    employer,
    state,
    jobTitle,
    naics: resolvedNaics,
    entity,
    oshaRecords,
    blsBenchmark,
    onetMapping,
    workersComp,
    opportunity,
    sourceStatuses,
    messages: [...new Set(messages)],
    completedAt: new Date().toISOString(),
  };
}
