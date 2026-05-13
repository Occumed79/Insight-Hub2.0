import { createInsertSchema } from "drizzle-zod";
import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const sourceTypeEnum = pgEnum("source_type", [
  "SEC",
  "Benchmark",
  "Workbook",
  "Manual",
  "URL",
]);

export const metricUnitEnum = pgEnum("metric_unit", ["usd", "count", "percent", "score"]);
export const metricCategoryEnum = pgEnum("metric_category", [
  "workforce",
  "safety",
  "financial",
  "risk",
]);
export const searchTargetEnum = pgEnum("search_target", [
  "company",
  "opportunity",
  "provider",
  "agency",
  "competitor",
]);
export const searchStatusEnum = pgEnum("search_status", ["queued", "running", "completed", "failed"]);

export const companiesTable = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  sector: text("sector").notNull(),
  headquarters: text("headquarters").notNull(),
  employees: integer("employees").notNull().default(0),
  employeesAsOf: text("employees_as_of").notNull().default("Unknown"),
  summary: text("summary").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourcesTable = pgTable("sources", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: sourceTypeEnum("type").notNull(),
  url: text("url"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricsTable = pgTable("metrics", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  value: doublePrecision("value").notNull().default(0),
  unit: metricUnitEnum("unit").notNull(),
  category: metricCategoryEnum("category").notNull(),
  trend: doublePrecision("trend"),
  sourceId: text("source_id").references(() => sourcesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profilesTable = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  sections: jsonb("sections")
    .$type<
      Array<{
        id: string;
        title: string;
        narrative: string;
        bullets: string[];
        metrics: string[];
      }>
    >()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locationsTable = pgTable("locations", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  city: text("city").notNull(),
  state: text("state"),
  country: text("country").notNull(),
  region: text("region").notNull(),
  facilityType: text("facility_type").notNull(),
  activity: text("activity").notNull(),
  notes: text("notes").notNull().default(""),
  longitude: doublePrecision("longitude").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assumptionsTable = pgTable("assumptions", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportsTable = pgTable("reports", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  signals: jsonb("signals").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const searchRunsTable = pgTable("search_runs", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  target: searchTargetEnum("target").notNull(),
  status: searchStatusEnum("status").notNull().default("queued"),
  resultCount: integer("result_count").notNull().default(0),
  notes: text("notes").notNull().default(""),
  rawResults: jsonb("raw_results").$type<unknown[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable);
export const insertSourceSchema = createInsertSchema(sourcesTable);
export const insertMetricSchema = createInsertSchema(metricsTable);
export const insertProfileSchema = createInsertSchema(profilesTable);
export const insertLocationSchema = createInsertSchema(locationsTable);
export const insertAssumptionSchema = createInsertSchema(assumptionsTable);
export const insertReportSchema = createInsertSchema(reportsTable);
export const insertSearchRunSchema = createInsertSchema(searchRunsTable);

export type Company = typeof companiesTable.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Source = typeof sourcesTable.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Metric = typeof metricsTable.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Assumption = typeof assumptionsTable.$inferSelect;
export type InsertAssumption = z.infer<typeof insertAssumptionSchema>;
export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type SearchRun = typeof searchRunsTable.$inferSelect;
export type InsertSearchRun = z.infer<typeof insertSearchRunSchema>;
