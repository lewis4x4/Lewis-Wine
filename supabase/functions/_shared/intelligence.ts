type Json = Record<string, unknown>;

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[BLOCKED — secret] ${name} is not configured. Set it with supabase secrets set ${name}=...`);
  return value;
}

export async function anthropicJson<T>(input: {
  model: string;
  system: string;
  messages: Array<Json>;
  maxTokens?: number;
  tools?: Array<Json>;
}): Promise<T> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 1600,
      system: input.system,
      messages: input.messages,
      tools: input.tools,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
  const payload = await res.json();
  const text = (payload.content ?? [])
    .filter((part: Json) => part.type === "text")
    .map((part: Json) => String(part.text ?? ""))
    .join("\n")
    .trim();
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const arrayStart = cleaned.indexOf("[");
    const objectStart = cleaned.indexOf("{");
    const start = arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart) ? arrayStart : objectStart;
    const end = arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart) ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("Anthropic returned no JSON payload");
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

export function fixtureEnabled() {
  return Deno.env.get("POURFOLIO_LLM_FIXTURE") === "1";
}
