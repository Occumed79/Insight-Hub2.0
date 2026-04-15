export type PortalConfig = {
  title: string;
  description: string;
  href: string;
  mode: "internal" | "external";
  imageKind: "profile" | "quant" | "geo" | "client" | "prospect" | "federal";
};

export const portalCards: PortalConfig[] = [
  { title: "Data Profiles", description: "Build reusable company dossiers from filings, source notes, workforce signals, and public operating context.", href: "/data-profiles", mode: "internal", imageKind: "profile" },
  { title: "Quantifiable Data", description: "Convert public headcount, WC benchmarks, and methodology assumptions into executive cost signals.", href: "/quantifiable-data", mode: "internal", imageKind: "quant" },
  { title: "Geographic Data", description: "Map client footprints, facilities, countries, activity clusters, and regional service opportunities.", href: "/geographic-data", mode: "internal", imageKind: "geo" },
  { title: "Client Intelligence", description: "Open the configured relationship workspace for client records, needs, and decision patterns.", href: "https://insight-hub-eyza.onrender.com/clients", mode: "external", imageKind: "client" },
  { title: "Prospect Intelligence", description: "Open the configured prospect workspace for employer discovery and business development targeting.", href: "https://insight-hub-eyza.onrender.com/prospects", mode: "external", imageKind: "prospect" },
  { title: "Federal Agencies", description: "Open the configured federal agency workspace for procurement, program, and contract intelligence.", href: "https://insight-hub-eyza.onrender.com/federal-agencies", mode: "external", imageKind: "federal" },
];
