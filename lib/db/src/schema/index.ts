import { pgTable, text, serial, timestamp, jsonb, integer, boolean, real } from "drizzle-orm/pg-core";

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

export const portalLinksTable = pgTable("portal_links", {
  portalKey: text("portal_key").primaryKey(),
  url: text("url").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PortalLink = typeof portalLinksTable.$inferSelect;

// Core intelligence workspaces transferred from the procurement application.
// These intentionally remain separate from the existing `entities` company-library table.
export const prospectsTable = pgTable("prospects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  description: text("description"),
  industry: text("industry"),
  headquarters: text("headquarters"),
  employeeCount: text("employee_count"),
  founded: text("founded"),
  naicsCodes: text("naics_codes"),
  status: text("status").notNull().default("prospect"),
  tier: text("tier").notNull().default("enterprise"),
  notes: text("notes"),
  researchSummary: text("research_summary"),
  opportunitySignals: text("opportunity_signals"),
  intelligenceSources: text("intelligence_sources"),
  lastResearched: timestamp("last_researched"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const prospectLocationsTable = pgTable("prospect_locations", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospectsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  type: text("type").notNull().default("office"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("United States"),
  address: text("address"),
  employeeEstimate: text("employee_estimate"),
  description: text("description"),
  openPositions: integer("open_positions").default(0),
  healthPositions: integer("health_positions").default(0),
  hiringTrend: text("hiring_trend"),
  hiringCategories: text("hiring_categories"),
  jobsLastUpdated: timestamp("jobs_last_updated"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const prospectJobsTable = pgTable("prospect_jobs", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospectsTable.id, { onDelete: "cascade" }),
  locationId: text("location_id"),
  title: text("title").notNull(),
  department: text("department"),
  rawLocation: text("raw_location"),
  jobType: text("job_type"),
  postedDate: text("posted_date"),
  url: text("url"),
  snippet: text("snippet"),
  isHealthRelated: boolean("is_health_related").default(false),
  healthRelevanceReason: text("health_relevance_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const prospectContactsTable = pgTable("prospect_contacts", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull().references(() => prospectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  title: text("title"),
  department: text("department"),
  isEhsContact: boolean("is_ehs_contact").default(false),
  isKeyContact: boolean("is_key_contact").default(false),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  headquarters: text("headquarters"),
  logoUrl: text("logo_url"),
  overallHiringTrend: text("overall_hiring_trend").default("unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientBranchesTable = pgTable("client_branches", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  city: text("city"),
  country: text("country").notNull().default("United States"),
  state: text("state"),
  address: text("address"),
  branchType: text("branch_type").notNull().default("office"),
  lastResearched: timestamp("last_researched"),
  hiringTrendSummary: text("hiring_trend_summary"),
  hiringTrendDirection: text("hiring_trend_direction").default("unknown"),
  postingCount: text("posting_count").default("0"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientContactsTable = pgTable("client_contacts", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  title: text("title"),
  department: text("department"),
  isEhsContact: boolean("is_ehs_contact").default(false),
  isKeyContact: boolean("is_key_contact").default(false),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const competitorsTable = pgTable("competitors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  description: text("description"),
  services: text("services"),
  coverageStates: text("coverage_states"),
  tier: text("tier").notNull().default("regional"),
  headquarters: text("headquarters"),
  employeeCount: text("employee_count"),
  founded: text("founded"),
  notes: text("notes"),
  recentActivity: text("recent_activity"),
  contractWins: text("contract_wins"),
  intelligenceSources: text("intelligence_sources"),
  newsArticles: text("news_articles"),
  fecFilings: text("fec_filings"),
  lastResearched: timestamp("last_researched"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const federalIntelItemsTable = pgTable("federal_intel_items", {
  id: text("id").primaryKey(),
  bucket: text("bucket").notNull(),
  sourceType: text("source_type").notNull().default("other"),
  agency: text("agency"),
  component: text("component"),
  office: text("office"),
  regionCountry: text("region_country"),
  title: text("title").notNull(),
  summary: text("summary"),
  datePosted: timestamp("date_posted"),
  status: text("status"),
  contractorIncumbent: text("contractor_incumbent"),
  relatedRef: text("related_ref"),
  budgetSignal: text("budget_signal"),
  oversightSignal: text("oversight_signal"),
  medicalTravelRelevance: text("medical_travel_relevance"),
  occuMedScore: integer("occu_med_score").default(0),
  actionTag: text("action_tag").default("monitor"),
  sourceUrl: text("source_url"),
  rawJson: text("raw_json"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stateProfilesTable = pgTable("state_profiles", {
  stateCode: text("state_code").primaryKey(),
  stateName: text("state_name").notNull(),
  region: text("region").notNull().default(""),
  oshaStatePlan: text("osha_state_plan").notNull().default("federal"),
  procurementUrl: text("procurement_url"),
  legislatureUrl: text("legislature_url"),
  govUrl: text("gov_url"),
  healthDeptUrl: text("health_dept_url"),
  laborUrl: text("labor_url"),
  emergencyMgmtUrl: text("emergency_mgmt_url"),
  medicalBoardUrl: text("medical_board_url"),
  insuranceDeptUrl: text("insurance_dept_url"),
  correctionsUrl: text("corrections_url"),
  dotUrl: text("dot_url"),
  postCommissionUrl: text("post_commission_url"),
  lastRefreshed: text("last_refreshed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stateAgencyItemsTable = pgTable("state_agency_items", {
  id: text("id").primaryKey(),
  stateCode: text("state_code").notNull(),
  bucket: text("bucket").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  url: text("url"),
  publishedDate: text("published_date"),
  agency: text("agency"),
  itemType: text("item_type"),
  relevanceScore: integer("relevance_score").default(0),
  rawJson: text("raw_json"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stateIntelItemsTable = pgTable("state_intel_items", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  url: text("url"),
  publishedDate: text("published_date"),
  source: text("source"),
  severity: text("severity"),
  affectedStates: text("affected_states"),
  rawJson: text("raw_json"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


// OSHA ITA database persistence. The importer is the only writer; application services query these tables.
export const oshaImportRunsTable = pgTable("osha_import_runs", {
  id: serial("id").primaryKey(),
  datasetName: text("dataset_name").notNull(),
  datasetYear: integer("dataset_year").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  recordCount: integer("record_count").notNull().default(0),
  metadata: jsonb("metadata"),
});

export const oshaSourceFilesTable = pgTable("osha_source_files", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull().references(() => oshaImportRunsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  datasetYear: integer("dataset_year").notNull(),
  sha256: text("sha256"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

export const oshaEstablishmentsTable = pgTable("osha_establishments", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull().references(() => oshaImportRunsTable.id, { onDelete: "cascade" }),
  sourceFileId: integer("source_file_id").references(() => oshaSourceFilesTable.id, { onDelete: "set null" }),
  establishmentName: text("establishment_name").notNull(),
  companyName: text("company_name").notNull(),
  dbaName: text("dba_name"),
  normalizedEstablishmentName: text("normalized_establishment_name").notNull(),
  normalizedCompanyName: text("normalized_company_name").notNull(),
  normalizedDbaName: text("normalized_dba_name"),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  zip: text("zip").notNull().default(""),
  naics: text("naics").notNull().default(""),
  year: integer("year").notNull(),
  totalHoursWorked: integer("total_hours_worked"),
  totalCases: integer("total_cases"),
  dartCases: integer("dart_cases"),
  daysAwayCases: integer("days_away_cases"),
  jobTransferRestrictionCases: integer("job_transfer_restriction_cases"),
  caseCategories: jsonb("case_categories"),
  trcRate: real("trc_rate"),
  dartRate: real("dart_rate"),
  daysAwayRate: real("days_away_rate"),
  sourceUrl: text("source_url").notNull(),
  datasetName: text("dataset_name").notNull(),
  datasetYear: integer("dataset_year").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  lastImportedDate: timestamp("last_imported_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const employerAliasesTable = pgTable("employer_aliases", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  normalizedCanonicalName: text("normalized_canonical_name").notNull(),
  alias: text("alias").notNull(),
  normalizedAlias: text("normalized_alias").notNull(),
  source: text("source").notNull().default("manual"),
  confidence: real("confidence").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const oshaEntityMatchesTable = pgTable("osha_entity_matches", {
  id: serial("id").primaryKey(),
  oshaEstablishmentId: integer("osha_establishment_id").notNull().references(() => oshaEstablishmentsTable.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").references(() => entitiesTable.id, { onDelete: "set null" }),
  canonicalName: text("canonical_name").notNull(),
  matchedName: text("matched_name").notNull(),
  matchType: text("match_type").notNull().default("name"),
  confidence: real("confidence").notNull().default(0),
  reviewed: boolean("reviewed").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
