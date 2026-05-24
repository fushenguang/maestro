import { useEffect, useState } from "react";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Route as RootRoute } from "./__root";
import { GITHUB_SCOPES, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/login",
  beforeLoad: async () => {
    const state = useAuthStore.getState();
    if (!state.loading && state.session) {
      throw redirect({ to: "/" as never });
    }
  },
  component: LoginPage
});

export function LoginPage() {
  const navigate = useNavigate({ from: "/login" as never });
  const { loading, session } = useAuthStore((state) => ({
    session: state.session,
    loading: state.loading
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/" as never });
    }
  }, [loading, navigate, session]);

  const handleGitHubLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          skipBrowserRedirect: true,
          scopes: GITHUB_SCOPES,
          redirectTo: "maestro://auth/callback"
        }
      });
      if (error) throw error;
      if (!data.url) throw new Error("Supabase did not return an OAuth authorization URL.");
      await open(data.url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "GitHub sign-in could not be started.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="font-mono text-xs text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <Card className="w-[320px] overflow-hidden border-slate-800 bg-slate-900 p-0 shadow-2xl">
        {/* Header */}
        <CardHeader className="border-b border-slate-800 px-6 py-6 text-center">
          {/* M logo mark */}
          <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-md border border-slate-400 font-mono text-sm font-semibold text-slate-100">
            M
          </div>
          <h1 className="text-base font-semibold uppercase tracking-[0.06em] text-slate-100">
            Maestro
          </h1>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            app factory · product layer
          </p>
        </CardHeader>

        {/* Body */}
        <CardContent className="px-5 pb-6 pt-5">
          {/* Config error banner */}
          {!isSupabaseConfigured && (
            <div className="mb-4 flex gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
              <svg className="mt-px h-3.5 w-3.5 flex-shrink-0 text-yellow-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
              </svg>
              <p className="font-mono text-[10px] leading-relaxed text-yellow-400/80">
                <span className="font-medium text-yellow-400">Env vars missing —</span>{" "}
                set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{" "}
                <code>apps/desktop/.env</code> then restart.
              </p>
            </div>
          )}

          {/* GitHub button */}
          <Button
            variant="outline"
            className="mb-4 h-10 w-full gap-2 border-slate-700 bg-transparent font-mono text-[13px] font-medium text-slate-200 hover:bg-slate-800 hover:text-slate-50"
            onClick={() => void handleGitHubLogin()}
            disabled={isSubmitting || !isSupabaseConfigured}
          >
            <svg height="18" width="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {isSubmitting ? "Opening GitHub..." : "continue with github"}
          </Button>

          {/* Divider */}
          <div className="mb-4 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="font-mono text-[10px] text-slate-600">access control</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Invite only note */}
          <p className="mb-3 text-center font-mono text-[10px] leading-relaxed text-slate-500">
            <span className="font-medium text-slate-400">invite only</span> — maestro is currently
            in private beta.
            <br />
            github account required to manage repos &amp; trigger builds.
          </p>

          {/* Permission info box */}
          <div className="flex gap-2 rounded-md bg-slate-800/50 px-3 py-2.5">
            <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <p className="font-mono text-[10px] leading-relaxed text-slate-400">
              signing in with github grants maestro read access to your repos and org membership.
              no write access until you explicitly link a repo to a product.
            </p>
          </div>

          {/* Auth error */}
          {errorMessage && (
            <p className="mt-3 font-mono text-[10px] text-red-400">{errorMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
