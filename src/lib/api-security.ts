export const ALLOWED_AI_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const MAX_AI_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
export const AI_SCAN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AI_SCAN_RATE_LIMIT_MAX_REQUESTS = 8;

export const PROTECTED_APP_PATHS = [
  "/analytics",
  "/blind-tasting",
  "/bottle-brain",
  "/cellar",
  "/dashboard",
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
