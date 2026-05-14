export type ProviderSignal = {
  provider: string;
  configured: boolean;
};

export type EnrichmentResult = {
  companyId: string;
  query: string;
  providers: ProviderSignal[];
  summary: string;
  createdAt: string;
};

const providerEnvMap: Record<string, string> = {
  serper: "SERPER_API_KEY",
  tavily: "TAVILY_API_KEY",
  exa: "EXA_API_KEY",
  firecrawl: "FIRECRAWL_API_KEY",
  jina: "JINA_API_KEY",
  apify: "APIFY_API_KEY",
};

export function getProviderSignals(): ProviderSignal[] {
  return Object.entries(providerEnvMap).map(([provider, envVar]) => ({
    provider,
    configured: Boolean(process.env[envVar]),
  }));
}

export function buildEnrichmentResult(companyId: string, query: string): EnrichmentResult {
  const providers = getProviderSignals();
  const configuredProviders = providers
    .filter((provider) => provider.configured)
    .map((provider) => provider.provider);

  return {
    companyId,
    query,
    providers,
    summary:
      configuredProviders.length > 0
        ? `Configured providers: ${configuredProviders.join(", ")}. External enrichment orchestration hook is active.`
        : "No external providers configured yet. Add API keys in environment variables.",
    createdAt: new Date().toISOString(),
  };
}
