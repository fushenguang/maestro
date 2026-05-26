import { useCallback, useEffect, useRef, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as RootRoute } from "./__root";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/auth/callback",
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

  const exchangeCode = useCallback(async (rawUrls: string[]) => {
    if (exchangingRef.current) return;

    const code = rawUrls.map(getCodeFromUrl).find((value): value is string => Boolean(value));
    if (!code) return;

    exchangingRef.current = true;
    setErrorMessage(null);
    setStatus("Completing sign-in...");

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      setStatus("Sign-in complete. Redirecting...");
      await navigate({ to: "/" as never });
    } catch (error) {
      exchangingRef.current = false;
      setErrorMessage(
        error instanceof Error ? error.message : "GitHub sign-in could not be completed."
      );
      setStatus("Sign-in failed");
    }
  }, [navigate]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

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
      if (unlisten) unlisten();
    };
  }, [exchangeCode]);

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
          {import.meta.env.DEV ? <DevCallbackInput onUrl={(url) => exchangeCode([url])} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** DEV ONLY — paste the full maestro://auth/callback?code=... URL here */
function DevCallbackInput({ onUrl }: { onUrl: (url: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-4 rounded border border-dashed border-yellow-600/60 p-3">
      <p className="mb-2 font-mono text-[10px] text-yellow-500">
        [DEV] 开发模式：将浏览器地址栏中的 <code>maestro://auth/callback?code=…</code> URL 粘贴到此处
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-200 outline-none"
          placeholder="maestro://auth/callback?code=..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              onUrl(value.trim());
            }
          }}
        />
        <button
          className="rounded bg-yellow-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-500"
          onClick={() => { if (value.trim()) onUrl(value.trim()); }}
        >
          提交
        </button>
      </div>
    </div>
  );
}
