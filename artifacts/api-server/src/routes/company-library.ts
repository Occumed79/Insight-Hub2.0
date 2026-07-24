import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";

const router = Router();

type CatalogCompany = {
  slug: string;
  name: string;
  shortName: string;
  aliases: string[];
};

type ModuleKey =
  | "locations"
  | "jobs"
  | "bls"
  | "organizationalChart"
  | "corporateStructure"
  | "sec"
  | "corporateSignals"
  | "fec"
  | "injuryExposure"
  | "evidence";

type ModuleState = {
  status: "available" | "not-researched";
  updatedAt?: string;
  count?: number;
};

const PUBLIC_COMPANY_CATALOG: CatalogCompany[] = [
  { slug: "v2x", name: "V2X, Inc.", shortName: "V2X", aliases: ["V2X", "Vectrus"] },
  { slug: "ids", name: "IDS", shortName: "IDS", aliases: [] },
  { slug: "kbr", name: "KBR, Inc.", shortName: "KBR", aliases: ["KBR"] },
  { slug: "pae-amentum", name: "PAE / Amentum", shortName: "Amentum", aliases: ["PAE", "Amentum"] },
  { slug: "s3-international", name: "S3 International", shortName: "S3", aliases: ["S3"] },
  { slug: "trace-systems", name: "Trace Systems", shortName: "Trace", aliases: [] },
  { slug: "weatherford", name: "Weatherford International", shortName: "Weatherford", aliases: ["Weatherford"] },
  { slug: "valiant", name: "Valiant Integrated Services", shortName: "Valiant", aliases: [] },
  { slug: "peraton", name: "Peraton", shortName: "Peraton", aliases: [] },
  { slug: "caci", name: "CACI International", shortName: "CACI", aliases: ["CACI International Inc."] },
  { slug: "iap", name: "IAP Worldwide Services", shortName: "IAP", aliases: ["IAP"] },
  { slug: "constellis", name: "Constellis", shortName: "Constellis", aliases: [] },
  { slug: "parsons", name: "Parsons Corporation", shortName: "Parsons", aliases: ["Parsons"] },
  { slug: "peckham", name: "Peckham", shortName: "Peckham", aliases: [] },
  { slug: "qinetiq", name: "QinetiQ", shortName: "QinetiQ", aliases: [] },
  { slug: "serco", name: "Serco", shortName: "Serco", aliases: ["Serco Inc.", "Serco Group"] },
  { slug: "mag-aerospace", name: "MAG Aerospace", shortName: "MAG", aliases: [] },
  { slug: "maximus-federal", name: "Maximus Federal", shortName: "Maximus", aliases: ["Maximus"] },
  { slug: "northrop-grumman", name: "Northrop Grumman", shortName: "Northrop Grumman", aliases: [] },
  { slug: "rheinmetall", name: "Rheinmetall", shortName: "Rheinmetall", aliases: [] },
  { slug: "rtx", name: "RTX Corporation", shortName: "RTX", aliases: ["Raytheon Technologies", "RTX"] },
  { slug: "saic", name: "Science Applications International Corporation", shortName: "SAIC", aliases: ["SAIC"] },
  { slug: "leidos", name: "Leidos", shortName: "Leidos", aliases: [] },
  { slug: "kongsberg", name: "Kongsberg", shortName: "Kongsberg", aliases: ["Kongsberg Gruppen"] },
  { slug: "kapsuun", name: "Kapsuun Group", shortName: "Kapsuun", aliases: ["Kapsuun"] },
  { slug: "mission-essential", name: "Mission Essential", shortName: "Mission Essential", aliases: [] },
  { slug: "source-group", name: "Source Group International", shortName: "Source Group", aliases: ["Source Group"] },
  { slug: "thales", name: "Thales", shortName: "Thales", aliases: ["Thales Group"] },
  { slug: "tecmotiv", name: "Tec-Motiv", shortName: "Tec-Motiv", aliases: [] },
  { slug: "c3el", name: "C3EL", shortName: "C3EL", aliases: [] },
  { slug: "asrc-federal", name: "ASRC Federal", shortName: "ASRC Federal", aliases: [] },
  { slug: "ecc", name: "ECC", shortName: "ECC", aliases: ["Environmental Chemical Corporation"] },
  { slug: "sierra-nevada", name: "Sierra Nevada Corporation", shortName: "SNC", aliases: ["Sierra Nevada", "SNC"] },
  { slug: "skybridge-tactical", name: "SkyBridge Tactical", shortName: "SkyBridge", aliases: [] },
  { slug: "sosi", name: "SOS International", shortName: "SOSi", aliases: ["SOSi"] },
  { slug: "freeport-mcmoran", name: "Freeport-McMoRan", shortName: "Freeport", aliases: ["Freeport"] },
  { slug: "leonardo", name: "Leonardo", shortName: "Leonardo", aliases: ["Leonardo DRS"] },
  { slug: "fluor", name: "Fluor Corporation", shortName: "Fluor", aliases: ["Fluor"] },
  { slug: "dynamic-aviation", name: "Dynamic Aviation", shortName: "Dynamic Aviation", aliases: [] },
  { slug: "world-vision", name: "World Vision", shortName: "World Vision", aliases: [] },
  { slug: "versar", name: "Versar", shortName: "Versar", aliases: [] },
  { slug: "clovehitch", name: "Clovehitch", shortName: "Clovehitch", aliases: [] },
  { slug: "gdit", name: "General Dynamics Information Technology", shortName: "GDIT", aliases: ["GDIT"] },
  { slug: "jacobs", name: "Jacobs Solutions", shortName: "Jacobs", aliases: ["Jacobs"] },
  { slug: "bae-systems", name: "BAE Systems", shortName: "BAE", aliases: ["BAE"] },
  { slug: "alutiiq", name: "Alutiiq", shortName: "Alutiiq", aliases: [] },
  { slug: "international-sos", name: "International SOS", shortName: "International SOS", aliases: [] },
  { slug: "hii-mission-technologies", name: "HII Mission Technologies", shortName: "HII", aliases: ["HII", "Huntington Ingalls Industries"] },
  { slug: "datapath", name: "DataPath", shortName: "DataPath", aliases: [] },
  { slug: "omniplex", name: "OMNIPLEX World Services", shortName: "OMNIPLEX", aliases: ["Omniplex"] },
  { slug: "ssi", name: "Strategic Solutions International", shortName: "SSI", aliases: ["SSI"] },
  { slug: "platform-aerospace", name: "Platform Aerospace", shortName: "Platform Aerospace", aliases: [] },
];

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|holdings?|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function snapshotState(metadata: Record<string, unknown>, keys: string[], fallbackUpdatedAt?: string): ModuleState {
  for (const key of keys) {
    const value = metadata[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const updatedAt = metadataString(record, "savedAt")
      || metadataString(record, "updatedAt")
      || metadataString(record, "completedAt")
      || fallbackUpdatedAt;
    const result = objectMetadata(record.result);
    const summary = objectMetadata(result.summary || record.summary);
    const count = Number(summary.people ?? summary.count ?? summary.results ?? record.count);
    return {
      status: "available",
      updatedAt,
      count: Number.isFinite(count) ? count : undefined,
    };
  }
  return { status: "not-researched" };
}

function entityNames(entity: typeof entitiesTable.$inferSelect): string[] {
  const metadata = objectMetadata(entity.metadata);
  const aliases = Array.isArray(metadata.aliases) ? metadata.aliases.map(String) : [];
  return [
    entity.name,
    entity.displayName,
    metadataString(metadata, "enteredName"),
    metadataString(metadata, "canonicalName"),
    ...aliases,
  ].filter((value): value is string => Boolean(value));
}

router.get("/company-library/catalog", async (_req, res) => {
  try {
    const [entities, locations] = await Promise.all([
      db.select().from(entitiesTable),
      db.select().from(locationsTable),
    ]);

    const locationCounts = new Map<number, number>();
    for (const location of locations) {
      if (location.reviewStatus === "rejected") continue;
      locationCounts.set(location.entityId, (locationCounts.get(location.entityId) || 0) + 1);
    }

    const cards = PUBLIC_COMPANY_CATALOG.map((company) => {
      const normalizedNames = new Set([company.name, company.shortName, ...company.aliases].map(normalize));
      const entity = entities.find((candidate) => entityNames(candidate).some((name) => normalizedNames.has(normalize(name))));
      const metadata = objectMetadata(entity?.metadata);
      const updatedAt = entity?.updatedAt?.toISOString();
      const locationCount = entity ? locationCounts.get(entity.id) || 0 : 0;
      const locationsState: ModuleState = locationCount > 0 || metadataString(metadata, "discoveryStatus") === "completed"
        ? { status: "available", updatedAt: metadataString(metadata, "lastDiscoveryAt") || updatedAt, count: locationCount }
        : { status: "not-researched" };

      const modules: Record<ModuleKey, ModuleState> = {
        locations: locationsState,
        jobs: snapshotState(metadata, ["hiringIntelligence", "jobs", "jobIntelligence"], updatedAt),
        bls: snapshotState(metadata, ["bls", "blsBenchmark", "workforceBenchmarks"], updatedAt),
        organizationalChart: snapshotState(metadata, ["organizationalChart"], updatedAt),
        corporateStructure: snapshotState(metadata, ["corporateStructure"], updatedAt),
        sec: snapshotState(metadata, ["secFilings", "sec"], updatedAt),
        corporateSignals: snapshotState(metadata, ["corporateSignals", "companyLiveIntelligence"], updatedAt),
        fec: snapshotState(metadata, ["fec", "fecSignals"], updatedAt),
        injuryExposure: snapshotState(metadata, ["injuryExposure", "occupationalExposure"], updatedAt),
        evidence: snapshotState(metadata, ["sourceGovernance", "evidenceInventory"], updatedAt),
      };
      const availableModules = Object.values(modules).filter((module) => module.status === "available").length;

      return {
        ...company,
        entityId: entity?.id,
        canonicalName: metadataString(metadata, "canonicalName") || entity?.displayName || company.name,
        officialWebsite: metadataString(metadata, "officialWebsite"),
        lastUpdatedAt: updatedAt,
        availableModules,
        totalModules: Object.keys(modules).length,
        modules,
      };
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      publicRepositoryNotice: "This is a neutral public-source research catalog. It does not identify Occu-Med clients or commercial relationships.",
      companies: cards,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Company library could not be loaded." });
  }
});

export default router;
