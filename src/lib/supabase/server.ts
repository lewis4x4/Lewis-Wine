import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Build-time prerendering runs with NODE_ENV=production but no env vars;
// only a running production deployment should fail loudly.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export async function createClient() {
  const cookieStore = await cookies();

  if (
    (!supabaseUrl || !supabaseAnonKey) &&
    process.env.NODE_ENV === "production" &&
    !isBuildPhase
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing in production. Refusing to run with a placeholder Supabase client."
    );
  }

  // Use placeholder values during build when env vars aren't available
  const url = supabaseUrl || "https://placeholder.supabase.co";
  const key = supabaseAnonKey || "placeholder-key";

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
