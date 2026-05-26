import type { Idea } from "@maestro/types";

export type FilterKey = "all" | "active" | "at_risk" | "in_market" | "closed";

export interface DashboardStats {
  total: number;
  live: number;
  deadlineSoon: number;
  forceClosed: number;
}

export function computeStats(ideas: Idea[]): DashboardStats {
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    total: ideas.length,
    live: ideas.filter((i) => i.status === "in_market").length,
    deadlineSoon: ideas.filter((i) => {
      if (!i.deadline) return false;
      const active = i.status === "active" || i.status === "at_risk";
      const soon = new Date(i.deadline) <= thirtyDaysOut;
      return active && soon;
    }).length,
    forceClosed: ideas.filter((i) => i.status === "force_closed").length,
  };
}

export function applyFilter(ideas: Idea[], filter: FilterKey): Idea[] {
  switch (filter) {
    case "active":
      return ideas.filter((i) => i.status === "active");
    case "at_risk":
      return ideas.filter((i) => i.status === "at_risk");
    case "in_market":
      return ideas.filter((i) => i.status === "in_market");
    case "closed":
      return ideas.filter(
        (i) => i.status === "force_closed" || i.status === "closed_no_go"
      );
    default:
      return ideas;
  }
}
