import { existsSync, statSync } from "node:fs";

// Regression guard for the class of failure where the bundler silently skips
// service-worker generation (Turbopack ignored the old next-pwa webpack hook
// and the app shipped without offline support for months).
const swPath = "public/sw.js";

if (!existsSync(swPath)) {
  console.error(`[assert-sw-built] ${swPath} was not emitted — the PWA build is broken.`);
  process.exit(1);
}

const size = statSync(swPath).size;
if (size < 1024) {
  console.error(`[assert-sw-built] ${swPath} is suspiciously small (${size} bytes) — precache manifest likely missing.`);
  process.exit(1);
}

console.log(`[assert-sw-built] ${swPath} emitted (${Math.round(size / 1024)} KB).`);
