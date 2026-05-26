import { useNavigate } from "@tanstack/react-router";
import type { Idea } from "@maestro/types";

// ── Status mappings ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-400",
  in_market: "bg-emerald-400",
  at_risk: "bg-amber-400",
  draft: "bg-blue-400",
  force_closed: "bg-red-400",
  closed_no_go: "bg-red-400",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success text-success-foreground",
  in_market: "bg-success text-success-foreground",
  at_risk: "bg-warning text-warning-foreground",
  draft: "bg-info text-info-foreground",
  force_closed: "bg-destructive text-destructive-foreground",
  closed_no_go: "bg-destructive/80 text-destructive-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  active: "active",
  in_market: "in market",
  at_risk: "at risk",
  draft: "draft",
  force_closed: "force closed",
  closed_no_go: "closed",
};

// ── Deadline cell ────────────────────────────────────────────────────────────

function DeadlineCell({ idea }: { idea: Idea }) {
  if (!idea.deadline) {
    return <span className="font-mono text-[11px] text-muted-foreground/40">—</span>;
  }

  const now = Date.now();
  const deadline = new Date(idea.deadline).getTime();
  const created = new Date(idea.createdAt).getTime();
  const total = deadline - created;
  const remaining = deadline - now;

  const remainingPct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const elapsedPct = 100 - remainingPct;

  const barColor =
    remainingPct < 20 ? "bg-red-400" : remainingPct < 50 ? "bg-amber-400" : "bg-emerald-400";
  const textColor =
    remainingPct < 20 ? "text-red-400 font-medium" : "text-muted-foreground";

  const daysLeft = Math.ceil(remaining / (1000 * 60 * 60 * 24));
  const label = daysLeft > 0 ? `${daysLeft}d left` : "expired";

  return (
    <div className="flex flex-col gap-1">
      <span className={`font-mono text-[11px] ${textColor}`}>{label}</span>
      <div className="h-[3px] w-full rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${elapsedPct}%` }}
        />
      </div>
    </div>
  );
}

// ── Market Signal cell ───────────────────────────────────────────────────────

const METRIC_SHORT: Record<string, string> = {
  paid_users: "paid",
  github_stars: "stars",
  weekly_downloads: "dl/wk",
  url_reachable: "url live",
};

function MarketSignalCell({ idea }: { idea: Idea }) {
  if (!idea.marketVisible) {
    return <span className="font-mono text-[11px] text-muted-foreground/40">—</span>;
  }
  const metricLabel = idea.successMetric ? (METRIC_SHORT[idea.successMetric] ?? idea.successMetric) : null;
  const targetLine =
    metricLabel && idea.targetN != null
      ? `target: ${metricLabel} > ${idea.targetN}`
      : metricLabel
        ? `target: ${metricLabel}`
        : null;

  return (
    <div className="flex flex-col gap-0.5">
      {targetLine && (
        <span className="font-mono text-[11px] text-muted-foreground">
          {targetLine}
        </span>
      )}
      <span className="font-mono text-[10px] text-muted-foreground/60">
        currently: {idea.marketCurrentValue}
      </span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
        no products yet
      </div>
      <button
        disabled
        className="mt-1 flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-border bg-foreground text-background font-sans text-[12px] font-medium cursor-not-allowed opacity-40"
      >
        <span className="text-[13px] leading-none">+</span>
        new idea
      </button>
    </div>
  );
}

// ── Product Table ────────────────────────────────────────────────────────────

const GRID = "grid grid-cols-[1fr_100px_120px_140px_80px] gap-3 items-center px-4";

interface ProductTableProps {
  ideas: Idea[];
}

export function ProductTable({ ideas }: ProductTableProps) {
  const navigate = useNavigate();

  if (ideas.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-px bg-border border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className={`${GRID} py-2 bg-secondary`}>
        {["product", "status", "deadline", "market signal", "version"].map((col) => (
          <span key={col} className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {col}
          </span>
        ))}
      </div>

      {/* Data rows */}
      {ideas.map((idea) => {
        const dotClass = STATUS_DOT[idea.status] ?? "bg-muted-foreground";
        const badgeClass = STATUS_BADGE[idea.status] ?? "bg-muted text-muted-foreground";
        const statusLabel = STATUS_LABEL[idea.status] ?? idea.status;
        const subText = idea.tags.length > 0 ? idea.tags.join(" · ") : (idea.description ?? "");

        return (
          <div
            key={idea.id}
            onClick={() =>
              void navigate({
                to: "/ideas/$id" as never,
                params: { id: idea.id } as never,
              })
            }
            className={`${GRID} py-3.5 bg-background hover:bg-secondary/30 cursor-pointer transition-colors`}
          >
            {/* Product */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-medium truncate">{idea.name}</span>
              {subText && (
                <span className="font-mono text-[11px] text-muted-foreground truncate">
                  {subText}
                </span>
              )}
            </div>

            {/* Status badge */}
            <div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-full font-mono text-[10px] font-medium ${badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                {statusLabel}
              </span>
            </div>

            {/* Deadline */}
            <DeadlineCell idea={idea} />

            {/* Market Signal */}
            <MarketSignalCell idea={idea} />

            {/* Version */}
            <div>
              <span className="inline-flex items-center px-[7px] py-[2px] rounded border border-border font-mono text-[10px] text-muted-foreground">
                {idea.currentVersion}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
