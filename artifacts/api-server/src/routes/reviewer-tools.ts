import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const CACHE_TTL = 5 * 60_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type Row = Record<string, unknown>;
type CommandId = "northcom" | "southcom" | "eucom" | "africom" | "centcom" | "indopacom";
type Scope = { label: string; terms: string[]; exclude?: string[]; bbox?: [number, number, number, number] };

const SCOPES: Record<CommandId, Scope> = {
  northcom: {
    label: "USNORTHCOM",
    terms: ["United States", "USA", "Alaska", "Canada", "Mexico", "Greenland", "Bahamas", "Puerto Rico", "California"],
    bbox: [-170, 23, -50, 85],
  },
  southcom: {
    label: "USSOUTHCOM",
    terms: ["South America", "Central America", "Caribbean", "Argentina", "Belize", "Bolivia", "Brazil", "Chile", "Colombia", "Costa Rica", "Cuba", "Dominican Republic", "Ecuador", "El Salvador", "Guatemala", "Guyana", "Haiti", "Honduras", "Jamaica", "Nicaragua", "Panama", "Paraguay", "Peru", "Suriname", "Trinidad", "Uruguay", "Venezuela"],
    bbox: [-120, -60, -25, 23],
  },
  eucom: {
    label: "USEUCOM",
    terms: ["Europe", "European", "Albania", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium", "Bosnia", "Bulgaria", "Croatia", "Cyprus", "Czech", "Denmark", "Estonia", "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Lithuania", "Moldova", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Türkiye", "Turkey", "Ukraine", "United Kingdom"],
    bbox: [-30, 34, 60, 82],
  },
  africom: {
    label: "USAFRICOM",
    terms: ["Africa", "African", "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", "Central African Republic", "Chad", "Comoros", "Congo", "DRC", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Ivory Coast", "Côte d'Ivoire", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Senegal", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe", "Sahel"],
    exclude: ["Egypt"],
    bbox: [-30, -40, 60, 38],
  },
  centcom: {
    label: "USCENTCOM",
    terms: ["Middle East", "Central Asia", "Afghanistan", "Bahrain", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Lebanon", "Oman", "Pakistan", "Qatar", "Saudi Arabia", "Syria", "Tajikistan", "Turkmenistan", "United Arab Emirates", "UAE", "Uzbekistan", "Yemen", "Gulf"],
    bbox: [24, 10, 85, 55],
  },
  indopacom: {
    label: "USINDOPACOM",
    terms: ["Indo-Pacific", "Pacific", "Hawaii", "Australia", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Taiwan", "Fiji", "India", "Indonesia", "Japan", "Kiribati", "Laos", "Malaysia", "Maldives", "Marshall Islands", "Micronesia", "Mongolia", "Myanmar", "Burma", "Nauru", "Nepal", "New Zealand", "North Korea", "Palau", "Papua New Guinea", "Philippines", "Samoa", "Singapore", "Solomon Islands", "South Korea", "Sri Lanka", "Thailand", "Timor-Leste", "Tonga", "Tuvalu", "Vanuatu", "Vietnam"],
  },
};

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}
function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function hasTerm(haystack: string, term: string) {
  const source = ` ${normalize(haystack)} `;
  const needle = ` ${normalize(term)} `;
  return source.includes(needle);
}
function excluded(scope: Scope, haystack: string) {
  return (scope.exclude ?? []).some((term) => hasTerm(haystack, term));
}
function scopeMatch(scope: Scope, haystack: string) {
  return !excluded(scope, haystack) && scope.terms.some((term) => hasTerm(haystack, term));
}
function pointInScope(scope: Scope, longitude: number | null, latitude: number | null) {
  if (!scope.bbox || longitude === null || latitude === null) return false;
  const [minLon, minLat, maxLon, maxLat] = scope.bbox;
  return longitude >= minLon && longitude <= maxLon && latitude >= minLat && latitude <= maxLat;
}
function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}
function dateString(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? raw : parsed.toISOString();
}
function firstCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return [Number(value[0]), Number(value[1])];
  for (const item of value) {
    const found = firstCoordinate(item);
    if (found) return found;
  }
  return null;
}
function payloadArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  for (const key of ["features", "events", "items", "data", "value", "results"]) if (Array.isArray(root[key])) return root[key] as unknown[];
  return [];
}
async function fetchJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const key = url;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 reviewer-tools" },
    });
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
    const value = await response.json();
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL, value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

router.get("/reviewer-tools/rxnorm", async (req: Request, res: Response) => {
  const term = clean(req.query.term, 120);
  if (term.length < 2) return res.status(400).json({ ok: false, error: "Enter at least two characters." });
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=10&option=1`;
    const payload = record(await fetchJson(url));
    const group = record(payload.approximateGroup);
    const seen = new Set<string>();
    const candidates = array(group.candidate).flatMap((raw) => {
      const item = record(raw);
      const rxcui = text(item.rxcui);
      const name = text(item.name);
      if (!rxcui || !name || seen.has(rxcui)) return [];
      seen.add(rxcui);
      return [{ rxcui, name, score: numberValue(item.score) }];
    });
    return res.json({ ok: true, source: "NLM RxNorm", candidates });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "RxNorm unavailable." });
  }
});

router.get("/reviewer-tools/pubchem", async (req: Request, res: Response) => {
  const name = clean(req.query.name, 160).replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?)\b/gi, "").replace(/\s+/g, " ").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Medication name is required." });
  try {
    const properties = "MolecularFormula,MolecularWeight,XLogP,TPSA,Complexity,HBondDonorCount,HBondAcceptorCount,IUPACName,Title";
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/${properties}/JSON`;
    const payload = record(await fetchJson(url));
    const table = record(payload.PropertyTable);
    const molecule = record(array(table.Properties)[0]);
    if (!Object.keys(molecule).length) return res.status(404).json({ ok: false, error: "No PubChem compound resolved." });
    const cid = numberValue(molecule.CID);
    return res.json({
      ok: true,
      source: "NIH PubChem PUG REST",
      molecule,
      structureImageUrl: cid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d` : null,
      pubchemUrl: cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` : "https://pubchem.ncbi.nlm.nih.gov/",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "PubChem unavailable." });
  }
});

async function whoForScope(scope: Scope) {
  const params = new URLSearchParams({ "$orderby": "PublicationDateAndTime desc", "$top": "250", "$select": "Id,PublicationDateAndTime,Title,Summary,Overview,Assessment,ItemDefaultUrl,DonId" });
  const payload = record(await fetchJson(`https://www.who.int/api/news/diseaseoutbreaknews?${params}`));
  return array(payload.value).map((raw) => {
    const item = record(raw);
    const title = text(item.Title) || "WHO Disease Outbreak News";
    const summary = stripHtml(text(item.Summary) || text(item.Overview) || text(item.Assessment)).slice(0, 650);
    const searchable = `${title} ${summary}`;
    const matchedArea = scope.terms.find((term) => hasTerm(searchable, term)) ?? "";
    const donId = text(item.DonId);
    const path = text(item.ItemDefaultUrl);
    return {
      id: donId || text(item.Id) || title,
      title,
      publishedAt: dateString(item.PublicationDateAndTime),
      summary,
      matchedArea,
      url: donId ? `https://www.who.int/emergencies/disease-outbreak-news/item/${encodeURIComponent(donId)}` : path ? (path.startsWith("http") ? path : `https://www.who.int${path.startsWith("/") ? "" : "/"}${path}`) : "https://www.who.int/emergencies/disease-outbreak-news",
      relevant: Boolean(matchedArea) && !excluded(scope, searchable),
    };
  }).filter((item) => item.relevant).slice(0, 12).map(({ relevant: _relevant, ...item }) => item);
}

async function gdacsForScope(scope: Scope) {
  const payload = await fetchJson("https://www.gdacs.org/contentdata/xml/gdacs_app_feed.json");
  const seen = new Set<string>();
  return payloadArray(payload).flatMap((raw) => {
    const feature = record(raw);
    const propsFromGeometry = record(feature.properties);
    const props = Object.keys(propsFromGeometry).length ? propsFromGeometry : feature;
    const geometry = record(feature.geometry);
    const coord = firstCoordinate(geometry.coordinates);
    const longitude = coord?.[0] ?? numberValue(props.longitude ?? props.lon ?? props.lng);
    const latitude = coord?.[1] ?? numberValue(props.latitude ?? props.lat);
    const eventType = text(props.eventtype) || text(props.eventType) || text(props.type) || "Disaster";
    const eventId = text(props.eventid) || text(props.eventId) || text(props.id) || text(feature.id);
    const title = text(props.name) || text(props.title) || text(props.eventname) || text(props.description) || `${eventType} event`;
    const country = text(props.country) || text(props.countryname) || text(props.countryName) || text(props.country_name) || text(props.iso3);
    const searchable = `${title} ${country} ${text(props.description)} ${text(props.location)}`;
    if (excluded(scope, searchable) || (!scopeMatch(scope, searchable) && !pointInScope(scope, longitude, latitude))) return [];
    const id = `${eventType}-${eventId || title}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const explicitUrl = text(props.url) || text(props.link) || text(props.weburl);
    return [{
      id,
      title,
      eventType,
      country,
      alertLevel: text(props.alertlevel) || text(props.alertLevel) || text(props.alert),
      fromDate: dateString(props.fromdate ?? props.fromDate ?? props.date ?? props.startdate),
      toDate: dateString(props.todate ?? props.toDate ?? props.enddate),
      latitude,
      longitude,
      url: explicitUrl || (eventId ? `https://www.gdacs.org/resources.aspx?eventid=${encodeURIComponent(eventId)}&eventtype=${encodeURIComponent(eventType)}` : "https://www.gdacs.org/"),
    }];
  }).sort((a, b) => (b.fromDate || b.toDate).localeCompare(a.fromDate || a.toDate)).slice(0, 12);
}

async function usgsForScope(scope: Scope) {
  const start = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const params = new URLSearchParams({ format: "geojson", starttime: start, minmagnitude: "4.0", orderby: "time", limit: "500" });
  const payload = record(await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`));
  return array(payload.features).map((raw) => {
    const feature = record(raw);
    const props = record(feature.properties);
    const geometry = record(feature.geometry);
    const coord = firstCoordinate(geometry.coordinates);
    const longitude = coord?.[0] ?? null;
    const latitude = coord?.[1] ?? null;
    const place = text(props.place);
    const title = text(props.title) || place || "USGS earthquake";
    const searchable = `${title} ${place}`;
    return {
      id: text(feature.id) || title,
      title,
      place,
      magnitude: numberValue(props.mag),
      occurredAt: Number.isFinite(Number(props.time)) ? new Date(Number(props.time)).toISOString() : "",
      url: text(props.url) || "https://earthquake.usgs.gov/earthquakes/map/",
      tsunami: Number(props.tsunami) === 1,
      latitude,
      longitude,
      depthKm: Array.isArray(geometry.coordinates) ? numberValue(geometry.coordinates[2]) : null,
      relevant: !excluded(scope, searchable) && (scopeMatch(scope, searchable) || pointInScope(scope, longitude, latitude)),
    };
  }).filter((item) => item.relevant).slice(0, 12).map(({ relevant: _relevant, ...item }) => item);
}

router.get("/reviewer-tools/aor", async (req: Request, res: Response) => {
  const command = clean(req.query.command, 30).toLowerCase() as CommandId;
  if (!SCOPES[command]) return res.status(400).json({ ok: false, error: "Unknown combatant command." });
  const scope = SCOPES[command];
  const [who, gdacs, usgs] = await Promise.allSettled([whoForScope(scope), gdacsForScope(scope), usgsForScope(scope)]);
  const sourceHealth = [
    { provider: "WHO Disease Outbreak News", ok: who.status === "fulfilled", count: who.status === "fulfilled" ? who.value.length : 0, error: who.status === "rejected" ? (who.reason instanceof Error ? who.reason.message : "Unavailable") : undefined },
    { provider: "GDACS", ok: gdacs.status === "fulfilled", count: gdacs.status === "fulfilled" ? gdacs.value.length : 0, error: gdacs.status === "rejected" ? (gdacs.reason instanceof Error ? gdacs.reason.message : "Unavailable") : undefined },
    { provider: "USGS Earthquake Catalog", ok: usgs.status === "fulfilled", count: usgs.status === "fulfilled" ? usgs.value.length : 0, error: usgs.status === "rejected" ? (usgs.reason instanceof Error ? usgs.reason.message : "Unavailable") : undefined },
  ];
  return res.json({
    ok: true,
    command,
    commandLabel: scope.label,
    retrievedAt: new Date().toISOString(),
    partial: sourceHealth.some((item) => !item.ok),
    sourceHealth,
    outbreaks: who.status === "fulfilled" ? who.value : [],
    disasters: gdacs.status === "fulfilled" ? gdacs.value : [],
    earthquakes: usgs.status === "fulfilled" ? usgs.value : [],
  });
});

export default router;
