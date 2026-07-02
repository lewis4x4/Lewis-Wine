import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Build-time prerendering runs with NODE_ENV=production but no env vars;
// only a running production deployment should fail loudly.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production" && !isBuildPhase) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing in production. Refusing to run with a placeholder Supabase client."
      );
    }
    // During local UI work or static rendering, return a placeholder client
    // so pages can still mount and show graceful empty states.
    return createBrowserClient<Database>(
      "https://placeholder.supabase.co",
      "placeholder-key"
    );
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
