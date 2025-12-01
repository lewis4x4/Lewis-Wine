import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // During build or when env vars are missing, return a mock client
    // This prevents build errors while still requiring env vars at runtime
    if (typeof window === "undefined") {
      return createBrowserClient<Database>(
        "https://placeholder.supabase.co",
        "placeholder-key"
      );
    }
    throw new Error(
      "Missing Supabase environment variables. Check .env.local"
    );
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
