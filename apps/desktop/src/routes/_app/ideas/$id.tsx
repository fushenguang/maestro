import { useEffect, useState } from "react";
import { createRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import type { Idea } from "@maestro/types";
import { Route as AppRoute } from "../../_app";
import { db } from "@/lib/db";
import { PhaseSidebar } from "@/components/PhaseSidebar";

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: "/ideas/$id",
  validateSearch: z.object({}).optional(),
  component: IdeasLayout,
});

function IdeasLayout() {
  const { id } = Route.useParams();
  const [idea, setIdea] = useState<Idea | null>(null);

  useEffect(() => {
    db.ideas
      .get(id)
      .then(setIdea)
      .catch((err: unknown) => {
        console.error("[ideas] failed to load idea:", err);
      });
  }, [id]);

  if (!idea) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <PhaseSidebar idea={idea} />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
