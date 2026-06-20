import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const entitiesTable = pgTable("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  type: text("type").notNull(), // "company", "agency", "organization"
  status: text("status").notNull().default("candidate"), // "candidate", "verified", "rejected"
  source: text("source").notNull(), // "manual", "discovery", "upload"
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEntitySchema = createInsertSchema(entitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entitiesTable.$inferSelect;

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  placeName: text("place_name").notNull(),
  formattedAddress: text("formatted_address"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").notNull(),
  region: text("region").notNull(),
  facilityType: text("facility_type"),
  activity: text("activity"),
  notes: text("notes"),
  coordinates: jsonb("coordinates").$type<[number, number]>().notNull(), // [lng, lat]
  geocodeSource: text("geocode_source").notNull(), // "manual", "uploaded", "osm", "google", "mapbox", "estimated"
  geocodeConfidence: text("geocode_confidence").notNull(), // "exact", "place", "city", "country", "unknown"
  sourceClass: text("source_class"),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  reviewStatus: text("review_status").notNull().default("candidate"), // "candidate", "verified", "rejected", "needs_research"
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;