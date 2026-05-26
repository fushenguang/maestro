import { useEffect, useState } from "react";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-shell";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Route as RootRoute } from "./__root";
import { GITHUB_SCOPES, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

// ── Zod schemas ──────────────────────────────────────────────────────────────
const emailAuthSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
type EmailAuthValues = z.infer<typeof emailAuthSchema>;

type AuthMode = "signin" | "signup";

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
  const [isGitHubSubmitting, setIsGitHubSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<EmailAuthValues>({
    resolver: zodResolver(emailAuthSchema),
    defaultValues: { email: "", password: "" },
  });
  const isEmailSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/" as never });
    }
  }, [loading, navigate, session]);

  // Clear form errors when switching mode
  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMessage(null);
    form.reset();
  };

  const handleGitHubLogin = async () => {
    setIsGitHubSubmitting(true);
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
      // Navigate to the callback page first so the deep-link listener is active
      // before the browser redirect comes back.
      void navigate({ to: "/auth/callback" as never });
      await open(data.url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "GitHub sign-in could not be started.");
    } finally {
      setIsGitHubSubmitting(false);
    }
  };

  const handleEmailAuth = async (values: EmailAuthValues) => {
    setErrorMessage(null);
    try {
      if (authMode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        // Sync session into the store immediately so the "/" beforeLoad
        // guard sees an authenticated state before we navigate.
        useAuthStore.getState().setSession(data.session);
        void navigate({ to: "/" as never });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        // If a session was created the server auto-confirmed the address.
        // Otherwise (session === null, user may also be null in newer GoTrue
        // for security reasons) the user must verify via OTP.
        if (data.session) {
          void navigate({ to: "/" as never });
        } else {
          void (navigate as (opts: unknown) => void)({ to: "/verify", search: { email: values.email } });
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed. Please try again.");
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
            disabled={isGitHubSubmitting || !isSupabaseConfigured}
          >
            <svg height="18" width="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {isGitHubSubmitting ? "Opening GitHub..." : "continue with github"}
          </Button>

          {/* Divider */}
          <div className="mb-4 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="font-mono text-[10px] text-slate-600">or email</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Sign in / Sign up mode tabs */}
          <div className="mb-4 flex rounded-md border border-slate-800 p-0.5">
            <button
              type="button"
              className={`flex-1 rounded py-1.5 font-mono text-[11px] transition-colors ${
                authMode === "signin"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-400"
              }`}
              onClick={() => switchMode("signin")}
            >
              sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded py-1.5 font-mono text-[11px] transition-colors ${
                authMode === "signup"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-400"
              }`}
              onClick={() => switchMode("signup")}
            >
              sign up
            </button>
          </div>

          {/* Email / Password form */}
          <form onSubmit={form.handleSubmit(handleEmailAuth)} noValidate className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[11px] text-slate-400">
                email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={!isSupabaseConfigured || isEmailSubmitting}
                className="h-9 border-slate-700 bg-slate-800/60 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus-visible:ring-slate-600"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="font-mono text-[10px] text-red-400">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-[11px] text-slate-400">
                password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                disabled={!isSupabaseConfigured || isEmailSubmitting}
                className="h-9 border-slate-700 bg-slate-800/60 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus-visible:ring-slate-600"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="font-mono text-[10px] text-red-400">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-9 w-full bg-slate-100 font-mono text-[13px] font-medium text-slate-900 hover:bg-white"
              disabled={!isSupabaseConfigured || isEmailSubmitting}
            >
              {isEmailSubmitting
                ? authMode === "signin" ? "Signing in..." : "Creating account..."
                : authMode === "signin" ? "sign in" : "create account"}
            </Button>
          </form>

          {/* Error message */}
          {errorMessage && (
            <p className="mt-3 font-mono text-[10px] text-red-400">{errorMessage}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
