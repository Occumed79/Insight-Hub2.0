import type { AdapterContext, AdapterResult, EvidenceRecord } from "./types";
import { arr, errorText, isoOrNull, makeRecord, normalize, num, result, row, str, type Row } from "./util";

const DAY = 86_400_000;

/** Case-insensitive field read for sources whose column casing is not guaranteed. */
function pick(source: Row, key: string): unknown {
  if (key in source) return source[key];
  const wanted = key.toLowerCase();
  for (const [name, value] of Object.entries(source)) if (name.toLowerCase() === wanted) return value;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* CDC Yellow Book reference chapters (existing /api/aor/yellow-book)  */
/* Reference context only. A chapter is attached to a country solely   */
/* through CDC/WHO evidence already retrieved for that country; the    */
/* book never asserts country risk on its own.                         */
/* ------------------------------------------------------------------ */

const YB_META = {
  sourceId: "yellow-book-reference",
  sourceName: "CDC Yellow Book 2026 (reference chapters)",
  sourceUrl: "https://www.cdc.gov/yellow-book/",
  dimension: "multi" as const,
  freshness: "STRUCTURAL_DATA" as const,
};

type YellowBookProfile = {
  title: string;
  aliases: string[];
  pages: [number, number];
  sourceDate: string;
  endemicity: string;
  atRisk: string;
  prevention: string;
  transmission: string;
  keyNotes: string[];
  flags: Record<string, boolean>;
  operationalRules: string[];
  sourceAssets: Array<{ type: string; id: string; page: number; title: string; excerpt: string }>;
};

const LINKABLE_CATEGORIES = new Set(["travel_vaccine", "routine_vaccine", "destination_disease_risk", "entry_requirement", "malaria", "travel_health_notice", "disease_outbreak_news", "respiratory_surveillance"]);

function aliasesOf(profile: YellowBookProfile): string[] {
  const base = profile.title.replace(/\(.*?\)/g, " ");
  return [...new Set([...profile.aliases, base].map(normalize).filter((alias) => alias.length >= 4))];
}

export async function yellowBookAdapter(ctx: AdapterContext, evidence: EvidenceRecord[]): Promise<AdapterResult> {
  let payload: Row;
  try {
    payload = row(await ctx.internalJson("/api/aor/yellow-book"));
  } catch (error) {
    return result(ctx, YB_META, "source_unavailable", [], errorText(error));
  }
  const profiles = arr(payload.profiles).map((item) => item as YellowBookProfile);
  if (!profiles.length) return result(ctx, YB_META, "source_returned_no_data", [], "The Yellow Book reference route returned no chapters.");

  const candidates = evidence.filter((record) => LINKABLE_CATEGORIES.has(record.category));
  const records: EvidenceRecord[] = [];
  for (const profile of profiles) {
    const aliases = aliasesOf(profile);
    const linked: Array<{ evidenceId: string; matchedOn: string }> = [];
    for (const record of candidates) {
      const haystack = ` ${normalize(`${record.subtype} ${record.title}`)} `;
      const hit = aliases.find((alias) => haystack.includes(` ${alias} `));
      if (hit) linked.push({ evidenceId: record.id, matchedOn: hit });
    }
    if (!linked.length) continue;
    const isMalaria = normalize(profile.title) === "malaria";
    records.push(makeRecord(ctx, "yellowbook", {
      dimension: isMalaria ? "malaria" : "health_vaccines",
      category: "yellow_book_reference",
      subtype: profile.title,
      title: `Yellow Book reference — ${profile.title}`,
      summary: `${profile.endemicity}. Prevention: ${profile.prevention}`.slice(0, 520),
      evidence: [profile.prevention, ...(profile.keyNotes ?? []).slice(0, 2)].filter(Boolean).join(" | ").slice(0, 900),
      sourceName: `${YB_META.sourceName}, chapter pp. ${profile.pages?.[0]}–${profile.pages?.[1]}`,
      sourceUrl: YB_META.sourceUrl,
      publishedAt: isoOrNull(profile.sourceDate),
      freshness: "STRUCTURAL_DATA",
      geometry: { type: "None" },
      geographyLevel: "text_only",
      geographyNote: "Disease-level reference chapter. It is attached to this country only through the linked CDC/WHO evidence records and does not state country-specific risk by itself. Current country guidance and notices come from the live sources.",
      extra: {
        profileTitle: profile.title,
        pages: profile.pages,
        chapterDate: profile.sourceDate,
        endemicity: profile.endemicity,
        atRisk: profile.atRisk,
        prevention: profile.prevention,
        transmission: profile.transmission,
        keyNotes: profile.keyNotes,
        operationalRules: profile.operationalRules ?? [],
        sourceAssets: profile.sourceAssets ?? [],
        linkedEvidence: linked,
      },
    }));
  }
  if (!records.length) return result(ctx, YB_META, "no_current_matching_finding", [], "No Yellow Book chapter could be linked to this country's retrieved CDC/WHO items.");
  return result(ctx, YB_META, "ok", records, "Reference context linked through CDC/WHO items; it is not a substitute for current destination guidance.");
}

/* ------------------------------------------------------------------ */
/* WHO FluNet influenza surveillance (weekly, reporting-lagged)        */
/* ------------------------------------------------------------------ */

const FLUNET_META = {
  sourceId: "who-flunet",
  sourceName: "WHO FluNet influenza surveillance",
  sourceUrl: "https://www.who.int/tools/flunet",
  dimension: "outbreaks" as const,
  freshness: "WEEKLY_SURVEILLANCE" as const,
};
const FLUNET_BASE = "https://xmart-api-public.who.int/FLUMART/VIW_FNT";

type FluWeek = { start: string; processed: number | null; infA: number | null; infB: number | null; all: number | null };

export async function whoFluNetAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const { iso2, iso3 } = ctx.country;
  const year = ctx.now().getUTCFullYear();
  const filter = `(COUNTRY_CODE eq '${iso3}' or COUNTRY_CODE eq '${iso2}') and ISO_YEAR ge ${year - 1}`;
  const url = `${FLUNET_BASE}?$filter=${encodeURIComponent(filter)}&$orderby=${encodeURIComponent("ISO_YEAR desc,ISO_WEEK desc")}&$top=120&$format=json`;
  let payload: unknown;
  try {
    payload = await ctx.externalJson(url, { headers: { Accept: "application/json" }, timeoutMs: 30_000 });
  } catch (error) {
    return result(ctx, FLUNET_META, "source_unavailable", [], errorText(error));
  }
  const rows = (Array.isArray(payload) ? payload : arr(row(payload).value)).map(row);
  if (!rows.length) return result(ctx, FLUNET_META, "source_returned_no_data", [], `FluNet returned no reports for ${ctx.country.name} since ${year - 1}. The country may not report to FluNet; this is not evidence of no circulation.`);

  const weeks: FluWeek[] = rows.flatMap((item) => {
    const isoYear = num(pick(item, "ISO_YEAR"));
    const isoWeek = num(pick(item, "ISO_WEEK"));
    const start = isoOrNull(pick(item, "ISO_WEEKSTARTDATE")) ?? null;
    if (!start || isoYear === null || isoWeek === null) return [];
    const infA = num(pick(item, "INF_A"));
    const infB = num(pick(item, "INF_B"));
    const allRaw = num(pick(item, "ALL_INF"));
    const all = allRaw ?? (infA !== null || infB !== null ? (infA ?? 0) + (infB ?? 0) : null);
    return [{ start, processed: num(pick(item, "SPEC_PROCESSED_NB")), infA, infB, all }];
  }).filter((week) => week.processed !== null || week.all !== null)
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  if (!weeks.length) return result(ctx, FLUNET_META, "source_returned_no_data", [], "FluNet rows were returned but none had recognizable specimen or influenza-positive counts (column names may have changed).");

  const latest = weeks[0];
  const recent = weeks.slice(0, 4);
  const processed4 = recent.reduce((sum, week) => sum + (week.processed ?? 0), 0);
  const positive4 = recent.reduce((sum, week) => sum + (week.all ?? 0), 0);
  const positivity4 = processed4 > 0 ? positive4 / processed4 : null;
  const ageDays = Math.floor((ctx.now().getTime() - Date.parse(latest.start)) / DAY);
  const staleReporting = ageDays > 56;
  const pct = positivity4 === null ? "not computable (no processed-specimen count)" : `${(positivity4 * 100).toFixed(1)}% of ${processed4} processed specimens`;
  const summary = `Latest FluNet week starting ${latest.start.slice(0, 10)}: ${latest.processed ?? "n/r"} specimens processed, ${latest.all ?? "n/r"} influenza-positive (A ${latest.infA ?? "n/r"}, B ${latest.infB ?? "n/r"}). Last ${recent.length} reporting week${recent.length === 1 ? "" : "s"} pooled: ${pct}.${staleReporting ? ` The latest report is ${ageDays} days old.` : ""}`;
  return result(ctx, FLUNET_META, "ok", [makeRecord(ctx, "flunet", {
    dimension: "outbreaks",
    category: "respiratory_surveillance",
    subtype: "influenza_flunet",
    title: `Influenza laboratory surveillance — ${ctx.country.name}`,
    summary,
    evidence: summary,
    sourceName: FLUNET_META.sourceName,
    sourceUrl: FLUNET_META.sourceUrl,
    publishedAt: latest.start,
    freshness: "WEEKLY_SURVEILLANCE",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: "National laboratory-network reports submitted to WHO with reporting lag. They describe tested specimens, not population incidence, and are not live telemetry. Only influenza is covered; RSV and SARS-CoV-2 are not connected.",
    extra: { weeks: weeks.slice(0, 8), positivity4Week: positivity4, processed4Week: processed4, positive4Week: positive4, reportingAgeDays: ageDays, staleReporting },
  })]);
}

/* ------------------------------------------------------------------ */
/* WHO/UNICEF WUENIC immunization coverage via existing /api/aor/immunization */
/* ------------------------------------------------------------------ */

const IMM_META = {
  sourceId: "who-immunization",
  sourceName: "WHO/UNICEF immunization coverage (WUENIC)",
  sourceUrl: "https://immunizationdata.who.int/",
  dimension: "health_vaccines" as const,
  freshness: "STRUCTURAL_DATA" as const,
};
const IMM_ITEMS: Array<{ item: string; label: string }> = [
  { item: "DTP3", label: "DTP3" },
  { item: "MCV1", label: "Measles-containing vaccine, dose 1 (MCV1)" },
  { item: "MCV2", label: "Measles-containing vaccine, dose 2 (MCV2)" },
  { item: "POL3", label: "Polio, 3rd dose (Pol3)" },
];

export async function whoImmunizationAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const settled = await Promise.all(IMM_ITEMS.map(async ({ item, label }) => {
    try {
      const payload = row(await ctx.internalJson(`/api/aor/immunization?dataset=wuenic&country=${encodeURIComponent(ctx.country.iso2)}&item=${encodeURIComponent(item)}`));
      return { item, label, payload, error: null as string | null };
    } catch (error) {
      return { item, label, payload: null, error: errorText(error) };
    }
  }));
  if (settled.every((entry) => entry.error)) return result(ctx, IMM_META, "source_unavailable", [], settled[0].error);

  const records: EvidenceRecord[] = [];
  const missing: string[] = [];
  for (const entry of settled) {
    if (!entry.payload) { missing.push(`${entry.item} (request failed)`); continue; }
    const rows = arr(entry.payload.rows).map(row).filter((item) => str(item.iso2) === ctx.country.iso2 || str(item.code) === ctx.country.iso3);
    const latest = [...rows].sort((a, b) => (num(b.year) ?? 0) - (num(a.year) ?? 0))[0];
    const coverage = latest ? num(latest.value) : null;
    if (!latest || coverage === null) { missing.push(`${entry.item} (no WUENIC estimate)`); continue; }
    const year = num(latest.year);
    const previous = num(latest.previousRevision);
    const grade = str(latest.gradeOfConfidenceLabel) || str(latest.gradeOfConfidence);
    const summary = `${entry.label} coverage ${coverage}% (WUENIC ${year ?? "year n/r"})${grade ? `; grade of confidence: ${grade}` : ""}.`;
    records.push(makeRecord(ctx, "wuenic", {
      dimension: "health_vaccines",
      category: "immunization_coverage",
      subtype: `wuenic_${entry.item.toLowerCase()}`,
      title: `${entry.label} coverage (${year ?? "n/r"})`,
      summary,
      evidence: `${summary}${str(latest.comment) ? ` WHO comment: ${str(latest.comment)}` : ""}`.slice(0, 700),
      sourceName: IMM_META.sourceName,
      sourceUrl: IMM_META.sourceUrl,
      freshness: "STRUCTURAL_DATA",
      geometry: { type: "None" },
      geographyLevel: "country",
      geographyNote: "National programme coverage estimate for the childhood schedule. It describes the resident population, not a traveler or deployed-worker recommendation, and is annual (not current).",
      extra: { antigen: entry.item, year, coveragePercent: coverage, previousRevision: previous, gradeOfConfidence: grade, administrativeCoverage: latest.administrativeCoverage ?? null, governmentEstimate: latest.governmentEstimate ?? null },
    }));
  }
  if (!records.length) return result(ctx, IMM_META, "no_current_matching_finding", [], `No WUENIC estimates were found for ${ctx.country.name}: ${missing.join("; ")}.`);
  return result(ctx, IMM_META, "ok", records, missing.length ? `Not available: ${missing.join("; ")}.` : null);
}

/* ------------------------------------------------------------------ */
/* WHO Global Health Observatory: structural health-system indicators  */
/* Indicator codes are resolved by exact catalogue name so a wrong     */
/* code can never be labelled with the wrong meaning.                  */
/* ------------------------------------------------------------------ */

const GHO_META = {
  sourceId: "who-gho",
  sourceName: "WHO Global Health Observatory",
  sourceUrl: "https://www.who.int/data/gho",
  dimension: "medical_access" as const,
  freshness: "STRUCTURAL_DATA" as const,
};
const GHO_BASE = "https://ghoapi.azureedge.net/api";
const GHO_TARGETS: Array<{ key: string; search: string; exact: RegExp; unit: string }> = [
  { key: "hospital_beds", search: "Hospital beds", exact: /^hospital beds \(per 10[\s ]?000 population\)$/i, unit: "per 10 000 population" },
  { key: "medical_doctors", search: "Medical doctors", exact: /^medical doctors \(per 10[\s ]?000 population\)$/i, unit: "per 10 000 population" },
  { key: "nursing_midwifery", search: "Nursing and midwifery", exact: /^nursing and midwifery personnel \(per 10[\s ]?000 population\)$/i, unit: "per 10 000 population" },
  { key: "uhc_index", search: "UHC service coverage index", exact: /^uhc service coverage index$/i, unit: "index (0–100)" },
];

const catalogues = new WeakMap<object, Map<string, Promise<{ code: string; name: string } | null>>>();

function resolveIndicator(ctx: AdapterContext, target: (typeof GHO_TARGETS)[number]): Promise<{ code: string; name: string } | null> {
  let byKey = catalogues.get(ctx.externalJson);
  if (!byKey) { byKey = new Map(); catalogues.set(ctx.externalJson, byKey); }
  const existing = byKey.get(target.key);
  if (existing) return existing;
  const pending = (async () => {
    const url = `${GHO_BASE}/Indicator?$filter=${encodeURIComponent(`contains(IndicatorName,'${target.search}')`)}`;
    const payload = row(await ctx.externalJson(url, { timeoutMs: 25_000 }));
    const match = arr(payload.value).map(row).find((item) => target.exact.test(str(item.IndicatorName)));
    return match ? { code: str(match.IndicatorCode), name: str(match.IndicatorName) } : null;
  })();
  pending.catch(() => byKey!.delete(target.key));
  byKey.set(target.key, pending);
  return pending;
}

export async function whoGhoAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const records: EvidenceRecord[] = [];
  const notes: string[] = [];
  let failures = 0;
  await Promise.all(GHO_TARGETS.map(async (target) => {
    try {
      const indicator = await resolveIndicator(ctx, target);
      if (!indicator) { notes.push(`${target.search}: indicator not found in the GHO catalogue`); return; }
      const url = `${GHO_BASE}/${encodeURIComponent(indicator.code)}?$filter=${encodeURIComponent(`SpatialDim eq '${ctx.country.iso3}'`)}&$orderby=${encodeURIComponent("TimeDim desc")}&$top=10`;
      const data = arr(row(await ctx.externalJson(url, { timeoutMs: 25_000 })).value).map(row);
      const latest = data.find((item) => num(item.NumericValue) !== null);
      if (!latest) { notes.push(`${indicator.name}: no value reported for ${ctx.country.name}`); return; }
      const value = num(latest.NumericValue) as number;
      const year = num(latest.TimeDim);
      const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
      records.push(makeRecord(ctx, "gho", {
        dimension: "medical_access",
        category: "health_system_indicator",
        subtype: target.key,
        title: `${indicator.name}${year ? ` — ${year}` : ""}`,
        summary: `${indicator.name}: ${display} ${target.unit}${year ? ` (${year})` : ""}.`,
        evidence: `WHO GHO ${indicator.code}: ${indicator.name} = ${display}${year ? ` in ${year}` : ""} for ${ctx.country.name}.`,
        sourceName: GHO_META.sourceName,
        sourceUrl: `${GHO_BASE}/${indicator.code}`,
        freshness: "STRUCTURAL_DATA",
        geometry: { type: "None" },
        geographyLevel: "country",
        geographyNote: "National average reported to WHO. It does not describe capacity, specialties, or access in any deployment area, and says nothing about the quality or availability of care at a given facility.",
        extra: { indicatorCode: indicator.code, indicatorName: indicator.name, value, unit: target.unit, year },
      }));
    } catch (error) {
      failures += 1;
      notes.push(`${target.search}: ${errorText(error)}`);
    }
  }));
  records.sort((a, b) => GHO_TARGETS.findIndex((t) => t.key === a.subtype) - GHO_TARGETS.findIndex((t) => t.key === b.subtype));
  if (!records.length) {
    return failures === GHO_TARGETS.length
      ? result(ctx, GHO_META, "source_unavailable", [], notes.join("; ").slice(0, 400))
      : result(ctx, GHO_META, "source_returned_no_data", [], notes.join("; ").slice(0, 400));
  }
  return result(ctx, GHO_META, "ok", records, notes.length ? notes.join("; ").slice(0, 400) : null);
}
