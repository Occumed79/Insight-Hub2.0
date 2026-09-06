import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const CACHE_TTL = 10 * 60_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function stripHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function isoDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? raw : date.toISOString();
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
function payloadItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  for (const key of ["value", "features", "events", "items", "data", "results"]) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  return [];
}

function countryTerms(country: string): string[] {
  const normalized = normalize(country);
  const aliases: Record<string, string[]> = {
    "democratic republic of the congo": ["democratic republic of the congo", "democratic republic of congo", "dr congo", "drc", "congo kinshasa"],
    "democratic republic of congo": ["democratic republic of the congo", "democratic republic of congo", "dr congo", "drc", "congo kinshasa"],
    "republic of the congo": ["republic of the congo", "republic of congo", "congo brazzaville"],
    "republic of congo": ["republic of the congo", "republic of congo", "congo brazzaville"],
    "guinea": ["guinea", "republic of guinea"],
    "guinea bissau": ["guinea bissau", "republic of guinea bissau"],
    "equatorial guinea": ["equatorial guinea", "republic of equatorial guinea"],
    "papua new guinea": ["papua new guinea"],
    "cote d ivoire": ["cote d ivoire", "ivory coast"],
    "czechia": ["czechia", "czech republic"],
    "timor leste": ["timor leste", "east timor"],
    "myanmar": ["myanmar", "burma"],
    "turkiye": ["turkiye", "turkey"],
    "south korea": ["south korea", "republic of korea", "korea republic of"],
    "north korea": ["north korea", "democratic peoples republic of korea", "dprk"],
  };
  return [...new Set([normalized, ...(aliases[normalized] ?? [])].map(normalize).filter(Boolean))];
}

function matchesCountry(country: string, ...values: unknown[]): boolean {
  const terms = countryTerms(country);
  const selected = normalize(country);
  return values.some((value) => {
    let candidate = normalize(text(value));
    if (!candidate) return false;
    // "Guinea" must not match Guinea-Bissau, Equatorial Guinea or Papua New Guinea.
    if (selected === "guinea" || selected === "republic of guinea") {
      candidate = candidate
        .replace(/\bpapua new guinea\b/g, " ")
        .replace(/\bequatorial guinea\b/g, " ")
        .replace(/\b(?:republic of )?guinea bissau\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return terms.some((term) => candidate === term || (` ${candidate} `).includes(` ${term} `));
  });
}

async function safeJson(url: string, timeoutMs = 18_000): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 AOR country intelligence" },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
    if (!body.trim()) throw new Error("Upstream returned an empty response.");
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      throw new Error("Upstream returned malformed JSON.");
    }
    cache.set(url, { expiresAt: Date.now() + CACHE_TTL, value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

function parseWho(raw: unknown) {
  const item = record(raw);
  const title = text(item.OverrideTitle) || text(item.Title) || "WHO Disease Outbreak News";
  const summary = stripHtml(text(item.Summary) || text(item.Overview) || text(item.Response)).slice(0, 900);
  const searchable = `${title} ${summary} ${text(item.Assessment)} ${text(item.Advice)} ${text(item.Response)} ${text(item.FurtherInformation)}`;
  const donId = text(item.DonId);
  const path = text(item.ItemDefaultUrl);
  const sourceUrl = donId
    ? `https://www.who.int/emergencies/disease-outbreak-news/item/${encodeURIComponent(donId)}`
    : path
      ? (path.startsWith("http") ? path : `https://www.who.int${path.startsWith("/") ? "" : "/"}${path}`)
      : "https://www.who.int/emergencies/disease-outbreak-news";
  return {
    id: text(item.Id) || donId || text(item.UrlName) || title,
    title,
    publicationDate: isoDate(item.PublicationDateAndTime || item.PublicationDate),
    summary,
    assessment: stripHtml(text(item.Assessment)).slice(0, 650),
    advice: stripHtml(text(item.Advice)).slice(0, 500),
    sourceUrl,
    searchable,
  };
}

function parseGdacs(raw: unknown) {
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
  const name = text(props.name) || text(props.title) || text(props.eventname) || text(props.description) || `${eventType} event`;
  const country = text(props.country) || text(props.countryname) || text(props.countryName) || text(props.country_name) || text(props.iso3);
  const affectedCountries = array(props.affectedcountries ?? props.affectedCountries).map((entry) => {
    const row = record(entry);
    return { name: text(row.countryname) || text(row.name), iso2: text(row.iso2), iso3: text(row.iso3) };
  }).filter((entry) => entry.name || entry.iso2 || entry.iso3);
  const urlValue = record(props.url);
  const sourceUrl = text(urlValue.report) || text(urlValue.details) || text(props.url) || text(props.link) || text(props.weburl) || (eventId ? `https://www.gdacs.org/resources.aspx?eventid=${encodeURIComponent(eventId)}&eventtype=${encodeURIComponent(eventType)}` : "https://www.gdacs.org/");
  return {
    eventType,
    eventId,
    episodeId,
    name,
    description: stripHtml(text(props.description) || text(props.subtitle)).slice(0, 500),
    alertLevel: text(props.alertlevel) || text(props.alertLevel) || text(props.alert),
    fromDate: isoDate(props.fromdate ?? props.fromDate ?? props.date ?? props.startdate),
    toDate: isoDate(props.todate ?? props.toDate ?? props.enddate),
    country,
    affectedCountries,
    latitude,
    longitude,
    sourceUrl,
  };
}

async function gdacsCountryFeed(country: string, days: number) {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 86_400_000);
  const params = new URLSearchParams({
    country,
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
    pagesize: "100",
    pagenumber: "1",
  });

  let sourceMode: "country-search" | "global-feed-fallback" = "country-search";
  let payload: unknown;
  try {
    payload = await safeJson(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params.toString()}`);
  } catch {
    sourceMode = "global-feed-fallback";
    payload = await safeJson("https://www.gdacs.org/contentdata/xml/gdacs_app_feed.json");
  }

  const cutoff = Date.now() - days * 86_400_000;
  const seen = new Set<string>();
  const events = payloadItems(payload)
    .map(parseGdacs)
    .filter((item) => {
      const countryFields = [item.country, ...item.affectedCountries.flatMap((entry) => [entry.name, entry.iso2, entry.iso3])];
      if (!countryFields.some((value) => matchesCountry(country, value))) return false;
      const date = Date.parse(item.fromDate || item.toDate || "");
      return !Number.isFinite(date) || date >= cutoff;
    })
    .filter((item) => {
      const key = `${item.eventType}:${item.eventId || item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (Date.parse(b.fromDate || b.toDate || "") || 0) - (Date.parse(a.fromDate || a.toDate || "") || 0))
    .slice(0, 20);

  return { events, sourceMode };
}

router.get("/aor/health-outbreaks", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const country = text(req.query.country).slice(0, 100);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  try {
    const payload = await safeJson("https://www.who.int/api/news/diseaseoutbreaknews");
    const outbreaks = payloadItems(payload)
      .map(parseWho)
      .filter((item) => matchesCountry(country, item.searchable))
      .sort((a, b) => (Date.parse(b.publicationDate) || 0) - (Date.parse(a.publicationDate) || 0))
      .slice(0, 20)
      .map(({ searchable: _searchable, ...item }) => ({ ...item, matchedCountry: true }));
    return res.json({
      ok: true,
      country,
      available: true,
      directMatches: outbreaks.length,
      outbreaks,
      fallbackUsed: false,
      source: "World Health Organization Disease Outbreak News",
      sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news",
      limitation: "Country matching is text-based and intentionally returns no unrelated fallback items. Results are sorted newest-first.",
    });
  } catch {
    return res.json({
      ok: true,
      country,
      available: false,
      directMatches: 0,
      outbreaks: [],
      fallbackUsed: false,
      source: "World Health Organization Disease Outbreak News",
      sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news",
      sourceNotice: "WHO Disease Outbreak News is temporarily unavailable; no unrelated outbreak items were substituted.",
    });
  }
});

router.get("/aor/disaster-alerts", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const country = text(req.query.country).slice(0, 100);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.trunc(rawDays), 1), 365) : 90;
  try {
    const { events, sourceMode } = await gdacsCountryFeed(country, days);
    return res.json({
      ok: true,
      country,
      available: true,
      days,
      events,
      sourceMode,
      source: "Global Disaster Alert and Coordination System (GDACS)",
      sourceUrl: "https://www.gdacs.org/",
      limitation: "Only events whose returned country metadata matches the selected country are shown; unrelated fallback events are never substituted.",
    });
  } catch {
    return res.json({
      ok: true,
      country,
      available: false,
      days,
      events: [],
      source: "Global Disaster Alert and Coordination System (GDACS)",
      sourceUrl: "https://www.gdacs.org/",
      sourceNotice: "GDACS is temporarily unavailable; no hazard events were substituted.",
    });
  }
});

export default router;
