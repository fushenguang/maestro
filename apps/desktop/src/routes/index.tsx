import { createRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Route as RootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage
});

function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
          Tauri shell
        </p>
        <h2 className="text-3xl font-semibold">Maestro Desktop — Bootstrap</h2>
        <p className="max-w-2xl text-sm text-slate-300">
          React, TanStack Router, Tailwind, shadcn/ui, and Tauri v2 are wired as
          the first desktop bootstrap slice.
        </p>
      </div>
      <Button>Launch orchestration UI</Button>
    </section>
  );
}
