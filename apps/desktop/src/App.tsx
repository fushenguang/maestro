import type { PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";

export function App({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-400">
              Maestro
            </p>
            <h1 className="text-lg font-semibold">Bootstrap desktop shell</h1>
          </div>
          <Button variant="outline" size="sm">
            Shell ready
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
