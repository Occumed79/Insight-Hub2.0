import { eq } from "drizzle-orm";
import { Router } from "express";
import { db, entitiesTable } from "@workspace/db";

const router = Router();

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

router.get("/company-library/file/:entityId", async (req, res) => {
  const entityId = Number(req.params.entityId);
  if (!Number.isInteger(entityId) || entityId <= 0) {
    res.status(400).json({ error: "A valid company entity ID is required." });
    return;
  }

  try {
    const [entity] = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, entityId))
      .limit(1);

    if (!entity) {
      res.status(404).json({ error: "Company file was not found." });
      return;
    }

    const metadata = objectMetadata(entity.metadata);
    const injuryExposure = objectMetadata(metadata.injuryExposure);
    const result = objectMetadata(injuryExposure.result);
    const file = typeof result.title === "string" && result.title.trim()
      ? result
      : null;

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      company: {
        entityId: entity.id,
        name: entity.name,
        displayName: entity.displayName,
        updatedAt: entity.updatedAt.toISOString(),
      },
      file,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Company file could not be loaded.",
    });
  }
});

export default router;
