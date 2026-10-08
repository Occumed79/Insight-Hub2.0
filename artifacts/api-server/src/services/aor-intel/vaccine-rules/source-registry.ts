import { REGISTRY_ROWS, REGISTRY_SNAPSHOT_DATE, type RegistryRow, type RegistrySection } from "./source-registry-data";

export interface RegistrySource {
  scope: string;
  section: RegistrySection;
  authority: string;
  check: string;
  url: string;
  /** Destination-country authorities outrank the WHO profile page. */
  priority: number;
}

const PRIORITY: Record<RegistrySection, number> = { B: 1, C: 2, D: 3, A: 4 };

function toSource(row: RegistryRow): RegistrySource {
  const [scope, section, authority, check, url] = row;
  return { scope, section, authority, check, url, priority: PRIORITY[section] };
}

const byScope = new Map<string, RegistrySource[]>();
for (const row of REGISTRY_ROWS) {
  const source = toSource(row);
  const list = byScope.get(source.scope) ?? [];
  list.push(source);
  byScope.set(source.scope, list);
}

export const registrySnapshotDate = REGISTRY_SNAPSHOT_DATE;

/** Official links to check for a destination, destination-government pages first. */
export function registrySourcesForCountry(iso3: string): RegistrySource[] {
  return [...(byScope.get(iso3.toUpperCase()) ?? [])].sort((a, b) => a.priority - b.priority);
}

export function registryGlobalSources(): RegistrySource[] {
  return byScope.get("GLOBAL") ?? [];
}

export function registryStats() {
  const countriesWithDestinationAuthority = new Set<string>();
  for (const [scope, list] of byScope) if (scope !== "GLOBAL" && list.some((s) => s.section === "B" || s.section === "C")) countriesWithDestinationAuthority.add(scope);
  return { totalLinks: REGISTRY_ROWS.length, countriesWithDestinationAuthority: countriesWithDestinationAuthority.size, snapshot: REGISTRY_SNAPSHOT_DATE };
}
