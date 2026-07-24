import { Router, type Response } from "express";
import { db, entitiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

function normalizeEntityName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isCompletedLegacySnapshot(metadata: Record<string, unknown>): boolean {
  const version = Number(metadata.cerebrasVersion);
  if (version === 2) return false;
  return metadata.discoveryStatus === "completed"
    || typeof metadata.lastDiscoveryAt === "string";
}

router.use(async (req, res, next) => {
  if (req.method !== "POST" || !["/locations/discover", "/entity-discovery/locations"].includes(req.path)) {
    next();
    return;
  }

  if (req.body?.refresh === true || req.body?.forceRefresh === true || !process.env.CEREBRAS_API_KEY) {
    next();
    return;
  }

  const enteredName = normalizeEntityName(req.body?.entityName);
  if (!enteredName) {
    next();
    return;
  }

  try {
    const [entity] = await db
      .select()
      .from(entitiesTable)
      .where(sql`
        lower(${entitiesTable.name}) = lower(${enteredName})
        OR lower(${entitiesTable.displayName}) = lower(${enteredName})
        OR lower(coalesce(${entitiesTable.metadata}->>'enteredName', '')) = lower(${enteredName})
        OR lower(coalesce(${entitiesTable.metadata}->>'canonicalName', '')) = lower(${enteredName})
      `)
      .limit(1);

    if (!entity) {
      next();
      return;
    }

    const metadata = objectMetadata(entity.metadata);
    if (!isCompletedLegacySnapshot(metadata)) {
      next();
      return;
    }

    // Bypass the normal Neon cache exactly once for pre-Version-2 snapshots.
    // After a successful response, the snapshot is marked as migrated and
    // subsequent searches return to the quota-saving Neon cache behavior.
    req.body = {
      ...req.body,
      refresh: true,
      forceRefresh: true,
      cerebrasV2Migration: true,
    };
    res.setHeader("X-Insight-Hub-Cerebras-Migration", "v2-refresh");

    const originalJson = res.json.bind(res);
    let responseScheduled = false;
    res.json = ((payload: unknown) => {
      if (responseScheduled) return originalJson(payload);
      responseScheduled = true;

      const responsePayload = payload as {
        ok?: boolean;
        entityId?: number;
        warnings?: string[];
        warning?: string;
      };

      const finish = async () => {
        if (responsePayload?.ok === true && Number.isInteger(responsePayload.entityId)) {
          const [current] = await db
            .select()
            .from(entitiesTable)
            .where(eq(entitiesTable.id, Number(responsePayload.entityId)))
            .limit(1);

          if (current) {
            const currentMetadata = objectMetadata(current.metadata);
            const migratedAt = new Date().toISOString();
            await db.update(entitiesTable).set({
              metadata: {
                ...currentMetadata,
                cerebrasVersion: 2,
                cerebrasValidatedAt: currentMetadata.cerebrasValidatedAt || migratedAt,
                cerebrasV2MigrationCompletedAt: migratedAt,
              },
              updatedAt: new Date(),
            }).where(eq(entitiesTable.id, current.id));

            const migrationNotice = "This legacy saved company was refreshed once through the Cerebras Version 2 location pipeline. Future searches will reuse the updated Neon snapshot unless refresh is explicitly requested.";
            responsePayload.warnings = Array.from(new Set([...(responsePayload.warnings || []), migrationNotice]));
            responsePayload.warning = responsePayload.warnings.join(" ");
          }
        }
        return originalJson(responsePayload);
      };

      void finish().catch((error) => {
        console.error("Cerebras Version 2 location migration finalization failed:", error);
        originalJson(payload);
      });
      return res;
    }) as Response["json"];

    next();
  } catch (error) {
    console.error("Cerebras Version 2 location migration lookup failed:", error);
    next();
  }
});

export default router;
