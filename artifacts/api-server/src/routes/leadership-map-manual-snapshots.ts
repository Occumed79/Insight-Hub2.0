import { Router, type NextFunction, type Request, type Response } from "express";
import { db, entitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const SNAPSHOT_KEY = "organizationalChart";
const MAX_SAVED_RESULTS = 300;

type SavedSnapshot = {
  version?: number;
  savedAt: string;
  result: {
    companyName?: string;
    people?: unknown[];
    summary?: {
      people?: number;
      confirmed?: number;
      sourcesAnalyzed?: number;
    };
    warnings?: string[];
    [key: string]: unknown;
  };
  sourceInputs?: Record<string, unknown>;
};

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function snapshotFromMetadata(metadata: Record<string, unknown>): SavedSnapshot | null {
  const value = metadata[SNAPSHOT_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<SavedSnapshot>;
  if (!snapshot.result || typeof snapshot.result !== "object" || !snapshot.savedAt) return null;
  return snapshot as SavedSnapshot;
}

function isManualSnapshot(snapshot: SavedSnapshot): boolean {
  const sourceInputs = objectMetadata(snapshot.sourceInputs);
  return typeof sourceInputs.manualFile === "string"
    || sourceInputs.manualSimpleImport === true;
}


function domainFromValue(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase().replace(/^@/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

function contactDomainFromMetadata(metadata: Record<string, unknown>): { domain: string | null; source: "saved" | "derived" | "none" } {
  const saved = domainFromValue(metadata.organizationalContactDomain);
  if (saved) return { domain: saved, source: "saved" };
  const chart = objectMetadata(metadata[SNAPSHOT_KEY] || metadata.organizational_chart);
  const sourceInputs = objectMetadata(chart.sourceInputs);
  for (const candidate of [sourceInputs.primaryUrl, metadata.officialWebsite, metadata.website, metadata.domain]) {
    const domain = domainFromValue(candidate);
    if (domain) return { domain, source: "derived" };
  }
  const result = objectMetadata(chart.result);
  const sources = Array.isArray(result.sources) ? result.sources : [];
  for (const source of sources) {
    const row = objectMetadata(source);
    if (String(row.sourceType || "") !== "official") continue;
    const domain = domainFromValue(row.url);
    if (domain) return { domain, source: "derived" };
  }
  return { domain: null, source: "none" };
}

router.get("/leadership-map/saved", async (_req: Request, res: Response) => {
  try {
    const entities = await db.select().from(entitiesTable).orderBy(entitiesTable.displayName).limit(MAX_SAVED_RESULTS);
    const companies = entities.flatMap((entity) => {
      const snapshot = snapshotFromMetadata(objectMetadata(entity.metadata));
      if (!snapshot) return [];
      const people = Array.isArray(snapshot.result.people) ? snapshot.result.people.length : 0;
      return [{
        id: entity.id,
        companyName: String(snapshot.result.companyName || entity.displayName || entity.name),
        savedAt: snapshot.savedAt,
        people: Number(snapshot.result.summary?.people ?? people),
        confirmed: Number(snapshot.result.summary?.confirmed ?? 0),
        sourcesAnalyzed: Number(snapshot.result.summary?.sourcesAnalyzed ?? 0),
      }];
    });
    res.json({ ok: true, companies });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Saved organizational charts could not be loaded." });
  }
});

router.get("/leadership-map/saved/:entityId", async (req: Request, res: Response, next: NextFunction) => {
  const entityId = Number(req.params.entityId);
  if (!Number.isInteger(entityId)) {
    next();
    return;
  }

  try {
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
    const snapshot = entity ? snapshotFromMetadata(objectMetadata(entity.metadata)) : null;
    if (!entity || !snapshot || !isManualSnapshot(snapshot)) {
      next();
      return;
    }

    const warnings = Array.from(new Set([
      "Loaded the manually researched organizational chart from Neon without spending search or AI quota.",
      ...(Array.isArray(snapshot.result.warnings) ? snapshot.result.warnings : []),
    ]));
    res.setHeader("X-Insight-Hub-Leadership-Cache", "MANUAL-HIT");
    res.json({
      ...snapshot.result,
      cacheHit: true,
      entityId: entity.id,
      savedAt: snapshot.savedAt,
      savedToDatabase: true,
      warnings,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "The manually imported organizational chart could not be loaded." });
  }
});


router.get("/leadership-map/contact-domain/:entityId", async (req: Request, res: Response) => {
  const entityId = Number(req.params.entityId);
  if (!Number.isInteger(entityId)) {
    res.status(400).json({ error: "A valid company ID is required." });
    return;
  }
  try {
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
    if (!entity) {
      res.status(404).json({ error: "The saved company was not found." });
      return;
    }
    res.json({ ok: true, ...contactDomainFromMetadata(objectMetadata(entity.metadata)) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "The company email domain could not be loaded." });
  }
});

router.put("/leadership-map/contact-domain/:entityId", async (req: Request, res: Response) => {
  const entityId = Number(req.params.entityId);
  const domain = domainFromValue(req.body?.domain);
  if (!Number.isInteger(entityId) || !domain) {
    res.status(400).json({ error: "A valid company ID and email domain are required." });
    return;
  }
  try {
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
    if (!entity) {
      res.status(404).json({ error: "The saved company was not found." });
      return;
    }
    await db.update(entitiesTable).set({
      metadata: { ...objectMetadata(entity.metadata), organizationalContactDomain: domain },
      updatedAt: new Date(),
    }).where(eq(entitiesTable.id, entityId));
    res.json({ ok: true, domain, source: "saved" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "The company email domain could not be saved." });
  }
});

export default router;
