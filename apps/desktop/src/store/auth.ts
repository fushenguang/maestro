import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

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

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session);
});

void supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    useAuthStore.setState({ loading: false });
    throw error;
  }

  useAuthStore.getState().setSession(data.session);
});
