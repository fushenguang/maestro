import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

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

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
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
