import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  clientBranchesTable,
  clientContactsTable,
  clientsTable,
  competitorsTable,
  federalIntelItemsTable,
  prospectContactsTable,
  prospectJobsTable,
  prospectLocationsTable,
  prospectsTable,
  stateAgencyItemsTable,
  stateIntelItemsTable,
  stateProfilesTable,
} from "@workspace/db";

const router = Router();

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown, label: string): string {
  const normalized = textOrNull(value);
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function safeLimit(value: unknown, fallback = 200, maximum = 500): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(1, Math.floor(parsed))) : fallback;
}

router.get("/core-intelligence/status", async (_req, res) => {
  try {
    const [[prospects], [clients], [competitors], [federal], [stateAgency], [stateIntel]] = await Promise.all([
      db.select({ value: count() }).from(prospectsTable),
      db.select({ value: count() }).from(clientsTable),
      db.select({ value: count() }).from(competitorsTable),
      db.select({ value: count() }).from(federalIntelItemsTable),
      db.select({ value: count() }).from(stateAgencyItemsTable),
      db.select({ value: count() }).from(stateIntelItemsTable),
    ]);
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      prospects: Number(prospects?.value ?? 0),
      clients: Number(clients?.value ?? 0),
      competitors: Number(competitors?.value ?? 0),
      federalIntelItems: Number(federal?.value ?? 0),
      stateAgencyItems: Number(stateAgency?.value ?? 0),
      stateIntelItems: Number(stateIntel?.value ?? 0),
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load intelligence status" });
  }
});

router.get("/prospects", async (_req, res) => {
  try {
    const prospects = await db.select().from(prospectsTable).orderBy(asc(prospectsTable.name));
    return res.json({ prospects });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load prospects" });
  }
});

router.get("/prospects/:id", async (req, res) => {
  try {
    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, req.params.id)).limit(1);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const [locations, jobs, contacts] = await Promise.all([
      db.select().from(prospectLocationsTable).where(eq(prospectLocationsTable.prospectId, prospect.id)).orderBy(asc(prospectLocationsTable.name)),
      db.select().from(prospectJobsTable).where(eq(prospectJobsTable.prospectId, prospect.id)).orderBy(desc(prospectJobsTable.createdAt)),
      db.select().from(prospectContactsTable).where(eq(prospectContactsTable.prospectId, prospect.id)).orderBy(asc(prospectContactsTable.name)),
    ]);
    return res.json({ prospect, locations, jobs, contacts });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load prospect" });
  }
});

router.post("/prospects", async (req, res) => {
  try {
    const now = new Date();
    const [prospect] = await db.insert(prospectsTable).values({
      id: randomUUID(),
      name: requiredText(req.body?.name, "name"),
      website: textOrNull(req.body?.website),
      description: textOrNull(req.body?.description),
      industry: textOrNull(req.body?.industry),
      headquarters: textOrNull(req.body?.headquarters),
      employeeCount: textOrNull(req.body?.employeeCount),
      founded: textOrNull(req.body?.founded),
      naicsCodes: textOrNull(req.body?.naicsCodes),
      status: textOrNull(req.body?.status) ?? "prospect",
      tier: textOrNull(req.body?.tier) ?? "enterprise",
      notes: textOrNull(req.body?.notes),
      createdAt: now,
      updatedAt: now,
    }).returning();
    return res.status(201).json({ prospect });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create prospect" });
  }
});

router.patch("/prospects/:id", async (req, res) => {
  try {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["name", "website", "description", "industry", "headquarters", "employeeCount", "founded", "naicsCodes", "status", "tier", "notes"] as const) {
      if (key in (req.body ?? {})) update[key] = key === "name" ? requiredText(req.body[key], "name") : textOrNull(req.body[key]);
    }
    const [prospect] = await db.update(prospectsTable).set(update).where(eq(prospectsTable.id, req.params.id)).returning();
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    return res.json({ prospect });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update prospect" });
  }
});

router.delete("/prospects/:id", async (req, res) => {
  try {
    const deleted = await db.delete(prospectsTable).where(eq(prospectsTable.id, req.params.id)).returning({ id: prospectsTable.id });
    if (!deleted.length) return res.status(404).json({ error: "Prospect not found" });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete prospect" });
  }
});

router.get("/clients", async (_req, res) => {
  try {
    const [clients, branches, contacts] = await Promise.all([
      db.select().from(clientsTable).orderBy(asc(clientsTable.name)),
      db.select().from(clientBranchesTable).orderBy(asc(clientBranchesTable.name)),
      db.select().from(clientContactsTable).orderBy(asc(clientContactsTable.name)),
    ]);
    const result = clients.map((client) => ({
      ...client,
      branches: branches.filter((branch) => branch.clientId === client.id),
      contacts: contacts.filter((contact) => contact.clientId === client.id),
    }));
    return res.json({ clients: result });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load clients" });
  }
});

router.post("/clients", async (req, res) => {
  try {
    const now = new Date();
    const [client] = await db.insert(clientsTable).values({
      id: randomUUID(),
      name: requiredText(req.body?.name, "name"),
      website: textOrNull(req.body?.website),
      industry: textOrNull(req.body?.industry),
      headquarters: textOrNull(req.body?.headquarters),
      logoUrl: textOrNull(req.body?.logoUrl),
      overallHiringTrend: textOrNull(req.body?.overallHiringTrend) ?? "unknown",
      createdAt: now,
      updatedAt: now,
    }).returning();
    return res.status(201).json({ client });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create client" });
  }
});

router.get("/competitors", async (_req, res) => {
  try {
    const competitors = await db.select().from(competitorsTable).orderBy(asc(competitorsTable.name));
    return res.json({ competitors });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load competitors" });
  }
});

router.get("/entities/roster", async (_req, res) => {
  try {
    const [clients, prospects, competitors] = await Promise.all([
      db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).orderBy(asc(clientsTable.name)),
      db.select({ id: prospectsTable.id, name: prospectsTable.name }).from(prospectsTable).orderBy(asc(prospectsTable.name)),
      db.select({ id: competitorsTable.id, name: competitorsTable.name }).from(competitorsTable).orderBy(asc(competitorsTable.name)),
    ]);
    const seen = new Set<string>();
    const entities = [
      ...clients.map((entity) => ({ ...entity, source: "client" as const })),
      ...prospects.map((entity) => ({ ...entity, source: "prospect" as const })),
      ...competitors.map((entity) => ({ ...entity, source: "competitor" as const })),
    ].filter((entity) => {
      const key = entity.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ entities, counts: { clients: clients.length, prospects: prospects.length, competitors: competitors.length } });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load entity roster" });
  }
});

router.post("/competitors", async (req, res) => {
  try {
    const now = new Date();
    const [competitor] = await db.insert(competitorsTable).values({
      id: randomUUID(),
      name: requiredText(req.body?.name, "name"),
      website: textOrNull(req.body?.website),
      description: textOrNull(req.body?.description),
      services: Array.isArray(req.body?.services) ? JSON.stringify(req.body.services) : textOrNull(req.body?.services),
      coverageStates: Array.isArray(req.body?.coverageStates) ? JSON.stringify(req.body.coverageStates) : textOrNull(req.body?.coverageStates),
      tier: textOrNull(req.body?.tier) ?? "regional",
      headquarters: textOrNull(req.body?.headquarters),
      employeeCount: textOrNull(req.body?.employeeCount),
      founded: textOrNull(req.body?.founded),
      notes: textOrNull(req.body?.notes),
      createdAt: now,
      updatedAt: now,
    }).returning();
    return res.status(201).json({ competitor });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create competitor" });
  }
});

router.patch("/competitors/:id", async (req, res) => {
  try {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["name", "website", "description", "tier", "headquarters", "employeeCount", "founded", "notes"] as const) {
      if (key in (req.body ?? {})) update[key] = key === "name" ? requiredText(req.body[key], "name") : textOrNull(req.body[key]);
    }
    if ("services" in (req.body ?? {})) update.services = Array.isArray(req.body.services) ? JSON.stringify(req.body.services) : textOrNull(req.body.services);
    if ("coverageStates" in (req.body ?? {})) update.coverageStates = Array.isArray(req.body.coverageStates) ? JSON.stringify(req.body.coverageStates) : textOrNull(req.body.coverageStates);
    const [competitor] = await db.update(competitorsTable).set(update).where(eq(competitorsTable.id, req.params.id)).returning();
    if (!competitor) return res.status(404).json({ error: "Competitor not found" });
    return res.json({ competitor });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update competitor" });
  }
});

router.delete("/competitors/:id", async (req, res) => {
  try {
    const deleted = await db.delete(competitorsTable).where(eq(competitorsTable.id, req.params.id)).returning({ id: competitorsTable.id });
    if (!deleted.length) return res.status(404).json({ error: "Competitor not found" });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete competitor" });
  }
});

router.get("/federal-intel/:bucket", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = safeLimit(req.query.limit, 100, 200);
    const offset = (page - 1) * limit;
    const bucket = req.params.bucket;
    const [items, [totalRow]] = await Promise.all([
      db.select().from(federalIntelItemsTable).where(eq(federalIntelItemsTable.bucket, bucket)).orderBy(desc(federalIntelItemsTable.fetchedAt)).limit(limit).offset(offset),
      db.select({ value: count() }).from(federalIntelItemsTable).where(eq(federalIntelItemsTable.bucket, bucket)),
    ]);
    const total = Number(totalRow?.value ?? 0);
    return res.json({ items, bucket, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load federal intelligence" });
  }
});

router.patch("/federal-intel/:id/tag", async (req, res) => {
  try {
    const actionTag = requiredText(req.body?.actionTag, "actionTag");
    const [item] = await db.update(federalIntelItemsTable).set({ actionTag, updatedAt: new Date() }).where(eq(federalIntelItemsTable.id, req.params.id)).returning();
    if (!item) return res.status(404).json({ error: "Federal intelligence item not found" });
    return res.json({ item });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update item" });
  }
});

router.get("/state-agencies/states", async (_req, res) => {
  try {
    const [states, counts] = await Promise.all([
      db.select().from(stateProfilesTable).orderBy(asc(stateProfilesTable.stateName)),
      db.select({ stateCode: stateAgencyItemsTable.stateCode, value: count() }).from(stateAgencyItemsTable).groupBy(stateAgencyItemsTable.stateCode),
    ]);
    const byState = new Map(counts.map((row) => [row.stateCode, Number(row.value)]));
    return res.json({ states: states.map((state) => ({ ...state, itemCount: byState.get(state.stateCode) ?? 0 })) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load state profiles" });
  }
});

router.get("/state-agencies/items", async (req, res) => {
  try {
    const stateCode = textOrNull(req.query.stateCode)?.toUpperCase();
    const bucket = textOrNull(req.query.bucket);
    const filters = [];
    if (stateCode) filters.push(eq(stateAgencyItemsTable.stateCode, stateCode));
    if (bucket) filters.push(eq(stateAgencyItemsTable.bucket, bucket));
    const items = await db.select().from(stateAgencyItemsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(stateAgencyItemsTable.fetchedAt))
      .limit(safeLimit(req.query.limit, 200, 500));
    const countRows = stateCode
      ? await db.select({ bucket: stateAgencyItemsTable.bucket, value: count() }).from(stateAgencyItemsTable).where(eq(stateAgencyItemsTable.stateCode, stateCode)).groupBy(stateAgencyItemsTable.bucket)
      : [];
    return res.json({ items, bucketCounts: Object.fromEntries(countRows.map((row) => [row.bucket, Number(row.value)])) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load state items" });
  }
});

router.get("/state-agencies/intel", async (req, res) => {
  try {
    const channel = textOrNull(req.query.channel);
    const items = await db.select().from(stateIntelItemsTable)
      .where(channel ? eq(stateIntelItemsTable.channel, channel) : undefined)
      .orderBy(desc(stateIntelItemsTable.fetchedAt))
      .limit(safeLimit(req.query.limit, 200, 500));
    const countRows = await db.select({ channel: stateIntelItemsTable.channel, value: count() }).from(stateIntelItemsTable).groupBy(stateIntelItemsTable.channel);
    return res.json({ items, channelCounts: Object.fromEntries(countRows.map((row) => [row.channel, Number(row.value)])) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load cross-state intelligence" });
  }
});

export default router;
