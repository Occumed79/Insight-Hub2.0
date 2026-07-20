export type PortalLinkKey = "entity" | "discovery" | "federal";

export type PortalConfig = {
  title: string;
  description: string;
  href: string;
  mode: "internal" | "external";
  imageKind: "profile" | "quant" | "geo" | "entity" | "discovery" | "federal";
  portalKey?: PortalLinkKey;
};

const env = import.meta.env as Record<string, string | undefined>;

const LEGACY_EXTERNAL_PORTAL_LINKS: Record<PortalLinkKey, string> = {
  entity: env["VITE_ENTITY_INTELLIGENCE_URL"] ?? "",
  discovery: env["VITE_ENTITY_DISCOVERY_URL"] ?? "",
  federal: env["VITE_FEDERAL_AGENCIES_URL"] ?? "",
};

export const portalCards: PortalConfig[] = [
  { title: "Data Profiles", description: "Build reusable entity dossiers from filings, source notes, workforce signals, and public operating context.", href: "/data-profiles", mode: "internal", imageKind: "profile" },
  { title: "Quantifiable Data", description: "Convert public headcount, WC benchmarks, and methodology assumptions into executive cost signals.", href: "/quantifiable-data", mode: "internal", imageKind: "quant" },
  { title: "Geographic Data", description: "Map entity footprints, facilities, countries, activity clusters, and regional service opportunities.", href: "/geographic-data", mode: "internal", imageKind: "geo" },
  { title: "Entity Intelligence", description: "Open the configured relationship workspace for entity records, needs, and decision patterns.", href: LEGACY_EXTERNAL_PORTAL_LINKS.entity, mode: "external", imageKind: "entity", portalKey: "entity" },
  { title: "Entity Discovery", description: "Open the configured discovery workspace for employer research and business development targeting.", href: LEGACY_EXTERNAL_PORTAL_LINKS.discovery, mode: "external", imageKind: "discovery", portalKey: "discovery" },
  { title: "Federal Agencies", description: "Open the configured agency workspace for program and contract intelligence.", href: LEGACY_EXTERNAL_PORTAL_LINKS.federal, mode: "external", imageKind: "federal", portalKey: "federal" },
];
