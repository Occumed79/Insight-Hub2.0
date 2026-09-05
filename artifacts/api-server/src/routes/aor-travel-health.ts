import { Router, type IRouter } from "express";

const router: IRouter = Router();
const CACHE_TTL = 6 * 60 * 60_000;
const CACHE_STALE_TTL = 24 * 60 * 60_000;
const cache = new Map<string, { expiresAt: number; staleUntil: number; value: string }>();

const COUNTRY_SLUG_ALIASES: Record<string, string[]> = {
  "united states": ["United-States"],
  "united states of america": ["United-States"],
  "united kingdom": ["United-Kingdom"],
  "united arab emirates": ["United-Arab-Emirates"],
  "south korea": ["South-Korea"],
  "north korea": ["North-Korea"],
  "cote d ivoire": ["Cote-d-Ivoire"],
  "democratic republic of the congo": ["democratic-republic-of-congo", "Democratic-Republic-of-Congo"],
  "democratic republic of congo": ["democratic-republic-of-congo", "Democratic-Republic-of-Congo"],
  "republic of the congo": ["Congo"],
  "republic of congo": ["Congo"],
  "timor leste": ["Timor-Leste"],
  "papua new guinea": ["Papua-New-Guinea"],
  "new zealand": ["New-Zealand"],
  "saudi arabia": ["Saudi-Arabia"],
  "south africa": ["South-Africa"],
  "south sudan": ["South-Sudan"],
  "sri lanka": ["Sri-Lanka"],
  "czech republic": ["Czechia", "Czech-Republic"],
  "czechia": ["Czechia"],
  "myanmar": ["Burma", "Myanmar"],
  "turkiye": ["Turkey", "Turkiye"],
};

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&deg;/gi, "°")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function plainText(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<li[^>]*>/gi, " • ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function section(raw: string, start: string, end: string) {
  const lower = raw.toLowerCase();
  const startAt = lower.indexOf(start.toLowerCase());
  if (startAt < 0) return "";
  const endAt = lower.indexOf(end.toLowerCase(), startAt + start.length);
  return raw.slice(startAt, endAt < 0 ? raw.length : endAt);
}

function tableRows(raw: string) {
  const rows: string[][] = [];
  for (const rowMatch of raw.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => plainText(match[1]));
    if (cells.length >= 2 && cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

function headingDiseases(raw: string) {
  return [...raw.matchAll(/<h(?:3|4)\b[^>]*>([\s\S]*?)<\/h(?:3|4)>/gi)]
    .map((match) => plainText(match[1]))
    .filter((name) => name && !/clinical guidance|how most people get sick|advice|avoid animals|avoid bug bites|avoid contaminated|stay healthy|non-vaccine/i.test(name))
    .map((name) => ({ name, transmission: "", advice: "Review CDC destination guidance" }));
}

function recommendationStatus(recommendation: string) {
  const normalized = normalize(recommendation);
  if (/not recommended|not required|no malaria transmission|none/.test(normalized)) return "not-routinely-recommended";
  if (/recommended|should be vaccinated|up to date|make sure you are up to date/.test(normalized)) return "recommended";
  if (/consider|may get|risk|some travelers/.test(normalized)) return "consider";
  return "review";
}

function uniqueByName<T extends { name: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function genericSlug(country: string) {
  return country
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

function slugCandidates(country: string) {
  const key = normalize(country);
  const aliases = COUNTRY_SLUG_ALIASES[key] ?? [];
  const generic = genericSlug(country);
  const withoutThe = generic.replace(/-Of-The-/i, "-Of-");
  return [...new Set([...aliases, generic, withoutThe].filter(Boolean))];
}

async function fetchText(url: string, timeoutMs = 18_000) {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return { value: hit.value, cacheState: "fresh" as const };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Occu-Med-Insight-Hub/2.0 AOR Travel Health",
      },
    });
    if (!response.ok) {
      const error = new Error(`CDC Travelers' Health returned HTTP ${response.status}.`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const value = await response.text();
    if (!/<html|<!doctype/i.test(value)) throw new Error("CDC Travelers' Health returned an unexpected response format.");
    cache.set(url, { expiresAt: Date.now() + CACHE_TTL, staleUntil: Date.now() + CACHE_TTL + CACHE_STALE_TTL, value });
    return { value, cacheState: "refreshed" as const };
  } catch (error) {
    if (hit && hit.staleUntil > Date.now()) return { value: hit.value, cacheState: "stale" as const };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDestination(country: string) {
  let lastError: unknown = null;
  for (const slug of slugCandidates(country)) {
    const sourceUrl = `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${encodeURIComponent(slug)}`;
    try {
      const loaded = await fetchText(sourceUrl);
      return { raw: loaded.value, cacheState: loaded.cacheState, sourceUrl, slug };
    } catch (error) {
      lastError = error;
      const status = (error as Error & { status?: number })?.status;
      if (status !== 404) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("CDC destination page was not found.");
}

function parseTravelHealth(country: string, raw: string, sourceUrl: string, cacheState: "fresh" | "refreshed" | "stale") {
  const vaccineSection = section(raw, "Vaccines and Medicines", "Non-Vaccine-Preventable Diseases");
  const diseaseSection = section(raw, "Non-Vaccine-Preventable Diseases", "Stay Healthy and Safe");
  const noticeSection = section(raw, "Travel Health Notices", "Vaccines and Medicines");

  const vaccineRows = tableRows(vaccineSection)
    .map((cells) => ({
      name: cells[0],
      recommendation: cells[1] || "",
      status: recommendationStatus(cells[1] || ""),
    }))
    .filter((row) => row.name && !/vaccines? for disease|recommendations|clinical guidance/i.test(row.name));

  const malaria = vaccineRows.find((row) => /malaria/i.test(row.name)) ?? null;
  const yellowFever = vaccineRows.find((row) => /yellow fever/i.test(row.name)) ?? null;
  const vaccines = uniqueByName(vaccineRows.filter((row) => !/malaria/i.test(row.name))).slice(0, 18);

  const tableDiseases = tableRows(diseaseSection)
    .map((cells) => ({
      name: cells[0],
      transmission: cells[1] || "",
      advice: cells[2] || "",
    }))
    .filter((row) => row.name && !/disease name|common ways|clinical guidance|avoid bug bites|avoid contaminated|airborne/i.test(row.name));
  const diseases = uniqueByName(tableDiseases.length ? tableDiseases : headingDiseases(diseaseSection)).slice(0, 16);

  const notices = [...noticeSection.matchAll(/<h(?:3|4)\b[^>]*>([\s\S]*?)<\/h(?:3|4)>/gi)]
    .map((match) => plainText(match[1]))
    .filter((value) => value && !/travel health notices/i.test(value))
    .slice(0, 6);

  return {
    ok: true,
    available: true,
    country,
    source: "CDC Travelers' Health",
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    cacheState,
    vaccines,
    malaria,
    yellowFever,
    diseases,
    notices,
    limitation: "CDC destination guidance is general travel-health information. Recommendations can vary by itinerary, duration, activities, age, pregnancy, immune status, medical history, and current entry requirements; confirm current guidance before travel.",
  };
}

router.get("/aor/travel-health", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const country = String(req.query.country || "").trim().slice(0, 100);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });

  try {
    const { raw, cacheState, sourceUrl } = await fetchDestination(country);
    const parsed = parseTravelHealth(country, raw, sourceUrl, cacheState);
    if (!parsed.vaccines.length && !parsed.diseases.length) {
      return res.status(502).json({
        ok: false,
        available: false,
        country,
        source: "CDC Travelers' Health",
        sourceUrl,
        vaccines: [],
        malaria: null,
        yellowFever: null,
        diseases: [],
        notices: [],
        sourceNotice: "CDC destination guidance loaded, but structured travel-health rows could not be extracted reliably.",
      });
    }
    return res.json(parsed);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      available: false,
      country,
      source: "CDC Travelers' Health",
      sourceUrl: "https://wwwnc.cdc.gov/travel/destinations/list",
      vaccines: [],
      malaria: null,
      yellowFever: null,
      diseases: [],
      notices: [],
      error: error instanceof Error ? error.message.slice(0, 240) : "CDC Travelers' Health request failed.",
      sourceNotice: "CDC Travelers' Health is temporarily unavailable for this destination; no values were substituted.",
    });
  }
});

export default router;
