import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import manifest from "../public/manifest.json" with { type: "json" };
import {
  AI_SCAN_RATE_LIMIT_MAX_REQUESTS,
  AI_SCAN_RATE_LIMIT_WINDOW_MS,
  checkRateLimit,
  isAllowedAiImageMimeType,
  isProtectedAppPath,
  MAX_AI_IMAGE_UPLOAD_BYTES,
  PROTECTED_APP_PATHS,
  validateAiImageUpload,
} from "../src/lib/api-security";
import { getAnthropicApiKey, isAnthropicConfigured } from "../src/lib/anthropic-config";

const requiredProtectedPaths = [
  "/analytics",
  "/blind-tasting",
  "/bottle-brain",
  "/cellar",
  "/jarvis/voice",
  "/ratings",
  "/recommendations",
  "/scan/receipt",
  "/settings",
  "/shopping",
  "/social/friends",
  "/visits",
  "/wishlist",
];

assert.equal(manifest.start_url, "/");
assert.ok(!PROTECTED_APP_PATHS.includes("/recommend" as never));

for (const path of requiredProtectedPaths) {
  assert.ok(isProtectedAppPath(path), `Expected protected route: ${path}`);
}

assert.ok(!isProtectedAppPath("/login"));
assert.ok(!isProtectedAppPath("/signup"));

assert.ok(isAllowedAiImageMimeType("image/jpeg"));
assert.ok(isAllowedAiImageMimeType("image/png"));
assert.ok(isAllowedAiImageMimeType("image/gif"));
assert.ok(isAllowedAiImageMimeType("image/webp"));
assert.ok(!isAllowedAiImageMimeType("image/svg+xml"));
assert.ok(!isAllowedAiImageMimeType("application/pdf"));

assert.equal(
  validateAiImageUpload({ type: "image/svg+xml", size: 1024 }),
  "Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image."
);
assert.equal(
  validateAiImageUpload({ type: "image/jpeg", size: MAX_AI_IMAGE_UPLOAD_BYTES + 1 }),
  "Image is too large. Maximum upload size is 8MB."
);
assert.equal(
  validateAiImageUpload({ type: "image/webp", size: MAX_AI_IMAGE_UPLOAD_BYTES }),
  null
);

const key = `security-test-${Date.now()}`;
for (let i = 0; i < AI_SCAN_RATE_LIMIT_MAX_REQUESTS; i += 1) {
  assert.deepEqual(checkRateLimit(key, 1_000, AI_SCAN_RATE_LIMIT_MAX_REQUESTS, AI_SCAN_RATE_LIMIT_WINDOW_MS), {
    allowed: true,
  });
}
assert.deepEqual(checkRateLimit(key, 1_000, AI_SCAN_RATE_LIMIT_MAX_REQUESTS, AI_SCAN_RATE_LIMIT_WINDOW_MS), {
  allowed: false,
  retryAfterSeconds: 60,
});
assert.deepEqual(
  checkRateLimit(key, 1_000 + AI_SCAN_RATE_LIMIT_WINDOW_MS + 1, AI_SCAN_RATE_LIMIT_MAX_REQUESTS, AI_SCAN_RATE_LIMIT_WINDOW_MS),
  { allowed: true }
);

const legacyScanRoute = readFileSync("src/app/api/ai/scan-label/route.ts", "utf8");
assert.ok(legacyScanRoute.includes("status: 410"));
assert.ok(!legacyScanRoute.includes("@anthropic-ai/sdk"));
assert.ok(!legacyScanRoute.includes("Mock Chateau"));

const anthropicEnvKey = ["ANTHROPIC", "API", "KEY"].join("_");
const validTestKey = ["sk", "ant", "test-valid-key"].join("-");
assert.equal(getAnthropicApiKey({ [anthropicEnvKey]: "your-anthropic-api-key" }), null);
assert.equal(getAnthropicApiKey({ [anthropicEnvKey]: "not-a-real-key" }), null);
assert.equal(getAnthropicApiKey({ [anthropicEnvKey]: "sk-ant-...redacted" }), null);
assert.equal(getAnthropicApiKey({ [anthropicEnvKey]: validTestKey }), validTestKey);
assert.equal(isAnthropicConfigured({ [anthropicEnvKey]: validTestKey }), true);

for (const apiRoute of [
  "src/app/api/bottle-intelligence/refresh/[id]/route.ts",
  "src/app/api/label/scan/route.ts",
  "src/app/api/receipt/scan/route.ts",
]) {
  const source = readFileSync(apiRoute, "utf8");
  assert.ok(!source.includes("proces..."), `${apiRoute} must not contain redacted env placeholders`);
  assert.ok(source.includes("getAnthropicApiKey"), `${apiRoute} must use validated Anthropic key loading`);
}

console.log("P0 security guardrails checks passed");
