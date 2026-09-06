import { Router, type IRouter } from "express";

const router: IRouter = Router();
const CACHE_TTL = 6 * 60 * 60_000;
const DESTINATION_STALE_TTL = 24 * 60 * 60_000;
const NOTICE_CACHE_TTL = 30 * 60_000;
const cache = new Map<string, { expiresAt: number; value: string }>();
const destinationCache = new Map<string, { expiresAt: number; staleUntil: number; raw: string; sourceUrl: string; slug: string }>();

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

const NOTICE_LEVELS: Record<number, { label: string; action: string }> = {
  4: { label: "Avoid All Travel", action: "Avoid travel unless traveling for humanitarian aid or emergency response." },
  3: { label: "Reconsider Nonessential Travel", action: "Reconsider nonessential travel." },
  2: { label: "Practice Enhanced Precautions", action: "Practice enhanced precautions and follow the notice's additional protective measures." },
  1: { label: "Practice Usual Precautions", action: "Practice usual precautions and follow destination guidance." },
};

type SourceLink = { label: string; url: string };
type RichCell = { text: string; links: SourceLink[] };

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

function absoluteCdcUrl(href: string) {
  if (!href) return "";
  try {
    return new URL(decodeEntities(href), "https://wwwnc.cdc.gov").toString();
  } catch {
    return "";
  }
}

function linksFromHtml(value: string): SourceLink[] {
  const links = [...value.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ label: plainText(match[2]), url: absoluteCdcUrl(match[1]) }))
    .filter((link) => link.label && link.url);
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}|${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function richTableRows(raw: string): RichCell[][] {
  const rows: RichCell[][] = [];
  for (const rowMatch of raw.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => ({
      text: plainText(match[1]),
      links: linksFromHtml(match[1]),
    }));
    if (cells.length && cells.some((cell) => cell.text || cell.links.length)) rows.push(cells);
  }
  return rows;
}

function headingDiseases(raw: string) {
  return [...raw.matchAll(/<h(?:3|4)\b[^>]*>([\s\S]*?)<\/h(?:3|4)>/gi)]
    .map((match) => plainText(match[1]))
    .filter((name) => name && !/clinical guidance|how most people get sick|advice|avoid animals|avoid bug bites|avoid contaminated|stay healthy|non-vaccine/i.test(name))
    .map((name) => ({ name, transmission: "", advice: "Review CDC destination guidance", clinicalGuidance: [] as SourceLink[], category: "Other" }));
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

async function fetchText(url: string, timeoutMs = 18_000, ttl = CACHE_TTL) {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
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
    cache.set(url, { expiresAt: Date.now() + ttl, value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

function validateDestinationPage(raw: string) {
  if (!/<html|<!doctype/i.test(raw)) throw new Error("CDC Travelers' Health returned an unexpected response format.");
  const hasVaccines = /Vaccines and Medicines/i.test(raw);
  const hasSafety = /Non-Vaccine-Preventable Diseases|Stay Healthy and Safe/i.test(raw);
  if (!hasVaccines || !hasSafety) throw new Error("CDC Travelers' Health destination page did not contain the expected destination guidance sections.");
}

async function fetchDestination(country: string) {
  const key = normalize(country);
  const now = Date.now();
  const hit = destinationCache.get(key);
  if (hit && hit.expiresAt > now) return { ...hit, cacheState: "fresh" as const };

  let lastError: unknown = null;
  try {
    for (const slug of slugCandidates(country)) {
      const sourceUrl = `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${encodeURIComponent(slug)}`;
      try {
        // The destination cache owns the six-hour freshness window; use a zero-TTL
        // fetch here so an expired destination entry genuinely attempts refresh.
        const raw = await fetchText(sourceUrl, 18_000, 0);
        validateDestinationPage(raw);
        const cached = { raw, sourceUrl, slug, expiresAt: Date.now() + CACHE_TTL, staleUntil: Date.now() + CACHE_TTL + DESTINATION_STALE_TTL };
        destinationCache.set(key, cached);
        return { ...cached, cacheState: "refreshed" as const };
      } catch (error) {
        lastError = error;
        const status = (error as Error & { status?: number })?.status;
        if (status !== 404) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("CDC destination page was not found.");
  } catch (error) {
    if (hit && hit.staleUntil > now) return { ...hit, cacheState: "stale" as const };
    throw error;
  }
}

function diseaseCategory(value: string) {
  const key = normalize(value);
  if (/contaminated food|food and water/.test(key)) return "Food / water";
  if (/bug bites|insect|mosquito|tick|sand fly/.test(key)) return "Vector-borne";
  if (/airborne|droplet|respiratory/.test(key)) return "Airborne / droplet";
  if (/animal/.test(key)) return "Animal exposure";
  if (/freshwater|water contact/.test(key)) return "Freshwater / environmental";
  return value || "Other";
}

function parseTravelHealth(country: string, raw: string, sourceUrl: string, cacheState: "fresh" | "refreshed" | "stale") {
  const vaccineSection = section(raw, "Vaccines and Medicines", "Non-Vaccine-Preventable Diseases");
  const diseaseSection = section(raw, "Non-Vaccine-Preventable Diseases", "Stay Healthy and Safe");
  const noticeSection = section(raw, "Travel Health Notices", "Vaccines and Medicines");

  const vaccineRows = richTableRows(vaccineSection)
    .filter((cells) => cells.length >= 2)
    .map((cells) => ({
      name: cells[0]?.text || "",
      recommendation: cells[1]?.text || "",
      status: recommendationStatus(cells[1]?.text || ""),
      diseaseLinks: cells[0]?.links || [],
      clinicalGuidance: cells.slice(2).flatMap((cell) => cell.links),
      recommendationLinks: cells[1]?.links || [],
    }))
    .filter((row) => row.name && !/vaccines? for disease|recommendations|clinical guidance/i.test(row.name));

  const malaria = vaccineRows.find((row) => /malaria/i.test(row.name)) ?? null;
  const yellowFever = vaccineRows.find((row) => /yellow fever/i.test(row.name)) ?? null;
  const vaccines = uniqueByName(vaccineRows.filter((row) => !/malaria/i.test(row.name))).slice(0, 30);

  const rawDiseaseRows = richTableRows(diseaseSection);
  let currentCategory = "Other";
  const tableDiseases: Array<{ name: string; transmission: string; advice: string; clinicalGuidance: SourceLink[]; diseaseLinks: SourceLink[]; adviceLinks: SourceLink[]; category: string }> = [];
  for (const cells of rawDiseaseRows) {
    if (cells.length === 1 || (cells.length > 1 && cells.slice(1).every((cell) => !cell.text && !cell.links.length))) {
      const candidate = cells[0]?.text || "";
      if (/avoid contaminated|avoid bug bites|airborne|droplet|animal|freshwater|environment/i.test(candidate)) currentCategory = diseaseCategory(candidate);
      continue;
    }
    const name = cells[0]?.text || "";
    if (!name || /disease name|common ways|clinical guidance|avoid bug bites|avoid contaminated|airborne/i.test(name)) continue;
    tableDiseases.push({
      name,
      transmission: cells[1]?.text || "",
      advice: cells[2]?.text || "",
      clinicalGuidance: cells.slice(3).flatMap((cell) => cell.links),
      diseaseLinks: cells[0]?.links || [],
      adviceLinks: cells[2]?.links || [],
      category: currentCategory,
    });
  }
  const diseases = uniqueByName(tableDiseases.length ? tableDiseases : headingDiseases(diseaseSection)).slice(0, 40);

  const notices = [...noticeSection.matchAll(/<h(?:3|4)\b[^>]*>([\s\S]*?)<\/h(?:3|4)>/gi)]
    .map((match) => plainText(match[1]))
    .filter((value) => value && !/travel health notices/i.test(value))
    .slice(0, 12);

  const updatedMatch = raw.match(/Updated\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
  return {
    ok: true,
    available: true,
    country,
    source: "CDC Travelers' Health",
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    cacheState,
    sourceUpdated: updatedMatch?.[1] || null,
    vaccines,
    malaria,
    yellowFever,
    diseases,
    notices,
    clinicalGuidanceLinks: [...vaccines, ...(malaria ? [malaria] : []), ...(yellowFever ? [yellowFever] : [])]
      .flatMap((row) => row.clinicalGuidance || [])
      .filter((link, index, all) => all.findIndex((candidate) => candidate.url === link.url) === index),
    limitation: "CDC destination guidance is general travel-health information. Recommendations can vary by itinerary, duration, activities, age, pregnancy, immune status, medical history, and current entry requirements; confirm current guidance before travel.",
  };
}

function inferNoticeCountries(text: string) {
  const countries: string[] = [];
  for (const match of text.matchAll(/(?:Country|Destination) List\s*:\s*([^<\n]+?)(?=(?:Country|Destination) List\s*:|$)/gi)) {
    const cleaned = plainText(match[1]).replace(/\b(?:New|Updated)\b.*$/i, "");
    for (const country of cleaned.split(/,\s*/)) {
      const value = country.trim().replace(/^the\s+/i, "");
      if (value && value.length < 80) countries.push(value);
    }
  }
  const titleMatch = plainText(text).match(/\b(?:in|for)\s+([A-Z][A-Za-zÀ-ÿ'’(). -]{2,60})(?:\s+August|\s+July|\s+June|\s+May|\s+April|\s+March|\s+February|\s+January|\s+September|\s+October|\s+November|\s+December|$)/);
  if (titleMatch?.[1]) countries.push(titleMatch[1].trim());
  const explicit = [
    ["Democratic Republic of the Congo", /Democratic Republic of the Congo|\bDRC\b/i],
    ["Uganda", /\bUganda\b/i], ["Indonesia", /\bIndonesia\b/i], ["Nicaragua", /\bNicaragua\b/i],
    ["Costa Rica", /\bCosta Rica\b/i], ["Yemen", /\bYemen\b/i], ["French Guiana", /\bFrench Guiana\b/i],
    ["Mayotte", /\bMayotte\b/i], ["Mauritius", /\bMauritius\b/i], ["Venezuela", /\bVenezuela\b/i],
    ["Suriname", /\bSuriname\b/i], ["Bolivia", /\bBolivia\b/i], ["Seychelles", /\bSeychelles\b/i],
    ["Colombia", /\bColombia\b/i], ["Haiti", /\bHaiti\b/i], ["Canada", /\bCanada\b/i], ["Mexico", /\bMexico\b/i],
  ] as const;
  const flat = plainText(text);
  for (const [name, pattern] of explicit) if (pattern.test(flat)) countries.push(name);
  return [...new Set(countries.map((value) => value.replace(/\s+Provinces?.*$/i, "").trim()).filter(Boolean))];
}

function parseTravelNotices(raw: string) {
  const notices: Array<{ level: number; levelLabel: string; action: string; title: string; date: string | null; summary: string; url: string; countries: string[]; status: "new" | "updated" | "active" }> = [];
  const headingMatches = [...raw.matchAll(/<h3\b[^>]*>\s*Level\s+([1-4])\s*-\s*([^<]+)<\/h3>/gi)];
  for (let index = 0; index < headingMatches.length; index += 1) {
    const match = headingMatches[index];
    const level = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = headingMatches[index + 1]?.index ?? raw.toLowerCase().indexOf("types of notices", start);
    const segment = raw.slice(start, end > start ? end : raw.length);
    const anchors = [...segment.matchAll(/<a\b[^>]*href=["']([^"']*\/travel\/notices\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const seen = new Set<string>();
    for (const anchor of anchors) {
      const url = absoluteCdcUrl(anchor[1]);
      const title = plainText(anchor[2]).replace(/^Read More\s*>*>?$/i, "").trim();
      if (!url || !title || title.length < 5 || seen.has(url) || /read more/i.test(title)) continue;
      seen.add(url);
      const localStart = Math.max(0, (anchor.index ?? 0) - 500);
      const localEnd = Math.min(segment.length, (anchor.index ?? 0) + anchor[0].length + 900);
      const context = segment.slice(localStart, localEnd);
      const contextText = plainText(context);
      const date = contextText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/)?.[0] || null;
      const status: "new" | "updated" | "active" = /\bNew\b/i.test(contextText) ? "new" : /\bUpdated\b/i.test(contextText) ? "updated" : "active";
      let summary = contextText;
      const titleAt = summary.indexOf(title);
      if (titleAt >= 0) summary = summary.slice(titleAt + title.length);
      if (date) summary = summary.replace(date, "");
      summary = summary.replace(/^(?:\d+\s*)?(?:New|Updated)?\s*/i, "").replace(/Read More\s*>*>?.*$/i, "").trim();
      if (summary.length > 700) summary = summary.slice(0, 700).trim();
      const meta = NOTICE_LEVELS[level] || { label: match[2].trim(), action: "Review CDC notice." };
      notices.push({ level, levelLabel: meta.label, action: meta.action, title, date, summary, url, countries: inferNoticeCountries(`${title} ${context}`), status });
    }
  }
  const deduped = new Map<string, (typeof notices)[number]>();
  for (const notice of notices) {
    const existing = deduped.get(notice.url);
    if (!existing || notice.level > existing.level) deduped.set(notice.url, notice);
  }
  return [...deduped.values()].sort((a, b) => b.level - a.level || String(b.date || "").localeCompare(String(a.date || "")));
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
        clinicalGuidanceLinks: [],
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
      clinicalGuidanceLinks: [],
      error: error instanceof Error ? error.message.slice(0, 240) : "CDC Travelers' Health request failed.",
      sourceNotice: "CDC Travelers' Health is temporarily unavailable for this destination; no values were substituted.",
    });
  }
});

router.get("/aor/travel-notices", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const sourceUrl = "https://wwwnc.cdc.gov/travel/notices";
  try {
    const raw = await fetchText(sourceUrl, 18_000, NOTICE_CACHE_TTL);
    const notices = parseTravelNotices(raw);
    return res.json({
      ok: true,
      source: "CDC Travel Health Notices",
      sourceUrl,
      retrievedAt: new Date().toISOString(),
      definitions: NOTICE_LEVELS,
      notices,
      counts: notices.reduce<Record<string, number>>((acc, notice) => { acc[String(notice.level)] = (acc[String(notice.level)] || 0) + 1; return acc; }, {}),
      limitation: "Travel Health Notices are live CDC alerts. Geographic matching is based on destinations explicitly named by CDC and should not be interpreted as a comprehensive country risk score.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, source: "CDC Travel Health Notices", sourceUrl, notices: [], error: error instanceof Error ? error.message : "CDC Travel Health Notices are temporarily unavailable." });
  }
});

export default router;
