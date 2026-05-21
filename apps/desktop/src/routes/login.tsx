import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GITHUB_SCOPES, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export const Route = createFileRoute("/login" as never)({
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

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error("Supabase did not return an OAuth authorization URL.");
      }

      await open(data.url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "GitHub sign-in could not be started."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <section className="text-sm text-slate-300">Loading session...</section>;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle>Maestro</CardTitle>
          <CardDescription>
            Sign in with GitHub to connect your workspace and continue in the desktop app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => void handleGitHubLogin()} disabled={isSubmitting}>
            {isSubmitting ? "Opening GitHub..." : "Continue with GitHub"}
          </Button>

          <div className="space-y-3">
            {/* TODO: implement email/password login */}
            <Input type="email" placeholder="Email" disabled />
            <Input type="password" placeholder="Password" disabled />
          </div>

          {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
