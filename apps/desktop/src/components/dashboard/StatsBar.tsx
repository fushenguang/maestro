import type { DashboardStats } from "@/lib/dashboard-utils";

interface StatPanelProps {
  label: string;
  value: number;
  valueClass?: string;
}

function StatPanel({ label, value, valueClass = "text-foreground" }: StatPanelProps) {
  return (
    <div className="bg-background px-5 py-3.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-[22px] font-semibold leading-none ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

interface StatsBarProps {
  stats: DashboardStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-4 gap-px bg-border border-b border-border">
      <StatPanel label="total products" value={stats.total} />
      <StatPanel label="live in market" value={stats.live} valueClass="text-emerald-400" />
      <StatPanel label="deadline < 30d" value={stats.deadlineSoon} valueClass="text-amber-400" />
      <StatPanel label="force closed" value={stats.forceClosed} valueClass="text-red-400" />
    </div>
  );
}

export type { DashboardStats };
