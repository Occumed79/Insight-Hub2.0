import { desc } from "drizzle-orm";
import { logger } from "./logger";
import {
  createMockSearchRun,
  getSearchRuns,
  insightDataset,
  type Company,
  type CompanyProfile,
  type InsightDataset,
  type LocationRecord,
  type Metric,
  type ReportRecord,
  type SearchRun,
  type SourceRecord,
} from "./insightDataset";

type DbModule = typeof import("@workspace/db");

async function loadDbModule(): Promise<DbModule | undefined> {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  try {
    return await import("@workspace/db");
  } catch (error) {
    logger.warn({ err: error }, "Insight repository could not load database module; using seed fallback");
    return undefined;
  }
}

function dateToIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

async function loadDatasetFromDatabase(dbModule: DbModule): Promise<InsightDataset | undefined> {
  const {
    assumptionsTable,
    companiesTable,
    db,
    locationsTable,
    metricsTable,
    profilesTable,
    reportsTable,
    sourcesTable,
  } = dbModule;

  const [companyRows, profileRows, metricRows, locationRows, sourceRows, reportRows, assumptionRows] =
    await Promise.all([
      db.select().from(companiesTable),
      db.select().from(profilesTable),
      db.select().from(metricsTable),
      db.select().from(locationsTable),
      db.select().from(sourcesTable),
      db.select().from(reportsTable),
      db.select().from(assumptionsTable),
    ]);

  if (companyRows.length === 0) {
    return undefined;
  }

  const companies: Company[] = companyRows.map((company) => ({
    id: company.id,
    name: company.name,
    shortName: company.shortName,
    sector: company.sector,
    headquarters: company.headquarters,
    employees: company.employees,
    employeesAsOf: company.employeesAsOf,
    summary: company.summary,
    tags: company.tags,
  }));

  const profiles: CompanyProfile[] = profileRows.map((profile) => ({
    companyId: profile.companyId,
    sections: profile.sections,
  }));

  const metrics: Metric[] = metricRows.map((metric) => ({
    id: metric.id,
    companyId: metric.companyId,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    category: metric.category,
    trend: metric.trend ?? undefined,
    sourceId: metric.sourceId ?? undefined,
  }));

  const locations: LocationRecord[] = locationRows.map((location) => ({
    id: location.id,
    companyId: location.companyId,
    company: location.company,
    city: location.city,
    state: location.state ?? undefined,
    country: location.country,
    region: location.region,
    facilityType: location.facilityType,
    activity: location.activity,
    notes: location.notes,
    coordinates: [location.longitude, location.latitude],
  }));

  const sources: SourceRecord[] = sourceRows.map((source) => ({
    id: source.id,
    companyId: source.companyId,
    label: source.label,
    type: source.type,
    url: source.url ?? undefined,
    note: source.note,
  }));

  const reports: ReportRecord[] = reportRows.map((report) => ({
    id: report.id,
    companyId: report.companyId,
    title: report.title,
    createdAt: dateToIso(report.createdAt),
    summary: report.summary,
    signals: report.signals,
  }));

  return {
    companies,
    profiles,
    metrics,
    locations,
    sources,
    reports,
    assumptions: assumptionRows.map((assumption) => ({
      id: assumption.id,
      label: assumption.label,
      value: assumption.value,
      unit: assumption.unit,
      description: assumption.description,
    })),
    status: {
      proxyRows: companies.length,
      methodologyRows: assumptionRows.length,
      geographyRows: locations.length,
      loaded: true,
    },
  };
}

export async function getInsightDataset(): Promise<InsightDataset> {
  const dbModule = await loadDbModule();

  if (!dbModule) {
    return insightDataset;
  }

  try {
    const databaseDataset = await loadDatasetFromDatabase(dbModule);
    return databaseDataset ?? insightDataset;
  } catch (error) {
    logger.warn({ err: error }, "Insight repository database read failed; using seed fallback");
    return insightDataset;
  }
}

export async function listSearchRuns(): Promise<SearchRun[]> {
  const dbModule = await loadDbModule();

  if (!dbModule) {
    return getSearchRuns();
  }

  try {
    const rows = await dbModule.db
      .select()
      .from(dbModule.searchRunsTable)
      .orderBy(desc(dbModule.searchRunsTable.createdAt));

    if (rows.length === 0) {
      return getSearchRuns();
    }

    return rows.map((row) => ({
      id: row.id,
      query: row.query,
      target: row.target,
      status: row.status === "running" || row.status === "failed" ? "queued" : row.status,
      createdAt: dateToIso(row.createdAt),
      resultCount: row.resultCount,
      notes: row.notes,
    }));
  } catch (error) {
    logger.warn({ err: error }, "Insight repository search-run read failed; using seed fallback");
    return getSearchRuns();
  }
}

export async function createSearchRunRecord(
  query: string,
  target: SearchRun["target"],
): Promise<SearchRun> {
  const run = createMockSearchRun(query, target);
  const dbModule = await loadDbModule();

  if (!dbModule) {
    return run;
  }

  try {
    await dbModule.db.insert(dbModule.searchRunsTable).values({
      id: run.id,
      query: run.query,
      target: run.target,
      status: run.status,
      resultCount: run.resultCount,
      notes: run.notes,
      rawResults: [],
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.createdAt),
    });
  } catch (error) {
    logger.warn({ err: error }, "Insight repository search-run insert failed; using in-memory record only");
  }

  return run;
}
