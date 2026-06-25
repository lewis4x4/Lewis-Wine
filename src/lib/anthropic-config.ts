const ANTHROPIC_ENV_KEY = ["ANTHROPIC", "API", "KEY"].join("_");
const PLACEHOLDER_KEYS = new Set(["your-anthropic-api-key", "", "changeme", "change-me"]);

type EnvLike = Record<string, string | undefined>;

export function getAnthropicApiKey(env: EnvLike = process.env): string | null {
  const value = env[ANTHROPIC_ENV_KEY]?.trim();
  if (!value) return null;
  if (PLACEHOLDER_KEYS.has(value.toLowerCase())) return null;
  if (value.includes("...")) return null;
  if (!value.startsWith("sk-ant-")) return null;
  return value;
}

export function isAnthropicConfigured(env: EnvLike = process.env): boolean {
  return getAnthropicApiKey(env) !== null;
}
