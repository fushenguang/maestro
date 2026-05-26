import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { db } from "@/lib/db";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      loading: false
    })
}));

async function upsertProfileFromSession(session: Session) {
  const user = session.user;
  if (!user) return;

  const meta = user.user_metadata ?? {};
  const isGitHub = user.app_metadata?.["provider"] === "github";

  try {
    await db.profile.upsert({
      id: user.id,
      githubLogin: isGitHub
        ? (meta["user_name"] as string | undefined) ?? user.email?.split("@")[0] ?? user.id
        : user.email?.split("@")[0] ?? user.id,
      githubAvatar: isGitHub ? (meta["avatar_url"] as string | undefined) ?? null : null,
      displayName: (meta["full_name"] as string | undefined) ?? null,
    });
  } catch (err) {
    console.warn("[auth] profile upsert failed:", err);
  }
}

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().setSession(session);
    if (event === "SIGNED_IN" && session) {
      void upsertProfileFromSession(session);
    }
  });

  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      useAuthStore.setState({ loading: false });
      return;
    }
    useAuthStore.getState().setSession(data.session);
  });
} else {
  // Env vars not set — unblock the UI immediately.
  useAuthStore.setState({ loading: false });
}
