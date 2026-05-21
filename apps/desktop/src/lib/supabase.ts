import { createClient } from "@supabase/supabase-js";

export const GITHUB_SCOPES = "repo read:user user:email read:org";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    db: { schema: "calcifer" },
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);
