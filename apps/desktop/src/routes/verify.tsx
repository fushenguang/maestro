import { useEffect, useState } from "react";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Route as RootRoute } from "./__root";
import { supabase } from "@/lib/supabase";

// ── Route search params ───────────────────────────────────────────────────────
const verifySearchSchema = z.object({
  email: z.string().email(),
});

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/verify",
  validateSearch: verifySearchSchema,
  beforeLoad: ({ search }) => {
    // validateSearch already enforces a valid email; this guard handles
    // the edge case where the param is missing entirely (e.g. direct URL).
    if (!search.email) {
      throw redirect({ to: "/login" as never });
    }
  },
  component: VerifyPage,
});

export function VerifyPage() {
  const navigate = useNavigate({ from: "/verify" as never });
  const { email } = Route.useSearch();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tick the cooldown down by 1 each second; cleans up on unmount automatically.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      // Auth state change will fire; navigate home.
      void navigate({ to: "/" as never });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Verification failed. Please check the code and try again.");
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        email,
        type: "signup",
      });
      if (error) throw error;
      setSuccessMessage("A new code has been sent to your email.");
      setResendCooldown(60);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <Card className="w-[320px] overflow-hidden border-slate-800 bg-slate-900 p-0 shadow-2xl">
        {/* Header */}
        <CardHeader className="border-b border-slate-800 px-6 py-6 text-center">
          <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-md border border-slate-400 font-mono text-sm font-semibold text-slate-100">
            M
          </div>
          <h1 className="text-base font-semibold uppercase tracking-[0.06em] text-slate-100">
            Check your email
          </h1>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            verification code
          </p>
        </CardHeader>

        {/* Body */}
        <CardContent className="px-5 pb-6 pt-5">
          <p className="mb-5 text-center font-mono text-[11px] leading-relaxed text-slate-400">
            We sent a 6-digit code to{" "}
            <span className="text-slate-200">{email}</span>.<br />
            Enter it below to confirm your account.
          </p>

          {/* OTP Input */}
          <div className="mb-4 flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={isVerifying}
              pushPasswordManagerStrategy="none"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="border-slate-700 bg-slate-800/60 font-mono text-slate-200" />
                <InputOTPSlot index={1} className="border-slate-700 bg-slate-800/60 font-mono text-slate-200" />
                <InputOTPSlot index={2} className="border-slate-700 bg-slate-800/60 font-mono text-slate-200" />
              </InputOTPGroup>
              <InputOTPSeparator className="text-slate-600" />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="border-slate-700 bg-slate-800/60 font-mono text-slate-200" />
                <InputOTPSlot index={4} className="border-slate-700 bg-slate-800/60 font-mono text-slate-200" />
                <InputOTPSlot index={5} className="border-slate-700 bg-slate-800/60 font-mono text-slate-200" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            className="h-9 w-full bg-slate-100 font-mono text-[13px] font-medium text-slate-900 hover:bg-white"
            onClick={handleVerify}
            disabled={otp.length !== 6 || isVerifying}
          >
            {isVerifying ? "Verifying..." : "verify email"}
          </Button>

          {/* Error / success feedback */}
          {errorMessage && (
            <p className="mt-3 font-mono text-[10px] text-red-400">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="mt-3 font-mono text-[10px] text-green-400">{successMessage}</p>
          )}

          {/* Resend */}
          <p className="mt-4 text-center font-mono text-[10px] text-slate-500">
            Didn&apos;t receive a code?{" "}
            <button
              type="button"
              className="text-slate-400 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `resend in ${resendCooldown}s` : "resend"}
            </button>
          </p>

          {/* Back to login */}
          <p className="mt-2 text-center font-mono text-[10px] text-slate-500">
            <button
              type="button"
              className="text-slate-400 underline-offset-2 hover:underline"
              onClick={() => void navigate({ to: "/login" as never })}
            >
              ← back to login
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
