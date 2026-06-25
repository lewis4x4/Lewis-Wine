export type AnthropicUsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: {
    web_search_requests?: number | null;
    web_fetch_requests?: number | null;
  } | null;
};

export type AnthropicRefreshTelemetry = {
  provider: "anthropic";
  configured: boolean;
  attempted: boolean;
  model: string | null;
  webSearchEnabled: boolean;
  webSearchUses: number;
  fallbackWithoutWebSearch: boolean;
  usage: AnthropicUsageLike | null;
  estimatedCostUsd: number | null;
  pricing: {
    inputUsdPerMTok: number;
    outputUsdPerMTok: number;
    cacheWriteUsdPerMTok: number;
    cacheReadUsdPerMTok: number;
  } | null;
};

const SONNET_PRICING = {
  inputUsdPerMTok: 3,
  outputUsdPerMTok: 15,
  cacheWriteUsdPerMTok: 3.75,
  cacheReadUsdPerMTok: 0.3,
};

const HAIKU_PRICING = {
  inputUsdPerMTok: 1,
  outputUsdPerMTok: 5,
  cacheWriteUsdPerMTok: 1.25,
  cacheReadUsdPerMTok: 0.1,
};

const OPUS_PRICING = {
  inputUsdPerMTok: 5,
  outputUsdPerMTok: 25,
  cacheWriteUsdPerMTok: 6.25,
  cacheReadUsdPerMTok: 0.5,
};

const FABLE_OR_MYTHOS_PRICING = {
  inputUsdPerMTok: 10,
  outputUsdPerMTok: 50,
  cacheWriteUsdPerMTok: 12.5,
  cacheReadUsdPerMTok: 1,
};

export function pricingForAnthropicModel(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.includes("haiku")) return HAIKU_PRICING;
  if (normalized.includes("opus")) return OPUS_PRICING;
  if (normalized.includes("fable") || normalized.includes("mythos")) return FABLE_OR_MYTHOS_PRICING;
  return SONNET_PRICING;
}

export function estimateAnthropicCostUsd(model: string, usage: AnthropicUsageLike | null | undefined): number | null {
  if (!usage) return null;
  const pricing = pricingForAnthropicModel(model);
  const cost =
    ((usage.input_tokens ?? 0) * pricing.inputUsdPerMTok +
      (usage.output_tokens ?? 0) * pricing.outputUsdPerMTok +
      (usage.cache_creation_input_tokens ?? 0) * pricing.cacheWriteUsdPerMTok +
      (usage.cache_read_input_tokens ?? 0) * pricing.cacheReadUsdPerMTok) /
    1_000_000;
  return Number(cost.toFixed(6));
}

export function countAnthropicWebSearchUses(content: unknown, usage?: AnthropicUsageLike | null): number {
  const usageCount = usage?.server_tool_use?.web_search_requests;
  if (typeof usageCount === "number") return usageCount;
  if (!Array.isArray(content)) return 0;
  return content.filter((part) => {
    if (!part || typeof part !== "object") return false;
    const block = part as { type?: string; name?: string };
    return block.type === "server_tool_use" && block.name === "web_search";
  }).length;
}

export function emptyAnthropicTelemetry(configured: boolean, model: string | null = null): AnthropicRefreshTelemetry {
  return {
    provider: "anthropic",
    configured,
    attempted: false,
    model,
    webSearchEnabled: false,
    webSearchUses: 0,
    fallbackWithoutWebSearch: false,
    usage: null,
    estimatedCostUsd: null,
    pricing: model ? pricingForAnthropicModel(model) : null,
  };
}
