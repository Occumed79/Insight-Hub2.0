import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const CACHE_TTL = 5 * 60_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type CommandId = "northcom" | "southcom" | "eucom" | "africom" | "centcom" | "indopacom";
type Scope = { label: string; terms: string[]; exclude?: string[]; bbox?: [number, number, number, number] };
type Row = Record<string, unknown>;

const SCOPES: Record<CommandId, Scope> = {
  northcom: { label: "USNORTHCOM", terms: ["United States", "USA", "Alaska", "Canada", "Mexico", "Greenland", "Bahamas", "Puerto Rico"], bbox: [-170, 23, -50, 85] },
  southcom: { label: "USSOUTHCOM", terms: ["South America", "Central America", "Caribbean", "Argentina", "Belize", "Bolivia", "Brazil", "Chile", "Colombia", "Costa Rica", "Cuba", "Dominican Republic", "Ecuador", "El Salvador", "Guatemala", "Guyana", "Haiti", "Honduras", "Jamaica", "Nicaragua", "Panama", "Paraguay", "Peru", "Suriname", "Trinidad", "Uruguay", "Venezuela"], bbox: [-120, -60, -25, 23] },
  eucom: { label: "USEUCOM", terms: ["Europe", "European", "Albania", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium", "Bosnia", "Bulgaria", "Croatia", "Cyprus", "Czech", "Denmark", "Estonia", "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Lithuania", "Moldova", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Türkiye", "Turkey", "Ukraine", "United Kingdom"], bbox: [-30, 34, 60, 82] },
  africom: { label: "USAFRICOM", terms: ["Africa", "African", "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", "Central African Republic", "Chad", "Comoros", "Congo", "DRC", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Ivory Coast", "Côte d'Ivoire", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Senegal", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe", "Sahel"], exclude: ["Egypt"], bbox: [-30, -40, 60, 38] },
  centcom: { label: "USCENTCOM", terms: ["Middle East", "Central Asia", "Afghanistan", "Bahrain", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Lebanon", "Oman", "Pakistan", "Qatar", "Saudi Arabia", "Syria", "Tajikistan", "Turkmenistan", "United Arab Emirates", "UAE", "Uzbekistan", "Yemen", "Gulf"], bbox: [24, 10, 85, 55] },
  indopacom: { label: "USINDOPACOM", terms: ["Indo-Pacific", "Pacific", "Hawaii", "Australia", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Taiwan", "Fiji", "India", "Indonesia", "Japan", "Kiribati", "Laos", "Malaysia", "Maldives", "Marshall Islands", "Micronesia", "Mongolia", "Myanmar", "Burma", "Nauru", "Nepal", "New Zealand", "North Korea", "Palau", "Papua New Guinea", "Philippines", "Samoa", "Singapore", "Solomon Islands", "South Korea", "Sri Lanka", "Thailand", "Timor-Leste", "Tonga", "Tuvalu", "Vanuatu", "Vietnam"] },
};

function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""; }
function num(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function normalize(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function hasTerm(haystack: string, term: string) { return ` ${normalize(haystack)} `.includes(` ${normalize(term)} `); }
function matchesCountry(country: string, ...values: unknown[]) {
  const needle = normalize(country);
  if (!needle) return false;
  return values.some((value) => {
    const candidate = normalize(text(value));
    return candidate === needle || candidate.startsWith(`${needle} `) || candidate.endsWith(` ${needle}`) || candidate.includes(` ${needle} `);
  });
}
function scopeMatch(scope: Scope, haystack: string) {
  if ((scope.exclude ?? []).some((term) => hasTerm(haystack, term))) return false;
  return scope.terms.some((term) => hasTerm(haystack, term));
}
function pointInScope(scope: Scope, longitude: number | null, latitude: number | null) {
  if (!scope.bbox || longitude === null || latitude === null) return false;
  const [minLon, minLat, maxLon, maxLat] = scope.bbox;
  return longitude >= minLon && longitude <= maxLon && latitude >= minLat && latitude <= maxLat;
}
function stripHtml(value: string) { return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim(); }
function isoDate(value: unknown) { const raw = text(value); if (!raw) return ""; const date = new Date(raw); return Number.isNaN(date.valueOf()) ? raw : date.toISOString(); }
function firstCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return [Number(value[0]), Number(value[1])];
  for (const item of value) { const found = firstCoordinate(item); if (found) return found; }
  return null;
}
function payloadItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  for (const key of ["value", "features", "events", "items", "data", "results"]) if (Array.isArray(root[key])) return root[key] as unknown[];
  return [];
}
async function fetchJson(url: string, timeoutMs = 18_000) {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 AOR" } });
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
    const value = await response.json();
    cache.set(url, { expiresAt: Date.now() + CACHE_TTL, value });
    return value;
  } finally { clearTimeout(timer); }
}

// WHO's own current Sitefinity API documentation specifies GET with no URI parameters.
async function whoFeed() {
  return fetchJson("https://www.who.int/api/news/diseaseoutbreaknews");
}
function whoItem(raw: unknown) {
  const item = record(raw);
  const title = text(item.OverrideTitle) || text(item.Title) || "WHO Disease Outbreak News";
  const summary = stripHtml(text(item.Summary) || text(item.Overview) || text(item.Response)).slice(0, 900);
  const searchable = `${title} ${summary} ${text(item.Assessment)} ${text(item.Advice)} ${text(item.Response)} ${text(item.FurtherInformation)}`;
  const donId = text(item.DonId);
  const path = text(item.ItemDefaultUrl);
  return {
    id: text(item.Id) || donId || text(item.UrlName) || title,
    title,
    publicationDate: isoDate(item.PublicationDateAndTime || item.PublicationDate),
    summary,
    assessment: stripHtml(text(item.Assessment)).slice(0, 650),
    advice: stripHtml(text(item.Advice)).slice(0, 500),
    sourceUrl: donId ? `https://www.who.int/emergencies/disease-outbreak-news/item/${encodeURIComponent(donId)}` : path ? (path.startsWith("http") ? path : `https://www.who.int${path.startsWith("/") ? "" : "/"}${path}`) : "https://www.who.int/emergencies/disease-outbreak-news",
    searchable,
  };
}
async function whoForScope(scope: Scope) {
  return payloadItems(await whoFeed()).map(whoItem).flatMap((item) => {
    const matchedArea = scope.terms.find((term) => hasTerm(item.searchable, term)) ?? "";
    return matchedArea && scopeMatch(scope, item.searchable) ? [{ id: item.id, title: item.title, publishedAt: item.publicationDate, summary: item.summary, matchedArea, url: item.sourceUrl }] : [];
  }).slice(0, 12);
}
async function whoForCountry(country: string) {
  const matches = payloadItems(await whoFeed()).map(whoItem).filter((item) => hasTerm(item.searchable, country));
  return matches.slice(0, 20).map((item) => ({
    id: item.id,
    title: item.title,
    publicationDate: item.publicationDate,
    summary: item.summary,
    assessment: item.assessment,
    advice: item.advice,
    matchedCountry: true,
    sourceUrl: item.sourceUrl,
  }));
}

function parseGdacsEvent(raw: unknown) {
  const feature = record(raw);
  const properties = record(feature.properties);
  const props = Object.keys(properties).length ? properties : feature;
  const geometry = record(feature.geometry);
  const coord = firstCoordinate(geometry.coordinates);
  const longitude = coord?.[0] ?? num(props.longitude ?? props.lon ?? props.lng);
  const latitude = coord?.[1] ?? num(props.latitude ?? props.lat);
  const eventType = text(props.eventtype) || text(props.eventType) || text(props.type) || "Disaster";
  const eventId = text(props.eventid) || text(props.eventId) || text(props.id) || text(feature.id);
  const episodeId = text(props.episodeid) || text(props.episodeId);
  const title = text(props.name) || text(props.title) || text(props.eventname) || text(props.description) || `${eventType} event`;
  const country = text(props.country) || text(props.countryname) || text(props.countryName) || text(props.country_name) || text(props.iso3);
  const affectedCountries = array(props.affectedcountries ?? props.affectedCountries).map((entry) => {
    const row = record(entry);
    return { name: text(row.countryname) || text(row.name), iso2: text(row.iso2), iso3: text(row.iso3) };
  }).filter((entry) => entry.name || entry.iso2 || entry.iso3);
  const urlValue = record(props.url);
  const url = text(urlValue.report) || text(urlValue.details) || text(props.url) || text(props.link) || text(props.weburl) || (eventId ? `https://www.gdacs.org/resources.aspx?eventid=${encodeURIComponent(eventId)}&eventtype=${encodeURIComponent(eventType)}` : "https://www.gdacs.org/");
  return {
    eventType, eventId, episodeId, title, country, affectedCountries, longitude, latitude,
    alertLevel: text(props.alertlevel) || text(props.alertLevel) || text(props.alert),
    fromDate: isoDate(props.fromdate ?? props.fromDate ?? props.date ?? props.startdate),
    toDate: isoDate(props.todate ?? props.toDate ?? props.enddate),
    description: stripHtml(text(props.description) || text(props.subtitle)).slice(0, 500),
    url,
    searchable: `${title} ${country} ${affectedCountries.flatMap((entry) => [entry.name, entry.iso2, entry.iso3]).join(" ")} ${text(props.description)} ${text(props.location)}`,
  };
}
async function gdacsForScope(scope: Scope) {
  const events = payloadItems(await fetchJson("https://www.gdacs.org/contentdata/xml/gdacs_app_feed.json")).map(parseGdacsEvent);
  const seen = new Set<string>();
  return events.flatMap((item) => {
    if (!scopeMatch(scope, item.searchable) && !pointInScope(scope, item.longitude, item.latitude)) return [];
    const id = `${item.eventType}:${item.eventId || item.title}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, title: item.title, eventType: item.eventType, country: item.country, alertLevel: item.alertLevel, fromDate: item.fromDate, toDate: item.toDate, latitude: item.latitude, longitude: item.longitude, url: item.url }];
  }).sort((a, b) => (b.fromDate || b.toDate).localeCompare(a.fromDate || a.toDate)).slice(0, 12);
}
async function gdacsForCountry(country: string, days: number) {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 86_400_000);
  const params = new URLSearchParams({ country, fromDate: fromDate.toISOString().slice(0, 10), toDate: toDate.toISOString().slice(0, 10), pagesize: "100", pagenumber: "1" });
  const events = payloadItems(await fetchJson(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params.toString()}`)).map(parseGdacsEvent);
  const seen = new Set<string>();
  return events.flatMap((item) => {
    // Never return an unattributed event in a country scan. This prevents command-level or
    // unrelated events from being presented as if they belonged to the selected country.
    const countryFields = [item.country, ...item.affectedCountries.flatMap((entry) => [entry.name, entry.iso2, entry.iso3])];
    if (!countryFields.some((value) => matchesCountry(country, value))) return [];
    const id = `${item.eventType}:${item.eventId || item.title}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      eventType: item.eventType,
      eventId: item.eventId,
      episodeId: item.episodeId,
      name: item.title,
      description: item.description,
      alertLevel: item.alertLevel,
      fromDate: item.fromDate,
      toDate: item.toDate,
      country: item.country,
      affectedCountries: item.affectedCountries,
      latitude: item.latitude,
      longitude: item.longitude,
      sourceUrl: item.url,
    }];
  }).slice(0, 20);
}

async function usgsForScope(scope: Scope) {
  const start = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const params = new URLSearchParams({ format: "geojson", starttime: start, minmagnitude: "4.0", orderby: "time", limit: "400" });
  const payload = record(await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`));
  return array(payload.features).flatMap((raw) => {
    const feature = record(raw); const props = record(feature.properties); const geometry = record(feature.geometry); const coord = firstCoordinate(geometry.coordinates); const longitude = coord?.[0] ?? null; const latitude = coord?.[1] ?? null; const place = text(props.place); const title = text(props.title) || (place ? `Earthquake near ${place}` : "USGS earthquake"); const searchable = `${title} ${place}`;
    if (!scopeMatch(scope, searchable) && !pointInScope(scope, longitude, latitude)) return [];
    return [{ id: text(feature.id) || title, title, place, magnitude: num(props.mag), occurredAt: Number.isFinite(Number(props.time)) ? new Date(Number(props.time)).toISOString() : "", url: text(props.url) || "https://earthquake.usgs.gov/earthquakes/map/", tsunami: Number(props.tsunami) === 1, latitude, longitude, depthKm: Array.isArray(geometry.coordinates) ? num(geometry.coordinates[2]) : null }];
  }).slice(0, 12);
}

async function unifiedCommand(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const command = String(req.query.command || "centcom").toLowerCase() as CommandId;
  if (!(command in SCOPES)) return res.status(400).json({ ok: false, error: "Unknown combatant command." });
  const scope = SCOPES[command];
  const [who, gdacs, usgs] = await Promise.allSettled([whoForScope(scope), gdacsForScope(scope), usgsForScope(scope)]);
  const sourceHealth = [
    { provider: "WHO Disease Outbreak News", ok: who.status === "fulfilled", count: who.status === "fulfilled" ? who.value.length : 0, ...(who.status === "rejected" ? { error: who.reason instanceof Error ? who.reason.message : "WHO unavailable." } : {}) },
    { provider: "GDACS", ok: gdacs.status === "fulfilled", count: gdacs.status === "fulfilled" ? gdacs.value.length : 0, ...(gdacs.status === "rejected" ? { error: gdacs.reason instanceof Error ? gdacs.reason.message : "GDACS unavailable." } : {}) },
    { provider: "USGS Earthquake Catalog", ok: usgs.status === "fulfilled", count: usgs.status === "fulfilled" ? usgs.value.length : 0, ...(usgs.status === "rejected" ? { error: usgs.reason instanceof Error ? usgs.reason.message : "USGS unavailable." } : {}) },
  ];
  return res.json({ ok: true, command, commandLabel: scope.label, retrievedAt: new Date().toISOString(), partial: sourceHealth.some((source) => !source.ok), sourceHealth, outbreaks: who.status === "fulfilled" ? who.value : [], disasters: gdacs.status === "fulfilled" ? gdacs.value : [], earthquakes: usgs.status === "fulfilled" ? usgs.value : [] });
}

router.get("/aor/unified-command", unifiedCommand);
router.get("/reviewer-tools/aor", unifiedCommand);
router.get("/aor/health-outbreaks", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const country = text(req.query.country).slice(0, 100);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  try {
    const outbreaks = await whoForCountry(country);
    return res.json({ ok: true, country, directMatches: outbreaks.length, outbreaks, fallbackUsed: false, source: "World Health Organization Disease Outbreak News", sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news", limitation: "Country matching is text-based and intentionally returns no unrelated fallback items." });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "WHO unavailable." });
  }
});
router.get("/aor/disaster-alerts", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const country = text(req.query.country).slice(0, 100);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.trunc(rawDays), 1), 365) : 90;
  try {
    const events = await gdacsForCountry(country, days);
    return res.json({ ok: true, country, days, events, source: "Global Disaster Alert and Coordination System (GDACS)", sourceUrl: "https://www.gdacs.org/", limitation: "Only events whose returned country metadata matches the selected country are shown; unrelated fallback events are never substituted." });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "GDACS unavailable." });
  }
});

export default router;
