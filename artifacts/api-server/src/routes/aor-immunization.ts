import { Router, type IRouter } from "express";
import * as XLSX from "xlsx";

const router: IRouter = Router();
const BASE_URL = "https://srhdpeuwpubsa-geecgzbpd5h0fueu.z01.azurefd.net/whdh/WIISE/export";
const CACHE_TTL = 24 * 60 * 60_000;

type DatasetKey = "coverage" | "incidence" | "cases" | "introduction" | "indicators" | "wuenic";
type Row = Record<string, unknown>;
type CachedWorkbook = { expiresAt: number; rows: Row[]; sourceUrl: string };

const DATASETS: Record<DatasetKey, { file: string; sheet: string; itemFields: string[]; valueFields: string[]; descriptionFields: string[] }> = {
  coverage: { file: "coverage-data.xlsx", sheet: "Data", itemFields: ["ANTIGEN"], valueFields: ["COVERAGE"], descriptionFields: ["ANTIGEN_DESCRIPTION"] },
  incidence: { file: "incidence-rate-data.xlsx", sheet: "Data", itemFields: ["DISEASE"], valueFields: ["INCIDENCE_RATE"], descriptionFields: ["DISEASE_DESCRIPTION"] },
  cases: { file: "reported-cases-data.xlsx", sheet: "Data", itemFields: ["DISEASE"], valueFields: ["CASES"], descriptionFields: ["DISEASE_DESCRIPTION"] },
  introduction: { file: "vaccine-introduction-data.xlsx", sheet: "Data", itemFields: ["DESCRIPTION"], valueFields: ["INTRO"], descriptionFields: ["DESCRIPTION"] },
  indicators: { file: "other-indicators-data.xlsx", sheet: "Data", itemFields: ["INDCODE", "DESCRIPTION"], valueFields: ["VALUE"], descriptionFields: ["DESCRIPTION", "INDCAT_DESCRIPTION"] },
  wuenic: { file: "wuenic-input-to-pdf.xlsx", sheet: "wuenic_master", itemFields: ["Vaccine"], valueFields: ["WUENIC"], descriptionFields: ["Vaccine"] },
};

// Map WHO/ISO alpha-3 country codes onto the alpha-2 keys used by the existing MapTiler country source.
// Kosovo (XKX) is included as a common non-ISO operational code used by international datasets.
const ISO3_TO_ISO2: Record<string, string> = {
  ABW:"AW",AFG:"AF",AGO:"AO",AIA:"AI",ALA:"AX",ALB:"AL",AND:"AD",ARE:"AE",ARG:"AR",ARM:"AM",ASM:"AS",ATA:"AQ",ATF:"TF",ATG:"AG",AUS:"AU",AUT:"AT",AZE:"AZ",
  BDI:"BI",BEL:"BE",BEN:"BJ",BES:"BQ",BFA:"BF",BGD:"BD",BGR:"BG",BHR:"BH",BHS:"BS",BIH:"BA",BLM:"BL",BLR:"BY",BLZ:"BZ",BMU:"BM",BOL:"BO",BRA:"BR",BRB:"BB",BRN:"BN",BTN:"BT",BVT:"BV",BWA:"BW",
  CAF:"CF",CAN:"CA",CCK:"CC",CHE:"CH",CHL:"CL",CHN:"CN",CIV:"CI",CMR:"CM",COD:"CD",COG:"CG",COK:"CK",COL:"CO",COM:"KM",CPV:"CV",CRI:"CR",CUB:"CU",CUW:"CW",CXR:"CX",CYM:"KY",CYP:"CY",CZE:"CZ",
  DEU:"DE",DJI:"DJ",DMA:"DM",DNK:"DK",DOM:"DO",DZA:"DZ",ECU:"EC",EGY:"EG",ERI:"ER",ESH:"EH",ESP:"ES",EST:"EE",ETH:"ET",FIN:"FI",FJI:"FJ",FLK:"FK",FRA:"FR",FRO:"FO",FSM:"FM",
  GAB:"GA",GBR:"GB",GEO:"GE",GGY:"GG",GHA:"GH",GIB:"GI",GIN:"GN",GLP:"GP",GMB:"GM",GNB:"GW",GNQ:"GQ",GRC:"GR",GRD:"GD",GRL:"GL",GTM:"GT",GUF:"GF",GUM:"GU",GUY:"GY",
  HKG:"HK",HMD:"HM",HND:"HN",HRV:"HR",HTI:"HT",HUN:"HU",IDN:"ID",IMN:"IM",IND:"IN",IOT:"IO",IRL:"IE",IRN:"IR",IRQ:"IQ",ISL:"IS",ISR:"IL",ITA:"IT",
  JAM:"JM",JEY:"JE",JOR:"JO",JPN:"JP",KAZ:"KZ",KEN:"KE",KGZ:"KG",KHM:"KH",KIR:"KI",KNA:"KN",KOR:"KR",KWT:"KW",LAO:"LA",LBN:"LB",LBR:"LR",LBY:"LY",LCA:"LC",LIE:"LI",LKA:"LK",LSO:"LS",LTU:"LT",LUX:"LU",LVA:"LV",
  MAC:"MO",MAF:"MF",MAR:"MA",MCO:"MC",MDA:"MD",MDG:"MG",MDV:"MV",MEX:"MX",MHL:"MH",MKD:"MK",MLI:"ML",MLT:"MT",MMR:"MM",MNE:"ME",MNG:"MN",MNP:"MP",MOZ:"MZ",MRT:"MR",MSR:"MS",MTQ:"MQ",MUS:"MU",MWI:"MW",MYS:"MY",MYT:"YT",
  NAM:"NA",NCL:"NC",NER:"NE",NFK:"NF",NGA:"NG",NIC:"NI",NIU:"NU",NLD:"NL",NOR:"NO",NPL:"NP",NRU:"NR",NZL:"NZ",OMN:"OM",PAK:"PK",PAN:"PA",PCN:"PN",PER:"PE",PHL:"PH",PLW:"PW",PNG:"PG",POL:"PL",PRI:"PR",PRK:"KP",PRT:"PT",PRY:"PY",PSE:"PS",PYF:"PF",
  QAT:"QA",REU:"RE",ROU:"RO",RUS:"RU",RWA:"RW",SAU:"SA",SDN:"SD",SEN:"SN",SGP:"SG",SGS:"GS",SHN:"SH",SJM:"SJ",SLB:"SB",SLE:"SL",SLV:"SV",SMR:"SM",SOM:"SO",SPM:"PM",SRB:"RS",SSD:"SS",STP:"ST",SUR:"SR",SVK:"SK",SVN:"SI",SWE:"SE",SWZ:"SZ",SXM:"SX",SYC:"SC",SYR:"SY",
  TCA:"TC",TCD:"TD",TGO:"TG",THA:"TH",TJK:"TJ",TKL:"TK",TKM:"TM",TLS:"TL",TON:"TO",TTO:"TT",TUN:"TN",TUR:"TR",TUV:"TV",TWN:"TW",TZA:"TZ",UGA:"UG",UKR:"UA",UMI:"UM",URY:"UY",USA:"US",UZB:"UZ",VAT:"VA",VCT:"VC",VEN:"VE",VGB:"VG",VIR:"VI",VNM:"VN",VUT:"VU",WLF:"WF",WSM:"WS",YEM:"YE",ZAF:"ZA",ZMB:"ZM",ZWE:"ZW",XKX:"XK",
};

const caches = new Map<DatasetKey, CachedWorkbook>();
const inFlight = new Map<DatasetKey, Promise<CachedWorkbook>>();

function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function normalize(value: unknown) { return text(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function number(value: unknown) { const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim()); return Number.isFinite(parsed) ? parsed : null; }
function value(row: Row, keys: string[]) { for (const key of keys) if (row[key] != null && text(row[key])) return row[key]; return null; }
function unique(values: string[], max = 500) { return [...new Set(values.filter(Boolean))].slice(0, max); }

async function downloadWorkbook(dataset: DatasetKey): Promise<CachedWorkbook> {
  const config = DATASETS[dataset];
  const sourceUrl = `${BASE_URL}/${config.file}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dataset === "indicators" ? 45_000 : 32_000);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.7", "User-Agent": "Occu-Med Insight Hub/2.0 WHO immunization intelligence" },
    });
    if (!response.ok) throw new Error(`WHO Immunization Data Portal returned HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length"));
    const maxBytes = dataset === "indicators" ? 55_000_000 : 28_000_000;
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error("WHO workbook exceeded the safety limit");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error("WHO workbook exceeded the safety limit");
    const workbook = XLSX.read(buffer, { type: "array", dense: true, cellDates: false });
    const sheet = workbook.Sheets[config.sheet] || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error(`WHO workbook did not contain sheet ${config.sheet}`);
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true });
    if (!rows.length) throw new Error("WHO workbook contained no data rows");
    return { rows, sourceUrl, expiresAt: Date.now() + CACHE_TTL };
  } finally { clearTimeout(timer); }
}

async function workbook(dataset: DatasetKey) {
  const hit = caches.get(dataset);
  if (hit && hit.expiresAt > Date.now()) return hit;
  let promise = inFlight.get(dataset);
  if (!promise) { promise = downloadWorkbook(dataset); inFlight.set(dataset, promise); }
  try { const loaded = await promise; caches.set(dataset, loaded); return loaded; }
  finally { inFlight.delete(dataset); }
}

function rowCountry(row: Row, dataset: DatasetKey) { return dataset === "wuenic" ? text(row.Country) : text(row.NAME || row.COUNTRYNAME); }
function rowCode(row: Row, dataset: DatasetKey) { return dataset === "wuenic" ? text(row.ISOCountryCode) : text(row.CODE || row.ISO_3_CODE); }
function rowIso2(row: Row, dataset: DatasetKey) {
  const code = rowCode(row, dataset).toUpperCase();
  if (code.length === 2) return code;
  return ISO3_TO_ISO2[code] || "";
}
function rowYear(row: Row, dataset: DatasetKey) { return number(dataset === "wuenic" ? row.Year : row.YEAR); }
function rowItem(row: Row, dataset: DatasetKey) { return text(value(row, DATASETS[dataset].itemFields)); }
function rowDescription(row: Row, dataset: DatasetKey) { return text(value(row, DATASETS[dataset].descriptionFields)); }
function rowMetric(row: Row, dataset: DatasetKey) { return value(row, DATASETS[dataset].valueFields); }

function defaultItem(dataset: DatasetKey, items: string[]) {
  const preferences: Record<DatasetKey, RegExp[]> = {
    coverage: [/^dtp3$/i, /^mcv1$/i, /measles/i], incidence: [/measles/i, /pertussis/i], cases: [/measles/i, /pertussis/i],
    introduction: [/hepatitis b/i, /pneumococcal/i], indicators: [/influenza.*policy/i, /school.*vaccin/i], wuenic: [/^dtp3$/i, /^mcv1$/i],
  };
  for (const pattern of preferences[dataset]) { const found = items.find((item) => pattern.test(item)); if (found) return found; }
  return items[0] || "";
}

function normalizedOutput(row: Row, dataset: DatasetKey) {
  const common = { country: rowCountry(row, dataset), code: rowCode(row, dataset), iso2: rowIso2(row, dataset), year: rowYear(row, dataset), item: rowItem(row, dataset), description: rowDescription(row, dataset), value: rowMetric(row, dataset) };
  if (dataset === "coverage") return { ...common, category: text(row.COVERAGE_CATEGORY), categoryDescription: text(row.COVERAGE_CATEGORY_DESCRIPTION), target: number(row.TARGET_NUMBER), doses: number(row.DOSES), value: number(row.COVERAGE) };
  if (dataset === "incidence") return { ...common, denominator: number(row.DENOMINATOR), value: number(row.INCIDENCE_RATE) };
  if (dataset === "cases") return { ...common, value: number(row.CASES) };
  if (dataset === "introduction") return { ...common, region: text(row.WHO_REGION), value: text(row.INTRO) };
  if (dataset === "indicators") return { ...common, region: text(row.WHO_REGION), category: text(row.INDCAT_DESCRIPTION), sort: number(row.INDSORT), value: row.VALUE };
  return { ...common, value: number(row.WUENIC), previousRevision: number(row.WUENICPreviousRevision), gradeOfConfidence: text(row.GradeOfConfidence), administrativeCoverage: number(row.AdministrativeCoverage), governmentEstimate: number(row.GovernmentEstimate), childrenVaccinated: number(row.ChildrenVaccinated), childrenInTarget: number(row.ChildrenInTarget), births: number(row.BirthsUNPD), survivingInfants: number(row.SurvivingInfantsUNPD), comment: text(row.Comment) };
}

router.get("/aor/immunization", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=21600");
  const requested = normalize(req.query.dataset || "coverage").replace(/ /g, "-");
  const aliases: Record<string, DatasetKey> = { coverage: "coverage", incidence: "incidence", cases: "cases", "reported-cases": "cases", introduction: "introduction", indicators: "indicators", wuenic: "wuenic" };
  const dataset = aliases[requested];
  if (!dataset) return res.status(400).json({ ok: false, error: "Unsupported immunization dataset." });

  try {
    const loaded = await workbook(dataset);
    const countryQuery = normalize(req.query.country);
    const requestedItem = normalize(req.query.item);
    const requestedYear = Number(req.query.year);
    const requestedCategory = normalize(req.query.category);

    const years = [...new Set(loaded.rows.map((row) => rowYear(row, dataset)).filter((year): year is number => Number.isFinite(year)))].sort((a, b) => b - a);
    const itemLabels = unique(loaded.rows.map((row) => rowItem(row, dataset)), 400).sort((a, b) => a.localeCompare(b));
    const selectedItem = requestedItem ? itemLabels.find((item) => normalize(item) === requestedItem) || itemLabels.find((item) => normalize(item).includes(requestedItem)) || "" : defaultItem(dataset, itemLabels);
    const selectedYear = Number.isFinite(requestedYear) && requestedYear > 1900 ? requestedYear : years[0] || null;

    const categories = dataset === "coverage" ? unique(loaded.rows.map((row) => text(row.COVERAGE_CATEGORY))).sort() : [];
    let selectedCategory = "";
    if (dataset === "coverage") selectedCategory = requestedCategory ? categories.find((category) => normalize(category) === requestedCategory) || "" : categories.find((category) => /wuenic/i.test(category)) || categories[0] || "";

    const filtered = loaded.rows.filter((row) => {
      if (countryQuery && normalize(rowCountry(row, dataset)) !== countryQuery && normalize(rowCode(row, dataset)) !== countryQuery && normalize(rowIso2(row, dataset)) !== countryQuery) return false;
      if (selectedYear != null && rowYear(row, dataset) !== selectedYear) return false;
      if (selectedItem && normalize(rowItem(row, dataset)) !== normalize(selectedItem)) return false;
      if (dataset === "coverage" && selectedCategory && normalize(row.COVERAGE_CATEGORY) !== normalize(selectedCategory)) return false;
      return true;
    });
    const output = filtered.map((row) => normalizedOutput(row, dataset));
    const mappedRows = output.filter((row) => row.iso2).length;

    return res.json({
      ok: true, dataset, retrievedAt: new Date().toISOString(), source: "WHO Immunization Data Portal", sourceUrl: loaded.sourceUrl,
      selected: { year: selectedYear, item: selectedItem, category: selectedCategory || null, country: countryQuery || null },
      facets: { years: years.slice(0, 60), items: itemLabels, categories },
      rows: output.slice(0, countryQuery ? 1500 : 350), totalMatched: output.length,
      mapCoverage: { mappedRows, unmappedRows: output.length - mappedRows },
      methodology: dataset === "coverage" ? "Coverage categories remain distinct. WUENIC estimates are not silently substituted for administrative or official country-reported coverage." : dataset === "wuenic" ? "WUENIC detail preserves current estimate, prior revision, confidence grade, administrative/government estimates, target denominators and source comments where supplied." : "Values are returned with the dataset's own WHO definition and unit; no composite risk score is inferred.",
      limitation: "WHO immunization indicators are programmatic/public-health measures. Coverage, incidence, reported cases, vaccine introduction status and modeled WUENIC estimates describe different concepts and must not be compared as if they were the same metric. Map colors are an Insight Hub visualization aid, not WHO risk classifications.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, dataset, error: error instanceof Error ? error.message : "WHO immunization source failed." });
  }
});

export default router;
