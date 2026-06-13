import { createClient } from "@/lib/supabase/server";
import type { JarvisSurfaceStatus } from "@/lib/jarvis/types";

export type JarvisSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface JarvisLiveAccess {
  kind: "live";
  userId: string;
  supabase: JarvisSupabaseClient;
  status: JarvisSurfaceStatus;
}

export interface JarvisAnonymousAccess {
  kind: "anonymous";
  userId: null;
  supabase: JarvisSupabaseClient;
  status: JarvisSurfaceStatus;
}

export interface JarvisFallbackAccess {
  kind: "demo" | "degraded";
  userId: null;
  supabase: null;
  status: JarvisSurfaceStatus;
}

export type JarvisAccess = JarvisLiveAccess | JarvisAnonymousAccess | JarvisFallbackAccess;

export const LIVE_JARVIS_STATUS: JarvisSurfaceStatus = {
  mode: "live",
  title: "Live executive memory",
  detail: "Connected to Supabase with real records and write paths enabled.",
};

export function getJarvisDemoStatus(): JarvisSurfaceStatus {
  return {
    mode: "demo",
    title: "Fallback mode",
    detail:
      "Supabase environment variables are missing, so JARVIS is rendering typed empty states and preview-only interactions.",
  };
}

export function getJarvisDegradedStatus(message?: string): JarvisSurfaceStatus {
  return {
    mode: "degraded",
    title: "Live memory unavailable",
    detail:
      message ??
      "The schema is unreachable or not migrated yet, so JARVIS is rendering safely without live data.",
  };
}

export async function getJarvisAccess(): Promise<JarvisAccess> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      kind: "demo",
      userId: null,
      supabase: null,
      status: getJarvisDemoStatus(),
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("JARVIS auth lookup failed", error);
      return {
        kind: "degraded",
        userId: null,
        supabase: null,
        status: getJarvisDegradedStatus("Authentication is configured, but the JARVIS data layer is not responding cleanly."),
      };
    }

    if (!user) {
      return {
        kind: "anonymous",
        userId: null,
        supabase,
        status: LIVE_JARVIS_STATUS,
      };
    }

    return {
      kind: "live",
      userId: user.id,
      supabase,
      status: LIVE_JARVIS_STATUS,
    };
  } catch (error) {
    console.error("JARVIS access bootstrap failed", error);
    return {
      kind: "degraded",
      userId: null,
      supabase: null,
      status: getJarvisDegradedStatus("Supabase is configured, but JARVIS could not establish a stable server session."),
    };
  }
}

export function isJarvisLiveAccess(access: JarvisAccess): access is JarvisLiveAccess {
  return access.kind === "live";
}
