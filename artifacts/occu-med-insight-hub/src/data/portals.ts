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

export const LEGACY_EXTERNAL_PORTAL_LINKS: Record<PortalLinkKey, string> = {
  entity: env["VITE_ENTITY_INTELLIGENCE_URL"] ?? "",
  discovery: env["VITE_ENTITY_DISCOVERY_URL"] ?? "",
  federal: env["VITE_FEDERAL_AGENCIES_URL"] ?? "",
};

export const portalCards: PortalConfig[] = [
  { title: "Intelligence Tools", description: "Search company, agency, and occupational health intelligence.", href: "/competitors", mode: "internal", imageKind: "profile" },
  { title: "Global Locations", description: "Explore headcount and workforce cost estimates.", href: "/geographic-data", mode: "internal", imageKind: "quant" },
  { title: "Global Location Overlap", description: "Compare company locations and shared markets.", href: "/location-overlap", mode: "internal", imageKind: "geo" },
];
