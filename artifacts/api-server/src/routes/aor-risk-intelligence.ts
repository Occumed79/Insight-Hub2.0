import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

type JsonRecord = Record<string, unknown>;

type AcledToken = {
  accessToken: string;
  expiresAt: number;
};

let acledTokenCache: AcledToken | null = null;
let acledTokenRequest: Promise<AcledToken> | null = null;

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 700): string {
  const compact = stripHtml(value);
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|password|token|authorization)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 300);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function countryMatches(country: string, ...values: unknown[]): boolean {
  const needle = normalize(country);
  if (!needle) return false;
  return values.some((value) => normalize(text(value)).includes(needle));
}

async function fetchJson(url: string, options?: RequestInit, timeoutMs = 30_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    let payload: unknown = null;
    try {
      payload = body ? JSON.parse(body) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const record = asRecord(payload);
      throw new Error(text(record?.message) || text(record?.detail) || text(record?.error) || `Source returned HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function nested(record: JsonRecord | null, ...path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) return undefined;
    current = currentRecord[key];
  }
  return current;
}

router.get("/aor/health-outbreaks", async (req: Request, res: Response) => {
  const country = text(req.query.country);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });

  try {
    const params = new URLSearchParams({
      "$top": "100",
      "$orderby": "PublicationDate desc",
      "$select": "Id,PublicationDate,PublicationDateAndTime,UrlName,ItemDefaultUrl,Title,OverrideTitle,Summary,Overview,Assessment,Advice,Response,DonId",
    });
    const payload = asRecord(await fetchJson(`https://www.who.int/api/news/diseaseoutbreaknews?${params.toString()}`));
    const allItems = asArray(payload?.value).map((item) => asRecord(item)).filter((item): item is JsonRecord => !!item);
    const matched = allItems.filter((item) => countryMatches(
      country,
      item.Title,
      item.OverrideTitle,
      item.Summary,
      item.Overview,
      item.Assessment,
      item.Advice,
      item.Response,
    ));
    const selected = (matched.length > 0 ? matched : allItems.slice(0, 12)).slice(0, 20);
    const outbreaks = selected.map((item) => {
      const path = text(item.ItemDefaultUrl) || (text(item.UrlName) ? `/emergencies/disease-outbreak/news/item/${text(item.UrlName)}` : "");
      return {
        id: text(item.Id) || text(item.DonId) || text(item.UrlName),
        title: text(item.OverrideTitle) || text(item.Title) || "WHO Disease Outbreak News",
        publicationDate: text(item.PublicationDateAndTime) || text(item.PublicationDate),
        summary: truncate(text(item.Summary) || text(item.Overview) || text(item.Response), 900),
        assessment: truncate(text(item.Assessment), 650),
        advice: truncate(text(item.Advice), 500),
        matchedCountry: matched.includes(item),
        sourceUrl: path ? (path.startsWith("http") ? path : `https://www.who.int${path.startsWith("/") ? "" : "/"}${path}`) : "https://www.who.int/emergencies/disease-outbreak-news",
      };
    });

    return res.json({
      ok: true,
      country,
      directMatches: matched.length,
      outbreaks,
      fallbackUsed: matched.length === 0,
      source: "World Health Organization Disease Outbreak News",
      sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news",
      endpoint: "/api/news/diseaseoutbreaknews",
      limitation: "WHO Disease Outbreak News is not an exhaustive list of every event WHO is monitoring. Country matching is text-based and requires human review, especially for cross-border events and differently named territories.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/aor/disaster-alerts", async (req: Request, res: Response) => {
  const country = text(req.query.country);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 365);
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 86_400_000);
  const params = new URLSearchParams({
    country,
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
    pagesize: "100",
    pagenumber: "1",
  });

  try {
    const payload = await fetchJson(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params.toString()}`);
    const payloadRecord = asRecord(payload);
    const rawFeatures = asArray(payloadRecord?.features).length > 0
      ? asArray(payloadRecord?.features)
      : Array.isArray(payload)
        ? payload
        : asArray(payloadRecord?.data);
    const events = rawFeatures.map((item) => {
      const feature = asRecord(item);
      const properties = asRecord(feature?.properties) ?? feature;
      const affectedCountries = asArray(properties?.affectedcountries).map((countryItem) => {
        const countryRecord = asRecord(countryItem);
        return {
          name: text(countryRecord?.countryname) || text(countryRecord?.name),
          iso2: text(countryRecord?.iso2),
          iso3: text(countryRecord?.iso3),
        };
      }).filter((entry) => entry.name || entry.iso2 || entry.iso3);
      const urlRecord = asRecord(properties?.url);
      const eventType = text(properties?.eventtype) || text(properties?.eventType);
      const eventId = text(properties?.eventid) || text(properties?.eventId);
      return {
        eventType,
        eventId,
        episodeId: text(properties?.episodeid) || text(properties?.episodeId),
        name: text(properties?.name) || text(properties?.eventname) || text(properties?.title) || `${eventType || "Disaster"} alert`,
        description: truncate(text(properties?.description) || text(properties?.subtitle), 500),
        alertLevel: text(properties?.alertlevel) || text(properties?.alertLevel),
        alertScore: numberValue(properties?.alertscore ?? properties?.alertScore),
        severity: text(properties?.severity),
        fromDate: text(properties?.fromdate) || text(properties?.fromDate),
        toDate: text(properties?.todate) || text(properties?.toDate),
        country: text(properties?.country),
        affectedCountries,
        sourceUrl: text(urlRecord?.report) || text(urlRecord?.details) || text(properties?.url) || (eventType && eventId ? `https://www.gdacs.org/report.aspx?eventtype=${encodeURIComponent(eventType)}&eventid=${encodeURIComponent(eventId)}` : "https://www.gdacs.org/"),
      };
    }).filter((event) => event.eventId || event.name);

    return res.json({
      ok: true,
      country,
      days,
      events,
      source: "Global Disaster Alert and Coordination System (GDACS)",
      sourceUrl: "https://www.gdacs.org/",
      limitation: "GDACS alerts are automated multi-hazard awareness products. Alert levels, modeled exposure, event geometry, and impact estimates can change as new information becomes available.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/aor/reliefweb-health", async (req: Request, res: Response) => {
  const country = text(req.query.country);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const appname = getEnv("RELIEFWEB_APPNAME");
  if (!appname) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "RELIEFWEB_APPNAME is not configured. ReliefWeb requires a pre-approved appname.",
      required: ["RELIEFWEB_APPNAME"],
    });
  }

  try {
    const response = asRecord(await fetchJson(`https://api.reliefweb.int/v2/reports?appname=${encodeURIComponent(appname)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        limit: 40,
        preset: "latest",
        query: {
          value: "health outbreak epidemic cholera hospital medical nutrition malnutrition WASH sanitation displacement healthcare",
          operator: "OR",
        },
        filter: { field: "country", value: country },
        fields: {
          include: [
            "title",
            "date.created",
            "source.name",
            "primary_country.name",
            "country.name",
            "disaster.name",
            "theme.name",
            "format.name",
            "body",
            "url",
            "url_alias",
          ],
        },
      }),
    }));
    const reports = asArray(response?.data).map((item) => {
      const row = asRecord(item);
      const fields = asRecord(row?.fields);
      const sourceNames = asArray(fields?.source).map((source) => text(asRecord(source)?.name)).filter(Boolean);
      const countries = asArray(fields?.country).map((entry) => text(asRecord(entry)?.name)).filter(Boolean);
      const disasters = asArray(fields?.disaster).map((entry) => text(asRecord(entry)?.name)).filter(Boolean);
      const themes = asArray(fields?.theme).map((entry) => text(asRecord(entry)?.name)).filter(Boolean);
      return {
        id: text(row?.id),
        title: text(fields?.title) || "ReliefWeb report",
        createdAt: text(nested(fields, "date", "created")),
        sourceNames,
        countries,
        disasters,
        themes,
        summary: truncate(text(fields?.body), 850),
        sourceUrl: text(fields?.url_alias) || text(fields?.url) || (text(row?.href) ? `https://api.reliefweb.int${text(row?.href)}` : "https://reliefweb.int/"),
      };
    });

    return res.json({
      ok: true,
      configured: true,
      country,
      reports,
      source: "ReliefWeb API",
      sourceUrl: "https://reliefweb.int/",
      limitation: "ReliefWeb aggregates partner-submitted humanitarian material. Reports can contain preliminary, overlapping, or source-specific assessments and should be read with their original attribution.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: safeError(error) });
  }
});

async function requestAcledToken(): Promise<AcledToken> {
  const username = getEnv("ACLED_USERNAME");
  const password = getEnv("ACLED_PASSWORD");
  if (!username || !password) throw new Error("ACLED_USERNAME and ACLED_PASSWORD are not configured.");
  const form = new URLSearchParams({ username, password, grant_type: "password", client_id: "acled", scope: "authenticated" });
  const payload = asRecord(await fetchJson("https://acleddata.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
  }));
  const accessToken = text(payload?.access_token);
  const expiresIn = numberValue(payload?.expires_in) ?? 86_400;
  if (!accessToken) throw new Error("ACLED authentication did not return an access token.");
  return { accessToken, expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000 };
}

async function getAcledToken(force = false): Promise<AcledToken> {
  if (!force && acledTokenCache && acledTokenCache.expiresAt > Date.now()) return acledTokenCache;
  if (!force && acledTokenRequest) return acledTokenRequest;
  acledTokenRequest = requestAcledToken();
  try {
    acledTokenCache = await acledTokenRequest;
    return acledTokenCache;
  } finally {
    acledTokenRequest = null;
  }
}

async function fetchAcled(country: string, startDate: string, endDate: string, forceToken = false): Promise<unknown> {
  const token = await getAcledToken(forceToken);
  const params = new URLSearchParams({
    "_format": "json",
    country,
    event_date: `${startDate}|${endDate}`,
    event_date_where: "BETWEEN",
    fields: "event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|interaction|region|country|admin1|admin2|admin3|location|latitude|longitude|source|source_scale|notes|fatalities|civilian_targeting|tags|timestamp",
    limit: "1000",
  });
  const response = await fetch(`https://acleddata.com/api/acled/read?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" },
  });
  if (response.status === 401 && !forceToken) {
    acledTokenCache = null;
    return fetchAcled(country, startDate, endDate, true);
  }
  const body = await response.text();
  let payload: unknown = null;
  try { payload = body ? JSON.parse(body) : null; } catch { payload = null; }
  if (!response.ok) throw new Error(text(asRecord(payload)?.message) || `ACLED returned HTTP ${response.status}`);
  return payload;
}

router.get("/aor/conflict-events", async (req: Request, res: Response) => {
  const country = text(req.query.country);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const configured = !!getEnv("ACLED_USERNAME") && !!getEnv("ACLED_PASSWORD");
  if (!configured) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "ACLED is ready but requires ACLED_USERNAME and ACLED_PASSWORD.",
      required: ["ACLED_USERNAME", "ACLED_PASSWORD"],
      authentication: "Server-side OAuth password grant with automatic 24-hour access-token renewal; no manual 14-day refresh-token maintenance.",
    });
  }
  const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 365);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  try {
    const payload = asRecord(await fetchAcled(country, startDate, endDate));
    const events = asArray(payload?.data).map((item) => {
      const row = asRecord(item);
      return {
        id: text(row?.event_id_cnty),
        eventDate: text(row?.event_date),
        eventType: text(row?.event_type),
        subEventType: text(row?.sub_event_type),
        actor1: text(row?.actor1),
        actor2: text(row?.actor2),
        region: text(row?.region),
        country: text(row?.country),
        admin1: text(row?.admin1),
        admin2: text(row?.admin2),
        location: text(row?.location),
        latitude: numberValue(row?.latitude),
        longitude: numberValue(row?.longitude),
        source: text(row?.source),
        sourceScale: text(row?.source_scale),
        notes: truncate(text(row?.notes), 700),
        fatalities: numberValue(row?.fatalities) ?? 0,
        civilianTargeting: text(row?.civilian_targeting),
        tags: text(row?.tags),
      };
    });
    return res.json({
      ok: true,
      configured: true,
      country,
      startDate,
      endDate,
      events,
      source: "Armed Conflict Location & Event Data (ACLED)",
      sourceUrl: "https://acleddata.com/",
      limitation: "ACLED records political violence, demonstrations, and strategic developments under its methodology. Reported fatalities and event classifications may be revised, and use is governed by ACLED licensing and attribution terms.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: safeError(error) });
  }
});

router.get("/aor/source-readiness", (_req: Request, res: Response) => {
  return res.json({
    ok: true,
    sources: [
      { id: "state", name: "U.S. Department of State", configured: true, live: true, requirement: null },
      { id: "who", name: "WHO Disease Outbreak News", configured: true, live: true, requirement: null },
      { id: "gdacs", name: "GDACS", configured: true, live: true, requirement: null },
      { id: "reliefweb", name: "ReliefWeb", configured: !!getEnv("RELIEFWEB_APPNAME"), live: !!getEnv("RELIEFWEB_APPNAME"), requirement: getEnv("RELIEFWEB_APPNAME") ? null : "Pre-approved RELIEFWEB_APPNAME" },
      { id: "acled", name: "ACLED", configured: !!getEnv("ACLED_USERNAME") && !!getEnv("ACLED_PASSWORD"), live: !!getEnv("ACLED_USERNAME") && !!getEnv("ACLED_PASSWORD"), requirement: getEnv("ACLED_USERNAME") && getEnv("ACLED_PASSWORD") ? null : "ACLED_USERNAME and ACLED_PASSWORD" },
      { id: "cfr", name: "CFR Global Conflict Tracker", configured: false, live: false, requirement: "No official API; requires a validated, terms-compliant parser or link-only treatment" },
      { id: "ucdp", name: "UCDP", configured: !!getEnv("UCDP_API_TOKEN"), live: false, requirement: getEnv("UCDP_API_TOKEN") ? "Adapter not enabled in this pass" : "UCDP_API_TOKEN" },
      { id: "firms", name: "NASA FIRMS", configured: !!getEnv("NASA_FIRMS_MAP_KEY"), live: false, requirement: getEnv("NASA_FIRMS_MAP_KEY") ? "Adapter not enabled in this pass" : "NASA_FIRMS_MAP_KEY" },
    ],
  });
});

export default router;
