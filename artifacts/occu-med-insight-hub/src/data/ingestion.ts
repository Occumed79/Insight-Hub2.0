import * as XLSX from "xlsx";
import { workbookAssets } from "./assets";
import { seedDataset } from "./seed";
import type { Company, InsightDataset, LocationRecord, Metric, SourceRecord } from "./types";

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const numberFrom = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

async function readWorkbook(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load workbook ${url}`);
  const buffer = await response.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

function rowsFromSheet(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [] as Record<string, unknown>[];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function normalizeProxyRows(rows: Record<string, unknown>[]) {
  const companies: Company[] = [];
  const metrics: Metric[] = [];
  const sources: SourceRecord[] = [];
  rows.slice(0, 28).forEach((row) => {
    const name = String(row.Company || "").trim();
    if (!name) return;
    const id = slugify(name.replace(/, inc\.?/i, ""));
    const employees = numberFrom(row.Employees);
    const wcReserve = numberFrom(row.Workers_comp_reserve_or_accrual_USD);
    const wcProxy = numberFrom(row.Estimated_annual_WC_cost_proxy_USD);
    const headcountSource = String(row.Headcount_source_url || "");
    const reserveSource = String(row.WC_reserve_source_url || "");
    const note = String(row.Notes || "Public workforce and workers' compensation proxy row from attached workbook.");
    companies.push({ id, name, shortName: name.split(/[,(]/)[0].trim(), sector: id === "v2x" ? "Defense services, logistics, training, and mission support" : "Federal services and industrial operations", headquarters: id === "v2x" ? "McLean, Virginia" : "Public company / benchmark peer", employees, employeesAsOf: String(row.Employees_as_of || "Workbook source"), summary: note, tags: id === "v2x" ? ["Initial dataset", "Federal contractor", "WC reserve signal"] : ["Benchmark peer", "Proxy row"] });
    const sourceId = `${id}-proxy-source`;
    sources.push({ id: sourceId, companyId: id, label: `${name} proxy workbook row`, type: headcountSource || reserveSource ? "URL" : "Workbook", url: headcountSource || reserveSource || undefined, note });
    metrics.push({ id: `${id}-employees`, companyId: id, label: "Employees", value: employees, unit: "count", category: "workforce", trend: 2.2, sourceId });
    if (wcReserve > 0) metrics.push({ id: `${id}-wc-reserve`, companyId: id, label: "WC reserve / accrual", value: wcReserve, unit: "usd", category: "financial", trend: 3.1, sourceId });
    if (wcProxy > 0) metrics.push({ id: `${id}-wc-proxy`, companyId: id, label: "Estimated annual WC proxy", value: wcProxy, unit: "usd", category: "financial", trend: 4.6, sourceId });
  });
  return { companies, metrics, sources };
}

function countryRegion(country: string) {
  const normalized = country.toLowerCase();
  if (["usa", "united states", "guam"].includes(normalized)) return "North America";
  if (["germany", "albania", "italy", "united kingdom"].includes(normalized)) return "Europe";
  if (["afghanistan", "kuwait", "iraq", "qatar", "saudi arabia"].includes(normalized)) return "Middle East / Central Asia";
  if (["philippines", "japan", "korea", "australia"].includes(normalized)) return "Indo-Pacific";
  return "Global";
}

const coordinateBook: Record<string, [number, number]> = { afghanistan: [67.71, 33.93], germany: [10.45, 51.17], guam: [144.79, 13.44], usa: [-98.58, 39.83], kuwait: [47.48, 29.31], philippines: [121.77, 12.88], albania: [20.16, 41.15] };

function normalizeGeographyRows(rows: Record<string, unknown>[]) {
  const locations: LocationRecord[] = [];
  rows.forEach((row, index) => {
    const city = String(row.City || row["City / Area"] || "").trim();
    const country = String(row.Country || "").trim();
    const v2x = String(row.V2X || "").trim();
    if (!city || !country || v2x.toUpperCase() !== "X") return;
    const key = country.toLowerCase();
    const base = coordinateBook[key] || [0, 20];
    const offset = (index % 7) * 0.65;
    locations.push({ id: `v2x-${slugify(city)}-${index}`, companyId: "v2x", company: "V2X", city, state: String(row.State || "") || undefined, country, region: countryRegion(country), facilityType: "Workbook presence", activity: "Mission, logistics, aviation, or program support", notes: "Parsed from the geographic workbook Data sheet where V2X is marked present.", coordinates: [base[0] + offset, base[1] + offset / 3] });
  });
  return locations;
}

export async function loadInsightDataset(): Promise<InsightDataset> {
  try {
    const [proxyWorkbook, methodologyWorkbook, geographyWorkbook] = await Promise.all([readWorkbook(workbookAssets.proxy), readWorkbook(workbookAssets.methodology), readWorkbook(workbookAssets.geography)]);
    const publicRows = rowsFromSheet(proxyWorkbook, "Public_Proxy_Table");
    const privateRows = ["Private_Batch2", "Private_Batch3", "Private_Batch4"].flatMap((sheet) => rowsFromSheet(proxyWorkbook, sheet));
    const methodologyRows = rowsFromSheet(methodologyWorkbook, methodologyWorkbook.SheetNames[0] || "");
    const geoRows = rowsFromSheet(geographyWorkbook, "Data");
    const normalized = normalizeProxyRows([...publicRows, ...privateRows]);
    const workbookLocations = normalizeGeographyRows(geoRows);
    const companyMap = new Map(seedDataset.companies.map((company) => [company.id, company]));
    normalized.companies.forEach((company) => companyMap.set(company.id, company));
    const sourceMap = new Map(seedDataset.sources.map((source) => [source.id, source]));
    normalized.sources.forEach((source) => sourceMap.set(source.id, source));
    const metricMap = new Map(seedDataset.metrics.map((metric) => [metric.id, metric]));
    normalized.metrics.forEach((metric) => metricMap.set(metric.id, metric));
    const locations = workbookLocations.length > 0 ? workbookLocations.slice(0, 80) : seedDataset.locations;
    metricMap.set("v2x-global-locations", { id: "v2x-global-locations", companyId: "v2x", label: "Mapped locations", value: locations.length, unit: "count", category: "risk", trend: 8.2, sourceId: "geography-workbook" });
    return { ...seedDataset, companies: Array.from(companyMap.values()), sources: Array.from(sourceMap.values()), metrics: Array.from(metricMap.values()), locations, status: { proxyRows: publicRows.length + privateRows.length, methodologyRows: methodologyRows.length, geographyRows: geoRows.length, loaded: true } };
  } catch (error) {
    return { ...seedDataset, status: { proxyRows: 0, methodologyRows: 0, geographyRows: 0, loaded: false, error: error instanceof Error ? error.message : "Workbook parsing failed" } };
  }
}

export type PdfExtractionInput = { fileName: string; text: string; sourceUrl?: string };

export function extractPdfSourceNotes(input: PdfExtractionInput): SourceRecord {
  return { id: slugify(input.fileName), companyId: "v2x", label: input.fileName, type: "Workbook", url: input.sourceUrl, note: input.text.slice(0, 500) };
}
