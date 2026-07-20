import * as XLSX from "xlsx";
import { workbookAssets } from "./assets";
import type { Company, InsightDataset, LocationRecord, Metric, SourceRecord } from "./types";

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const numberFrom = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
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

  rows.forEach((row) => {
    const name = String(row.Company || "").trim();
    if (!name) return;
    const id = slugify(name.replace(/, inc\.?/i, ""));
    const employees = numberFrom(row.Employees);
    const wcReserve = numberFrom(row.Workers_comp_reserve_or_accrual_USD);
    const wcProxy = numberFrom(row.Estimated_annual_WC_cost_proxy_USD);
    const headcountSource = String(row.Headcount_source_url || "");
    const reserveSource = String(row.WC_reserve_source_url || "");
    const note = String(row.Notes || "Public workforce and workers' compensation proxy row from attached workbook.");
    const sourceId = `${id}-proxy-source`;

    companies.push({
      id,
      name,
      shortName: name.split(/[,(]/)[0].trim(),
      sector: id === "v2x" ? "Defense services, logistics, training, and mission support" : "Federal services and industrial operations",
      headquarters: id === "v2x" ? "McLean, Virginia" : "Public company / benchmark peer",
      employees: employees ?? 0,
      employeesAsOf: String(row.Employees_as_of || "Workbook source"),
      summary: note,
      tags: id === "v2x" ? ["Initial dataset", "Federal contractor", "WC reserve signal"] : ["Benchmark peer", "Proxy row"],
      entityType: "company",
    });
    sources.push({ id: sourceId, companyId: id, label: `${name} proxy workbook row`, type: headcountSource || reserveSource ? "URL" : "Workbook", url: headcountSource || reserveSource || undefined, note });
    if (employees !== undefined) metrics.push({ id: `${id}-employees`, companyId: id, label: "Employees", value: employees, unit: "count", category: "workforce", sourceId, status: "uploaded" });
    if (wcReserve !== undefined && wcReserve > 0) metrics.push({ id: `${id}-wc-reserve`, companyId: id, label: "WC reserve / accrual", value: wcReserve, unit: "usd", category: "financial", sourceId, status: "uploaded" });
    if (wcProxy !== undefined && wcProxy > 0) metrics.push({ id: `${id}-wc-proxy`, companyId: id, label: "Estimated annual WC proxy", value: wcProxy, unit: "usd", category: "financial", sourceId, status: "estimated" });
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
  "abu dhabi|uae": { coordinates: [54.388567, 24.463297], confidence: "place", source: "manual" },
  "abu dhabi|united arab emirates": { coordinates: [54.388567, 24.463297], confidence: "place", source: "manual" },
  "canberra|australia": { coordinates: [149.129574, -35.296524], confidence: "city", source: "manual" },
  "reston|usa": { coordinates: [-77.3570, 38.9586], confidence: "city", source: "estimated" },
  "reston|united states": { coordinates: [-77.3570, 38.9586], confidence: "city", source: "estimated" },
  "bagram|afghanistan": { coordinates: [69.234108, 34.933373], confidence: "place", source: "manual" },
  "kuwait international airport|kuwait": { coordinates: [47.955156, 29.220268], confidence: "place", source: "manual" },
  "camp buehring|kuwait": { coordinates: [47.420235, 29.699025], confidence: "place", source: "manual" },
  "camp buehring udairi|kuwait": { coordinates: [47.420235, 29.699025], confidence: "place", source: "manual" },
  "camp patriot|kuwait": { coordinates: [48.121449, 29.044155], confidence: "place", source: "estimated" },
  "shuaiba sea port|kuwait": { coordinates: [48.121449, 29.044155], confidence: "place", source: "manual" },
  "isa air base|bahrain": { coordinates: [50.592636, 25.914427], confidence: "place", source: "manual" },
  "guantanamo bay|cuba": { coordinates: [-75.159326, 19.918556], confidence: "place", source: "manual" },
  "landstuhl|germany": { coordinates: [7.572230, 49.414331], confidence: "city", source: "manual" },
  "nassau|bahamas": { coordinates: [-77.338344, 25.078227], confidence: "city", source: "manual" },
  "colorado springs|usa": { coordinates: [-104.825348, 38.833958], confidence: "city", source: "manual" },
  "colorado springs|united states": { coordinates: [-104.825348, 38.833958], confidence: "city", source: "manual" },
  "denver|usa": { coordinates: [-104.984862, 39.739236], confidence: "city", source: "manual" },
  "denver|united states": { coordinates: [-104.984862, 39.739236], confidence: "city", source: "manual" },
  "glastonbury|usa": { coordinates: [-72.608146, 41.712322], confidence: "city", source: "manual" },
  "glastonbury|united states": { coordinates: [-72.608146, 41.712322], confidence: "city", source: "manual" },
  "southport|usa": { coordinates: [-73.288343, 41.135222], confidence: "city", source: "manual" },
  "southport|united states": { coordinates: [-73.288343, 41.135222], confidence: "city", source: "manual" },
  "scottsdale|usa": { coordinates: [-111.920773, 33.493143], confidence: "city", source: "manual" },
  "sedona|usa": { coordinates: [-111.761439, 34.868861], confidence: "city", source: "manual" },
  "irvine|usa": { coordinates: [-117.825981, 33.685697], confidence: "city", source: "manual" },
  "crestview|usa": { coordinates: [-86.570508, 30.762133], confidence: "city", source: "manual" },
  "fort lauderdale|usa": { coordinates: [-80.143379, 26.122308], confidence: "city", source: "manual" },
  "jacksonville beach|usa": { coordinates: [-81.393140, 30.294686], confidence: "city", source: "manual" },
  "orlando|usa": { coordinates: [-81.379045, 28.542122], confidence: "city", source: "manual" },
  "atlanta|usa": { coordinates: [-84.389815, 33.754466], confidence: "city", source: "manual" },
  "chicago|usa": { coordinates: [-87.624421, 41.875562], confidence: "city", source: "manual" },
  "indianapolis|usa": { coordinates: [-86.158350, 39.768333], confidence: "city", source: "manual" },
  "winfield|usa": { coordinates: [-96.995592, 37.239749], confidence: "city", source: "manual" },
  "braintree|usa": { coordinates: [-71.004123, 42.220596], confidence: "city", source: "manual" },
  "norwood|usa": { coordinates: [-71.199498, 42.194543], confidence: "city", source: "manual" },
  "annapolis|usa": { coordinates: [-76.492786, 38.978640], confidence: "city", source: "manual" },
  "columbia|usa": { coordinates: [-76.858205, 39.215621], confidence: "city", source: "manual" },
  "saco|usa": { coordinates: [-70.368382, 43.493696], confidence: "city", source: "manual" },
  "detroit|usa": { coordinates: [-83.046640, 42.331551], confidence: "city", source: "manual" },
  "biloxi|usa": { coordinates: [-88.889382, 30.400763], confidence: "city", source: "manual" },
  "madison|usa": { coordinates: [-90.004082, 32.630832], confidence: "city", source: "manual" },
  "bozeman|usa": { coordinates: [-111.044047, 45.679429], confidence: "city", source: "manual" },
  "fayetteville|usa": { coordinates: [-78.878292, 35.052576], confidence: "city", source: "manual" },
  "elkhorn|usa": { coordinates: [-96.234612, 41.286070], confidence: "city", source: "manual" },
  "branchburg|usa": { coordinates: [-74.700271, 40.568824], confidence: "city", source: "manual" },
  "ramsey|usa": { coordinates: [-74.140977, 41.057319], confidence: "city", source: "manual" },
  "new york|usa": { coordinates: [-74.006015, 40.712728], confidence: "city", source: "manual" },
  "new york city|usa": { coordinates: [-74.006015, 40.712728], confidence: "city", source: "manual" },
  "port chester|usa": { coordinates: [-73.665683, 41.001764], confidence: "city", source: "manual" },
  "chester|usa": { coordinates: [-75.765242, 39.982931], confidence: "city", source: "manual" },
  "pittsburgh|usa": { coordinates: [-79.962461, 40.444153], confidence: "city", source: "manual" },
  "nashville|usa": { coordinates: [-86.774298, 36.162277], confidence: "city", source: "manual" },
  "austin|usa": { coordinates: [-97.733935, 30.285149], confidence: "city", source: "manual" },
  "dallas|usa": { coordinates: [-96.796856, 32.776272], confidence: "city", source: "manual" },
  "fort worth|usa": { coordinates: [-97.332746, 32.753177], confidence: "city", source: "manual" },
  "houston|usa": { coordinates: [-95.344063, 29.720790], confidence: "city", source: "manual" },
  "wichita falls|usa": { coordinates: [-98.502078, 33.900457], confidence: "city", source: "manual" },
  "alexandria|usa": { coordinates: [-77.047023, 38.805110], confidence: "city", source: "manual" },
  "glen allen|usa": { coordinates: [-77.506374, 37.665978], confidence: "city", source: "manual" },
  "manchester|usa": { coordinates: [-73.071997, 43.163775], confidence: "city", source: "manual" },
  "seattle|usa": { coordinates: [-122.330062, 47.603832], confidence: "city", source: "manual" },
  "montgomery|usa": { coordinates: [-86.309078, 32.377711], confidence: "city", source: "manual" },
  "mildenhall|uk": { coordinates: [0.511677, 52.352731], confidence: "city", source: "manual" },
  "mannheim|germany": { coordinates: [8.467310, 49.489291], confidence: "city", source: "manual" },
  "patch barracks|germany": { coordinates: [9.080949, 48.735530], confidence: "place", source: "manual" },
  "thule ab|greenland": { coordinates: [-68.714564, 76.529947], confidence: "place", source: "manual" },
  "martyr bg ali flaih ab|iraq": { coordinates: [44.502380, 33.308472], confidence: "place", source: "manual" },
  "muwaffaq salti ab|jordan": { coordinates: [36.779415, 31.820508], confidence: "place", source: "manual" },
  "manda bay|kenya": { coordinates: [40.896473, -2.170203], confidence: "place", source: "manual" },
  "kwajalein atoll|marshall islands": { coordinates: [167.079554, 9.160464], confidence: "place", source: "manual" },
  "subic bay|philippines": { coordinates: [120.233980, 14.784979], confidence: "place", source: "manual" },
  "doha|qatar": { coordinates: [51.508181, 25.310881], confidence: "city", source: "manual" },
  "al udeid ab|qatar": { coordinates: [51.322184, 25.117317], confidence: "place", source: "manual" },
  "doha al udeid ab|qatar": { coordinates: [51.535667, 25.288991], confidence: "place", source: "manual" },
  "deveselu|romania": { coordinates: [24.391376, 44.053542], confidence: "place", source: "manual" },
  "al khobar|saudi arabia": { coordinates: [50.196024, 26.304000], confidence: "city", source: "manual" },
  "seoul|south korea": { coordinates: [126.978291, 37.566679], confidence: "city", source: "manual" },
  "bangkok|thailand": { coordinates: [100.493509, 13.752494], confidence: "city", source: "manual" },
  "chiang mai|thailand": { coordinates: [98.985880, 18.788278], confidence: "city", source: "manual" },
  "ankara|turkey": { coordinates: [32.854050, 39.920776], confidence: "city", source: "manual" },
};

const countryCentroids: Record<string, [number, number]> = {
  afghanistan: [67.71, 33.93], albania: [20.16, 41.15], australia: [133.78, -25.27], bahamas: [-77.39, 25.03], bahrain: [50.56, 26.07], cuba: [-77.78, 21.52], germany: [10.45, 51.17], guam: [144.79, 13.44], iraq: [43.68, 33.22], italy: [12.57, 41.87], japan: [138.25, 36.20], korea: [127.77, 35.91], kuwait: [47.48, 29.31], philippines: [121.77, 12.88], qatar: [51.18, 25.35], "saudi arabia": [45.08, 23.89], uae: [54.30, 24.35], "united arab emirates": [54.30, 24.35], "united kingdom": [-3.43, 55.38], usa: [-98.58, 39.83], "united states": [-98.58, 39.83],
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
      sourceId: "geography-workbook",
      status: "uploaded",
    });
  });
  return locations;
}

const emptyDataset = (status: InsightDataset["status"]): InsightDataset => ({ companies: [], profiles: [], metrics: [], locations: [], sources: [], reports: [], assumptions: [], intelligence: [], status });

export async function loadInsightDataset(): Promise<InsightDataset> {
  try {
    const [proxyWorkbook, methodologyWorkbook, geographyWorkbook] = await Promise.all([readWorkbook(workbookAssets.proxy), readWorkbook(workbookAssets.methodology), readWorkbook(workbookAssets.geography)]);
    const publicRows = rowsFromSheet(proxyWorkbook, "Public_Proxy_Table");
    const privateRows = ["Private_Batch2", "Private_Batch3", "Private_Batch4"].flatMap((sheet) => rowsFromSheet(proxyWorkbook, sheet));
    const methodologyRows = rowsFromSheet(methodologyWorkbook, methodologyWorkbook.SheetNames[0] || "");
    const geoRows = rowsFromSheet(geographyWorkbook, "Data");
    const normalized = normalizeProxyRows([...publicRows, ...privateRows]);
    const workbookLocations = normalizeGeographyRows(geoRows);
    const geographySource: SourceRecord = { id: "geography-workbook", companyId: "v2x", label: "V2X geographic workbook", type: "Workbook", note: "Uploaded geographic workbook rows where V2X is marked present." };
    const metrics = [...normalized.metrics];
    if (workbookLocations.length > 0) metrics.push({ id: "v2x-global-locations", companyId: "v2x", label: "Mapped locations", value: workbookLocations.length, unit: "count", category: "risk", sourceId: geographySource.id, status: "uploaded" });

    return {
      ...emptyDataset({ proxyRows: publicRows.length + privateRows.length, methodologyRows: methodologyRows.length, geographyRows: geoRows.length, loaded: true }),
      companies: normalized.companies,
      metrics,
      locations: workbookLocations,
      sources: [...normalized.sources, geographySource],
    };
  } catch (error) {
    return emptyDataset({ proxyRows: 0, methodologyRows: 0, geographyRows: 0, loaded: false, error: error instanceof Error ? error.message : "Workbook parsing failed" });
  }
}

export type PdfExtractionInput = { fileName: string; text: string; sourceUrl?: string };

export function extractPdfSourceNotes(input: PdfExtractionInput): SourceRecord {
  return { id: slugify(input.fileName), companyId: "v2x", label: input.fileName, type: "Workbook", url: input.sourceUrl, note: input.text.slice(0, 500) };
}
