import { serwist } from "@serwist/next/config";

// Consumed by `serwist build serwist.config.mjs` after `next build`.
// Bundles src/app/sw.ts with an injected precache manifest generated from
// the .next output and public/ assets.
export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});
