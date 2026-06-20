export type PortalConfig = {
  title: string;
  description: string;
  href: string;
  mode: "internal" | "external";
  imageKind: "profile" | "quant" | "geo" | "entity" | "discovery" | "federal";
  envName?: string;
};

export const portalCards: PortalConfig[] = [
  { title: "Data Profiles", description: "Build reusable entity dossiers from filings, source notes, workforce signals, and public operating context.", href: "/data-profiles", mode: "internal", imageKind: "profile" },
  { title: "Quantifiable Data", description: "Convert public headcount, workers' comp benchmarks, and methodology assumptions into executive cost signals.", href: "/quantifiable-data", mode: "internal", imageKind: "quant" },
  { title: "Geographic Data", description: "Map entity footprints, facilities, countries, activity clusters, and regional service opportunities.", href: "/geographic-data", mode: "internal", imageKind: "geo" },
];
