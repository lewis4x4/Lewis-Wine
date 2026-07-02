export const ALLOWED_AI_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const MAX_AI_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
export const AI_SCAN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AI_SCAN_RATE_LIMIT_MAX_REQUESTS = 8;
// Daily budget for Anthropic web-search endpoints (bottle-intelligence
// refresh, acquisition engine): the expensive spend surface.
export const AI_WEB_SEARCH_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const AI_WEB_SEARCH_DAILY_MAX_REQUESTS = 40;

export const PROTECTED_APP_PATHS = [
  "/analytics",
  "/blind-tasting",
  "/bottle-brain",
  "/capture",
  "/cellar",
  "/dashboard",
  "/intelligence",
  "/jarvis",
  "/ratings",
  "/recommendations",
  "/scan",
  "/settings",
  "/shopping",
  "/social",
  "/visits",
  "/wishlist",
] as const;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function isAllowedAiImageMimeType(
  mimeType: string
): mimeType is (typeof ALLOWED_AI_IMAGE_MIME_TYPES)[number] {
  return ALLOWED_AI_IMAGE_MIME_TYPES.includes(
    mimeType as (typeof ALLOWED_AI_IMAGE_MIME_TYPES)[number]
  );
}

export function validateAiImageUpload(file: Pick<File, "size" | "type">): string | null {
  if (!isAllowedAiImageMimeType(file.type)) {
    return "Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image.";
  }

  if (file.size > MAX_AI_IMAGE_UPLOAD_BYTES) {
    return "Image is too large. Maximum upload size is 8MB.";
  }

  return null;
}

export function isProtectedAppPath(pathname: string): boolean {
  return PROTECTED_APP_PATHS.some((path) => pathname.startsWith(path));
}

export function checkRateLimit(
  key: string,
  now = Date.now(),
  maxRequests = AI_SCAN_RATE_LIMIT_MAX_REQUESTS,
  windowMs = AI_SCAN_RATE_LIMIT_WINDOW_MS
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true };
}

type SupabaseRpcClient = {
  // The hand-written Database type has no Functions section, so the typed
  // client's rpc() generics don't line up with a precise structural type;
  // accept any rpc-bearing client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: any, args?: any) => any;
};

/**
 * Durable per-user rate limit backed by the consume_api_quota RPC
 * (migration 00026), so caps on paid AI endpoints survive serverless cold
 * starts and concurrent instances. Falls back to the in-memory limiter when
 * the RPC is unavailable (migration not applied / transient failure) rather
 * than blocking requests.
 */
export async function checkDurableRateLimit(
  supabase: SupabaseRpcClient,
  userId: string,
  route: string,
  maxRequests = AI_SCAN_RATE_LIMIT_MAX_REQUESTS,
  windowMs = AI_SCAN_RATE_LIMIT_WINDOW_MS
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  try {
    const { data, error } = await supabase.rpc("consume_api_quota", {
      p_route: route,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
      p_max_requests: maxRequests,
    });
    if (error) throw error;
    if (data === true) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
  } catch {
    return checkRateLimit(`${route}:${userId}`, Date.now(), maxRequests, windowMs);
  }
}
