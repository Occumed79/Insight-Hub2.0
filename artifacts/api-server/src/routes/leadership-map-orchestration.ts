import { Router, type NextFunction, type Request, type Response } from "express";
import { db, entitiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  discoverLeadershipWithAi,
  type LeadershipAiPerson,
  type LeadershipProviderDiagnostic,
} from "../lib/leadershipAiOrchestration";

const router = Router();
const SNAPSHOT_KEY = "organizationalChart";
const MAX_SAVED_RESULTS = 300;

type Confidence = "confirmed" | "probable" | "inferred";
type LeadershipLevel = "board" | "executive" | "senior-leadership" | "director" | "manager" | "individual-contributor" | "unknown";

type Evidence = {
  url: string;
  label: string;
  sourceType: "official" | "sec" | "press" | "public-web";
  snippet: string;
  fetchedAt: string;
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

type SourceRecord = {
  url: string;
  label: string;
  sourceType: "official" | "sec" | "press" | "public-web";
  status: "analyzed" | "failed" | "skipped";
  note: string;
};

type LeadershipResult = {
  companyName: string;
  startedAt: string;
  completedAt: string;
  people: Person[];
  edges: Edge[];
  gaps: Array<{ level: LeadershipLevel; label: string; reason: string }>;
  sources: SourceRecord[];
  warnings: string[];
  issuer?: { cik: string; name: string; ticker?: string; exchange?: string };
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
  providerDiagnostics?: LeadershipProviderDiagnostic[];
  cacheHit?: boolean;
  entityId?: number;
  savedAt?: string;
  savedToDatabase?: boolean;
  pagesConsidered?: number;
  aiPagesRead?: number;
};

type SavedSnapshot = {
  version: number;
  savedAt: string;
  result: LeadershipResult;
  sourceInputs?: {
    primaryUrl?: string;
    supportingUrls?: string[];
    secQuery?: string;
  };
};

function cleanText(value: unknown, max = 2_000): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function normalizeKey(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function snapshotFromMetadata(metadata: Record<string, unknown>): SavedSnapshot | null {
  const value = metadata[SNAPSHOT_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<SavedSnapshot>;
  if (!snapshot.result || typeof snapshot.result !== "object" || !snapshot.savedAt) return null;
  return snapshot as SavedSnapshot;
}

function confidenceRank(value: Confidence): number {
  return value === "confirmed" ? 3 : value === "probable" ? 2 : 1;
}

function levelRank(level: LeadershipLevel): number {
  return ({ board: 0, executive: 1, "senior-leadership": 2, director: 3, manager: 4, "individual-contributor": 5, unknown: 6 })[level];
}

function mergePeople(baseline: Person[], aiPeople: LeadershipAiPerson[]): Person[] {
  const merged = new Map<string, Person>();
  const add = (person: Person) => {
    const key = normalizeKey(person.name);
    if (!key) return;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, person);
      return;
    }
    const stronger = confidenceRank(person.confidence) > confidenceRank(existing.confidence) ? person : existing;
    const weaker = stronger === person ? existing : person;
    merged.set(key, {
      ...weaker,
      ...stronger,
      title: stronger.title.length >= weaker.title.length ? stronger.title : weaker.title,
      level: stronger.level !== "unknown" ? stronger.level : weaker.level,
      department: stronger.department || weaker.department,
      location: stronger.location || weaker.location,
      bio: stronger.bio || weaker.bio,
      sourceUrls: Array.from(new Set([...existing.sourceUrls, ...person.sourceUrls])),
      evidence: [...existing.evidence, ...person.evidence]
        .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url && candidate.snippet === item.snippet) === index)
        .slice(0, 16),
    });
  };
  baseline.forEach(add);
  aiPeople.forEach((person) => add(person as Person));
  return Array.from(merged.values())
    .sort((left, right) => levelRank(left.level) - levelRank(right.level) || left.name.localeCompare(right.name))
    .slice(0, 260);
}

function buildEdges(people: Person[]): Edge[] {
  const sorted = [...people].sort((left, right) => levelRank(left.level) - levelRank(right.level) || left.name.localeCompare(right.name));
  const edges: Edge[] = [];
  for (const person of sorted) {
    const rank = levelRank(person.level);
    if (rank <= 0 || person.level === "unknown") continue;
    const parents = sorted.filter((candidate) => levelRank(candidate.level) < rank && candidate.id !== person.id);
    if (parents.length === 0) continue;
    const sameDepartment = parents.filter((candidate) => candidate.department && candidate.department === person.department);
    const pool = sameDepartment.length > 0 ? sameDepartment : parents;
    const parent = pool.sort((left, right) => levelRank(right.level) - levelRank(left.level) || left.name.localeCompare(right.name))[0];
    if (!parent) continue;
    edges.push({
      fromId: parent.id,
      toId: person.id,
      relationship: "inferred-title-hierarchy",
      confidence: "inferred",
      note: "Placement is inferred from public titles and department signals; it is not a confirmed reporting line.",
    });
  }
  return edges.slice(0, 450);
}

function buildGaps(people: Person[]): LeadershipResult["gaps"] {
  const has = (level: LeadershipLevel) => people.some((person) => person.level === level);
  const gaps: LeadershipResult["gaps"] = [];
  if (!has("board")) gaps.push({ level: "board", label: "Board or governing body", reason: "No board-level people were identified in the analyzed public sources." });
  if (!people.some((person) => /chief executive|\bceo\b|president/i.test(person.title))) gaps.push({ level: "executive", label: "Chief executive", reason: "A chief executive or president was not confidently identified." });
  if (!has("senior-leadership")) gaps.push({ level: "senior-leadership", label: "Vice presidents / business-unit leaders", reason: "No vice-president or comparable layer was identified." });
  if (!has("director")) gaps.push({ level: "director", label: "Director layer", reason: "No director-level people were identified." });
  if (!has("manager")) gaps.push({ level: "manager", label: "Management layer", reason: "Public sources rarely expose the full manager layer." });
  if (!has("individual-contributor")) gaps.push({ level: "individual-contributor", label: "Analysts and individual contributors", reason: "Public sources usually do not expose a complete individual-contributor roster." });
  return gaps;
}

function recompute(
  result: LeadershipResult,
  aiPeople: LeadershipAiPerson[],
  aiSources: SourceRecord[],
  diagnostics: LeadershipProviderDiagnostic[],
  warnings: string[],
  pagesConsidered: number,
  pagesRead: number,
): LeadershipResult {
  const people = mergePeople(result.people || [], aiPeople);
  const sources = [...(result.sources || []), ...aiSources]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url && candidate.status === item.status) === index)
    .slice(0, 80);
  const gaps = buildGaps(people);
  const combinedWarnings = Array.from(new Set([...(result.warnings || []), ...warnings]));
  return {
    ...result,
    completedAt: new Date().toISOString(),
    people,
    edges: buildEdges(people),
    gaps,
    sources,
    warnings: combinedWarnings,
    providerDiagnostics: diagnostics,
    pagesConsidered,
    aiPagesRead: pagesRead,
    summary: {
      people: people.length,
      confirmed: people.filter((person) => person.confidence === "confirmed").length,
      probable: people.filter((person) => person.confidence === "probable").length,
      inferred: people.filter((person) => person.confidence === "inferred").length,
      levels: new Set(people.map((person) => person.level)).size,
      sourcesAnalyzed: sources.filter((source) => source.status === "analyzed").length,
      gaps: gaps.length,
    },
    methodology: "The organizational chart combines bounded official-page crawling, SEC public filings, Groq browser discovery, Cloudflare semantic reranking, Gemini structured extraction, and Cerebras validation. Named people and titles remain tied to public evidence. Every reporting relationship not explicitly stated by a source is labeled inferred title hierarchy rather than a confirmed reporting line.",
  };
}

function hostname(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameHost(left: string, right: string): boolean {
  const leftHost = hostname(left);
  const rightHost = hostname(right);
  return Boolean(leftHost && rightHost && (leftHost === rightHost || leftHost.endsWith(`.${rightHost}`) || rightHost.endsWith(`.${leftHost}`)));
}

function looksLikeOfficialCompanyUrl(value: string, companyName: string): boolean {
  const host = hostname(value);
  if (!host) return false;
  const ignored = new Set(["group", "global", "company", "companies", "corporation", "corp", "inc", "llc", "ltd", "plc", "holdings"]);
  const tokens = normalizeKey(companyName).split(" ").filter((token) => token.length >= 3 && !ignored.has(token));
  const compactHost = host.replace(/[^a-z0-9]/g, "");
  return tokens.some((token) => compactHost.includes(token.replace(/[^a-z0-9]/g, "")));
}

function emptyBaseline(companyName: string, warning: string): LeadershipResult {
  const startedAt = new Date().toISOString();
  return {
    companyName,
    startedAt,
    completedAt: startedAt,
    people: [],
    edges: [],
    gaps: [],
    sources: [],
    warnings: [warning],
    summary: { people: 0, confirmed: 0, probable: 0, inferred: 0, levels: 0, sourcesAnalyzed: 0, gaps: 0 },
    methodology: "Public organizational-chart evidence was processed without an official-domain crawl because no sufficiently safe official company domain was resolved.",
  };
}

async function findEntity(companyName: string) {
  const [entity] = await db.select().from(entitiesTable).where(sql`
    lower(${entitiesTable.name}) = lower(${companyName})
    OR lower(${entitiesTable.displayName}) = lower(${companyName})
    OR lower(coalesce(${entitiesTable.metadata}->>'enteredName', '')) = lower(${companyName})
    OR lower(coalesce(${entitiesTable.metadata}->>'canonicalName', '')) = lower(${companyName})
  `).limit(1);
  return entity;
}

async function getOrCreateEntity(companyName: string) {
  const existing = await findEntity(companyName);
  if (existing) return existing;
  const [created] = await db.insert(entitiesTable).values({
    name: companyName,
    displayName: companyName,
    type: "company",
    status: "candidate",
    source: "organizational-chart-builder",
    metadata: { enteredName: companyName },
  }).returning();
  return created;
}

async function saveSnapshot(entityId: number, snapshot: SavedSnapshot): Promise<void> {
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
  if (!entity) throw new Error("The company record no longer exists in Neon.");
  await db.update(entitiesTable).set({
    displayName: snapshot.result.companyName || entity.displayName,
    metadata: { ...objectMetadata(entity.metadata), [SNAPSHOT_KEY]: snapshot },
    updatedAt: new Date(),
  }).where(eq(entitiesTable.id, entityId));
}

async function finalizeAndSave(
  base: LeadershipResult,
  entityId: number,
  ai: Awaited<ReturnType<typeof discoverLeadershipWithAi>>,
  req: Request,
): Promise<LeadershipResult> {
  const merged = recompute(
    base,
    ai.people,
    ai.sources as SourceRecord[],
    ai.diagnostics,
    ai.warnings,
    ai.pagesConsidered,
    ai.pagesRead,
  );
  const savedAt = new Date().toISOString();
  merged.cacheHit = false;
  merged.entityId = entityId;
  merged.savedAt = savedAt;
  merged.savedToDatabase = true;
  const snapshot: SavedSnapshot = {
    version: 1,
    savedAt,
    result: merged,
    sourceInputs: {
      primaryUrl: cleanText(req.body?.primaryUrl, 2_000) || undefined,
      supportingUrls: Array.isArray(req.body?.supportingUrls) ? req.body.supportingUrls : [],
      secQuery: cleanText(req.body?.secQuery, 180) || undefined,
    },
  };
  await saveSnapshot(entityId, snapshot);
  return merged;
}

function cachedResponse(entityId: number, snapshot: SavedSnapshot): LeadershipResult {
  return {
    ...snapshot.result,
    cacheHit: true,
    entityId,
    savedAt: snapshot.savedAt,
    savedToDatabase: true,
    warnings: Array.from(new Set([
      "Loaded the saved organizational chart from Neon without calling Groq, Cloudflare, Gemini, Cerebras, the crawler, or SEC again.",
      ...(snapshot.result.warnings || []),
    ])),
  };
}

router.get("/leadership-map/saved", async (_req, res) => {
  try {
    const entities = await db.select().from(entitiesTable).orderBy(entitiesTable.displayName).limit(MAX_SAVED_RESULTS);
    const saved = entities.flatMap((entity) => {
      const snapshot = snapshotFromMetadata(objectMetadata(entity.metadata));
      if (!snapshot) return [];
      return [{
        id: entity.id,
        companyName: snapshot.result.companyName || entity.displayName,
        savedAt: snapshot.savedAt,
        people: snapshot.result.summary?.people || snapshot.result.people?.length || 0,
        confirmed: snapshot.result.summary?.confirmed || 0,
        sourcesAnalyzed: snapshot.result.summary?.sourcesAnalyzed || 0,
      }];
    });
    res.json({ ok: true, companies: saved });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Saved organizational charts could not be loaded." });
  }
});

router.get("/leadership-map/saved/:entityId", async (req, res) => {
  const entityId = Number(req.params.entityId);
  if (!Number.isInteger(entityId)) {
    res.status(400).json({ error: "A valid saved company ID is required." });
    return;
  }
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
  const snapshot = entity ? snapshotFromMetadata(objectMetadata(entity.metadata)) : null;
  if (!entity || !snapshot) {
    res.status(404).json({ error: "No saved organizational chart was found for this company." });
    return;
  }
  res.setHeader("X-Insight-Hub-Leadership-Cache", "HIT");
  res.json(cachedResponse(entity.id, snapshot));
});

router.post("/leadership-map/analyze", async (req: Request, res: Response, next: NextFunction) => {
  const companyName = cleanText(req.body?.companyName, 180);
  const refresh = req.body?.refresh === true || req.body?.forceRefresh === true;
  if (!companyName) {
    next();
    return;
  }

  try {
    const existing = await findEntity(companyName);
    const existingSnapshot = existing ? snapshotFromMetadata(objectMetadata(existing.metadata)) : null;
    if (existing && existingSnapshot && !refresh) {
      res.setHeader("X-Insight-Hub-Leadership-Cache", "HIT");
      res.json(cachedResponse(existing.id, existingSnapshot));
      return;
    }

    const primaryUrl = cleanText(req.body?.primaryUrl, 2_000) || undefined;
    const supportingUrls: string[] = Array.isArray(req.body?.supportingUrls)
      ? req.body.supportingUrls.map((value: unknown) => cleanText(value, 2_000)).filter((value: string) => Boolean(value)).slice(0, 12)
      : [];
    const entity = existing || await getOrCreateEntity(companyName);
    const ai = await discoverLeadershipWithAi({ companyName, primaryUrl, supportingUrls });

    const explicitSeed = primaryUrl;
    const discoveredOfficialSeed = ai.sources
      .filter((source) => source.status === "analyzed")
      .map((source) => source.url)
      .find((url) => looksLikeOfficialCompanyUrl(url, companyName));
    const officialSeed = explicitSeed || discoveredOfficialSeed;

    if (!officialSeed) {
      const base = emptyBaseline(
        companyName,
        "No sufficiently safe official company domain was resolved, so the legacy official-domain crawler and SEC enrichment were skipped for this run rather than treating a third-party page as official.",
      );
      try {
        const merged = await finalizeAndSave(base, entity.id, ai, req);
        res.json(merged);
      } catch (saveError) {
        const merged = recompute(base, ai.people, ai.sources as SourceRecord[], ai.diagnostics, ai.warnings, ai.pagesConsidered, ai.pagesRead);
        merged.entityId = entity.id;
        merged.cacheHit = false;
        merged.savedToDatabase = false;
        merged.warnings = Array.from(new Set([...merged.warnings, `The chart was built but could not be saved to Neon: ${saveError instanceof Error ? saveError.message : "Unknown persistence error"}`]));
        res.json(merged);
      }
      return;
    }

    const sameHostSupportingUrls = supportingUrls.filter((url: string) => sameHost(url, officialSeed));
    const officialDiscoveredUrls = ai.sources
      .filter((source) => source.status === "analyzed" && sameHost(source.url, officialSeed))
      .map((source) => source.url);
    const combinedUrls = Array.from(new Set([...sameHostSupportingUrls, ...officialDiscoveredUrls])).slice(0, 12);
    req.body.primaryUrl = primaryUrl || officialSeed;
    req.body.supportingUrls = combinedUrls.filter((url) => url !== req.body.primaryUrl);

    const originalJson = res.json.bind(res);
    let responseScheduled = false;
    res.json = ((payload: unknown) => {
      if (responseScheduled) return res;
      if (res.statusCode >= 400 || !payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray((payload as Partial<LeadershipResult>).people)) {
        return originalJson(payload);
      }
      responseScheduled = true;
      const base = payload as LeadershipResult;
      void finalizeAndSave(base, entity.id, ai, req)
        .then((merged) => originalJson(merged))
        .catch((saveError) => {
          const merged = recompute(base, ai.people, ai.sources as SourceRecord[], ai.diagnostics, ai.warnings, ai.pagesConsidered, ai.pagesRead);
          merged.entityId = entity.id;
          merged.cacheHit = false;
          merged.savedToDatabase = false;
          merged.warnings = Array.from(new Set([...merged.warnings, `The chart was built but could not be saved to Neon: ${saveError instanceof Error ? saveError.message : "Unknown persistence error"}`]));
          originalJson(merged);
        });
      return res;
    }) as Response["json"];

    next();
  } catch (error) {
    console.error("Organizational chart orchestration failed:", error);
    next();
  }
});

export default router;
