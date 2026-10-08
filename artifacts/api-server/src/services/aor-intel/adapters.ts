import { getAorCountryProfileByIso2 } from "../../data/aor-country-profiles";
import { pointInCountry } from "./geo";
import type { AdapterContext, AdapterResult, EvidenceRecord, RecommendationType, RequirementType } from "./types";
import { arr, countryNameMatches, errorText, isoOrNull, makeRecord, normalize, num, result, row, str, type Row } from "./util";

/* ------------------------------------------------------------------ */
/* CDC Travelers' Health (destination guidance): vaccines, malaria,    */
/* yellow fever, destination disease risks                             */
/* ------------------------------------------------------------------ */

const CDC_META = {
  sourceId: "cdc-travelers-health",
  sourceName: "CDC Travelers' Health",
  sourceUrl: "https://wwwnc.cdc.gov/travel/destinations/list",
  dimension: "multi" as const,
  freshness: "CURRENT_GUIDANCE" as const,
};

const REQUIREMENT_LANGUAGE = /\b(entry requirement|required for entry|is required|are required|proof of (?:yellow fever )?vaccination|certificate of vaccination|icvp|must (?:show|present|have))\b/i;
const NEGATED_REQUIREMENT = /\b(not required|no (?:proof|certificate)|is not a requirement)\b/i;
const TRANSIT_LANGUAGE = /\b(arriving from|coming from|travel(?:ing|ling)? from|transit|previous(?:ly)? (?:travel|visit)|have (?:been|traveled|travelled) (?:in|to|through)|countries? (?:with|at) risk)\b/i;

export function classifyRecommendation(textValue: string, name = ""): RecommendationType {
  const t = normalize(textValue);
  if (/routine/.test(normalize(name)) || /routine vaccines/.test(t)) return "routine";
  if (/not recommended|not routinely recommended|no malaria transmission|no risk/.test(t)) return "not_routinely_recommended";
  if (/some travelers|certain travelers|selected travelers|if you (?:will|plan|are going)|depending on|for travelers who|travelers at (?:higher|increased)/.test(t)) return "selected_travelers";
  if (/consider|may get|talk to your|discuss/.test(t)) return "consider";
  if (/recommended|should be vaccinated|up to date|make sure you are up to date/.test(t)) return "recommended";
  return "review";
}

export function classifyRequirement(textValue: string): RequirementType | null {
  if (NEGATED_REQUIREMENT.test(textValue)) return "not_required";
  if (!REQUIREMENT_LANGUAGE.test(textValue)) return null;
  return TRANSIT_LANGUAGE.test(textValue) ? "entry_required_after_transit" : "entry_required";
}

export type MalariaPlaceKind = "province" | "state" | "region" | "department" | "district" | "governorate" | "county" | "prefecture" | "division" | "island" | "territory" | "city" | "border_area";

/** A place the CDC text names. It is listed, never drawn: no authoritative admin geometry is bundled for it. */
export type MalariaPlace = {
  name: string;
  kind: MalariaPlaceKind;
  /** "risk" = named in a sentence that describes risk; "no_risk" = named where the text states no risk / malaria-free. */
  risk: "risk" | "no_risk";
  seasonality: string | null;
  /** Elevation limit stated in the same sentence as this place; applies to the place, not the whole country. */
  elevationLimitMeters: number | null;
  elevationNote: string | null;
  sourceSentence: string;
  geometry: "text_only";
};

export type MalariaModel = {
  riskScope: "none_stated" | "country_wide" | "parts_of_country" | "unspecified";
  riskStatement: string;
  areasMentioned: string | null;
  /** Provinces, states, regions, islands, border areas and cities the text names, with what the same sentence says about them. */
  places: MalariaPlace[];
  seasonality: string | null;
  altitudeNote: string | null;
  /**
   * Drawn on the terrain only when the CDC sentence that states the limit is not tied to a named place or regional
   * qualifier. A limit stated for "Province X" or "the north" belongs to that area and is listed with it instead.
   */
  altitudeLimitMeters: number | null;
  altitudeScope: "country_statement" | "named_places" | "qualified_area" | null;
  altitudeScopeNote: string | null;
  preventionDrugs: string[];
  preventionStatement: string | null;
};

const MALARIA_DRUGS = ["atovaquone-proguanil", "doxycycline", "mefloquine", "tafenoquine", "chloroquine", "primaquine"];

/**
 * Elevation limit, only when the text explicitly negates transmission above a stated height
 * ("does not occur above 2,000 m") or restricts risk to below it ("risk is limited to areas below 1,500 m").
 * Positive statements such as "risk in areas above 1,000 m" are not treated as limits.
 */
export function parseAltitudeLimit(textValue: string): { meters: number; basis: string } | null {
  const toMeters = (amount: string, unit: string) => {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) return null;
    return /^f/i.test(unit) ? Math.round(value * 0.3048) : Math.round(value);
  };
  for (const sentence of textValue.replace(/\s+/g, " ").split(/(?<=[.;])\s+/)) {
    const negated = sentence.match(/\b(?:no|not|does not occur|do not occur|absent|free of|without|unlikely|rare(?:ly)?)\b[^.;]{0,80}?\b(?:above|over|higher than|greater than)\s+([\d,]+)\s*(m\b|meters|metres|feet|ft\b)/i);
    if (negated) { const meters = toMeters(negated[1], negated[2]); if (meters) return { meters, basis: sentence.trim() }; }
    const restricted = sentence.match(/\b(?:risk|transmission|present|occurs?|found|limited|restricted|only)\b[^.;]{0,60}?\b(?:below|under|lower than)\s+([\d,]+)\s*(m\b|meters|metres|feet|ft\b)/i);
    if (restricted && /\b(?:limited|restricted|only|confined)\b/i.test(sentence)) { const meters = toMeters(restricted[1], restricted[2]); if (meters) return { meters, basis: sentence.trim() }; }
  }
  return null;
}

const PLACE_WORD = "[\\p{Lu}][\\p{L}'’-]+";
const PLACE_NAME = `${PLACE_WORD}(?:\\s+(?:de|del|la|of|do|da|al|el|bin|ben|des|du)?\\s*${PLACE_WORD}){0,3}`.replace(/\s\*/g, " ?");
const PLACE_LIST = `${PLACE_NAME}(?:\\s*(?:,|;|\\band\\b|&|\\bor\\b)\\s*(?:and\\s+|or\\s+)?${PLACE_NAME})*`;
const LEADING_NOISE = new Set(["in", "the", "at", "on", "for", "risk", "malaria", "areas", "area", "only", "all", "throughout", "some", "parts", "part", "and", "or", "of", "no"]);
const KIND_BY_WORD: Record<string, MalariaPlaceKind> = {
  province: "province", provinces: "province", state: "state", states: "state", region: "region", regions: "region", department: "department", departments: "department",
  district: "district", districts: "district", governorate: "governorate", governorates: "governorate", county: "county", counties: "county", prefecture: "prefecture", prefectures: "prefecture",
  division: "division", divisions: "division", island: "island", islands: "island", territory: "territory", territories: "territory", city: "city", cities: "city",
};
const SEASON_PATTERN = /\b(?:year[- ]round|seasonal(?:ly)?|rainy season|dry season|transmission season|from [A-Z][a-z]+ (?:to|through|until) [A-Z][a-z]+|between [A-Z][a-z]+ and [A-Z][a-z]+)\b/i;
const NO_RISK_PATTERN = /\b(?:no|not|without|free of|absent)\b[^.;]{0,40}\b(?:malaria|risk|transmission)\b|malaria[- ]free/i;

function cleanPlaceName(raw: string): string | null {
  const words = raw.trim().split(/\s+/);
  while (words.length && LEADING_NOISE.has(words[0].toLowerCase())) words.shift();
  const name = words.join(" ").replace(/[.,;:]+$/, "");
  return name.length >= 3 ? name : null;
}

function splitPlaceList(list: string): string[] {
  return list.split(/\s*(?:,|;|\band\b|&|\bor\b)\s*/i).map((part) => cleanPlaceName(part)).filter((name): name is string => Boolean(name));
}

/**
 * Names the places a CDC sentence refers to by an administrative word (Province, State, Island, ...) or a border phrase.
 * Capitalised words alone are never treated as places. Nothing here is geocoded.
 */
export function extractMalariaPlaces(textValue: string): MalariaPlace[] {
  const found = new Map<string, MalariaPlace>();
  const sentences = textValue.replace(/\s+/g, " ").split(/(?<=[.;])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  for (const sentence of sentences) {
    const names: Array<{ name: string; kind: MalariaPlaceKind }> = [];
    for (const match of sentence.matchAll(new RegExp(`\\b(provinces?|states?|regions?|departments?|districts?|governorates?|counties|prefectures?|divisions?|islands?|cities|city|territories)\\s+of\\s+(${PLACE_LIST})`, "gu"))) {
      for (const name of splitPlaceList(match[2])) names.push({ name, kind: KIND_BY_WORD[match[1].toLowerCase()] });
    }
    for (const match of sentence.matchAll(new RegExp(`(${PLACE_NAME})\\s+(Province|State|Region|Department|District|Governorate|County|Prefecture|Division|Island|Islands|Territory)\\b`, "gu"))) {
      const name = cleanPlaceName(match[1]);
      if (name) names.push({ name: `${name} ${match[2]}`, kind: KIND_BY_WORD[match[2].toLowerCase()] });
    }
    for (const match of sentence.matchAll(new RegExp(`\\b(?:border(?:ing)?\\s+(?:areas?|regions?|districts?|zones?)\\s+(?:with|of|near)|areas?\\s+bordering|along\\s+the)\\s+(?:the\\s+)?(${PLACE_LIST})(?:\\s+border)?`, "gu"))) {
      for (const name of splitPlaceList(match[1])) names.push({ name: `Border area with ${name}`, kind: "border_area" });
    }
    if (!names.length) continue;
    const noRisk = NO_RISK_PATTERN.test(sentence);
    const season = sentence.match(SEASON_PATTERN)?.[0] ?? null;
    const limit = parseAltitudeLimit(sentence);
    for (const { name, kind } of names) {
      const base = name.replace(/\s+(?:province|state|region|department|district|governorate|county|prefecture|division|island|islands|territory)$/i, "").toLowerCase();
      const key = `${base}|${noRisk ? "n" : "r"}`;
      const place: MalariaPlace = { name, kind, risk: noRisk ? "no_risk" : "risk", seasonality: season, elevationLimitMeters: limit?.meters ?? null, elevationNote: limit?.basis ?? null, sourceSentence: sentence.slice(0, 400), geometry: "text_only" };
      const existing = found.get(key);
      if (!existing) found.set(key, place);
      else {
        // The same place named again (for example in a list, then with its own elevation sentence): keep one entry and add what the later sentence states.
        found.set(key, {
          ...existing,
          name: name.length > existing.name.length ? name : existing.name,
          kind: name.length > existing.name.length ? kind : existing.kind,
          seasonality: existing.seasonality ?? place.seasonality,
          elevationLimitMeters: existing.elevationLimitMeters ?? place.elevationLimitMeters,
          elevationNote: existing.elevationNote ?? place.elevationNote,
        });
      }
    }
  }
  return [...found.values()];
}


/**
 * "No malaria transmission" counts as a country-level statement only when nothing narrows it: a clause such as
 * "no transmission above 2,000 m" or "no risk in the cities of X" says nothing about the rest of the country.
 */
export function statesNoMalariaAnywhere(textValue: string): boolean {
  const pattern = /\b(?:there is |is )?(?:no malaria transmission|no risk of malaria|malaria is not (?:a risk|present)|not a malaria[- ]risk(?: country)?)\b([^.;]*)/gi;
  for (const match of textValue.replace(/\s+/g, " ").matchAll(pattern)) {
    const rest = match[1].replace(/\b(?:anywhere\s+)?(?:in|within|across)\s+(?:this|the|that)\s+(?:entire\s+|whole\s+)?(?:country|destination|nation)\b/gi, " ");
    if (!/\b(?:above|below|over|under|in|at|on|within|except|outside|during|for|among|near|along|between|from)\b/i.test(rest)) return true;
  }
  return false;
}

const REGIONAL_QUALIFIER = /\b(?:in|of|across|within|throughout)\s+the\s+(?:north|south|east|west|centre|center|central|northern|southern|eastern|western)\b|\b(?:rural|forest(?:ed)?|coastal|border|inland|highland|lowland|urban)\b/i;

/** Parses only what the retrieved CDC text states; every absent field is null, never inferred. */
export function parseMalariaText(textValue: string): MalariaModel {
  const t = textValue.replace(/\s+/g, " ").trim();
  const n = normalize(t);
  let riskScope: MalariaModel["riskScope"] = "unspecified";
  if (statesNoMalariaAnywhere(t)) riskScope = "none_stated";
  else if (/parts of|some areas|certain areas|areas (?:below|above|of)|in some|limited to|certain regions|in the (?:north|south|east|west)/.test(n)) riskScope = "parts_of_country";
  else if (/throughout (?:the )?country|all areas|entire country|country wide|countrywide|all regions|nationwide/.test(n)) riskScope = "country_wide";
  const altitude = t.match(/[^.]*\b(?:below|under|above|over|altitudes? (?:below|above|of))\s+[\d,]+\s*(?:m\b|meters|metres|feet|ft\b)[^.]*\.?/i)?.[0]?.trim() || null;
  const season = t.match(/[^.]*\b(?:year[- ]round|seasonal(?:ly)?|rainy season|dry season|transmission season|from [A-Z][a-z]+ (?:to|through|until) [A-Z][a-z]+|between [A-Z][a-z]+ and [A-Z][a-z]+)[^.]*\.?/i)?.[0]?.trim() || null;
  const prevention = t.match(/[^.]*\b(?:prophylaxis|chemoprevention|antimalarial|prevent(?:ive)? medication|malaria (?:pills|medicine))[^.]*\.?/i)?.[0]?.trim() || null;
  const areas = riskScope === "parts_of_country" ? (t.match(/[^.]*\b(?:parts of|some areas|certain areas|areas of|in the (?:north|south|east|west))[^.]*\.?/i)?.[0]?.trim() || null) : null;
  const places = extractMalariaPlaces(t);
  if (riskScope === "unspecified" && places.some((place) => place.risk === "risk")) riskScope = "parts_of_country";

  // A stated elevation limit is drawn on the terrain only when its sentence is not tied to a named place or regional qualifier.
  const limit = parseAltitudeLimit(t);
  let altitudeLimitMeters: number | null = null;
  let altitudeScope: MalariaModel["altitudeScope"] = null;
  let altitudeScopeNote: string | null = null;
  if (limit) {
    const tied = extractMalariaPlaces(limit.basis);
    if (tied.length) {
      altitudeScope = "named_places";
      altitudeScopeNote = `The limit is stated for ${tied.map((place) => place.name).join(", ")}; it is listed with ${tied.length === 1 ? "that place" : "those places"} and not applied to the whole country.`;
    } else if (REGIONAL_QUALIFIER.test(limit.basis)) {
      altitudeScope = "qualified_area";
      altitudeScopeNote = "The limit is stated for a regional qualifier in the text (for example a direction or rural/border/coastal area), not for the whole country, so it is not drawn on the terrain.";
    } else {
      altitudeScope = "country_statement";
      altitudeLimitMeters = limit.meters;
    }
  }
  return {
    riskScope,
    riskStatement: t,
    areasMentioned: areas,
    places,
    seasonality: season,
    altitudeNote: altitude,
    altitudeLimitMeters,
    altitudeScope,
    altitudeScopeNote,
    preventionDrugs: MALARIA_DRUGS.filter((drug) => normalize(t).includes(normalize(drug))),
    preventionStatement: prevention,
  };
}

export async function cdcGuidanceAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const { country } = ctx;
  let payload: Row;
  try {
    payload = row(await ctx.internalJson(`/api/aor/travel-health?country=${encodeURIComponent(country.name)}`));
  } catch (error) {
    return result(ctx, CDC_META, "source_unavailable", [], errorText(error));
  }
  if (payload.available === false) return result(ctx, CDC_META, "source_unavailable", [], str(payload.sourceNotice) || "CDC destination guidance unavailable.");

  const sourceUrl = str(payload.sourceUrl) || CDC_META.sourceUrl;
  const updatedAt = isoOrNull(payload.sourceUpdated);
  const retrievedAt = isoOrNull(payload.retrievedAt) || ctx.now().toISOString();
  const common = { sourceName: CDC_META.sourceName, sourceUrl, updatedAt, retrievedAt, freshness: CDC_META.freshness, geometry: { type: "Country", iso2: country.iso2 } as const, geographyLevel: "country" as const };
  const records: EvidenceRecord[] = [];

  for (const item of arr(payload.vaccines).map(row)) {
    const name = str(item.name);
    const recText = str(item.recommendation);
    if (!name) continue;
    const routine = /routine/i.test(name);
    records.push(makeRecord(ctx, "cdc", {
      ...common,
      dimension: "health_vaccines",
      category: routine ? "routine_vaccine" : "travel_vaccine",
      subtype: name,
      title: name,
      summary: recText || "CDC lists this vaccine for the destination; see source for detail.",
      evidence: `${name}: ${recText}`.slice(0, 700),
      recommendationType: classifyRecommendation(recText, name),
      geographyNote: "CDC destination guidance applies at country level; itinerary-specific advice is in the source.",
    }));
    const requirement = classifyRequirement(recText);
    if (requirement) {
      records.push(makeRecord(ctx, "cdc-req", {
        ...common,
        dimension: "health_vaccines",
        category: "entry_requirement",
        subtype: `${name} entry requirement`,
        title: `${name}: entry requirement language`,
        summary: "Requirement language appears in the CDC destination text. Confirm against the destination government's own rules before travel.",
        evidence: recText.slice(0, 700),
        requirementType: requirement,
        geographyNote: "Legal entry requirements are kept separate from recommendations and must be verified with the destination government.",
      }));
    }
  }

  const yellowFever = row(payload.yellowFever);
  if (str(yellowFever.name)) {
    const recText = str(yellowFever.recommendation);
    records.push(makeRecord(ctx, "cdc", {
      ...common,
      dimension: "health_vaccines",
      category: "travel_vaccine",
      subtype: "Yellow Fever",
      title: "Yellow Fever vaccination (CDC recommendation)",
      summary: recText || "CDC lists yellow fever guidance for this destination.",
      evidence: `${str(yellowFever.name)}: ${recText}`.slice(0, 700),
      recommendationType: classifyRecommendation(recText, "Yellow Fever"),
      geographyNote: "Subnational yellow-fever recommendation maps exist for some countries; not resolved here.",
    }));
    const requirement = classifyRequirement(recText);
    if (requirement) {
      records.push(makeRecord(ctx, "cdc-req", {
        ...common,
        dimension: "health_vaccines",
        category: "entry_requirement",
        subtype: "Yellow Fever entry requirement",
        title: "Yellow Fever: entry requirement language",
        summary: "Requirement language appears in the CDC destination text. Requirements based on prior travel/transit differ from CDC recommendations.",
        evidence: recText.slice(0, 700),
        requirementType: requirement,
      }));
    }
  }

  const malariaRow = row(payload.malaria);
  if (str(malariaRow.name)) {
    const recText = str(malariaRow.recommendation);
    const model = parseMalariaText(recText);
    const countryWide = model.riskScope === "country_wide" || model.riskScope === "none_stated";
    records.push(makeRecord(ctx, "cdc", {
      ...common,
      dimension: "malaria",
      category: "malaria",
      subtype: "malaria_risk_and_prevention",
      title: "Malaria risk and prevention",
      summary: recText || "CDC lists malaria guidance for this destination.",
      evidence: recText.slice(0, 900),
      severity: model.riskScope === "none_stated" ? "No malaria transmission stated by source" : model.riskScope === "parts_of_country" ? "Risk in parts of country (source text)" : model.riskScope === "country_wide" ? "Country-wide risk (source text)" : "Risk scope not stated in retrieved text",
      recommendationType: classifyRecommendation(recText, "malaria"),
      geometry: countryWide ? { type: "Country", iso2: country.iso2 } : { type: "None" },
      geographyLevel: countryWide ? "country" : "text_only",
      geographyNote: countryWide ? null : model.places.length
        ? `CDC names ${model.places.length} place${model.places.length === 1 ? "" : "s"} (${model.places.slice(0, 6).map((place) => place.name).join(", ")}${model.places.length > 6 ? ", …" : ""}). They are listed, not drawn: no authoritative sub-national boundary dataset is bundled, and a province outline would overstate what a sentence such as "rural areas of X" says.`
        : "CDC describes malaria risk areas in text. Risk areas are not drawn as polygons because no authoritative geometry was retrieved.",
      extra: { malaria: model },
    }));
  }

  for (const item of arr(payload.diseases).map(row)) {
    const name = str(item.name);
    if (!name) continue;
    records.push(makeRecord(ctx, "cdc-disease", {
      ...common,
      dimension: "health_vaccines",
      category: "destination_disease_risk",
      subtype: name,
      title: name,
      summary: [str(item.transmission), str(item.advice)].filter(Boolean).join(" — ") || "CDC lists this destination disease risk.",
      evidence: `${name}: ${str(item.transmission)} ${str(item.advice)}`.trim().slice(0, 600),
      recommendationType: null,
      extra: { exposureCategory: str(item.category) },
    }));
  }

  if (!records.length) return result(ctx, CDC_META, "source_returned_no_data", [], "CDC destination page parsed with no structured rows.");
  return result(ctx, { ...CDC_META, sourceUrl }, "ok", records);
}

/* ------------------------------------------------------------------ */
/* CDC Travel Health Notices                                           */
/* ------------------------------------------------------------------ */

const NOTICE_META = {
  sourceId: "cdc-travel-notices",
  sourceName: "CDC Travel Health Notices",
  sourceUrl: "https://wwwnc.cdc.gov/travel/notices",
  dimension: "outbreaks" as const,
  freshness: "CURRENT_NOTICE" as const,
};

export async function cdcNoticesAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  let payload: Row;
  try {
    payload = row(await ctx.internalJson("/api/aor/travel-notices"));
  } catch (error) {
    return result(ctx, NOTICE_META, "source_unavailable", [], errorText(error));
  }
  const notices = arr(payload.notices).map(row);
  if (!notices.length) return result(ctx, NOTICE_META, "source_returned_no_data", [], "CDC returned no notices.");
  const matched = notices.filter((notice) => arr(notice.countries).some((name) => countryNameMatches(ctx.country, str(name))));
  if (!matched.length) return result(ctx, NOTICE_META, "no_current_matching_finding", [], "No CDC Travel Health Notice names this country.");
  const records = matched.map((notice) => makeRecord(ctx, "cdc-notice", {
    dimension: "outbreaks",
    category: "travel_health_notice",
    subtype: `level_${num(notice.level) ?? "x"}`,
    title: str(notice.title),
    summary: str(notice.summary) || str(notice.action),
    evidence: `${str(notice.levelLabel)}: ${str(notice.action)}`,
    severity: `Level ${num(notice.level) ?? "?"} — ${str(notice.levelLabel)}`,
    severityLevel: num(notice.level),
    sourceName: NOTICE_META.sourceName,
    sourceUrl: str(notice.url) || NOTICE_META.sourceUrl,
    publishedAt: isoOrNull(notice.date),
    updatedAt: isoOrNull(notice.date),
    freshness: NOTICE_META.freshness,
    geographyLevel: "text_only",
    geographyNote: "Country matched from destinations named in the CDC notice; the notice may concern only part of the country.",
    extra: { status: str(notice.status) },
  }));
  return result(ctx, NOTICE_META, "ok", records);
}

/* ------------------------------------------------------------------ */
/* WHO Disease Outbreak News                                           */
/* ------------------------------------------------------------------ */

const WHO_META = {
  sourceId: "who-don",
  sourceName: "WHO Disease Outbreak News",
  sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news",
  dimension: "outbreaks" as const,
  freshness: "CURRENT_NOTICE" as const,
};

export async function whoOutbreaksAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  let payload: Row;
  try {
    payload = row(await ctx.internalJson(`/api/aor/health-outbreaks?country=${encodeURIComponent(ctx.country.name)}`));
  } catch (error) {
    return result(ctx, WHO_META, "source_unavailable", [], errorText(error));
  }
  if (payload.available === false) return result(ctx, WHO_META, "source_unavailable", [], str(payload.sourceNotice) || "WHO Disease Outbreak News unavailable.");
  const items = arr(payload.outbreaks).map(row);
  if (!items.length) return result(ctx, WHO_META, "no_current_matching_finding", [], "No WHO Disease Outbreak News item matched this country by text.");
  const records = items.map((item) => makeRecord(ctx, "who-don", {
    dimension: "outbreaks",
    category: "disease_outbreak_news",
    subtype: "who_don",
    title: str(item.title),
    summary: str(item.summary).slice(0, 600),
    evidence: [str(item.assessment), str(item.advice)].filter(Boolean).join(" | ").slice(0, 800) || str(item.summary).slice(0, 400),
    sourceName: WHO_META.sourceName,
    sourceUrl: str(item.sourceUrl) || WHO_META.sourceUrl,
    publishedAt: isoOrNull(item.publicationDate),
    updatedAt: isoOrNull(item.publicationDate),
    freshness: WHO_META.freshness,
    geographyLevel: "text_only",
    geographyNote: "Matched to the country by text; WHO may describe only part of the country or a multi-country event.",
  }));
  return result(ctx, WHO_META, "ok", records);
}

/* ------------------------------------------------------------------ */
/* GDACS disasters (real event coordinates when provided)              */
/* ------------------------------------------------------------------ */

const GDACS_META = {
  sourceId: "gdacs",
  sourceName: "GDACS",
  sourceUrl: "https://www.gdacs.org/",
  dimension: "disasters" as const,
  freshness: "NEAR_REAL_TIME" as const,
};

export async function gdacsAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  let payload: Row;
  try {
    payload = row(await ctx.internalJson(`/api/aor/disaster-alerts?country=${encodeURIComponent(ctx.country.name)}&days=90`));
  } catch (error) {
    return result(ctx, GDACS_META, "source_unavailable", [], errorText(error));
  }
  if (payload.available === false) return result(ctx, GDACS_META, "source_unavailable", [], str(payload.sourceNotice) || "GDACS unavailable.");
  const events = arr(payload.events).map(row);
  if (!events.length) return result(ctx, GDACS_META, "no_current_matching_finding", [], "No GDACS event in the last 90 days names this country.");
  const records = events.map((event) => {
    const lat = num(event.latitude);
    const lon = num(event.longitude);
    const hasPoint = lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    const title = str(event.name) || str(event.title) || `${str(event.eventType) || "Disaster"} event`;
    const alert = str(event.alertLevel);
    return makeRecord(ctx, "gdacs", {
      id: `gdacs:${ctx.country.iso2}:${str(event.eventType)}:${str(event.eventId) || slugId(title)}`,
      dimension: "disasters",
      category: (str(event.eventType) || "disaster").toLowerCase(),
      subtype: str(event.eventType) || "Disaster",
      title,
      summary: str(event.description) || title,
      evidence: [alert ? `GDACS alert level: ${alert}` : "", str(event.description)].filter(Boolean).join(" | ").slice(0, 600),
      severity: alert ? `GDACS ${alert}` : null,
      sourceName: GDACS_META.sourceName,
      sourceUrl: str(event.sourceUrl) || str(event.url) || GDACS_META.sourceUrl,
      publishedAt: isoOrNull(event.fromDate),
      updatedAt: isoOrNull(event.toDate) || isoOrNull(event.fromDate),
      freshness: GDACS_META.freshness,
      geometry: hasPoint ? { type: "Point", coordinates: [lon as number, lat as number] } : { type: "None" },
      geographyLevel: hasPoint ? "point" : "text_only",
      geographyNote: hasPoint ? "Event coordinates as published by GDACS (may be an event centroid, not the full affected area)." : "GDACS returned no coordinates for this event.",
      extra: { eventId: str(event.eventId), fromDate: str(event.fromDate), toDate: str(event.toDate) },
    });
  });
  return result(ctx, GDACS_META, "ok", records);
}

function slugId(value: string) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 40);
}

/* ------------------------------------------------------------------ */
/* USGS earthquakes (real coordinates)                                 */
/* ------------------------------------------------------------------ */

const USGS_META = {
  sourceId: "usgs",
  sourceName: "USGS Earthquake Catalog",
  sourceUrl: "https://earthquake.usgs.gov/earthquakes/map/",
  dimension: "disasters" as const,
  freshness: "NEAR_REAL_TIME" as const,
};

export async function usgsAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const { country } = ctx;
  if (!country.bboxes.length) return result(ctx, USGS_META, "not_applicable", [], "No country polygon is available to bound the earthquake query.");
  const seen = new Map<string, Row>();
  let anyOk = false;
  let lastError = "";
  for (const [minLon, minLat, maxLon, maxLat] of country.bboxes) {
    try {
      const query = new URLSearchParams({ minLon: String(minLon), minLat: String(minLat), maxLon: String(maxLon), maxLat: String(maxLat), days: "30" });
      const payload = row(await ctx.internalJson(`/api/aor/seismic-activity?${query}`));
      anyOk = true;
      for (const quake of arr(payload.earthquakes).map(row)) seen.set(str(quake.id) || `${quake.latitude},${quake.longitude},${quake.occurredAt}`, quake);
    } catch (error) {
      lastError = errorText(error);
    }
  }
  if (!anyOk) return result(ctx, USGS_META, "source_unavailable", [], lastError);
  if (!seen.size) return result(ctx, USGS_META, "no_current_matching_finding", [], "No M4.0+ earthquakes in the last 30 days inside the country bounding box.");
  const records = [...seen.values()].flatMap((quake) => {
    const lat = num(quake.latitude);
    const lon = num(quake.longitude);
    if (lat === null || lon === null) return [];
    const withinBorders = pointInCountry(country.iso2, lon, lat);
    const magnitude = num(quake.magnitude);
    return [makeRecord(ctx, "usgs", {
      id: `usgs:${country.iso2}:${str(quake.id)}`,
      dimension: "disasters",
      category: "earthquake",
      subtype: "earthquake",
      title: str(quake.title) || `M${magnitude ?? "?"} earthquake`,
      summary: [str(quake.place), magnitude !== null ? `Magnitude ${magnitude}` : "", num(quake.depthKm) !== null ? `depth ${num(quake.depthKm)} km` : "", quake.tsunami ? "tsunami flag set" : ""].filter(Boolean).join(" · "),
      evidence: `USGS event ${str(quake.id)} at ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      severity: magnitude !== null ? `M${magnitude.toFixed(1)}` : null,
      sourceName: USGS_META.sourceName,
      sourceUrl: str(quake.url) || USGS_META.sourceUrl,
      publishedAt: isoOrNull(quake.occurredAt),
      updatedAt: isoOrNull(quake.occurredAt),
      freshness: USGS_META.freshness,
      geometry: { type: "Point", coordinates: [lon, lat] },
      geographyLevel: "point",
      geographyNote: withinBorders ? "Epicentre inside the country boundary." : "Epicentre inside the country's bounding box but outside its land boundary (offshore or neighbouring territory).",
      extra: { magnitude, depthKm: num(quake.depthKm), tsunami: Boolean(quake.tsunami), withinBorders },
    })];
  });
  return result(ctx, USGS_META, "ok", records);
}

/* ------------------------------------------------------------------ */
/* Security / travel advisories: State Dept and UK FCDO kept separate  */
/* ------------------------------------------------------------------ */

const STATE_META = {
  sourceId: "state-travel-advisory",
  sourceName: "U.S. Department of State Travel Advisory",
  sourceUrl: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html",
  dimension: "security" as const,
  freshness: "CURRENT_GUIDANCE" as const,
};

export async function stateAdvisoryAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  let payload: Row;
  try {
    payload = row(await ctx.internalJson(`/api/public-data/aor-risk?country=${encodeURIComponent(ctx.country.name)}`));
  } catch (error) {
    return result(ctx, STATE_META, "source_unavailable", [], errorText(error));
  }
  if (payload.found !== true) return result(ctx, STATE_META, "no_current_matching_finding", [], "No exact country match in the State Department advisory feeds.");
  const advisory = row(payload.advisory);
  const level = num(advisory.level);
  return result(ctx, STATE_META, "ok", [makeRecord(ctx, "state", {
    dimension: "security",
    category: "travel_advisory",
    subtype: "us_state_department",
    title: str(advisory.title) || `${ctx.country.name} Travel Advisory`,
    summary: str(advisory.summary).slice(0, 700),
    evidence: [level !== null ? `Level ${level}: ${str(advisory.levelLabel)}` : "", arr(advisory.riskFactors).map(str).filter(Boolean).join(", ")].filter(Boolean).join(" | "),
    severity: level !== null ? `Level ${level} — ${str(advisory.levelLabel)}` : str(advisory.levelLabel) || null,
    severityLevel: level,
    sourceName: STATE_META.sourceName,
    sourceUrl: str(advisory.sourceUrl) || STATE_META.sourceUrl,
    publishedAt: isoOrNull(advisory.updatedAt),
    updatedAt: isoOrNull(advisory.updatedAt),
    freshness: STATE_META.freshness,
    geometry: { type: "Country", iso2: ctx.country.iso2 },
    geographyLevel: "country",
    geographyNote: "Issued at country level; the full advisory may single out sub-national areas.",
    extra: { riskFactors: arr(advisory.riskFactors).map(str), cacheState: str(payload.cacheState) },
  })]);
}

const FCDO_META = {
  sourceId: "fcdo-travel-advice",
  sourceName: "UK FCDO Foreign Travel Advice",
  sourceUrl: "https://www.gov.uk/foreign-travel-advice",
  dimension: "security" as const,
  freshness: "CURRENT_GUIDANCE" as const,
};

const FCDO_SLUG_OVERRIDES: Record<string, string[]> = {
  US: ["usa"], CD: ["democratic-republic-of-the-congo"], CG: ["congo"], CI: ["cote-d-ivoire", "ivory-coast"], CZ: ["czech-republic", "czechia"],
  MM: ["myanmar-burma", "myanmar"], TR: ["turkey"], KR: ["south-korea"], KP: ["north-korea"], VA: ["holy-see", "vatican-city"],
  TL: ["timor-leste"], SZ: ["eswatini"], MK: ["north-macedonia"], PS: ["the-occupied-palestinian-territories", "israel-and-the-occupied-palestinian-territories"],
};

const FCDO_ALERT_LABELS: Record<string, { label: string; scope: "whole" | "parts"; level: number }> = {
  avoid_all_travel_to_whole_country: { label: "FCDO advises against all travel to the whole country", scope: "whole", level: 4 },
  avoid_all_but_essential_travel_to_whole_country: { label: "FCDO advises against all but essential travel to the whole country", scope: "whole", level: 3 },
  avoid_all_travel_to_parts: { label: "FCDO advises against all travel to parts of the country", scope: "parts", level: 2 },
  avoid_all_but_essential_travel_to_parts: { label: "FCDO advises against all but essential travel to parts of the country", scope: "parts", level: 1 },
};

export function fcdoSlugs(name: string, iso2: string): string[] {
  const generic = normalize(name).replace(/\s+/g, "-");
  return [...new Set([...(FCDO_SLUG_OVERRIDES[iso2] || []), generic, generic.replace(/^the-/, "")].filter(Boolean))];
}

export async function fcdoAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  let lastError = "";
  let notFound = 0;
  const slugs = fcdoSlugs(ctx.country.name, ctx.country.iso2);
  for (const slugValue of slugs) {
    const url = `https://www.gov.uk/api/content/foreign-travel-advice/${slugValue}`;
    let payload: Row;
    try {
      payload = row(await ctx.externalJson(url, { headers: { Accept: "application/json" }, timeoutMs: 15_000 }));
    } catch (error) {
      const message = errorText(error);
      if (/404|not found/i.test(message)) { notFound += 1; continue; }
      lastError = message;
      continue;
    }
    const details = row(payload.details);
    const alerts = arr(details.alert_status).map(str).filter(Boolean);
    const pageUrl = `https://www.gov.uk/foreign-travel-advice/${slugValue}`;
    const known = alerts.map((alert) => FCDO_ALERT_LABELS[alert]).filter(Boolean);
    const worst = known.sort((a, b) => b.level - a.level)[0];
    const wholeCountry = known.some((alert) => alert.scope === "whole");
    return result(ctx, { ...FCDO_META, sourceUrl: pageUrl }, "ok", [makeRecord(ctx, "fcdo", {
      dimension: "security",
      category: "travel_advice",
      subtype: "uk_fcdo",
      title: str(payload.title) || `${ctx.country.name} travel advice`,
      summary: known.length ? known.map((alert) => alert.label).join("; ") : "No FCDO advice-against-travel flag is set on the current advice page.",
      evidence: [alerts.length ? `alert_status: ${alerts.join(", ")}` : "alert_status: none", str(details.change_description)].filter(Boolean).join(" | ").slice(0, 600),
      severity: worst ? worst.label : "No FCDO advice-against-travel flag",
      severityLevel: null,
      sourceName: FCDO_META.sourceName,
      sourceUrl: pageUrl,
      publishedAt: isoOrNull(payload.first_published_at),
      updatedAt: isoOrNull(payload.public_updated_at),
      freshness: FCDO_META.freshness,
      geometry: wholeCountry ? { type: "Country", iso2: ctx.country.iso2 } : { type: "None" },
      geographyLevel: wholeCountry ? "country" : known.length ? "text_only" : "country",
      geographyNote: known.length && !wholeCountry ? "FCDO restricts only parts of the country; the affected areas are described in the advice text and are not drawn." : null,
      extra: { alertStatus: alerts },
    })]);
  }
  if (lastError) return result(ctx, FCDO_META, "source_unavailable", [], lastError);
  return result(ctx, FCDO_META, "source_returned_no_data", [], `No FCDO travel advice page found (${notFound} slug candidates tried).`);
}

/* ------------------------------------------------------------------ */
/* NASA POWER climatology (historical/climatological, not current)     */
/* ------------------------------------------------------------------ */

const POWER_META = {
  sourceId: "nasa-power",
  sourceName: "NASA POWER climatology",
  sourceUrl: "https://power.larc.nasa.gov/",
  dimension: "environment" as const,
  freshness: "HISTORICAL_CLIMATOLOGICAL" as const,
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

function monthly(parameter: unknown): Array<{ month: string; value: number }> {
  const values = row(parameter);
  return MONTHS.flatMap((month) => {
    const value = num(values[month]);
    return value === null || value <= -900 ? [] : [{ month, value }];
  });
}

export async function nasaPowerAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const center = ctx.country.center;
  if (!center) return result(ctx, POWER_META, "not_applicable", [], "No reference coordinates are available for this country.");
  const [lon, lat] = center;
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M_MAX,T2M_MIN,RH2M&community=SB&longitude=${lon}&latitude=${lat}&format=JSON`;
  let payload: Row;
  try {
    payload = row(await ctx.externalJson(url, { headers: { Accept: "application/json" }, timeoutMs: 25_000 }));
  } catch (error) {
    return result(ctx, POWER_META, "source_unavailable", [], errorText(error));
  }
  const parameter = row(row(payload.properties).parameter);
  const tMax = monthly(parameter.T2M_MAX);
  const tMin = monthly(parameter.T2M_MIN);
  const rh = monthly(parameter.RH2M);
  if (!tMax.length && !tMin.length && !rh.length) return result(ctx, POWER_META, "source_returned_no_data", [], "NASA POWER returned no usable climatology values.");
  const hottest = [...tMax].sort((a, b) => b.value - a.value)[0];
  const coldest = [...tMin].sort((a, b) => a.value - b.value)[0];
  const humid = [...rh].sort((a, b) => b.value - a.value)[0];
  const reference = ctx.country.capital ? `${ctx.country.capital} (country reference point)` : "country reference point";
  const summaryParts = [
    hottest ? `Hottest month ${hottest.month}: mean daily maximum ${hottest.value.toFixed(1)}°C` : "",
    coldest ? `coldest month ${coldest.month}: mean daily minimum ${coldest.value.toFixed(1)}°C` : "",
    humid ? `highest mean relative humidity ${humid.value.toFixed(0)}% (${humid.month})` : "",
  ].filter(Boolean);
  return result(ctx, POWER_META, "ok", [makeRecord(ctx, "power", {
    dimension: "environment",
    category: "climatology",
    subtype: "temperature_humidity_climatology",
    title: `Climatological heat, cold and humidity — ${reference}`,
    summary: `${summaryParts.join("; ")}.`,
    evidence: `NASA POWER climatology at ${lat.toFixed(2)}, ${lon.toFixed(2)}: ${summaryParts.join("; ")}.`,
    sourceName: POWER_META.sourceName,
    sourceUrl: POWER_META.sourceUrl,
    freshness: POWER_META.freshness,
    geometry: { type: "Point", coordinates: [lon, lat] },
    geographyLevel: "point",
    geographyNote: "Long-term climatology at a single reference point. It is not a country-wide measurement and not a current observation.",
    extra: { hottestMonth: hottest ?? null, coldestMonth: coldest ?? null, mostHumidMonth: humid ?? null, referencePoint: [lon, lat] },
  })]);
}

/* ------------------------------------------------------------------ */
/* Medical access: structural baseline from the reviewed profile       */
/* ------------------------------------------------------------------ */

const MEDICAL_META = {
  sourceId: "aor-baseline-profile",
  sourceName: "AOR reviewed country baseline (structural)",
  sourceUrl: "",
  dimension: "medical_access" as const,
  freshness: "STRUCTURAL_DATA" as const,
};

export async function medicalAccessAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const profile = getAorCountryProfileByIso2(ctx.country.iso2);
  if (!profile) return result(ctx, MEDICAL_META, "no_current_matching_finding", [], "No reviewed baseline profile exists for this country.");
  return result(ctx, MEDICAL_META, "ok", [makeRecord(ctx, "baseline", {
    dimension: "medical_access",
    category: "health_system_structure",
    subtype: "medical_access_baseline",
    title: `Medical access baseline — tier: ${profile.medicalAccessTier}`,
    summary: profile.medicalAccess,
    evidence: `${profile.medicalAccess} Evacuation: ${profile.escalationEvacuation}`.slice(0, 900),
    severity: `Reviewer baseline tier: ${profile.medicalAccessTier}`,
    sourceName: "AOR_Global_Country_Profiles_MapTiler.xlsx (reviewed 2026-08-10)",
    sourceUrl: "",
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "Country", iso2: ctx.country.iso2 },
    geographyLevel: "country",
    geographyNote: "Reviewer-curated country orientation; not a facility inventory, bed/capacity count, or live status. Facilities shown on a map do not imply capability.",
    extra: { evacuation: profile.escalationEvacuation, watchItems: profile.reviewWatchItems },
  })]);
}

/* ------------------------------------------------------------------ */
/* Sources not yet built in this slice: reported explicitly            */
/* ------------------------------------------------------------------ */

export function pendingAdapters(ctx: AdapterContext): AdapterResult[] {
  const pending = (sourceId: string, sourceName: string, sourceUrl: string, dimension: AdapterResult["dimension"], note: string) =>
    result(ctx, { sourceId, sourceName, sourceUrl, dimension, freshness: null }, "not_evaluated", [], note);
  return [
    pending("who-rsv-sars2", "WHO RSV and SARS-CoV-2 country surveillance", "https://www.who.int/teams/global-influenza-programme/surveillance-and-monitoring", "outbreaks", "Not connected. Only influenza (FluNet) is evaluated; absence of RSV or SARS-CoV-2 signals here means nothing."),
    pending("malaria-admin-geometry", "Admin-level malaria risk geometry", "https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/malaria.html", "malaria", "No machine-readable authoritative admin-level risk geometry is connected. Provinces, states, regions, islands and border areas named in the CDC text are listed with their stated seasonality and per-place elevation limits, not drawn. A terrain elevation limit is drawn only when the CDC text states one for the whole country."),
  ];
}
