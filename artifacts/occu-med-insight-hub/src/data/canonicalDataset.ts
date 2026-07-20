import { resolveConfigCompanyId } from "../company-configs";
import type {
  Assumption,
  Company,
  CompanyIntelligence,
  CompanyProfile,
  DataQualityIssue,
  InsightDataset,
  LocationRecord,
  Metric,
  ReportRecord,
  SourceRecord,
  WorkbookStatus,
} from "./types";

export type InsightDatasetLayer = {
  name: string;
  priority: number;
  data: Partial<InsightDataset>;
  replaceCompanyIds?: string[];
};

const EMPTY_STATUS: WorkbookStatus = {
  proxyRows: 0,
  methodologyRows: 0,
  geographyRows: 0,
  loaded: false,
};

const canonicalCompanyId = (companyId: string) => resolveConfigCompanyId(companyId.trim());
const scopedKey = (companyId: string, recordKey: string) => `${companyId}:${recordKey}`;

function normalizeCompany(company: Company): Company {
  return {
    ...company,
    id: canonicalCompanyId(company.id),
    entityType: company.entityType ?? "company",
  };
}

function normalizeProfile(profile: CompanyProfile): CompanyProfile {
  return { ...profile, companyId: canonicalCompanyId(profile.companyId) };
}

function normalizeMetric(metric: Metric): Metric {
  return {
    ...metric,
    companyId: canonicalCompanyId(metric.companyId),
    deduplicationKey: metric.deduplicationKey ?? metric.id,
    sourceIds: metric.sourceIds ?? (metric.sourceId ? [metric.sourceId] : undefined),
  };
}

function normalizeLocation(location: LocationRecord): LocationRecord {
  return {
    ...location,
    companyId: canonicalCompanyId(location.companyId),
    deduplicationKey: location.deduplicationKey ?? location.id,
  };
}

function normalizeSource(source: SourceRecord): SourceRecord {
  return { ...source, companyId: canonicalCompanyId(source.companyId) };
}

function normalizeReport(report: ReportRecord): ReportRecord {
  return { ...report, companyId: canonicalCompanyId(report.companyId) };
}

function normalizeIntelligence(intelligence: CompanyIntelligence): CompanyIntelligence {
  const companyId = canonicalCompanyId(intelligence.companyId);
  return {
    ...intelligence,
    companyId,
    facts: intelligence.facts.map((fact) => ({ ...fact, companyId })),
    runs: intelligence.runs.map((run) => ({ ...run, companyId })),
  };
}

function removeCompanyRecords<T extends { companyId: string }>(records: Map<string, T>, companyIds: Set<string>) {
  for (const [key, record] of records) {
    if (companyIds.has(record.companyId)) records.delete(key);
  }
}

function recordCount(data: Partial<InsightDataset>): number {
  return (
    (data.companies?.length ?? 0) +
    (data.profiles?.length ?? 0) +
    (data.metrics?.length ?? 0) +
    (data.locations?.length ?? 0) +
    (data.sources?.length ?? 0) +
    (data.reports?.length ?? 0) +
    (data.assumptions?.length ?? 0) +
    (data.intelligence?.length ?? 0)
  );
}

function validateCoordinates(location: LocationRecord, issues: DataQualityIssue[]) {
  const [longitude, latitude] = location.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
    issues.push({
      code: "invalid-coordinate",
      severity: "error",
      recordType: "location",
      recordId: location.id,
      message: `Location has invalid coordinates [${longitude}, ${latitude}].`,
    });
  }
}

export function assembleCanonicalDataset(layers: InsightDatasetLayer[]): InsightDataset {
  const companies = new Map<string, Company>();
  const profiles = new Map<string, CompanyProfile>();
  const metrics = new Map<string, Metric>();
  const locations = new Map<string, LocationRecord>();
  const sources = new Map<string, SourceRecord>();
  const reports = new Map<string, ReportRecord>();
  const assumptions = new Map<string, Assumption>();
  const intelligence = new Map<string, CompanyIntelligence>();
  const issues: DataQualityIssue[] = [];
  let droppedRecords = 0;
  let status = EMPTY_STATUS;

  const orderedLayers = layers
    .map((layer, index) => ({ ...layer, index }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  for (const layer of orderedLayers) {
    const replacements = new Set((layer.replaceCompanyIds ?? []).map(canonicalCompanyId));
    if (replacements.size > 0) {
      for (const companyId of replacements) companies.delete(companyId);
      removeCompanyRecords(profiles, replacements);
      removeCompanyRecords(metrics, replacements);
      removeCompanyRecords(locations, replacements);
      removeCompanyRecords(sources, replacements);
      removeCompanyRecords(reports, replacements);
      removeCompanyRecords(intelligence, replacements);
    }

    for (const company of layer.data.companies ?? []) {
      const normalized = normalizeCompany(company);
      if (!normalized.id) {
        issues.push({ code: "empty-company-id", severity: "error", layer: layer.name, recordType: "company", recordId: company.name, message: "Company record has no canonical identifier." });
        droppedRecords += 1;
        continue;
      }
      companies.set(normalized.id, normalized);
    }
    for (const profile of layer.data.profiles ?? []) {
      const normalized = normalizeProfile(profile);
      profiles.set(normalized.companyId, normalized);
    }
    for (const metric of layer.data.metrics ?? []) {
      const normalized = normalizeMetric(metric);
      metrics.set(scopedKey(normalized.companyId, normalized.deduplicationKey ?? normalized.id), normalized);
    }
    for (const location of layer.data.locations ?? []) {
      const normalized = normalizeLocation(location);
      locations.set(scopedKey(normalized.companyId, normalized.deduplicationKey ?? normalized.id), normalized);
    }
    for (const source of layer.data.sources ?? []) {
      const normalized = normalizeSource(source);
      sources.set(scopedKey(normalized.companyId, normalized.id), normalized);
    }
    for (const report of layer.data.reports ?? []) {
      const normalized = normalizeReport(report);
      reports.set(scopedKey(normalized.companyId, normalized.id), normalized);
    }
    for (const assumption of layer.data.assumptions ?? []) assumptions.set(assumption.id, assumption);
    for (const item of layer.data.intelligence ?? []) {
      const normalized = normalizeIntelligence(item);
      intelligence.set(normalized.companyId, normalized);
    }
    if (layer.data.status) status = layer.data.status;
  }

  const companyIds = new Set(companies.keys());
  const dropOrphans = <T extends { companyId: string }>(records: Map<string, T>, recordType: DataQualityIssue["recordType"]) => {
    for (const [key, record] of records) {
      if (companyIds.has(record.companyId)) continue;
      issues.push({
        code: "orphan-record",
        severity: "warning",
        recordType,
        recordId: key,
        message: `Record references missing company ${record.companyId}.`,
      });
      records.delete(key);
      droppedRecords += 1;
    }
  };

  dropOrphans(profiles, "profile");
  dropOrphans(metrics, "metric");
  dropOrphans(locations, "location");
  dropOrphans(sources, "source");
  dropOrphans(reports, "report");
  dropOrphans(intelligence, "intelligence");

  for (const metric of metrics.values()) {
    const sourceIds = metric.sourceIds ?? (metric.sourceId ? [metric.sourceId] : []);
    for (const sourceId of sourceIds) {
      if (sources.has(scopedKey(metric.companyId, sourceId))) continue;
      issues.push({
        code: "missing-source",
        severity: "warning",
        recordType: "metric",
        recordId: metric.id,
        message: `Metric references missing source ${sourceId}.`,
      });
    }
  }

  for (const location of locations.values()) validateCoordinates(location, issues);

  const companyNames = new Map(Array.from(companies.values()).map((company) => [company.id, company.name]));
  const normalizedLocations = Array.from(locations.values()).map((location) => ({
    ...location,
    company: companyNames.get(location.companyId) ?? location.company,
  }));

  return {
    companies: Array.from(companies.values()),
    profiles: Array.from(profiles.values()),
    metrics: Array.from(metrics.values()),
    locations: normalizedLocations,
    sources: Array.from(sources.values()),
    reports: Array.from(reports.values()),
    assumptions: Array.from(assumptions.values()),
    intelligence: Array.from(intelligence.values()),
    status,
    diagnostics: {
      layers: orderedLayers.map((layer) => ({ name: layer.name, priority: layer.priority, records: recordCount(layer.data) })),
      issues,
      droppedRecords,
    },
  };
}

export function upsertCompanyIntelligence(dataset: InsightDataset, item: CompanyIntelligence): InsightDataset {
  const normalized = normalizeIntelligence(item);
  const intelligence = new Map(dataset.intelligence.map((entry) => [canonicalCompanyId(entry.companyId), entry]));
  intelligence.set(normalized.companyId, normalized);
  return { ...dataset, intelligence: Array.from(intelligence.values()) };
}
