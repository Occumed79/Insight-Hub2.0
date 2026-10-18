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
  { title: "Intelligence Tools", description: "Search company, agency, and occupational health intelligence.", href: "/competitors", mode: "internal", imageKind: "profile" },
  { title: "Global Locations", description: "Explore headcount and workforce cost estimates.", href: "/geographic-data", mode: "internal", imageKind: "quant" },
  { title: "Global Location Overlap", description: "Compare company locations and shared markets.", href: "/location-overlap", mode: "internal", imageKind: "geo" },
  { title: "Clients Service Map", description: "View client locations and service needs.", href: LEGACY_EXTERNAL_PORTAL_LINKS.entity, mode: "external", imageKind: "entity", portalKey: "entity" },
  { title: "Admin for Map", description: "Manage map research and employer discovery.", href: LEGACY_EXTERNAL_PORTAL_LINKS.discovery, mode: "external", imageKind: "discovery", portalKey: "discovery" },
  { title: "DocBox", description: "Access program and contract intelligence.", href: LEGACY_EXTERNAL_PORTAL_LINKS.federal, mode: "external", imageKind: "federal", portalKey: "federal" },
];
