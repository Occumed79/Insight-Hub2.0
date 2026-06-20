const CONFIG_ID_ALIASES: Record<string, string> = {
  "caci-international-inc": "caci",
  "fluor-corporation": "fluor",
};

export function resolveConfigCompanyId(companyId: string): string {
  return CONFIG_ID_ALIASES[companyId] ?? companyId;
}

export function getConfigIdAliases(): Record<string, string> {
  return CONFIG_ID_ALIASES;
}
