export type PortalConfig = {
  title: string;
  description: string;
  href: string;
  mode: "internal" | "external";
  imageKind: "profile" | "quant" | "geo" | "client" | "prospect" | "federal";
  envName?: string;
};

const env = import.meta.env as Record<string, string | undefined>;

const EXTERNAL_PORTAL_LINKS = {
  client: env["VITE_CLIENT_INTELLIGENCE_URL"] ?? "",
  prospect: env["VITE_PROSPECT_INTELLIGENCE_URL"] ?? "",
  federal: env["VITE_FEDERAL_AGENCIES_URL"] ?? "",
};

export const portalCards: PortalConfig[] = [
  { title: "Data Profiles", description: "Build reusable company dossiers from filings, source notes, workforce signals, and public operating context.", href: "/data-profiles", mode: "internal", imageKind: "profile" },
  { title: "Quantifiable Data", description: "Convert public headcount, WC benchmarks, and methodology assumptions into executive cost signals.", href: "/quantifiable-data", mode: "internal", imageKind: "quant" },
  { title: "Geographic Data", description: "Map client footprints, facilities, countries, activity clusters, and regional service opportunities.", href: "/geographic-data", mode: "internal", imageKind: "geo" },
  { title: "Client Intelligence", description: "Open the configured relationship workspace for client records, needs, and decision patterns.", href: EXTERNAL_PORTAL_LINKS.client, mode: "external", imageKind: "client", envName: "VITE_CLIENT_INTELLIGENCE_URL" },
  { title: "Prospect Intelligence", description: "Open the configured prospect workspace for employer discovery and business development targeting.", href: EXTERNAL_PORTAL_LINKS.prospect, mode: "external", imageKind: "prospect", envName: "VITE_PROSPECT_INTELLIGENCE_URL" },
  { title: "Federal Agencies", description: "Open the configured agency workspace for program and contract intelligence.", href: EXTERNAL_PORTAL_LINKS.federal, mode: "external", imageKind: "federal", envName: "VITE_FEDERAL_AGENCIES_URL" },
];
