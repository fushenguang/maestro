import { useEffect, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import type { Idea } from "@maestro/types";
import { Route as AppRoute } from "../_app";
import { db } from "@/lib/db";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { FilterTabs } from "@/components/dashboard/FilterTabs";
import type { FilterKey } from "@/components/dashboard/FilterTabs";
import { ProductTable, EmptyState } from "@/components/dashboard/ProductTable";
import { computeStats, applyFilter } from "@/lib/dashboard-utils";

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: "/dashboard",
  component: DashboardPage,
});

// ── Dashboard Page ────────────────────────────────────────────────────────────

function DashboardPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    db.ideas
      .list()
      .then(setIdeas)
      .catch((err: unknown) => {
        console.error("[dashboard] failed to load ideas:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = computeStats(ideas);
  const filtered = applyFilter(ideas, filter);

  return (
    <div className="flex flex-col">
      {/* Stats row — flush to top */}
      <StatsBar stats={stats} />

      {/* Content area */}
      <div className="px-5 py-4">
        {loading ? (
          <p className="font-mono text-[11px] text-muted-foreground">loading…</p>
        ) : ideas.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Section header: "product registry" + filter pills */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                product registry
              </span>
              <FilterTabs active={filter} onChange={setFilter} />
            </div>
            <ProductTable ideas={filtered} />
          </>
        )}
      </div>
    </div>
  );
}

