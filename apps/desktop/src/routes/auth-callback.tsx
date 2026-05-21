import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback" as never)({
  component: AuthCallbackPage
});

function getCodeFromUrl(rawUrl: string) {
  try {
    return new URL(rawUrl).searchParams.get("code");
  } catch {
    return null;
  }
}

export function AuthCallbackPage() {
  const navigate = useNavigate({ from: "/auth/callback" as never });
  const [status, setStatus] = useState("Waiting for GitHub sign-in callback...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const exchangingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;

    const exchangeCode = async (rawUrls: string[]) => {
      if (exchangingRef.current) {
        return;
      }

      const code = rawUrls.map(getCodeFromUrl).find((value): value is string => Boolean(value));

      if (!code) {
        return;
      }

      exchangingRef.current = true;
      setErrorMessage(null);
      setStatus("Completing sign-in...");

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        if (mounted) {
          setStatus("Sign-in complete. Redirecting...");
          await navigate({ to: "/" as never });
        }
      } catch (error) {
        exchangingRef.current = false;

        if (mounted) {
          setErrorMessage(
            error instanceof Error ? error.message : "GitHub sign-in could not be completed."
          );
          setStatus("Sign-in failed");
        }
      }
    };

    void (async () => {
      const currentUrls = await getCurrent();

      if (currentUrls?.length) {
        await exchangeCode(currentUrls);
      }

      unlisten = await onOpenUrl((urls) => {
        void exchangeCode(urls);
      });
    })();

    return () => {
      mounted = false;

      if (unlisten) {
        void unlisten();
      }
    };
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Completing sign-in</CardTitle>
          <CardDescription>Maestro is finishing your GitHub authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>{status}</p>
          {errorMessage ? <p className="text-red-400">{errorMessage}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
