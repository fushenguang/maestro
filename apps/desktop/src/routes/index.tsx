import { createRoute, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { Route as RootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  beforeLoad: async () => {
    const state = useAuthStore.getState();

    if (!state.loading && !state.session) {
      throw redirect({ to: "/login" as never });
    }
  },
  component: HomePage
});

function HomePage() {
  const { loading, session } = useAuthStore((state) => ({
    session: state.session,
    loading: state.loading
  }));

  if (loading) {
    return <section className="text-sm text-slate-300">Loading session...</section>;
  }

  if (!session) {
    return <section className="text-sm text-slate-300">Redirecting to login...</section>;
  }

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
