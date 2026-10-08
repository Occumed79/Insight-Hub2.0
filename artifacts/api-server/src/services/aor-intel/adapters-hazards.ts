import type { AdapterContext, AdapterResult, EvidenceRecord } from "./types";
import { arr, errorText, isoOrNull, makeRecord, num, result, row, str } from "./util";

const HOUR = 3_600_000;

/* ------------------------------------------------------------------ */
/* OpenAQ v3 — latest PM2.5 readings at real monitoring stations       */
/* Requires OPENAQ_API_KEY (sent as X-API-Key).                         */
/* ------------------------------------------------------------------ */

const OPENAQ_META = {
  sourceId: "openaq",
  sourceName: "OpenAQ v3 air quality (PM2.5)",
  sourceUrl: "https://openaq.org/",
  dimension: "environment" as const,
  freshness: "NEAR_REAL_TIME" as const,
};
const OPENAQ_BASE = "https://api.openaq.org/v3";
const PM25_PARAMETER_ID = 2;
const FRESH_WINDOW_MS = 72 * HOUR;
const MAX_STATIONS = 40;

type Station = { id: number; name: string; lon: number; lat: number; provider: string; isMonitor: boolean | null; lastUtc: string | null };

export async function openAqAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const key = ctx.env("OPENAQ_API_KEY")?.trim();
  if (!key) {
    return result(ctx, OPENAQ_META, "not_configured", [], "OPENAQ_API_KEY is not set. OpenAQ v3 requires an API key (free at https://explore.openaq.org/register), sent as the X-API-Key header.");
  }
  const headers = { Accept: "application/json", "X-API-Key": key };
  let stations: Station[];
  try {
    const url = `${OPENAQ_BASE}/locations?iso=${encodeURIComponent(ctx.country.iso2)}&parameters_id=${PM25_PARAMETER_ID}&limit=1000`;
    const payload = row(await ctx.externalJson(url, { headers, timeoutMs: 25_000 }));
    stations = arr(payload.results).map(row).flatMap((item) => {
      const coordinates = row(item.coordinates);
      const lat = num(coordinates.latitude);
      const lon = num(coordinates.longitude);
      const id = num(item.id);
      if (lat === null || lon === null || id === null) return [];
      return [{ id, name: str(item.name) || `Location ${id}`, lon, lat, provider: str(row(item.provider).name), isMonitor: typeof item.isMonitor === "boolean" ? item.isMonitor : null, lastUtc: isoOrNull(row(item.datetimeLast).utc) }];
    });
  } catch (error) {
    return result(ctx, OPENAQ_META, "source_unavailable", [], errorText(error));
  }
  if (!stations.length) return result(ctx, OPENAQ_META, "source_returned_no_data", [], `OpenAQ lists no PM2.5 monitoring locations for ${ctx.country.name}. Absence of stations is not evidence of clean air.`);

  const now = ctx.now().getTime();
  const active = stations.filter((station) => station.lastUtc && now - Date.parse(station.lastUtc) <= FRESH_WINDOW_MS)
    .sort((a, b) => Date.parse(b.lastUtc as string) - Date.parse(a.lastUtc as string)).slice(0, MAX_STATIONS);
  if (!active.length) return result(ctx, OPENAQ_META, "no_current_matching_finding", [], `${stations.length} PM2.5 station${stations.length === 1 ? " is" : "s are"} listed but none reported in the last 72 hours.`);

  let latest: Array<{ locationId: number; value: number; utc: string }>;
  try {
    const url = `${OPENAQ_BASE}/parameters/${PM25_PARAMETER_ID}/latest?locations_id=${active.map((station) => station.id).join(",")}&limit=1000`;
    const payload = row(await ctx.externalJson(url, { headers, timeoutMs: 25_000 }));
    latest = arr(payload.results).map(row).flatMap((item) => {
      const value = num(item.value);
      const locationId = num(item.locationsId);
      const utc = isoOrNull(row(item.datetime).utc);
      return value === null || value < 0 || locationId === null || !utc ? [] : [{ locationId, value, utc }];
    });
  } catch (error) {
    return result(ctx, OPENAQ_META, "source_unavailable", [], errorText(error));
  }
  const byLocation = new Map<number, { value: number; utc: string }>();
  for (const item of latest) {
    const previous = byLocation.get(item.locationId);
    if (!previous || Date.parse(item.utc) > Date.parse(previous.utc)) byLocation.set(item.locationId, item);
  }
  const records: EvidenceRecord[] = [];
  for (const station of active) {
    const reading = byLocation.get(station.id);
    if (!reading || now - Date.parse(reading.utc) > FRESH_WINDOW_MS) continue;
    records.push(makeRecord(ctx, "openaq", {
      id: `openaq:${ctx.country.iso2}:${station.id}`,
      dimension: "environment",
      category: "air_quality_station",
      subtype: "pm25",
      title: `PM2.5 — ${station.name}`,
      summary: `Latest PM2.5 reading ${reading.value} µg/m³ at ${station.name} (${reading.utc.slice(0, 16).replace("T", " ")} UTC).`,
      evidence: `OpenAQ location ${station.id} (${station.provider || "provider n/r"}${station.isMonitor === false ? ", low-cost sensor" : station.isMonitor ? ", reference monitor" : ""}): PM2.5 = ${reading.value} µg/m³ at ${reading.utc}.`,
      sourceName: OPENAQ_META.sourceName,
      sourceUrl: `https://explore.openaq.org/locations/${station.id}`,
      publishedAt: reading.utc,
      updatedAt: reading.utc,
      freshness: "NEAR_REAL_TIME",
      geometry: { type: "Point", coordinates: [station.lon, station.lat] },
      geographyLevel: "point",
      geographyNote: "A single station's latest reading. It is not an air-quality index, not a 24-hour average, and not representative of the whole country or city. Station coverage is uneven.",
      extra: { pm25: reading.value, unit: "µg/m³", locationId: station.id, provider: station.provider, isMonitor: station.isMonitor, stationsListed: stations.length },
    }));
  }
  if (!records.length) return result(ctx, OPENAQ_META, "source_returned_no_data", [], "OpenAQ returned no usable latest PM2.5 measurements for the active stations.");
  return result(ctx, OPENAQ_META, "ok", records, `${records.length} of ${stations.length} listed PM2.5 stations reported in the last 72 hours.`);
}

/* ------------------------------------------------------------------ */
/* ReliefWeb API v2 (OCHA) — ongoing disasters + latest OCHA sitreps    */
/* ReliefWeb requires a pre-approved `appname` (since 1 Nov 2025).     */
/* ------------------------------------------------------------------ */

const RW_META = {
  sourceId: "reliefweb-ocha",
  sourceName: "ReliefWeb (OCHA) humanitarian context",
  sourceUrl: "https://reliefweb.int/",
  dimension: "disasters" as const,
  freshness: "CURRENT_NOTICE" as const,
};
const RW_BASE = "https://api.reliefweb.int/v2";

export async function reliefWebAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const appname = ctx.env("RELIEFWEB_APPNAME")?.trim();
  if (!appname) {
    return result(ctx, RW_META, "not_configured", [], "RELIEFWEB_APPNAME is not set. ReliefWeb API v2 requires a pre-approved appname (mandatory since 1 November 2025; request one at https://apidoc.reliefweb.int/). Limit: 1,000 calls/day.");
  }
  const iso3 = ctx.country.iso3;
  const disastersUrl = `${RW_BASE}/disasters?appname=${encodeURIComponent(appname)}`;
  const reportsUrl = `${RW_BASE}/reports?appname=${encodeURIComponent(appname)}`;

  let disasters: Array<Record<string, unknown>> = [];
  try {
    const payload = row(await ctx.externalJson(disastersUrl, {
      method: "POST",
      timeoutMs: 25_000,
      body: {
        limit: 10,
        sort: ["date.event:desc"],
        filter: { operator: "AND", conditions: [{ field: "country.iso3", value: iso3 }, { field: "status", value: ["alert", "ongoing"], operator: "OR" }] },
        fields: { include: ["name", "status", "glide", "date.event", "date.changed", "type.name", "country.name", "url", "profile.overview"] },
      },
    }));
    disasters = arr(payload.data).map((item) => row(row(item).fields));
  } catch (error) {
    return result(ctx, RW_META, "source_unavailable", [], errorText(error));
  }

  let reports: Array<Record<string, unknown>> = [];
  let reportNote: string | null = null;
  try {
    const payload = row(await ctx.externalJson(reportsUrl, {
      method: "POST",
      timeoutMs: 25_000,
      body: {
        limit: 3,
        sort: ["date.original:desc"],
        filter: { operator: "AND", conditions: [{ field: "primary_country.iso3", value: iso3 }, { field: "source.shortname", value: "OCHA" }, { field: "format.name", value: "Situation Report" }] },
        fields: { include: ["title", "url", "date.original", "source.name", "format.name"] },
      },
    }));
    reports = arr(payload.data).map((item) => row(row(item).fields));
  } catch (error) {
    reportNote = `OCHA situation reports unavailable: ${errorText(error)}`;
  }

  const records: EvidenceRecord[] = [];
  for (const item of disasters) {
    const name = str(item.name);
    if (!name) continue;
    const types = arr(item.type).map((entry) => str(row(entry).name)).filter(Boolean);
    const status = str(item.status);
    const eventDate = isoOrNull(row(item.date).event);
    records.push(makeRecord(ctx, "reliefweb", {
      id: `reliefweb:${ctx.country.iso2}:disaster:${str(item.glide) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
      dimension: "disasters",
      category: "humanitarian_disaster",
      subtype: (types[0] || "disaster").toLowerCase(),
      title: name,
      summary: `${status === "alert" ? "Alert" : "Ongoing"} ReliefWeb disaster entry${types.length ? ` (${types.join(", ")})` : ""}${eventDate ? `, event date ${eventDate.slice(0, 10)}` : ""}.`,
      evidence: str(row(item.profile).overview).slice(0, 600) || name,
      severity: status || null,
      sourceName: RW_META.sourceName,
      sourceUrl: str(item.url) || RW_META.sourceUrl,
      publishedAt: eventDate,
      updatedAt: isoOrNull(row(item.date).changed),
      freshness: "CURRENT_NOTICE",
      geometry: { type: "None" },
      geographyLevel: "text_only",
      geographyNote: "ReliefWeb tags disasters to countries, not coordinates. The event may affect only part of the country or several countries, so it is listed, not drawn.",
      extra: { glide: str(item.glide) || null, types, status, countries: arr(item.country).map((entry) => str(row(entry).name)).filter(Boolean) },
    }));
  }
  for (const item of reports) {
    const title = str(item.title);
    if (!title) continue;
    records.push(makeRecord(ctx, "reliefweb", {
      id: `reliefweb:${ctx.country.iso2}:sitrep:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70)}`,
      dimension: "disasters",
      category: "ocha_situation_report",
      subtype: "situation_report",
      title,
      summary: `OCHA situation report published ${isoOrNull(row(item.date).original)?.slice(0, 10) ?? "(date n/r)"}.`,
      evidence: title,
      sourceName: RW_META.sourceName,
      sourceUrl: str(item.url) || RW_META.sourceUrl,
      publishedAt: isoOrNull(row(item.date).original),
      freshness: "CURRENT_NOTICE",
      geometry: { type: "None" },
      geographyLevel: "text_only",
      geographyNote: "Country-tagged humanitarian report; the covered area is described in the report itself.",
      extra: { format: "Situation Report" },
    }));
  }
  if (!records.length) return result(ctx, RW_META, "no_current_matching_finding", [], `No alert/ongoing ReliefWeb disasters or recent OCHA situation reports for ${ctx.country.name}.${reportNote ? ` ${reportNote}` : ""}`);
  return result(ctx, RW_META, "ok", records, reportNote ?? "Content from ReliefWeb (OCHA); attribution required, check each item's terms of use.");
}
