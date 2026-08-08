import { createHash, randomUUID } from "node:crypto";

type DbModule = typeof import("@workspace/db");
let dbModulePromise: Promise<DbModule> | null = null;
let ensurePromise: Promise<void> | null = null;

export type CompetitiveScope = "federal" | "state";
export type WatchlistStatus = "active" | "review" | "archived";

export type CompetitiveWatchlistRecord = {
  id: string;
  displayName: string;
  canonicalName: string;
  website: string | null;
  aliases: string[];
  uei: string | null;
  cage: string | null;
  recipientId: string | null;
  relationshipType: string;
  sourceScope: string;
  status: WatchlistStatus;
  evidenceUrl: string | null;
  evidenceNote: string | null;
  updatedAt: string;
};

export type CompetitiveAwardRecord = {
  id: string;
  competitorId: string | null;
  competitorName: string | null;
  sourceScope: CompetitiveScope;
  sourceName: string;
  stateCode: string | null;
  awardId: string;
  recipientName: string;
  recipientUei: string | null;
  title: string;
  description: string | null;
  agency: string | null;
  subagency: string | null;
  amount: number | null;
  actionDate: string | null;
  startDate: string | null;
  endDate: string | null;
  naics: string | null;
  psc: string | null;
  placeOfPerformance: string | null;
  sourceUrl: string;
  matchConfidence: number;
  matchMethod: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CompetitiveCandidateRecord = {
  id: string;
  displayName: string;
  normalizedName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  awardCount: number;
  totalValue: number;
  sourceScopes: string[];
  sampleAwards: Array<{ awardId: string; title: string; sourceName: string; amount: number | null }>;
  status: "candidate" | "approved" | "rejected";
};

export type CompetitiveSourceCoverage = {
  key: string;
  scope: CompetitiveScope;
  name: string;
  stateCode?: string;
  method: "api" | "open-data" | "official-index";
  configured: boolean;
  state: "ready" | "success" | "empty" | "disabled" | "error";
  resultCount: number;
  limitation: string;
  error?: string;
};

export type CompetitiveOverview = {
  watchlist: CompetitiveWatchlistRecord[];
  awards: CompetitiveAwardRecord[];
  candidates: CompetitiveCandidateRecord[];
  sourceCoverage: CompetitiveSourceCoverage[];
  summary: {
    watchedCompetitors: number;
    awardsInWindow: number;
    totalAwardValue: number;
    candidateCompetitors: number;
    federalAwards: number;
    stateAwards: number;
  };
  generatedAt: string;
};

type SeedCompetitor = {
  id: string;
  displayName: string;
  canonicalName: string;
  website: string;
  aliases: string[];
  relationshipType: string;
  sourceScope: string;
  status?: WatchlistStatus;
  evidenceUrl: string;
  evidenceNote: string;
};

const SEED_WATCHLIST: SeedCompetitor[] = [
  { id: "concentra", displayName: "Concentra", canonicalName: "Occupational Health Centers of the Southwest PA", website: "https://www.concentra.com", aliases: ["Concentra Medical Centers", "Concentra Inc", "Concentra"], relationshipType: "direct-national", sourceScope: "both", evidenceUrl: "https://spo.az.gov/ctr073228", evidenceNote: "National occupational health provider and Arizona statewide employee medical exam contractor." },
  { id: "workcare", displayName: "WorkCare", canonicalName: "WorkCare Inc", website: "https://workcare.com", aliases: ["WorkCare", "WorkCare Inc."], relationshipType: "direct-national", sourceScope: "both", evidenceUrl: "https://workcare.com/", evidenceNote: "Occupational health, medical surveillance, screening, injury prevention and workforce health." },
  { id: "premise-health", displayName: "Premise Health", canonicalName: "Premise Health Employer Solutions LLC", website: "https://www.premisehealth.com", aliases: ["Premise Health", "Premise Health Systems"], relationshipType: "direct-national", sourceScope: "both", evidenceUrl: "https://www.premisehealth.com/types-of-care/occupational-health/", evidenceNote: "Large direct healthcare and occupational health operator." },
  { id: "medcor", displayName: "Medcor", canonicalName: "Medcor Inc", website: "https://medcor.com", aliases: ["Medcor", "Medcor Inc."], relationshipType: "direct-national", sourceScope: "both", evidenceUrl: "https://medcor.com/", evidenceNote: "Onsite clinics, injury triage, telehealth and occupational health." },
  { id: "marathon-health", displayName: "Marathon Health", canonicalName: "Marathon Health LLC", website: "https://marathon.health", aliases: ["Marathon Health"], relationshipType: "direct-national", sourceScope: "state", evidenceUrl: "https://marathon.health/occupational-health/", evidenceNote: "Advanced primary care and occupational health for employers and public entities." },
  { id: "allone-health", displayName: "AllOne Health", canonicalName: "AllOne Health Resources Inc", website: "https://allonehealth.com", aliases: ["AllOne Health", "AllOne Health Resources"], relationshipType: "broader-workforce-health", sourceScope: "both", evidenceUrl: "https://allonehealth.com/", evidenceNote: "Broader workforce health provider with occupational health services." },
  { id: "axiom-medical", displayName: "Axiom Medical", canonicalName: "Axiom Medical Consulting LLC", website: "https://www.axiomllc.com", aliases: ["Axiom Medical", "Axiom Medical Consulting"], relationshipType: "direct-national", sourceScope: "both", status: "review", evidenceUrl: "https://www.axiomllc.com/", evidenceNote: "Direct service overlap; identity held in review because unrelated federal contractors also use the Axiom name." },
  { id: "ohd", displayName: "OHD / Occupational Health Dynamics", canonicalName: "OHD LLLP", website: "https://ohdglobal.com", aliases: ["OHD", "Occupational Health Dynamics", "OHD LLLP"], relationshipType: "adjacent-supplier", sourceScope: "both", status: "review", evidenceUrl: "https://ohdglobal.com/", evidenceNote: "Adjacent occupational safety/fit-testing supplier and services organization." },

  { id: "qtc", displayName: "Leidos QTC Health Services", canonicalName: "QTC Medical Services Inc", website: "https://www.qtcm.com", aliases: ["QTC Medical Services", "QTC Management", "Leidos QTC Health Services"], relationshipType: "government-exam-network", sourceScope: "federal", evidenceUrl: "https://www.qtcm.com/providers", evidenceNote: "Nationwide medical, disability and occupational health examination network for government programs." },
  { id: "acuity", displayName: "Acuity International", canonicalName: "Acuity International LLC", website: "https://acuityinternational.com", aliases: ["Acuity International", "Comprehensive Health Services", "CHSi"], relationshipType: "government-occupational-health", sourceScope: "both", evidenceUrl: "https://spo.az.gov/ctr073225", evidenceNote: "Occupational health TPA/provider network and Arizona statewide employee medical exam contractor." },
  { id: "stg-international", displayName: "STG International", canonicalName: "STG International Inc", website: "https://www.stginternational.com", aliases: ["STG International", "STGi"], relationshipType: "government-occupational-health", sourceScope: "federal", evidenceUrl: "https://www.stginternational.com", evidenceNote: "Federal occupational health staffing and clinical services contractor." },
  { id: "eagle-health", displayName: "Eagle Health", canonicalName: "Eagle Health LLC", website: "https://www.capitaleaglegroup.com", aliases: ["Eagle Health", "Eagle Health LLC"], relationshipType: "government-occupational-health", sourceScope: "federal", evidenceUrl: "https://www.capitaleaglegroup.com", evidenceNote: "Federal occupational health and medical services contractor." },
  { id: "inomedic", displayName: "Inomedic Health Applications", canonicalName: "Inomedic Health Applications Inc", website: "https://www.inomedic.com", aliases: ["Inomedic Health Applications", "IHA"], relationshipType: "government-occupational-health", sourceScope: "federal", evidenceUrl: "https://www.inomedic.com", evidenceNote: "Occupational, environmental and aerospace medical services for government programs." },
  { id: "mca-sedgwick", displayName: "Managed Care Advisors / Sedgwick", canonicalName: "Managed Care Advisors Inc", website: "https://www.mcaservices.com", aliases: ["Managed Care Advisors", "MCA-Sedgwick", "MCA Sedgwick"], relationshipType: "network-administrator", sourceScope: "federal", evidenceUrl: "https://www.cdc.gov/wtc/npn.html", evidenceNote: "Operates a nationwide provider network and medical appointment/case-management workflows for federal programs." },
  { id: "examinetics", displayName: "Examinetics", canonicalName: "Examinetics Inc", website: "https://www.examinetics.com", aliases: ["Examinetics", "Examinetics Inc."], relationshipType: "direct-national", sourceScope: "both", evidenceUrl: "https://www.examinetics.com", evidenceNote: "National occupational health surveillance network, mobile units and clinic access." },
  { id: "mobile-health", displayName: "Mobile Health", canonicalName: "Mobile Health Management Services Inc", website: "https://www.mobilehealth.com", aliases: ["Mobile Health", "Mobile Health Management Services"], relationshipType: "direct-national", sourceScope: "both", evidenceUrl: "https://www.mobilehealth.com", evidenceNote: "National occupational health and employee screening network." },
  { id: "lifehealth", displayName: "LifeHealth", canonicalName: "LifeHealth LLC", website: "https://www.lifehealthcorp.com", aliases: ["LifeHealth", "LifeHealth LLC"], relationshipType: "network-administrator", sourceScope: "both", evidenceUrl: "https://www.lifehealthcorp.com", evidenceNote: "National provider network for medical exams, fitness-for-duty, surveillance and readiness services." },
  { id: "mbi", displayName: "MBI Industrial Medicine", canonicalName: "MBI Industrial Medicine Inc", website: "https://www.gowithmbi.com", aliases: ["MBI Industrial Medicine", "MBI Acquisition Corp", "MBI Industrial Services"], relationshipType: "direct-regional", sourceScope: "state", evidenceUrl: "https://spo.az.gov/ctr073227", evidenceNote: "Arizona statewide employee medical exam contractor." },
  { id: "careatc", displayName: "CareATC", canonicalName: "CareATC Inc", website: "https://www.careatc.com", aliases: ["CareATC", "CareATC Inc."], relationshipType: "direct-onsite", sourceScope: "state", evidenceUrl: "https://www.careatc.com", evidenceNote: "Employer and public-sector onsite health, occupational health and screening services." },
  { id: "international-sos", displayName: "International SOS", canonicalName: "International SOS Government Medical Services Inc", website: "https://www.internationalsos.com", aliases: ["International SOS", "International SOS Government Medical Services"], relationshipType: "global-workforce-medical", sourceScope: "both", evidenceUrl: "https://www.internationalsos.com", evidenceNote: "Global workforce/deployment medical and occupational health services." },
  { id: "banner-oh", displayName: "Banner Occupational Health", canonicalName: "Banner Occupational Health Arizona LLC", website: "https://www.bannerhealth.com", aliases: ["Banner Occupational Health Clinics", "Banner Occupational Health Arizona"], relationshipType: "direct-regional", sourceScope: "state", evidenceUrl: "https://spo.az.gov/ctr073226", evidenceNote: "Arizona statewide employee medical exam contractor." },
  { id: "kaiser-otj", displayName: "Kaiser Permanente On-the-Job", canonicalName: "Kaiser Foundation Health Plan Inc", website: "https://healthy.kaiserpermanente.org", aliases: ["Kaiser Permanente On-the-Job", "Kaiser Permanente Occupational Health"], relationshipType: "direct-regional", sourceScope: "state", evidenceUrl: "https://healthy.kaiserpermanente.org", evidenceNote: "Employer occupational health programs and public-sector contract activity." },
  { id: "akeso-agile", displayName: "Akeso / Agile Occupational Medicine", canonicalName: "Akeso Occupational Health", website: "https://www.akesohealth.com", aliases: ["Akeso Occupational Health", "Agile Occupational Medicine", "Akeso Medical Holdings"], relationshipType: "direct-regional", sourceScope: "state", evidenceUrl: "https://www.akesohealth.com", evidenceNote: "Large independent occupational medicine platform in the western U.S." },
  { id: "apple-occupational", displayName: "Apple Occupational Medical Services", canonicalName: "Apple Occupational Medical Services LLC", website: "https://www.appleoccupational.com", aliases: ["Apple Occupational Medical Services", "Apple Occupational"], relationshipType: "government-occupational-health", sourceScope: "federal", evidenceUrl: "https://www.appleoccupational.com", evidenceNote: "Occupational medical contractor with federal medical-services activity." },

  { id: "optumserve", displayName: "OptumServe Health Services / LHI", canonicalName: "OptumServe Health Services Inc", website: "https://www.optum.com/business/federal-government.html", aliases: ["OptumServe Health Services", "Optum Serve Health Services", "Logistics Health Incorporated", "LHI"], relationshipType: "government-exam-network", sourceScope: "federal", evidenceUrl: "https://business.optum.com/en/access/federal-health-services/federal-health-programs.html", evidenceNote: "Large government medical examination and specialty-referral network; formerly LHI." },
  { id: "loyal-source", displayName: "Loyal Source Government Services", canonicalName: "Loyal Source Government Services LLC", website: "https://www.loyalsource.com", aliases: ["Loyal Source", "Loyal Source Government Services"], relationshipType: "government-exam-network", sourceScope: "federal", evidenceUrl: "https://www.loyalsource.com/occupational-health/", evidenceNote: "Federal/state occupational health, drug testing, medical screening and government medical exams." },
  { id: "ves", displayName: "Veterans Evaluation Services", canonicalName: "Veterans Evaluation Services Inc", website: "https://www.ves.com", aliases: ["Veterans Evaluation Services", "VES"], relationshipType: "government-exam-network", sourceScope: "federal", evidenceUrl: "https://www.ves.com/providers/", evidenceNote: "Global provider network administering government medical examinations." },
  { id: "escreen", displayName: "eScreen / Abbott", canonicalName: "eScreen Inc", website: "https://www.escreen.com", aliases: ["eScreen", "eScreen Inc", "Abbott eScreen"], relationshipType: "network-administrator", sourceScope: "both", evidenceUrl: "https://www.escreen.com/us/en/home/employers/dot-employers/occupational-health-services-and-physical-exams.html", evidenceNote: "Large nationwide occupational health clinic network and program-administration platform." },
  { id: "disa", displayName: "DISA Global Solutions", canonicalName: "DISA Global Solutions Inc", website: "https://disa.com", aliases: ["DISA Global Solutions", "DISA"], relationshipType: "network-administrator", sourceScope: "both", evidenceUrl: "https://disa.com/employer-health-services/physical-exams/", evidenceNote: "Occupational health, physical exams, audiometry, respiratory services and workforce screening." },
  { id: "first-advantage", displayName: "First Advantage", canonicalName: "First Advantage Corporation", website: "https://fadv.com", aliases: ["First Advantage", "Sterling", "Sterling Check"], relationshipType: "network-administrator", sourceScope: "both", evidenceUrl: "https://fadv.com/solutions/occupational-health-screening/", evidenceNote: "Large employment screening and occupational health network with physical and medical services." },
  { id: "examworks", displayName: "ExamWorks", canonicalName: "ExamWorks LLC", website: "https://www.examworks.com", aliases: ["ExamWorks", "ExamWorks LLC"], relationshipType: "adjacent-medical-exams", sourceScope: "both", status: "review", evidenceUrl: "https://www.examworks.com/about/about-examworks", evidenceNote: "Independent medical examination network serving insurers, employers and government agencies." },
];

const REVERSE_TERMS = [
  "occupational health services",
  "occupational medical services",
  "employee medical examinations",
  "medical surveillance",
  "fitness for duty medical evaluations",
  "pre-employment medical examinations",
  "medical evaluation screening",
  "deployment medical readiness",
];

const STATE_OFFICIAL_INDEX_SOURCES = [
  { key: "az-spo", stateCode: "AZ", name: "Arizona State Procurement Office", domain: "spo.az.gov" },
  { key: "tx-lbb", stateCode: "TX", name: "Texas Legislative Budget Board Contracts", domain: "contracts.lbb.texas.gov" },
  { key: "ca-dgs", stateCode: "CA", name: "California DGS / Cal eProcure", domain: "caleprocure.ca.gov" },
  { key: "mi-dtmb", stateCode: "MI", name: "Michigan DTMB Procurement", domain: "michigan.gov" },
  { key: "pa-emarketplace", stateCode: "PA", name: "Pennsylvania eMarketplace", domain: "emarketplace.state.pa.us" },
] as const;

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

async function getDbModule(): Promise<DbModule> {
  if (!dbModulePromise) dbModulePromise = import("@workspace/db");
  return dbModulePromise;
}

export function normalizeCompetitiveName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|pllc|pa|pc|holdings|holding|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return ""; }
  }
  return String(value).trim();
}

function firstValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const direct = text(record[key]);
    if (direct) return direct;
    const actualKey = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (actualKey) {
      const candidate = text(record[actualKey]);
      if (candidate) return candidate;
    }
  }
  return "";
}

function hashId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
  return escapeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function matchCompetitiveIdentity(
  recipientName: string,
  recipientUei: string | null | undefined,
  watchlist: CompetitiveWatchlistRecord[],
): { competitor: CompetitiveWatchlistRecord; confidence: number; method: string } | null {
  const normalized = normalizeCompetitiveName(recipientName);
  if (!normalized) return null;

  if (recipientUei) {
    const byUei = watchlist.find((item) => item.uei && item.uei.toUpperCase() === recipientUei.toUpperCase());
    if (byUei) return { competitor: byUei, confidence: 1, method: "uei" };
  }

  for (const competitor of watchlist) {
    const names = [competitor.canonicalName, competitor.displayName, ...competitor.aliases]
      .map(normalizeCompetitiveName)
      .filter(Boolean);
    if (names.includes(normalized)) return { competitor, confidence: 0.99, method: "exact-name-or-alias" };
  }

  // Deliberately conservative. Do not use substring/fuzzy matching here: short or
  // generic brands such as “Axiom” have produced unrelated award false positives.
  return null;
}

export async function ensureCompetitiveAwardsPersistence(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for competitive awards persistence.");
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const { pool } = await getDbModule();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS competitive_watchlist (
          id text PRIMARY KEY,
          display_name text NOT NULL,
          canonical_name text NOT NULL,
          website text,
          aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
          uei text,
          cage text,
          recipient_id text,
          relationship_type text NOT NULL DEFAULT 'direct',
          source_scope text NOT NULL DEFAULT 'both',
          status text NOT NULL DEFAULT 'active',
          evidence_url text,
          evidence_note text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS competitive_awards (
          id text PRIMARY KEY,
          competitor_id text REFERENCES competitive_watchlist(id) ON DELETE SET NULL,
          source_scope text NOT NULL,
          source_name text NOT NULL,
          state_code text,
          award_id text NOT NULL,
          parent_award_id text,
          recipient_name text NOT NULL,
          recipient_uei text,
          title text NOT NULL,
          description text,
          agency text,
          subagency text,
          office text,
          amount numeric,
          action_date date,
          start_date date,
          end_date date,
          naics text,
          psc text,
          place_of_performance text,
          source_url text NOT NULL,
          match_confidence real NOT NULL DEFAULT 0,
          match_method text NOT NULL DEFAULT 'unmatched',
          raw_json jsonb,
          first_seen_at timestamp NOT NULL DEFAULT now(),
          last_seen_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS competitive_candidates (
          id text PRIMARY KEY,
          display_name text NOT NULL,
          normalized_name text NOT NULL UNIQUE,
          first_seen_at timestamp NOT NULL DEFAULT now(),
          last_seen_at timestamp NOT NULL DEFAULT now(),
          award_count integer NOT NULL DEFAULT 0,
          total_value numeric NOT NULL DEFAULT 0,
          source_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
          sample_awards jsonb NOT NULL DEFAULT '[]'::jsonb,
          status text NOT NULL DEFAULT 'candidate',
          approved_competitor_id text REFERENCES competitive_watchlist(id) ON DELETE SET NULL,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS competitive_refresh_runs (
          id text PRIMARY KEY,
          started_at timestamp NOT NULL DEFAULT now(),
          completed_at timestamp,
          status text NOT NULL DEFAULT 'running',
          federal_awards integer NOT NULL DEFAULT 0,
          state_awards integer NOT NULL DEFAULT 0,
          candidates_seen integer NOT NULL DEFAULT 0,
          source_status jsonb,
          warnings jsonb,
          created_at timestamp NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS competitive_awards_competitor_idx ON competitive_awards (competitor_id, action_date DESC);
        CREATE INDEX IF NOT EXISTS competitive_awards_scope_idx ON competitive_awards (source_scope, action_date DESC);
        CREATE INDEX IF NOT EXISTS competitive_awards_recipient_uei_idx ON competitive_awards (recipient_uei);
        CREATE INDEX IF NOT EXISTS competitive_candidates_status_idx ON competitive_candidates (status, award_count DESC);
        CREATE INDEX IF NOT EXISTS competitive_watchlist_uei_idx ON competitive_watchlist (uei);
      `);

      for (const seed of SEED_WATCHLIST) {
        await pool.query(
          `INSERT INTO competitive_watchlist
            (id, display_name, canonical_name, website, aliases, relationship_type, source_scope, status, evidence_url, evidence_note)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             canonical_name = EXCLUDED.canonical_name,
             website = EXCLUDED.website,
             aliases = EXCLUDED.aliases,
             relationship_type = EXCLUDED.relationship_type,
             source_scope = EXCLUDED.source_scope,
             evidence_url = EXCLUDED.evidence_url,
             evidence_note = EXCLUDED.evidence_note,
             updated_at = now()`,
          [seed.id, seed.displayName, seed.canonicalName, seed.website, JSON.stringify(seed.aliases), seed.relationshipType, seed.sourceScope, seed.status ?? "active", seed.evidenceUrl, seed.evidenceNote],
        );
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

async function readWatchlist(): Promise<CompetitiveWatchlistRecord[]> {
  await ensureCompetitiveAwardsPersistence();
  const { pool } = await getDbModule();
  const { rows } = await pool.query(`
    SELECT id, display_name, canonical_name, website, aliases, uei, cage, recipient_id,
           relationship_type, source_scope, status, evidence_url, evidence_note, updated_at
      FROM competitive_watchlist
     WHERE status <> 'archived'
     ORDER BY display_name ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    canonicalName: row.canonical_name,
    website: row.website,
    aliases: parseJsonArray(row.aliases),
    uei: row.uei,
    cage: row.cage,
    recipientId: row.recipient_id,
    relationshipType: row.relationship_type,
    sourceScope: row.source_scope,
    status: row.status,
    evidenceUrl: row.evidence_url,
    evidenceNote: row.evidence_note,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

async function upsertAward(award: Omit<CompetitiveAwardRecord, "competitorName" | "firstSeenAt" | "lastSeenAt"> & { rawJson?: unknown }): Promise<void> {
  const { pool } = await getDbModule();
  await pool.query(
    `INSERT INTO competitive_awards
      (id, competitor_id, source_scope, source_name, state_code, award_id, recipient_name, recipient_uei,
       title, description, agency, subagency, amount, action_date, start_date, end_date, naics, psc,
       place_of_performance, source_url, match_confidence, match_method, raw_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       competitor_id = EXCLUDED.competitor_id,
       recipient_name = EXCLUDED.recipient_name,
       recipient_uei = COALESCE(EXCLUDED.recipient_uei, competitive_awards.recipient_uei),
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       agency = EXCLUDED.agency,
       subagency = EXCLUDED.subagency,
       amount = EXCLUDED.amount,
       action_date = EXCLUDED.action_date,
       start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date,
       naics = EXCLUDED.naics,
       psc = EXCLUDED.psc,
       place_of_performance = EXCLUDED.place_of_performance,
       source_url = EXCLUDED.source_url,
       match_confidence = EXCLUDED.match_confidence,
       match_method = EXCLUDED.match_method,
       raw_json = EXCLUDED.raw_json,
       last_seen_at = now()`,
    [award.id, award.competitorId, award.sourceScope, award.sourceName, award.stateCode, award.awardId, award.recipientName, award.recipientUei, award.title, award.description, award.agency, award.subagency, award.amount, award.actionDate, award.startDate, award.endDate, award.naics, award.psc, award.placeOfPerformance, award.sourceUrl, award.matchConfidence, award.matchMethod, JSON.stringify(award.rawJson ?? {})],
  );
}

async function recordCandidate(name: string, scope: CompetitiveScope, award: { awardId: string; title: string; sourceName: string; amount: number | null }): Promise<void> {
  const normalized = normalizeCompetitiveName(name);
  if (!normalized || normalized.length < 4) return;
  const { pool } = await getDbModule();
  const id = `candidate-${hashId(normalized)}`;
  const existing = await pool.query(`SELECT source_scopes, sample_awards FROM competitive_candidates WHERE normalized_name = $1 LIMIT 1`, [normalized]);
  const scopes = new Set<string>(parseJsonArray(existing.rows[0]?.source_scopes));
  scopes.add(scope);
  const samples = Array.isArray(existing.rows[0]?.sample_awards) ? existing.rows[0].sample_awards as Array<Record<string, unknown>> : [];
  if (!samples.some((item) => text(item.awardId) === award.awardId)) samples.unshift(award);
  const sampleAwards = samples.slice(0, 6);
  await pool.query(
    `INSERT INTO competitive_candidates
      (id, display_name, normalized_name, award_count, total_value, source_scopes, sample_awards)
     VALUES ($1,$2,$3,1,$4,$5::jsonb,$6::jsonb)
     ON CONFLICT (normalized_name) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       last_seen_at = now(),
       award_count = competitive_candidates.award_count + 1,
       total_value = competitive_candidates.total_value + EXCLUDED.total_value,
       source_scopes = EXCLUDED.source_scopes,
       sample_awards = EXCLUDED.sample_awards,
       updated_at = now()`,
    [id, name, normalized, award.amount ?? 0, JSON.stringify([...scopes]), JSON.stringify(sampleAwards)],
  );
}

async function updateResolvedUei(competitor: CompetitiveWatchlistRecord, recipientUei: string | null, recipientId: string | null): Promise<void> {
  if (!recipientUei && !recipientId) return;
  const { pool } = await getDbModule();
  await pool.query(
    `UPDATE competitive_watchlist
        SET uei = COALESCE(uei, $2), recipient_id = COALESCE(recipient_id, $3), updated_at = now()
      WHERE id = $1`,
    [competitor.id, recipientUei, recipientId],
  );
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 25_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function usaSpendingSearch(filters: Record<string, unknown>, limit = 50): Promise<Record<string, unknown>[]> {
  const payload = await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "Occu-Med Insight Hub 2 competitive awards" },
    body: JSON.stringify({
      filters,
      fields: ["Award ID", "Recipient Name", "Recipient UEI", "Award Amount", "Description", "Base Obligation Date", "Start Date", "End Date", "Awarding Agency", "Awarding Sub Agency", "Primary Place of Performance", "NAICS", "PSC", "recipient_id", "generated_internal_id"],
      page: 1,
      limit,
      sort: "Award Amount",
      order: "desc",
      subawards: false,
    }),
  });
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return Array.isArray(record.results) ? record.results.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function usaAward(row: Record<string, unknown>, match: ReturnType<typeof matchCompetitiveIdentity>, scope: CompetitiveScope = "federal"): Omit<CompetitiveAwardRecord, "competitorName" | "firstSeenAt" | "lastSeenAt"> & { rawJson: unknown } | null {
  const awardId = firstValue(row, ["Award ID", "award_id", "generated_internal_id"]);
  const recipientName = firstValue(row, ["Recipient Name", "recipient_name"]);
  if (!awardId || !recipientName) return null;
  const generatedId = firstValue(row, ["generated_internal_id"]);
  const amount = safeNumber(row["Award Amount"] ?? row.award_amount);
  const description = firstValue(row, ["Description", "description"]);
  const agency = firstValue(row, ["Awarding Agency", "awarding_agency"]);
  const subagency = firstValue(row, ["Awarding Sub Agency", "awarding_sub_agency"]);
  const recipientUei = firstValue(row, ["Recipient UEI", "recipient_uei"]) || null;
  const recipientId = firstValue(row, ["recipient_id"]);
  const actionDate = dateOnly(row["Base Obligation Date"] ?? row.base_obligation_date ?? row["Start Date"]);
  const startDate = dateOnly(row["Start Date"] ?? row.start_date);
  const endDate = dateOnly(row["End Date"] ?? row.end_date);
  const naics = firstValue(row, ["NAICS", "naics"]);
  const psc = firstValue(row, ["PSC", "psc"]);
  const place = firstValue(row, ["Primary Place of Performance", "Place of Performance State Code", "place_of_performance"]);
  const sourceUrl = generatedId ? `https://www.usaspending.gov/award/${encodeURIComponent(generatedId)}` : "https://www.usaspending.gov/";
  if (match?.competitor && recipientUei) void updateResolvedUei(match.competitor, recipientUei, recipientId || null);
  return {
    id: `${scope}-usaspending-${hashId(awardId, recipientName)}`,
    competitorId: match?.competitor.id ?? null,
    sourceScope: scope,
    sourceName: "USAspending",
    stateCode: null,
    awardId,
    recipientName,
    recipientUei,
    title: description || awardId,
    description: description || null,
    agency: agency || null,
    subagency: subagency || null,
    amount,
    actionDate,
    startDate,
    endDate,
    naics: naics || null,
    psc: psc || null,
    placeOfPerformance: place || null,
    sourceUrl,
    matchConfidence: match?.confidence ?? 0,
    matchMethod: match?.method ?? "unmatched-reverse-search",
    rawJson: row,
  };
}

async function refreshFederal(watchlist: CompetitiveWatchlistRecord[], fromDate: string, toDate: string): Promise<{ count: number; candidateCount: number; coverage: CompetitiveSourceCoverage; warnings: string[] }> {
  let count = 0;
  let candidateCount = 0;
  const warnings: string[] = [];
  const seenAwards = new Set<string>();
  const active = watchlist.filter((item) => item.status === "active" && item.sourceScope !== "state");

  const runOne = async (competitor: CompetitiveWatchlistRecord) => {
    const rows = await usaSpendingSearch({
      recipient_search_text: [competitor.uei || competitor.canonicalName],
      time_period: [{ start_date: fromDate, end_date: toDate, date_type: "new_awards_only" }],
      award_type_codes: ["A", "B", "C", "D", "IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
    }, 25);
    for (const row of rows) {
      const recipient = firstValue(row, ["Recipient Name"]);
      const uei = firstValue(row, ["Recipient UEI"]);
      const match = matchCompetitiveIdentity(recipient, uei, watchlist);
      if (!match || match.competitor.id !== competitor.id) continue;
      const award = usaAward(row, match);
      if (!award || seenAwards.has(award.id)) continue;
      seenAwards.add(award.id);
      await upsertAward(award);
      count += 1;
    }
  };

  for (let index = 0; index < active.length; index += 5) {
    const batch = active.slice(index, index + 5);
    const settled = await Promise.allSettled(batch.map(runOne));
    for (const result of settled) if (result.status === "rejected") warnings.push(`Watchlist query failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  }

  for (const term of REVERSE_TERMS) {
    try {
      const rows = await usaSpendingSearch({
        keywords: [term],
        time_period: [{ start_date: fromDate, end_date: toDate, date_type: "new_awards_only" }],
        award_type_codes: ["A", "B", "C", "D", "IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
      }, 50);
      for (const row of rows) {
        const recipient = firstValue(row, ["Recipient Name"]);
        if (!recipient) continue;
        const uei = firstValue(row, ["Recipient UEI"]);
        const match = matchCompetitiveIdentity(recipient, uei, watchlist);
        const award = usaAward(row, match);
        if (!award) continue;
        if (match) {
          if (!seenAwards.has(award.id)) {
            seenAwards.add(award.id);
            await upsertAward(award);
            count += 1;
          }
        } else {
          await recordCandidate(recipient, "federal", { awardId: award.awardId, title: award.title, sourceName: award.sourceName, amount: award.amount });
          candidateCount += 1;
        }
      }
    } catch (error) {
      warnings.push(`Reverse search for “${term}” failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    count,
    candidateCount,
    coverage: {
      key: "usaspending",
      scope: "federal",
      name: "USAspending federal awards",
      method: "api",
      configured: true,
      state: count > 0 ? "success" : warnings.length ? "error" : "empty",
      resultCount: count,
      limitation: "Keyless official federal award API. Identity attribution requires an exact verified legal name/alias or UEI match; fuzzy names are not accepted.",
      ...(warnings.length ? { error: warnings[0] } : {}),
    },
    warnings,
  };
}

function relevanceText(record: Record<string, unknown>): string {
  return Object.values(record).map(text).join(" ").toLowerCase();
}

function isRelevantStateRecord(record: Record<string, unknown>): boolean {
  const value = relevanceText(record);
  return ["occupational health", "medical exam", "medical examination", "medical surveillance", "fitness for duty", "drug testing", "audiogram", "hearing conservation", "respirator", "employee health"].some((term) => value.includes(term));
}

async function refreshOregon(watchlist: CompetitiveWatchlistRecord[]): Promise<{ count: number; candidateCount: number; coverage: CompetitiveSourceCoverage; warnings: string[] }> {
  const sourceName = "OregonBuys Purchases and Contracts Open Data";
  try {
    const payload = await fetchJson("https://data.oregon.gov/resource/qyug-f2km.json?$limit=5000");
    const rows = Array.isArray(payload) ? payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
    let count = 0;
    let candidateCount = 0;
    for (const row of rows) {
      if (!isRelevantStateRecord(row)) continue;
      const recipientName = firstValue(row, ["supplier_name", "supplier", "vendor_name", "vendor", "contractor_name", "payee_name"]);
      if (!recipientName) continue;
      const awardId = firstValue(row, ["contract_number", "contract_id", "purchase_order_number", "po_number", "document_number", "record_id"]) || hashId(recipientName, relevanceText(row).slice(0, 200));
      const title = firstValue(row, ["contract_title", "description", "contract_description", "item_description", "document_description", "commodity_description"]) || "Oregon procurement record";
      const amount = safeNumber(firstValue(row, ["contract_amount", "total_amount", "amount", "current_contract_value", "purchase_order_total"]));
      const match = matchCompetitiveIdentity(recipientName, null, watchlist);
      const record: Omit<CompetitiveAwardRecord, "competitorName" | "firstSeenAt" | "lastSeenAt"> & { rawJson: unknown } = {
        id: `state-or-${hashId(awardId, recipientName)}`,
        competitorId: match?.competitor.id ?? null,
        sourceScope: "state",
        sourceName,
        stateCode: "OR",
        awardId,
        recipientName,
        recipientUei: null,
        title,
        description: title,
        agency: firstValue(row, ["agency_name", "agency", "department_name", "department"]) || null,
        subagency: null,
        amount,
        actionDate: dateOnly(firstValue(row, ["award_date", "contract_date", "purchase_order_date", "start_date", "date"])),
        startDate: dateOnly(firstValue(row, ["start_date", "contract_start_date"])),
        endDate: dateOnly(firstValue(row, ["end_date", "contract_end_date"])),
        naics: null,
        psc: firstValue(row, ["commodity_code", "unspsc", "commodity"]) || null,
        placeOfPerformance: "Oregon",
        sourceUrl: "https://data.oregon.gov/Revenue-Expense/OregonBuys-Purchases-and-Contracts-Multi-Year-Repo/qyug-f2km",
        matchConfidence: match?.confidence ?? 0,
        matchMethod: match?.method ?? "unmatched-state-open-data",
        rawJson: row,
      };
      if (match) {
        await upsertAward(record);
        count += 1;
      } else {
        await recordCandidate(recipientName, "state", { awardId, title, sourceName, amount });
        candidateCount += 1;
      }
    }
    return { count, candidateCount, warnings: [], coverage: { key: "or-oregonbuys", scope: "state", stateCode: "OR", name: sourceName, method: "open-data", configured: true, state: count || candidateCount ? "success" : "empty", resultCount: count + candidateCount, limitation: "Official OregonBuys multi-year open-data extract; publishing cadence is periodic rather than real-time." } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { count: 0, candidateCount: 0, warnings: [`OregonBuys: ${message}`], coverage: { key: "or-oregonbuys", scope: "state", stateCode: "OR", name: sourceName, method: "open-data", configured: true, state: "error", resultCount: 0, limitation: "Official OregonBuys multi-year open-data extract.", error: message } };
  }
}

function langSearchKeys(): string[] {
  return [getEnv("LANGSEARCH_API_KEY"), getEnv("LANGSEARCH_API_KEY_2"), getEnv("LANGSEARCH_API_KEY_3"), getEnv("LANGSEARCH_API_KEY_4")].filter((item): item is string => Boolean(item));
}

async function officialIndexSearch(query: string): Promise<Array<{ title: string; url: string; summary: string }>> {
  const keys = langSearchKeys();
  if (!keys.length) throw new Error("LANGSEARCH_API_KEY is not configured");
  let lastError: unknown = null;
  for (const key of keys) {
    try {
      const payload = await fetchJson("https://api.langsearch.com/v1/web-search", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, freshness: "oneYear", summary: true, count: 10 }),
      });
      const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : {};
      const pages = data.webPages && typeof data.webPages === "object" ? data.webPages as Record<string, unknown> : {};
      const values = Array.isArray(pages.value) ? pages.value : [];
      return values.flatMap((item): Array<{ title: string; url: string; summary: string }> => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const url = firstValue(row, ["url"]);
        if (!url) return [];
        return [{ title: stripHtml(firstValue(row, ["name", "title"])), url, summary: stripHtml(firstValue(row, ["summary", "snippet"])) }];
      });
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Official index search failed");
}

function extractSupplierFromOfficialResult(value: string): string | null {
  const patterns = [
    /supplier\s*[:\-]\s*([^|·;]{3,100})/i,
    /vendor\s*[:\-]\s*([^|·;]{3,100})/i,
    /contractor\s*[:\-]\s*([^|·;]{3,100})/i,
    /awarded\s+to\s+([^|·;,.]{3,100})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

async function refreshOfficialStateIndexes(watchlist: CompetitiveWatchlistRecord[]): Promise<{ count: number; candidateCount: number; coverage: CompetitiveSourceCoverage[]; warnings: string[] }> {
  const configured = langSearchKeys().length > 0;
  if (!configured) {
    return {
      count: 0,
      candidateCount: 0,
      warnings: ["Official state index search disabled because LANGSEARCH_API_KEY is not configured."],
      coverage: STATE_OFFICIAL_INDEX_SOURCES.map((source) => ({ key: source.key, scope: "state", stateCode: source.stateCode, name: source.name, method: "official-index", configured: false, state: "disabled", resultCount: 0, limitation: `Search is restricted to the official ${source.domain} domain and every surfaced record links back to that primary state source.` })),
    };
  }

  let count = 0;
  let candidateCount = 0;
  const warnings: string[] = [];
  const coverage: CompetitiveSourceCoverage[] = [];
  for (const source of STATE_OFFICIAL_INDEX_SOURCES) {
    let sourceCount = 0;
    try {
      const results = await officialIndexSearch(`site:${source.domain} ("occupational health" OR "medical exam" OR "medical surveillance" OR "fitness for duty" OR "drug testing") (contract OR award OR supplier OR vendor)`);
      for (const result of results) {
        if (!result.url.includes(source.domain)) continue;
        const combined = `${result.title} ${result.summary}`;
        const supplier = extractSupplierFromOfficialResult(combined);
        if (!supplier) continue;
        const match = matchCompetitiveIdentity(supplier, null, watchlist);
        const awardId = combined.match(/\b(?:CTR|contract\s*#?\s*|award\s*#?\s*)([A-Z0-9-]{5,})\b/i)?.[1] ?? hashId(result.url);
        const amountMatch = combined.match(/\$\s*([0-9,.]+(?:\s*(?:million|billion|m|b))?)/i)?.[1] ?? "";
        let amount = safeNumber(amountMatch);
        if (/million|\bm\b/i.test(amountMatch) && amount !== null) amount *= 1_000_000;
        if (/billion|\bb\b/i.test(amountMatch) && amount !== null) amount *= 1_000_000_000;
        if (match) {
          await upsertAward({
            id: `state-${source.stateCode.toLowerCase()}-${hashId(awardId, supplier, result.url)}`,
            competitorId: match.competitor.id,
            sourceScope: "state",
            sourceName: source.name,
            stateCode: source.stateCode,
            awardId,
            recipientName: supplier,
            recipientUei: null,
            title: result.title || awardId,
            description: result.summary || null,
            agency: null,
            subagency: null,
            amount,
            actionDate: null,
            startDate: null,
            endDate: null,
            naics: null,
            psc: null,
            placeOfPerformance: source.stateCode,
            sourceUrl: result.url,
            matchConfidence: match.confidence,
            matchMethod: `${match.method}+official-state-domain`,
            rawJson: result,
          });
          count += 1;
        } else {
          await recordCandidate(supplier, "state", { awardId, title: result.title || awardId, sourceName: source.name, amount });
          candidateCount += 1;
        }
        sourceCount += 1;
      }
      coverage.push({ key: source.key, scope: "state", stateCode: source.stateCode, name: source.name, method: "official-index", configured: true, state: sourceCount ? "success" : "empty", resultCount: sourceCount, limitation: `Restricted to the official ${source.domain} domain; source links are retained for human verification.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${source.name}: ${message}`);
      coverage.push({ key: source.key, scope: "state", stateCode: source.stateCode, name: source.name, method: "official-index", configured: true, state: "error", resultCount: 0, limitation: `Restricted to the official ${source.domain} domain.`, error: message });
    }
  }
  return { count, candidateCount, coverage, warnings };
}

export async function refreshCompetitiveAwards(days = 365): Promise<{ runId: string; federalAwards: number; stateAwards: number; candidatesSeen: number; sourceCoverage: CompetitiveSourceCoverage[]; warnings: string[] }> {
  await ensureCompetitiveAwardsPersistence();
  const { pool } = await getDbModule();
  const runId = randomUUID();
  await pool.query(`INSERT INTO competitive_refresh_runs (id) VALUES ($1)`, [runId]);
  const to = new Date();
  const from = new Date(to.getTime() - Math.max(7, Math.min(days, 730)) * 86_400_000);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);
  const watchlist = await readWatchlist();
  const warnings: string[] = [];
  const sourceCoverage: CompetitiveSourceCoverage[] = [];
  let federalAwards = 0;
  let stateAwards = 0;
  let candidatesSeen = 0;
  try {
    const federal = await refreshFederal(watchlist, fromDate, toDate);
    federalAwards += federal.count;
    candidatesSeen += federal.candidateCount;
    warnings.push(...federal.warnings);
    sourceCoverage.push(federal.coverage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`USAspending refresh failed: ${message}`);
    sourceCoverage.push({ key: "usaspending", scope: "federal", name: "USAspending federal awards", method: "api", configured: true, state: "error", resultCount: 0, limitation: "Official keyless federal award API.", error: message });
  }

  const oregon = await refreshOregon(watchlist);
  stateAwards += oregon.count;
  candidatesSeen += oregon.candidateCount;
  warnings.push(...oregon.warnings);
  sourceCoverage.push(oregon.coverage);

  const indexed = await refreshOfficialStateIndexes(watchlist);
  stateAwards += indexed.count;
  candidatesSeen += indexed.candidateCount;
  warnings.push(...indexed.warnings);
  sourceCoverage.push(...indexed.coverage);

  await pool.query(
    `UPDATE competitive_refresh_runs
        SET completed_at = now(), status = 'completed', federal_awards = $2, state_awards = $3,
            candidates_seen = $4, source_status = $5::jsonb, warnings = $6::jsonb
      WHERE id = $1`,
    [runId, federalAwards, stateAwards, candidatesSeen, JSON.stringify(sourceCoverage), JSON.stringify(warnings)],
  );
  return { runId, federalAwards, stateAwards, candidatesSeen, sourceCoverage, warnings };
}

async function readLatestCoverage(): Promise<CompetitiveSourceCoverage[]> {
  const { pool } = await getDbModule();
  const { rows } = await pool.query(`SELECT source_status FROM competitive_refresh_runs WHERE status = 'completed' ORDER BY completed_at DESC NULLS LAST LIMIT 1`);
  const value = rows[0]?.source_status;
  return Array.isArray(value) ? value as CompetitiveSourceCoverage[] : [
    { key: "usaspending", scope: "federal", name: "USAspending federal awards", method: "api", configured: true, state: "ready", resultCount: 0, limitation: "Official keyless federal award API. Run Refresh to establish the first snapshot." },
    { key: "or-oregonbuys", scope: "state", stateCode: "OR", name: "OregonBuys Purchases and Contracts Open Data", method: "open-data", configured: true, state: "ready", resultCount: 0, limitation: "Official structured state procurement dataset." },
    ...STATE_OFFICIAL_INDEX_SOURCES.map((source): CompetitiveSourceCoverage => ({ key: source.key, scope: "state", stateCode: source.stateCode, name: source.name, method: "official-index", configured: langSearchKeys().length > 0, state: langSearchKeys().length > 0 ? "ready" : "disabled", resultCount: 0, limitation: `Restricted to the official ${source.domain} domain.` })),
  ];
}

export async function getCompetitiveOverview(days = 365): Promise<CompetitiveOverview> {
  await ensureCompetitiveAwardsPersistence();
  const { pool } = await getDbModule();
  const boundedDays = Math.max(7, Math.min(days, 730));
  const [watchlist, awardRows, candidateRows, sourceCoverage] = await Promise.all([
    readWatchlist(),
    pool.query(`
      SELECT a.*, w.display_name AS competitor_name
        FROM competitive_awards a
        LEFT JOIN competitive_watchlist w ON w.id = a.competitor_id
       WHERE COALESCE(a.action_date, a.first_seen_at::date) >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
       ORDER BY COALESCE(a.action_date, a.first_seen_at::date) DESC, a.amount DESC NULLS LAST
       LIMIT 600
    `, [boundedDays]),
    pool.query(`
      SELECT * FROM competitive_candidates
       WHERE status = 'candidate' AND (award_count >= 2 OR total_value >= 500000)
       ORDER BY award_count DESC, total_value DESC
       LIMIT 100
    `),
    readLatestCoverage(),
  ]);

  const awards: CompetitiveAwardRecord[] = awardRows.rows.map((row) => ({
    id: row.id,
    competitorId: row.competitor_id,
    competitorName: row.competitor_name,
    sourceScope: row.source_scope,
    sourceName: row.source_name,
    stateCode: row.state_code,
    awardId: row.award_id,
    recipientName: row.recipient_name,
    recipientUei: row.recipient_uei,
    title: row.title,
    description: row.description,
    agency: row.agency,
    subagency: row.subagency,
    amount: row.amount === null ? null : Number(row.amount),
    actionDate: dateOnly(row.action_date),
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    naics: row.naics,
    psc: row.psc,
    placeOfPerformance: row.place_of_performance,
    sourceUrl: row.source_url,
    matchConfidence: Number(row.match_confidence ?? 0),
    matchMethod: row.match_method,
    firstSeenAt: new Date(row.first_seen_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
  }));

  const candidates: CompetitiveCandidateRecord[] = candidateRows.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    firstSeenAt: new Date(row.first_seen_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    awardCount: Number(row.award_count ?? 0),
    totalValue: Number(row.total_value ?? 0),
    sourceScopes: parseJsonArray(row.source_scopes),
    sampleAwards: Array.isArray(row.sample_awards) ? row.sample_awards : [],
    status: row.status,
  }));
  const totalAwardValue = awards.reduce((sum, award) => sum + (award.amount ?? 0), 0);
  return {
    watchlist,
    awards,
    candidates,
    sourceCoverage,
    summary: {
      watchedCompetitors: watchlist.filter((item) => item.status === "active").length,
      awardsInWindow: awards.length,
      totalAwardValue,
      candidateCompetitors: candidates.length,
      federalAwards: awards.filter((item) => item.sourceScope === "federal").length,
      stateAwards: awards.filter((item) => item.sourceScope === "state").length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function approveCompetitiveCandidate(candidateId: string): Promise<CompetitiveWatchlistRecord> {
  await ensureCompetitiveAwardsPersistence();
  const { pool } = await getDbModule();
  const { rows } = await pool.query(`SELECT * FROM competitive_candidates WHERE id = $1 AND status = 'candidate' LIMIT 1`, [candidateId]);
  const candidate = rows[0];
  if (!candidate) throw new Error("Candidate not found or already reviewed.");
  const id = `discovered-${hashId(candidate.normalized_name)}`;
  await pool.query("BEGIN");
  try {
    await pool.query(
      `INSERT INTO competitive_watchlist (id, display_name, canonical_name, aliases, relationship_type, source_scope, status, evidence_note)
       VALUES ($1,$2,$2,'[]'::jsonb,'discovered-award-winner','both','active',$3)
       ON CONFLICT (id) DO UPDATE SET status = 'active', updated_at = now()`,
      [id, candidate.display_name, `Promoted from reverse award discovery after ${candidate.award_count} relevant award hits.`],
    );
    await pool.query(`UPDATE competitive_candidates SET status = 'approved', approved_competitor_id = $2, updated_at = now() WHERE id = $1`, [candidateId, id]);
    await pool.query(`UPDATE competitive_awards SET competitor_id = $2, match_confidence = GREATEST(match_confidence, 0.95), match_method = 'candidate-approved' WHERE competitor_id IS NULL AND lower(regexp_replace(recipient_name, '[^a-zA-Z0-9]+', ' ', 'g')) = lower(regexp_replace($3, '[^a-zA-Z0-9]+', ' ', 'g'))`, [candidateId, id, candidate.display_name]);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
  const watchlist = await readWatchlist();
  const approved = watchlist.find((item) => item.id === id);
  if (!approved) throw new Error("Candidate promotion completed but watchlist record could not be reloaded.");
  return approved;
}

export async function rejectCompetitiveCandidate(candidateId: string): Promise<void> {
  await ensureCompetitiveAwardsPersistence();
  const { pool } = await getDbModule();
  const result = await pool.query(`UPDATE competitive_candidates SET status = 'rejected', updated_at = now() WHERE id = $1 AND status = 'candidate'`, [candidateId]);
  if (!result.rowCount) throw new Error("Candidate not found or already reviewed.");
}
