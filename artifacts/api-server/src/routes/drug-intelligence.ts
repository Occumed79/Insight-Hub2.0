import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const CACHE_TTL = 10 * 60_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type Row = Record<string, unknown>;
type MedicationInput = { rxcui: string; name: string };
type SignalDefinition = {
  id: string;
  label: string;
  domain: string;
  patterns: RegExp[];
};

const SIGNALS: SignalDefinition[] = [
  { id: "alertness", label: "Alertness / psychomotor", domain: "Safety-sensitive work", patterns: [/somnolence/i, /sedation/i, /drows(?:y|iness)/i, /dizziness/i, /ataxia/i, /coordination/i, /psychomotor/i, /driv(?:e|ing).{0,60}(?:caution|impair|avoid|ability)/i, /operat(?:e|ing).{0,60}machin/i] },
  { id: "syncope-hypotension", label: "Syncope / hypotension", domain: "Heights / exertion / driving", patterns: [/syncope/i, /orthostatic/i, /hypotension/i, /faint(?:ing)?/i] },
  { id: "respiratory-depression", label: "Respiratory depression", domain: "Respiratory / safety-sensitive", patterns: [/respiratory depression/i, /hypoventilation/i, /respiratory arrest/i] },
  { id: "hypoglycemia", label: "Hypoglycemia", domain: "Safety-sensitive / remote work", patterns: [/hypoglyc/i] },
  { id: "bleeding", label: "Bleeding / hemorrhage", domain: "Trauma consequence", patterns: [/bleeding/i, /hemorrhag/i, /haemorrhag/i] },
  { id: "cardiac-rhythm", label: "Cardiac rhythm / QT", domain: "Cardiovascular monitoring", patterns: [/QT prolong/i, /torsad/i, /arrhythm/i, /bradycard/i, /ventricular tachy/i] },
  { id: "heat-hydration", label: "Heat / hydration / electrolytes", domain: "Environmental tolerance", patterns: [/dehydration/i, /electrolyte/i, /hyponatrem/i, /hypokalem/i, /hyperkalem/i, /heat prostration/i, /heat intolerance/i] },
  { id: "photosensitivity", label: "Photosensitivity", domain: "Outdoor work", patterns: [/photosensitiv/i, /phototoxic/i] },
  { id: "vision", label: "Visual disturbance", domain: "Driving / precision work", patterns: [/blurred vision/i, /visual disturbance/i, /vision blurred/i, /diplopia/i] },
  { id: "seizure", label: "Seizure / convulsion", domain: "Safety-sensitive work", patterns: [/seizure/i, /convulsion/i] },
  { id: "cognitive-behavioral", label: "Cognitive / behavioral effects", domain: "Judgment / concentration", patterns: [/confusion/i, /cognitive/i, /impaired concentration/i, /agitation/i, /hallucination/i, /suicid/i] },
  { id: "renal", label: "Renal function / dosing", domain: "Monitoring / deployment continuity", patterns: [/renal impairment/i, /renal function/i, /kidney function/i] },
  { id: "hepatic", label: "Hepatic function", domain: "Monitoring / deployment continuity", patterns: [/hepatic impairment/i, /hepatic failure/i, /liver function/i, /hepatotoxic/i] },
  { id: "infection", label: "Serious infection / immunosuppression", domain: "Exposure / remote care", patterns: [/serious infection/i, /opportunistic infection/i, /immunosuppress/i] },
  { id: "tendon", label: "Tendon / connective-tissue injury", domain: "Physical-demand work", patterns: [/tendon rupture/i, /tendinitis/i, /tendonitis/i] },
];

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}
function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const single = text(value);
  return single ? [single] : [];
}
function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function compact(value: string, max = 2400) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trim()}…`;
}
function excerpt(value: string, pattern: RegExp, radius = 230) {
  const match = pattern.exec(value);
  if (!match || match.index == null) return compact(value, radius * 2);
  const start = Math.max(0, match.index - radius);
  const end = Math.min(value.length, match.index + match[0].length + radius);
  return compact(`${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`, radius * 2 + 40);
}
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function baseMedicationName(name: string) {
  return name
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|meq)\b/gi, " ")
    .replace(/\b(oral|tablet|capsule|solution|suspension|injection|injectable|extended release|delayed release|topical|cream|ointment|patch|spray|inhalation|intravenous|subcutaneous)\b/gi, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function openFdaKey(params: URLSearchParams) {
  const key = clean(process.env.OPENFDA_API_KEY || process.env.FDA_API_KEY, 200);
  if (key) params.set("api_key", key);
}

async function fetchJson(url: string, timeoutMs = 12_000, allow404 = false): Promise<unknown | null> {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 drug-intelligence" },
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
    const value = await response.json();
    cache.set(url, { expiresAt: Date.now() + CACHE_TTL, value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveRxNormIdentity(rxcui: string, fallbackName: string) {
  const [propertiesPayload, relatedPayload] = await Promise.all([
    fetchJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(rxcui)}/properties.json`).catch(() => null),
    fetchJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=IN+PIN`).catch(() => null),
  ]);

  const properties = record(record(propertiesPayload).properties);
  const groups = array(record(record(relatedPayload).relatedGroup).conceptGroup);
  const ingredients = unique(groups.flatMap((rawGroup) => {
    const group = record(rawGroup);
    return array(group.conceptProperties).map((rawConcept) => text(record(rawConcept).name)).filter(Boolean);
  }));

  const canonicalName = text(properties.name) || fallbackName;
  return {
    rxcui,
    canonicalName,
    synonym: text(properties.synonym),
    termType: text(properties.tty),
    ingredients: ingredients.length ? ingredients : unique([baseMedicationName(canonicalName), baseMedicationName(fallbackName)]),
    source: "NLM RxNorm",
    sourceUrl: `https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(rxcui)}/properties.json`,
  };
}

async function resolveRxClasses(rxcui: string) {
  try {
    const payload = record(await fetchJson(`https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=${encodeURIComponent(rxcui)}`));
    const root = record(payload.rxclassDrugInfoList);
    const rows = array(root.rxclassDrugInfo).flatMap((raw) => {
      const item = record(raw);
      const classItem = record(item.rxclassMinConceptItem);
      const className = text(classItem.className);
      if (!className) return [];
      return [{
        classId: text(classItem.classId),
        className,
        classType: text(classItem.classType),
        relationship: text(item.rela),
        relationshipSource: text(item.relaSource),
      }];
    });
    const deduped = new Map<string, (typeof rows)[number]>();
    rows.forEach((item) => deduped.set(`${item.classId}|${item.className}|${item.relationshipSource}`, item));
    return Array.from(deduped.values()).slice(0, 18);
  } catch {
    return [];
  }
}

async function searchOpenFda(query: string) {
  const params = new URLSearchParams({ search: query, limit: "10" });
  openFdaKey(params);
  const payload = await fetchJson(`https://api.fda.gov/drug/label.json?${params}`, 14_000, true);
  if (!payload) return [];
  return array(record(payload).results).map(record);
}

async function resolveOpenFdaLabel(rxcui: string, ingredientNames: string[], fallbackName: string) {
  let results = await searchOpenFda(`openfda.rxcui:\"${rxcui}\"`).catch(() => []);
  const names = unique([...ingredientNames, baseMedicationName(fallbackName)]).filter((name) => name.length >= 3);
  if (!results.length) {
    for (const name of names.slice(0, 3)) {
      results = await searchOpenFda(`openfda.generic_name:\"${name.replace(/\"/g, "")}\"`).catch(() => []);
      if (results.length) break;
      results = await searchOpenFda(`openfda.brand_name:\"${name.replace(/\"/g, "")}\"`).catch(() => []);
      if (results.length) break;
    }
  }
  if (!results.length) return null;

  results.sort((a, b) => Number(text(b.effective_time) || 0) - Number(text(a.effective_time) || 0));
  const label = results[0];
  const openfda = record(label.openfda);
  const setId = text(label.set_id) || text(label.id);
  const sections = {
    boxedWarning: stringArray(label.boxed_warning).join("\n\n"),
    warningsAndCautions: stringArray(label.warnings_and_cautions).join("\n\n") || stringArray(label.warnings).join("\n\n"),
    adverseReactions: stringArray(label.adverse_reactions).join("\n\n"),
    drugInteractions: stringArray(label.drug_interactions).join("\n\n"),
    contraindications: stringArray(label.contraindications).join("\n\n"),
    precautions: stringArray(label.precautions).join("\n\n"),
    patientCounseling: stringArray(label.patient_counseling_information).join("\n\n") || stringArray(label.information_for_patients).join("\n\n"),
    useInSpecificPopulations: stringArray(label.use_in_specific_populations).join("\n\n"),
  };

  return {
    setId,
    effectiveTime: text(label.effective_time),
    genericNames: stringArray(openfda.generic_name),
    brandNames: stringArray(openfda.brand_name),
    manufacturers: stringArray(openfda.manufacturer_name),
    routes: stringArray(openfda.route),
    dosageForms: stringArray(openfda.dosage_form),
    pharmClassEpc: stringArray(openfda.pharm_class_epc),
    pharmClassMoa: stringArray(openfda.pharm_class_moa),
    sections,
    source: "FDA Structured Product Labeling via openFDA",
    sourceUrl: `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(`openfda.rxcui:\"${rxcui}\"`)}&limit=1`,
    dailyMedUrl: setId ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}` : "https://dailymed.nlm.nih.gov/dailymed/",
  };
}

function deriveSignals(label: Awaited<ReturnType<typeof resolveOpenFdaLabel>>) {
  if (!label) return [];
  const searchableSections: Array<[string, string]> = [
    ["Boxed Warning", label.sections.boxedWarning],
    ["Warnings and Precautions", label.sections.warningsAndCautions],
    ["Adverse Reactions", label.sections.adverseReactions],
    ["Drug Interactions", label.sections.drugInteractions],
    ["Contraindications", label.sections.contraindications],
    ["Patient Counseling", label.sections.patientCounseling],
  ];
  const signals = SIGNALS.flatMap((definition) => {
    for (const [section, sectionText] of searchableSections) {
      if (!sectionText) continue;
      for (const pattern of definition.patterns) {
        if (pattern.test(sectionText)) {
          return [{
            id: definition.id,
            label: definition.label,
            domain: definition.domain,
            section,
            evidence: excerpt(sectionText, pattern),
            source: "FDA product labeling",
          }];
        }
      }
    }
    return [];
  });
  return signals;
}

async function loadDrugIntelligence(input: MedicationInput) {
  const identity = await resolveRxNormIdentity(input.rxcui, input.name);
  const [classes, label] = await Promise.all([
    resolveRxClasses(input.rxcui),
    resolveOpenFdaLabel(input.rxcui, identity.ingredients, identity.canonicalName),
  ]);
  const signals = deriveSignals(label);
  const fdaClassNames = unique([...(label?.pharmClassEpc || []), ...(label?.pharmClassMoa || [])]);
  return {
    medication: { rxcui: input.rxcui, name: input.name },
    identity,
    classes,
    fdaClassNames,
    label: label ? {
      ...label,
      sections: Object.fromEntries(Object.entries(label.sections).map(([key, value]) => [key, compact(value, 4200)])),
    } : null,
    signals,
    coverage: {
      rxnorm: Boolean(identity.canonicalName),
      rxclass: classes.length > 0,
      fdaLabel: Boolean(label),
      signalCount: signals.length,
    },
    limitation: "Label-derived occupational signals identify source text that may matter to a reviewer. They do not establish impairment, severity, causation, or fitness for duty.",
  };
}

function mentionTerms(profile: Awaited<ReturnType<typeof loadDrugIntelligence>>) {
  const values = unique([
    ...profile.identity.ingredients,
    baseMedicationName(profile.identity.canonicalName),
    baseMedicationName(profile.medication.name),
  ]).map(normalize).filter((value) => value.length >= 4);
  const expanded = new Set<string>(values);
  values.forEach((value) => {
    const first = value.split(" ")[0];
    if (first.length >= 5) expanded.add(first);
  });
  return Array.from(expanded);
}

function findRegimenMentions(profiles: Awaited<ReturnType<typeof loadDrugIntelligence>>[]) {
  const mentions: Array<{ fromRxcui: string; fromDrug: string; toRxcui: string; toDrug: string; section: string; evidence: string }> = [];
  profiles.forEach((source) => {
    const sectionText = source.label?.sections?.drugInteractions || "";
    if (!sectionText) return;
    const normalizedSection = normalize(sectionText);
    profiles.forEach((target) => {
      if (source.medication.rxcui === target.medication.rxcui) return;
      const term = mentionTerms(target).find((candidate) => normalizedSection.includes(candidate));
      if (!term) return;
      const loosePattern = new RegExp(escapeRegExp(term).replace(/\\ /g, "\\s+"), "i");
      mentions.push({
        fromRxcui: source.medication.rxcui,
        fromDrug: source.identity.canonicalName,
        toRxcui: target.medication.rxcui,
        toDrug: target.identity.canonicalName,
        section: "FDA Drug Interactions",
        evidence: excerpt(sectionText, loosePattern),
      });
    });
  });
  const seen = new Set<string>();
  return mentions.filter((item) => {
    const key = `${item.fromRxcui}|${item.toRxcui}|${item.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildOverlapSignals(profiles: Awaited<ReturnType<typeof loadDrugIntelligence>>[]) {
  const buckets = new Map<string, { id: string; label: string; domain: string; medications: Array<{ rxcui: string; name: string; evidence: string; section: string }> }>();
  profiles.forEach((profile) => {
    profile.signals.forEach((signal) => {
      const bucket = buckets.get(signal.id) || { id: signal.id, label: signal.label, domain: signal.domain, medications: [] };
      bucket.medications.push({ rxcui: profile.medication.rxcui, name: profile.identity.canonicalName, evidence: signal.evidence, section: signal.section });
      buckets.set(signal.id, bucket);
    });
  });
  return Array.from(buckets.values()).filter((bucket) => new Set(bucket.medications.map((item) => item.rxcui)).size >= 2);
}

router.get("/reviewer-tools/drug-intelligence", async (req: Request, res: Response) => {
  const rxcui = clean(req.query.rxcui, 40);
  const name = clean(req.query.name, 180);
  if (!/^\d+$/.test(rxcui) || !name) return res.status(400).json({ ok: false, error: "A numeric RxCUI and medication name are required." });
  try {
    const profile = await loadDrugIntelligence({ rxcui, name });
    return res.json({ ok: true, ...profile, sources: ["NLM RxNorm", "NLM RxClass", "FDA Structured Product Labeling / openFDA", "DailyMed label link"] });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Drug intelligence sources are unavailable." });
  }
});

router.post("/reviewer-tools/drug-regimen", async (req: Request, res: Response) => {
  const body = record(req.body);
  const medications = array(body.medications).flatMap((raw) => {
    const item = record(raw);
    const rxcui = clean(item.rxcui, 40);
    const name = clean(item.name, 180);
    return /^\d+$/.test(rxcui) && name ? [{ rxcui, name }] : [];
  }).slice(0, 8);
  if (medications.length < 2) return res.status(400).json({ ok: false, error: "Select at least two valid medications for regimen review." });
  try {
    const profiles = await Promise.all(medications.map(loadDrugIntelligence));
    const overlaps = buildOverlapSignals(profiles);
    const interactionMentions = findRegimenMentions(profiles);
    return res.json({
      ok: true,
      medications: profiles.map((profile) => ({
        medication: profile.medication,
        identity: profile.identity,
        coverage: profile.coverage,
        signals: profile.signals,
      })),
      overlaps,
      interactionMentions,
      coverage: {
        selected: profiles.length,
        fdaLabels: profiles.filter((profile) => profile.coverage.fdaLabel).length,
        rxClasses: profiles.filter((profile) => profile.coverage.rxclass).length,
        medicationsWithSignals: profiles.filter((profile) => profile.signals.length > 0).length,
      },
      limitation: "This regimen view does not calculate a drug-drug interaction severity score. Overlaps mean multiple selected labels contain the same occupationally relevant signal. Interaction mentions mean one selected product's FDA Drug Interactions section explicitly mentions another selected medication or ingredient; absence of a mention is not evidence of safety.",
      sources: ["NLM RxNorm", "NLM RxClass", "FDA Structured Product Labeling / openFDA"],
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Regimen intelligence sources are unavailable." });
  }
});

export default router;
