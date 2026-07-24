import { Router, type Response } from "express";
import { db, entitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const SNAPSHOT_KEY = "organizationalChart";
const QUALITY_VERSION = 2;
const MAX_QUALITY_PEOPLE = 80;

type Confidence = "confirmed" | "probable" | "inferred";
type LeadershipLevel = "board" | "executive" | "senior-leadership" | "director" | "manager" | "individual-contributor" | "unknown";

type Evidence = {
  url?: string;
  label?: string;
  sourceType?: "official" | "sec" | "press" | "public-web";
  snippet?: string;
  fetchedAt?: string;
};

type Person = {
  id: string;
  name: string;
  title: string;
  level: LeadershipLevel;
  department?: string;
  location?: string;
  bio?: string;
  confidence: Confidence;
  sourceUrls: string[];
  evidence: Evidence[];
};

type Edge = {
  fromId: string;
  toId: string;
  relationship: "explicit-reporting-line" | "inferred-title-hierarchy";
  confidence: Confidence;
  note: string;
};

type LeadershipResult = {
  companyName: string;
  startedAt: string;
  completedAt: string;
  people: Person[];
  edges: Edge[];
  gaps: Array<{ level: LeadershipLevel; label: string; reason: string }>;
  sources: Array<Record<string, unknown>>;
  warnings: string[];
  summary: {
    people: number;
    confirmed: number;
    probable: number;
    inferred: number;
    levels: number;
    sourcesAnalyzed: number;
    gaps: number;
  };
  methodology: string;
  entityId?: number;
  savedAt?: string;
  savedToDatabase?: boolean;
  [key: string]: unknown;
};

type SavedSnapshot = {
  version?: number;
  savedAt: string;
  result: LeadershipResult;
  sourceInputs?: Record<string, unknown>;
};

const NON_PERSON_PATTERN = /\b(?:board|boards|committee|committees|governance|proxy|proxies|proposal|proposals|vote|votes|voting|shareholder|shareholders|stock|exchange|university|college|school|institute|orchestra|foundation|corporation|company|companies|llc|inc|group|holdco|funding|services|policy|policies|program|experience|information|statement|report|section|class|directors?|executives?|officers?|leadership|management|compensation|retainer|assignment|articles?|ownership|nomination|nominating|nominee|nominees|independence|qualification|requirements?|principles?|overview|events?|news|press|method|methods|number|notice|contact|relations|development|sustainability|strategy|human\s+capital|corporate|charitable|conflict|recommend|recommendation|election|current\s+board|quick\s+facts|restated|amended|beneficial|security|securities|annual\s+meeting|stockholder|stockholders|how\s+many|how\s+does|why\s+invest|view\s+all|take\s+the|our\s+sustainability|all\s+board|directors\s+standing|directors\s+recommend)\b/i;
const LEADERSHIP_TITLE_PATTERN = /\b(?:chief(?:\s+[a-z&/-]+){0,5}\s+officer|ceo|cfo|coo|cio|cto|cmo|chro|president|vice\s+president|svp|evp|chair|chairman|chairwoman|chairperson|board\s+member|independent\s+director|non-executive\s+director|director|managing\s+director|general\s+counsel|deputy\s+general\s+counsel|corporate\s+secretary|treasurer|controller|general\s+manager|country\s+manager|head\s+of|manager|supervisor|program\s+manager|committee\s+chair|founder|partner)\b/i;
const TITLE_NOISE_PATTERN = /\b(?:proposal|proxy|vote|voting|article|section|information|experience|qualification|requirement|policy|principle|current\s+board\s+size|directors\s+since|directors\s+whose|nominee\s+below|recommend|stock\s+quote|press\s+release|news|overview)\b/i;
const NAME_TOKEN_PATTERN = /^(?:[A-Z]\.|[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]{1,24})$/;
const TITLE_STOP_WORDS = new Set(["and", "of", "the", "for", "to", "at", "a", "an", "senior", "executive"]);

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, max = 1_000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalize(value: unknown): string {
  return cleanText(value, 2_000)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function confidenceRank(value: Confidence): number {
  return value === "confirmed" ? 3 : value === "probable" ? 2 : 1;
}

function levelRank(level: LeadershipLevel): number {
  return ({ board: 0, executive: 1, "senior-leadership": 2, director: 3, manager: 4, "individual-contributor": 5, unknown: 6 })[level];
}

function isLikelyHumanName(value: unknown): boolean {
  const name = cleanText(value, 120);
  if (name.length < 4 || name.length > 90 || /\d|[!?;:{}<>]/.test(name)) return false;
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return false;
  if (NON_PERSON_PATTERN.test(name)) return false;
  if (!tokens.every((token) => NAME_TOKEN_PATTERN.test(token))) return false;

  const lexicalTokens = tokens.filter((token) => !/^[A-Z]\.$/.test(token));
  if (lexicalTokens.length < 2) return false;
  if (lexicalTokens.some((token) => token.length < 2)) return false;

  // All-uppercase names are common in filings, but long all-uppercase phrases are usually headings.
  const allUpper = lexicalTokens.every((token) => token === token.toUpperCase());
  if (allUpper && lexicalTokens.length > 4) return false;
  return true;
}

function isLikelyLeadershipTitle(value: unknown): boolean {
  const title = cleanText(value, 240);
  const words = title.split(/\s+/).filter(Boolean);
  if (!title || title.length > 170 || words.length > 18 || /[?]/.test(title)) return false;
  if (TITLE_NOISE_PATTERN.test(title)) return false;
  return LEADERSHIP_TITLE_PATTERN.test(title);
}

function titleEvidenceTokens(title: string): string[] {
  return normalize(title)
    .split(" ")
    .filter((token) => token.length >= 3 && !TITLE_STOP_WORDS.has(token))
    .slice(0, 8);
}

function evidenceSupportsPerson(person: Person): boolean {
  const nameTokens = normalize(person.name).split(" ").filter(Boolean);
  const lastName = nameTokens.at(-1) || "";
  const firstName = nameTokens[0] || "";
  const titleTokens = titleEvidenceTokens(person.title);
  if (!lastName || titleTokens.length === 0) return false;

  return Array.isArray(person.evidence) && person.evidence.some((item) => {
    const snippet = normalize(item?.snippet);
    if (!snippet || !snippet.includes(lastName)) return false;
    const hasName = snippet.includes(`${firstName} ${lastName}`)
      || (firstName.length > 1 && snippet.includes(firstName) && snippet.includes(lastName));
    const hasTitle = titleTokens.some((token) => snippet.includes(token)) || LEADERSHIP_TITLE_PATTERN.test(String(item?.snippet || ""));
    return hasName && hasTitle;
  });
}

function qualityPerson(person: Person): Person | null {
  const name = cleanText(person?.name, 120);
  const title = cleanText(person?.title, 200);
  if (!isLikelyHumanName(name) || !isLikelyLeadershipTitle(title)) return null;
  const normalizedPerson: Person = {
    ...person,
    name,
    title,
    sourceUrls: Array.isArray(person.sourceUrls) ? person.sourceUrls.filter((url) => /^https?:\/\//i.test(String(url))).slice(0, 12) : [],
    evidence: Array.isArray(person.evidence) ? person.evidence.filter((item) => item && typeof item === "object").slice(0, 12) : [],
  };
  if (!evidenceSupportsPerson(normalizedPerson)) return null;
  if (normalizedPerson.level === "unknown") return null;

  const hasPrimaryEvidence = normalizedPerson.evidence.some((item) => item.sourceType === "official" || item.sourceType === "sec");
  const confidence: Confidence = hasPrimaryEvidence && normalizedPerson.confidence === "confirmed" ? "confirmed" : "probable";
  return { ...normalizedPerson, confidence };
}

function titleScore(title: string): number {
  const normalized = normalize(title);
  let score = LEADERSHIP_TITLE_PATTERN.test(title) ? 20 : 0;
  score += Math.max(0, 12 - normalized.split(" ").length);
  if (/chief|president|vice president|director|general counsel|treasurer|secretary|controller|manager/.test(normalized)) score += 8;
  if (TITLE_NOISE_PATTERN.test(title)) score -= 30;
  return score;
}

function mergeQualityPeople(people: Person[]): Person[] {
  const merged = new Map<string, Person>();
  for (const rawPerson of people) {
    const person = qualityPerson(rawPerson);
    if (!person) continue;
    const key = normalize(person.name).replace(/\b(?:jr|sr|ii|iii|iv)\b/g, "").trim();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, person);
      continue;
    }
    const stronger = confidenceRank(person.confidence) > confidenceRank(existing.confidence)
      ? person
      : confidenceRank(person.confidence) < confidenceRank(existing.confidence)
        ? existing
        : titleScore(person.title) > titleScore(existing.title) ? person : existing;
    const weaker = stronger === person ? existing : person;
    merged.set(key, {
      ...weaker,
      ...stronger,
      sourceUrls: Array.from(new Set([...(existing.sourceUrls || []), ...(person.sourceUrls || [])])).slice(0, 12),
      evidence: [...(existing.evidence || []), ...(person.evidence || [])]
        .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url && candidate.snippet === item.snippet) === index)
        .slice(0, 12),
    });
  }

  return Array.from(merged.values())
    .sort((left, right) => levelRank(left.level) - levelRank(right.level) || left.name.localeCompare(right.name))
    .slice(0, MAX_QUALITY_PEOPLE);
}

function buildGaps(people: Person[]): LeadershipResult["gaps"] {
  const has = (level: LeadershipLevel) => people.some((person) => person.level === level);
  const gaps: LeadershipResult["gaps"] = [];
  if (!has("board")) gaps.push({ level: "board", label: "Board or governing body", reason: "No source-supported board members survived the strict person-quality review." });
  if (!people.some((person) => /chief executive|\bceo\b|president/i.test(person.title))) gaps.push({ level: "executive", label: "Chief executive", reason: "No source-supported chief executive or president was identified." });
  if (!has("senior-leadership")) gaps.push({ level: "senior-leadership", label: "Vice presidents / business-unit leaders", reason: "No source-supported vice-president or comparable layer was identified." });
  if (!has("director")) gaps.push({ level: "director", label: "Director layer", reason: "No source-supported director layer was identified." });
  if (!has("manager")) gaps.push({ level: "manager", label: "Management layer", reason: "Public sources rarely expose the full manager layer." });
  return gaps;
}

function isLeadershipResult(value: unknown): value is LeadershipResult {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as Partial<LeadershipResult>).people));
}

function sanitizeLeadershipResult(result: LeadershipResult): { result: LeadershipResult; removed: number; changed: boolean } {
  const originalPeople = Array.isArray(result.people) ? result.people : [];
  const people = mergeQualityPeople(originalPeople);
  const ids = new Set(people.map((person) => person.id));
  const explicitEdges = (Array.isArray(result.edges) ? result.edges : [])
    .filter((edge) => edge.relationship === "explicit-reporting-line" && ids.has(edge.fromId) && ids.has(edge.toId))
    .slice(0, 160);
  const gaps = buildGaps(people);
  const removed = Math.max(0, originalPeople.length - people.length);
  const warnings = Array.from(new Set([
    ...(Array.isArray(result.warnings) ? result.warnings : []),
    ...(removed > 0 ? [`Strict person validation removed ${removed} document headings, organizations, sentence fragments, or unsupported records that had been misclassified as people.`] : []),
    ...(people.length === 0 ? ["No defensible named leaders remain after strict validation. Refresh from public sources to rebuild the chart with the corrected extractor."] : []),
  ]));
  const sources = Array.isArray(result.sources) ? result.sources : [];
  const sanitized: LeadershipResult = {
    ...result,
    people,
    edges: explicitEdges,
    gaps,
    warnings,
    summary: {
      people: people.length,
      confirmed: people.filter((person) => person.confidence === "confirmed").length,
      probable: people.filter((person) => person.confidence === "probable").length,
      inferred: 0,
      levels: new Set(people.map((person) => person.level)).size,
      sourcesAnalyzed: sources.filter((source) => source.status === "analyzed").length,
      gaps: gaps.length,
    },
    methodology: "Only named individuals with a plausible human name, a recognizable current leadership title, and an evidence excerpt containing both the person and role are retained. Document headings, organizations, schools, policies, committees, proxy language, and sentence fragments are excluded. Governance documents remain evidence sources rather than people. Reporting lines are shown only when a public source states them explicitly.",
  };
  const changed = removed > 0
    || JSON.stringify((result.edges || []).map((edge) => [edge.fromId, edge.toId, edge.relationship])) !== JSON.stringify(explicitEdges.map((edge) => [edge.fromId, edge.toId, edge.relationship]))
    || result.summary?.people !== people.length;
  return { result: sanitized, removed, changed };
}

function snapshotFromMetadata(metadata: Record<string, unknown>): SavedSnapshot | null {
  const value = metadata[SNAPSHOT_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<SavedSnapshot>;
  if (!snapshot.result || !isLeadershipResult(snapshot.result) || typeof snapshot.savedAt !== "string") return null;
  return snapshot as SavedSnapshot;
}

async function persistSanitizedResult(entityId: number, result: LeadershipResult): Promise<void> {
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
  if (!entity) return;
  const metadata = objectMetadata(entity.metadata);
  const existing = snapshotFromMetadata(metadata);
  const savedAt = result.savedAt || existing?.savedAt || new Date().toISOString();
  await db.update(entitiesTable).set({
    metadata: {
      ...metadata,
      [SNAPSHOT_KEY]: {
        ...(existing || {}),
        version: QUALITY_VERSION,
        savedAt,
        result: { ...result, entityId, savedAt, savedToDatabase: true },
      },
    },
    updatedAt: new Date(),
  }).where(eq(entitiesTable.id, entityId));
}

async function sanitizeSavedSnapshots(): Promise<void> {
  const entities = await db.select().from(entitiesTable).limit(300);
  const pending = entities.flatMap((entity) => {
    const metadata = objectMetadata(entity.metadata);
    const snapshot = snapshotFromMetadata(metadata);
    if (!snapshot) return [];
    const sanitized = sanitizeLeadershipResult(snapshot.result);
    if (!sanitized.changed && snapshot.version === QUALITY_VERSION) return [];
    return [async () => persistSanitizedResult(entity.id, { ...sanitized.result, entityId: entity.id, savedAt: snapshot.savedAt, savedToDatabase: true })];
  });

  for (let index = 0; index < pending.length; index += 8) {
    await Promise.all(pending.slice(index, index + 8).map((task) => task()));
  }
}

router.get("/leadership-map/saved", async (_req, _res, next) => {
  try {
    await sanitizeSavedSnapshots();
  } catch (error) {
    console.error("Saved organizational-chart cleanup failed:", error);
  }
  next();
});

router.use((req, res, next) => {
  if (!req.path.startsWith("/leadership-map/")) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  let responseScheduled = false;
  res.json = ((payload: unknown) => {
    if (responseScheduled || !isLeadershipResult(payload)) return originalJson(payload);
    responseScheduled = true;
    const sanitized = sanitizeLeadershipResult(payload);
    const entityId = Number(sanitized.result.entityId);
    const send = () => originalJson(sanitized.result);
    if (!Number.isInteger(entityId) || entityId <= 0) return send();
    void persistSanitizedResult(entityId, sanitized.result)
      .then(send)
      .catch((error) => {
        console.error("Organizational-chart quality cleanup could not be persisted:", error);
        send();
      });
    return res;
  }) as Response["json"];

  next();
});

export default router;
