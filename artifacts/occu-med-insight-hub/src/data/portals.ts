export type PortalConfig = {
  title: string;
  description: string;
  href: string;
  mode: "internal" | "external";
  imageKind: "profile" | "quant" | "geo" | "client" | "prospect" | "federal";
};

const INSIGHT_HUB_2_URL = "https://insight-hub2-0-fz26.onrender.com";

export const portalCards: PortalConfig[] = [
  { title: "Data Profiles", description: "Build reusable company dossiers from filings, source notes, workforce signals, and public operating context.", href: "/data-profiles", mode: "internal", imageKind: "profile" },
  { title: "Quantifiable Data", description: "Convert public headcount, WC benchmarks, and methodology assumptions into executive cost signals.", href: "/quantifiable-data", mode: "internal", imageKind: "quant" },
  { title: "Geographic Data", description: "Map client footprints, facilities, countries, activity clusters, and regional service opportunities.", href: "/geographic-data", mode: "internal", imageKind: "geo" },
  { title: "Client Intelligence", description: "Open the configured relationship workspace for client records, needs, and decision patterns.", href: `${INSIGHT_HUB_2_URL}/portal/clients`, mode: "external", imageKind: "client" },
  { title: "Prospect Intelligence", description: "Open the prospect dashboard for employer discovery, coverage gaps, and business development targeting.", href: "/portal/prospects", mode: "internal", imageKind: "prospect" },
  { title: "Federal Agencies", description: "Open the configured federal agency workspace for procurement, program, and contract intelligence.", href: `${INSIGHT_HUB_2_URL}/portal/federal-agencies`, mode: "external", imageKind: "federal" },
];
