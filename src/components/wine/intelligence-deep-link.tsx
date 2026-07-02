"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Several surfaces deep-link into /intelligence with query params
// (?action=find-more, ?intake=purchase) plus a hash. The panels load data
// asynchronously, so a native hash-scroll fires before layout settles and the
// query params were previously ignored entirely. This shim consumes them:
// it resolves the intended section and re-scrolls as panels stream in.
const ACTION_TARGETS: Record<string, string> = {
  "find-more": "buy-again",
  "buy-again": "buy-again",
  replenish: "replenishment",
};

const INTAKE_TARGETS: Record<string, string> = {
  purchase: "acquisition-receipt",
};

export function IntelligenceDeepLink() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const action = searchParams.get("action");
    const intake = searchParams.get("intake");
    const hashTarget =
      typeof window !== "undefined" && window.location.hash
        ? window.location.hash.slice(1)
        : null;
    const target =
      (action && ACTION_TARGETS[action]) ||
      (intake && INTAKE_TARGETS[intake]) ||
      hashTarget;
    if (!target) return;

    let cancelled = false;
    const scroll = () => {
      if (cancelled) return;
      document.getElementById(target)?.scrollIntoView({ block: "start" });
    };
    // Re-scroll a few times so async panel loading can't shift the layout
    // away from the target after the first jump.
    scroll();
    const timers = [300, 900, 1800].map((ms) => window.setTimeout(scroll, ms));
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [searchParams]);

  return null;
}
