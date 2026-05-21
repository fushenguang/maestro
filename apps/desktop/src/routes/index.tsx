import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

function HomePage() {
  return (
    <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Maestro Desktop
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Maestro Desktop — Bootstrap
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The desktop shell is ready for the next slice of orchestration,
          provider, and UI work.
        </p>
        <Button>Bootstrap Ready</Button>
      </div>
    </section>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage
});
