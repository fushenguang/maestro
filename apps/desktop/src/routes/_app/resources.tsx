import { createRoute } from "@tanstack/react-router";
import { Route as AppRoute } from "../_app";

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: "/resources",
  component: ResourcesPage,
});

function ResourcesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Resources</p>
      <h2 className="text-xl font-semibold">Coming soon</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Resource tracking will be available in a future update.
      </p>
    </div>
  );
}
