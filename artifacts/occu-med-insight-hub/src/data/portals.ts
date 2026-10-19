export type PortalConfig = {
  title: string;
  description: string;
  href: string;
  imageKind: "profile" | "quant" | "geo";
};

export const portalCards: PortalConfig[] = [
  { title: "Intelligence Tools", description: "Search company, agency, and occupational health intelligence.", href: "/competitors", imageKind: "profile" },
  { title: "Global Locations", description: "Explore headcount and workforce cost estimates.", href: "/geographic-data", imageKind: "quant" },
  { title: "Global Location Overlap", description: "Compare company locations and shared markets.", href: "/location-overlap", imageKind: "geo" },
];
