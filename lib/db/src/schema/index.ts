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