import { createClient } from "@supabase/supabase-js";

export const GITHUB_SCOPES = "repo read:user user:email read:org";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

/** False when .env is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Use placeholder values so createClient never throws at startup when env vars
// are absent. Actual API calls will fail gracefully instead of crashing the app.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    db: { schema: "calcifer" },
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);
