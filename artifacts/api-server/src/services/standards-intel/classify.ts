import type { Classification, DocClass, SourceDefinition } from "./types";

/** Evidence-based categories: a category is assigned only when the document's own text contains one of its terms. Terms are recorded as evidence. */
export const CATEGORY_RULES: Array<{ id: string; label: string; patterns: RegExp[] }> = [
  { id: "occupational_medicine", label: "Occupational medicine and surveillance", patterns: [/medical surveillance/i, /medical (?:examination|evaluation|monitoring|removal)/i, /occupational (?:medicine|health|physician)/i, /health surveillance/i, /biological monitoring/i, /fitness for duty/i, /work-related (?:illness|injur)/i, /workers'? compensation/i, /physician or other licensed health care professional/i] },
  { id: "industrial_hygiene", label: "Industrial hygiene and hazardous exposure", patterns: [/permissible exposure/i, /exposure limit/i, /\bPEL\b/, /\bTLV\b/, /hazard(?:ous)? (?:communication|chemical|substance)/i, /silica/i, /asbestos/i, /\blead\b.*(?:exposure|standard)/i, /benzene/i, /air contaminant/i, /carcinogen/i, /industrial hygiene/i, /heat illness|heat stress|extreme heat/i, /toxic substance/i] },
  { id: "respiratory", label: "Respiratory protection", patterns: [/respirator/i, /respiratory protection/i, /\bN95\b/i, /fit[- ]test/i, /black lung|pneumoconiosis/i, /respirable/i] },
  { id: "hearing", label: "Hearing conservation", patterns: [/hearing (?:conservation|loss|protection)/i, /occupational noise/i, /noise exposure/i, /audiometr/i] },
  { id: "infectious_disease", label: "Workplace infectious diseases", patterns: [/infectious disease/i, /bloodborne pathogen/i, /tubercul/i, /\bCOVID/i, /influenza|\bflu\b/i, /measles/i, /outbreak/i, /infection control/i, /pandemic/i, /\bmpox\b/i, /hepatitis/i] },
  { id: "commercial_driver", label: "Commercial driver medical standards", patterns: [/commercial driver/i, /\bCDL\b/, /\bFMCSA\b/, /medical examiner/i, /medical certificate.*driver|driver.*medical/i, /national registry of certified medical examiners/i, /motor carrier/i, /49 CFR (?:part )?391/i] },
  { id: "aviation", label: "Aviation medical standards", patterns: [/airman/i, /aviation medical|aerospace medicine/i, /medical certificat(?:e|ion).*(?:pilot|airman)/i, /14 CFR (?:part )?67/i, /\bpilot\b.*medical|medical.*\bpilot\b/i, /air traffic controller/i] },
  { id: "emergency_response", label: "Emergency response and firefighting", patterns: [/firefight/i, /emergency (?:response|responder)/i, /\bHAZWOPER\b/i, /fire (?:brigade|department|protection)/i, /\bNFPA\b/] },
  { id: "maritime", label: "Maritime and offshore occupations", patterns: [/maritime/i, /merchant mariner/i, /\bshipyard/i, /longshor/i, /offshore/i, /vessel crew|seafarer/i, /coast guard/i] },
  { id: "construction_mining_energy", label: "Construction, mining, energy, and manufacturing", patterns: [/construction/i, /\bmin(?:e|er|ers|ing)\b/i, /\bMSHA\b/, /coal/i, /oil and gas|petroleum|energy sector/i, /manufacturing/i, /nuclear/i, /excavat/i] },
  { id: "laboratory_diagnostics", label: "Laboratory and diagnostic testing", patterns: [/clinical laborator/i, /\bCLIA\b/, /diagnostic test/i, /laboratory test/i, /in vitro diagnostic/i, /specimen/i, /toxicology/i] },
  { id: "vaccination", label: "Vaccination and occupational immunization", patterns: [/vaccin/i, /immuniz/i, /\bACIP\b/] },
  { id: "drug_safety", label: "Medical products and drug safety", patterns: [/drug safety/i, /adverse (?:event|reaction)/i, /\brecall\b/i, /medical device/i, /biological product/i, /\bmedwatch\b/i, /controlled substance/i, /drug (?:and alcohol )?test/i, /\bmarijuana|cannabis/i, /opioid/i, /safety communication/i] },
  { id: "employment_exams", label: "Employment medical examinations", patterns: [/pre-?employment/i, /\bADA\b|americans with disabilities/i, /reasonable accommodation/i, /disability.*employ|employ.*disabilit/i, /medical inquir/i, /genetic information nondiscrimination|\bGINA\b/i, /return[- ]to[- ]work/i, /medical qualification/i] },
  { id: "privacy_records", label: "Healthcare privacy and records", patterns: [/\bHIPAA\b/i, /health information (?:privacy|technology|exchange)/i, /protected health information/i, /medical records?/i, /access to employee exposure and medical records/i, /confidentiality of (?:health|medical)/i] },
  { id: "environmental_safety", label: "Environmental and workplace safety", patterns: [/workplace safety/i, /occupational safety/i, /safety and health/i, /fatal(?:ity|ities)/i, /injur(?:y|ies) and illness/i, /workplace violence/i, /fall protection/i, /machine guarding/i, /recordkeeping/i, /\bOSHA\b/, /heat injury/i] },
  { id: "international", label: "International occupational health", patterns: [/\bILO\b|international labour/i, /european union|\bEU\b/, /\bWHO\b|world health organization/i, /United Kingdom|\bHSE\b/, /\bIARC\b/] },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORY_RULES.map((rule) => [rule.id, rule.label]));

const INDUSTRY_RULES: Array<{ id: string; patterns: RegExp[] }> = [
  { id: "general_industry", patterns: [/general industry/i, /29 CFR (?:part )?1910/i] },
  { id: "construction", patterns: [/construction/i, /29 CFR (?:part )?1926/i] },
  { id: "mining", patterns: [/\bmin(?:e|er|ers|ing)\b/i, /\bMSHA\b/, /coal/i] },
  { id: "energy_utilities", patterns: [/oil and gas|petroleum|energy|electric power|nuclear|utility/i] },
  { id: "manufacturing", patterns: [/manufactur/i, /chemical plant/i] },
  { id: "transportation_trucking", patterns: [/commercial motor vehicle|motor carrier|commercial driver|trucking|\bCDL\b/i, /railroad|rail(?:way)? workers/i] },
  { id: "aviation", patterns: [/airman|aviation|aircraft|pilot|air traffic/i] },
  { id: "maritime", patterns: [/maritime|merchant mariner|shipyard|longshor|vessel|offshore/i] },
  { id: "healthcare", patterns: [/health ?care (?:worker|personnel|facilit|setting)|hospital|nursing home|clinical/i] },
  { id: "emergency_services", patterns: [/firefight|emergency responder|first responder|law enforcement|police/i] },
  { id: "agriculture", patterns: [/agricultur|farm ?work|pesticide/i] },
  { id: "laboratories", patterns: [/laborator/i] },
  { id: "federal_contractors_government", patterns: [/federal (?:employee|contractor)|department of defense|\bDoD\b|military/i] },
];

export const INDUSTRY_IDS = INDUSTRY_RULES.map((rule) => rule.id);

export const APPLICABILITY_NOTE = "Classification reflects the issuer's own wording. Whether a document applies to a particular employer, worker, or contract has not been determined.";

export function classify(input: { title: string; summary: string; categories?: string[]; cfrRefs?: string[]; source: SourceDefinition }): Classification {
  const text = [input.title, input.summary, ...(input.categories ?? []), ...(input.cfrRefs ?? [])].join(" \n ");
  const evidence: Classification["evidence"] = [];
  for (const rule of CATEGORY_RULES) {
    const terms = new Set<string>();
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) terms.add(match[0].trim().toLowerCase());
    }
    if (terms.size) evidence.push({ category: rule.id, terms: [...terms].slice(0, 5) });
  }
  // "environmental_safety" and "international" are weak, generic matches. They do not on their own establish occupational-health relevance for broad feeds.
  const categories = evidence.map((entry) => entry.category);
  const industries = INDUSTRY_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map((rule) => rule.id);
  const strong = evidence.filter((entry) => entry.category !== "environmental_safety" && entry.category !== "international");
  const matchedTerms = evidence.reduce((sum, entry) => sum + entry.terms.length, 0);
  const classificationConfidence = Math.min(0.95, categories.length ? 0.45 + 0.1 * Math.min(matchedTerms, 4) + (strong.length ? 0.1 : 0) : 0);
  return {
    categories, industries, topic: (strong[0] ?? evidence[0])?.category ?? null, evidence,
    classificationConfidence: Number(classificationConfidence.toFixed(2)),
  };
}

/** True when the item's own text carries at least one occupational-health signal. "international" alone (a bare mention of WHO or the EU) is not one. */
export function isOccupationallyRelevant(classification: Classification): boolean {
  return classification.categories.some((category) => category !== "international");
}

export function relevanceStatement(classification: Classification): string {
  const strong = classification.evidence.filter((entry) => entry.category !== "environmental_safety" && entry.category !== "international");
  if (!strong.length) return "No direct occupational-medicine indicators were found in the issuer's text.";
  return `The issuer's text refers to: ${strong.map((entry) => `${CATEGORY_LABELS[entry.category] ?? entry.category} (${entry.terms.slice(0, 3).join(", ")})`).join("; ")}.`;
}

export function docClassFor(source: SourceDefinition, docType: string | null, text: string): DocClass {
  if (source.docClass === "index") return "index";
  if (source.method === "federal_register_api") {
    if (docType === "RULE" || docType === "PRORULE") return "binding_regulation";
    if (/guidance|interpretation|recommendation|policy statement|compliance (?:guide|policy)/i.test(text)) return "official_guidance";
    return "announcement";
  }
  return source.docClass;
}
