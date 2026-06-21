import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const entitiesTable = pgTable("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("candidate"),
  source: text("source").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Entity = typeof entitiesTable.$inferSelect;

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  placeName: text("place_name").notNull(),
  formattedAddress: text("formatted_address"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").notNull(),
  region: text("region").notNull(),
  facilityType: text("facility_type"),
  activity: text("activity"),
  notes: text("notes"),
  coordinates: jsonb("coordinates").notNull(),
  geocodeSource: text("geocode_source").notNull(),
  geocodeConfidence: text("geocode_confidence").notNull(),
  sourceClass: text("source_class"),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  reviewStatus: text("review_status").notNull().default("candidate"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Location = typeof locationsTable.$inferSelect;

export const intelligenceSourcesTable = pgTable("intelligence_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  url: text("url"),
  requiresKey: text("requires_key").notNull().default("no"),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type IntelligenceSource = typeof intelligenceSourcesTable.$inferSelect;

export const intelligenceFactsTable = pgTable("intelligence_facts", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  factDate: text("fact_date"),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  value: text("value"),
  valueUnit: text("value_unit"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type").notNull(),
  confidence: text("confidence").notNull().default("medium"),
  rawSnippet: text("raw_snippet"),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata"),
  runId: integer("run_id").references(() => intelligenceRunsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IntelligenceFact = typeof intelligenceFactsTable.$inferSelect;

export const intelligenceRunsTable = pgTable("intelligence_runs", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  sourcesQueried: jsonb("sources_queried"),
  factsCollected: integer("facts_collected").notNull().default(0),
  status: text("status").notNull().default("running"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IntelligenceRun = typeof intelligenceRunsTable.$inferSelect;

export const companySignalSnapshotsTable = pgTable("company_signal_snapshots", {
  id: serial("id").primaryKey(),
  companyId: text("company_id").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  signalType: text("signal_type").notNull(),
  signalValue: text("signal_value"),
  signalUnit: text("signal_unit"),
  sourceName: text("source_name"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CompanySignalSnapshot = typeof companySignalSnapshotsTable.$inferSelect;