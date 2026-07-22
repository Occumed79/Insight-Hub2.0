const CONFIG_ID_ALIASES: Record<string, string> = {};

export function resolveConfigCompanyId(companyId: string): string {
  return CONFIG_ID_ALIASES[companyId] ?? companyId;
}

export function getConfigIdAliases(): Record<string, string> {
  return { ...CONFIG_ID_ALIASES };
}
