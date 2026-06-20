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
  if (["afghanistan", "kuwait", "iraq", "qatar", "saudi arabia", "uae", "united arab emirates", "bahrain"].includes(normalized)) return "Middle East / Central Asia";
  if (["philippines", "japan", "korea", "australia"].includes(normalized)) return "Indo-Pacific";
  return "Global";
}

type GeocodeHit = {
  coordinates: [number, number];
  confidence: LocationRecord["geocodeConfidence"];
  source: LocationRecord["geocodeSource"];
};

const normalizeLookup = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const preciseCoordinateBook: Record<string, GeocodeHit> = {
  "abu dhabi|uae": { coordinates: [54.3773, 24.4539], confidence: "place", source: "estimated" },
  "abu dhabi|united arab emirates": { coordinates: [54.3773, 24.4539], confidence: "place", source: "estimated" },
  "canberra|australia": { coordinates: [149.1300, -35.2809], confidence: "city", source: "estimated" },
  "reston|usa": { coordinates: [-77.3570, 38.9586], confidence: "city", source: "estimated" },
  "reston|united states": { coordinates: [-77.3570, 38.9586], confidence: "city", source: "estimated" },
  "bagram|afghanistan": { coordinates: [69.2649, 34.9461], confidence: "place", source: "estimated" },
  "kuwait international airport|kuwait": { coordinates: [47.9713, 29.2266], confidence: "place", source: "estimated" },
  "camp buehring|kuwait": { coordinates: [47.4338, 29.7042], confidence: "place", source: "estimated" },
  "camp buehring udairi|kuwait": { coordinates: [47.4338, 29.7042], confidence: "place", source: "estimated" },
  "camp patriot|kuwait": { coordinates: [48.1618, 29.3478], confidence: "place", source: "estimated" },
  "shuaiba sea port|kuwait": { coordinates: [48.1597, 29.0475], confidence: "place", source: "estimated" },
  "isa air base|bahrain": { coordinates: [50.5906, 25.9191], confidence: "place", source: "estimated" },
  "guantanamo bay|cuba": { coordinates: [-75.2090, 19.9065], confidence: "place", source: "estimated" },
  "landstuhl|germany": { coordinates: [7.5706, 49.4131], confidence: "city", source: "estimated" },
  "nassau|bahamas": { coordinates: [-77.3504, 25.0443], confidence: "city", source: "estimated" },
  "colorado springs|usa": { coordinates: [-104.8214, 38.8339], confidence: "city", source: "estimated" },
  "colorado springs|united states": { coordinates: [-104.8214, 38.8339], confidence: "city", source: "estimated" },
  "denver|usa": { coordinates: [-104.9903, 39.7392], confidence: "city", source: "estimated" },
  "denver|united states": { coordinates: [-104.9903, 39.7392], confidence: "city", source: "estimated" },
  "glastonbury|usa": { coordinates: [-72.6081, 41.7123], confidence: "city", source: "estimated" },
  "glastonbury|united states": { coordinates: [-72.6081, 41.7123], confidence: "city", source: "estimated" },
  "southport|usa": { coordinates: [-78.0203, 33.9216], confidence: "city", source: "estimated" },
  "southport|united states": { coordinates: [-78.0203, 33.9216], confidence: "city", source: "estimated" },
};

const countryCentroids: Record<string, [number, number]> = {
  afghanistan: [67.71, 33.93],
  albania: [20.16, 41.15],
  australia: [133.78, -25.27],
  bahamas: [-77.39, 25.03],
  bahrain: [50.56, 26.07],
  cuba: [-77.78, 21.52],
  germany: [10.45, 51.17],
  guam: [144.79, 13.44],
  iraq: [43.68, 33.22],
  italy: [12.57, 41.87],
  japan: [138.25, 36.20],
  korea: [127.77, 35.91],
  kuwait: [47.48, 29.31],
  philippines: [121.77, 12.88],
  qatar: [51.18, 25.35],
  "saudi arabia": [45.08, 23.89],
  uae: [54.30, 24.35],
  "united arab emirates": [54.30, 24.35],
  "united kingdom": [-3.43, 55.38],
  usa: [-98.58, 39.83],
  "united states": [-98.58, 39.83],
};

function resolveCoordinates(city: string, country: string): GeocodeHit {
  const cityKey = normalizeLookup(city);
  const countryKey = normalizeLookup(country);
  const precise = preciseCoordinateBook[`${cityKey}|${countryKey}`];
  if (precise) return precise;
  const countryCoordinate = countryCentroids[countryKey];
  if (countryCoordinate) return { coordinates: countryCoordinate, confidence: "country", source: "estimated" };
  return { coordinates: [0, 0], confidence: "unknown", source: "estimated" };
}

function normalizeGeographyRows(rows: Record<string, unknown>[]) {
  const locations: LocationRecord[] = [];
  rows.forEach((row, index) => {
    const city = String(row.City || row["City / Area"] || "").trim();
    const country = String(row.Country || "").trim();
    const v2x = String(row.V2X || "").trim();
    if (!city || !country || v2x.toUpperCase() !== "X") return;
    const geocode = resolveCoordinates(city, country);
    locations.push({
      id: `v2x-${slugify(city)}-${index}`,
      companyId: "v2x",
      company: "V2X",
      city,
      state: String(row.State || "") || undefined,
      country,
      region: countryRegion(country),
      facilityType: "Workbook presence",
      activity: "Mission, logistics, aviation, or program support",
      notes: "Parsed from the geographic workbook Data sheet where V2X is marked present.",
      placeName: city,
      formattedAddress: `${city}, ${country}`,
      geocodeSource: geocode.source,
      geocodeConfidence: geocode.confidence,
      coordinates: geocode.coordinates,
    });
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
