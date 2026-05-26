import type { Idea } from "@maestro/types";
import { IconLock, IconCheck } from "@tabler/icons-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { getPhaseStatus, PHASE_NAMES } from "@/lib/phase-utils";
import { cn } from "@/lib/utils";

const PHASE_ROUTES: Record<number, string> = {
  0: '/ideas/$id/feed',
  1: '/ideas/$id/intent',
  2: '/ideas/$id/boundary',
  3: '/ideas/$id/validation',
};

const PHASE_LOCK_TOOLTIPS: Record<number, string> = {
  2: 'Intent clarity must reach 85% · resolve open questions',
  3: 'Lock boundary definition first',
  4: 'Validation gate must return \'go\'',
};

interface PhaseSidebarProps {
  idea: Idea;
  onPhaseClick?: (phase: number) => void;
}

export function PhaseSidebar({ idea, onPhaseClick }: PhaseSidebarProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };
  return (
    <aside className="w-[168px] shrink-0 border-r border-border flex flex-col py-4 gap-0.5">
      {PHASE_NAMES.map((name, phase) => {
        const status = getPhaseStatus(idea, phase);
        const isClickable = status !== "locked";

        return (
          <button
            key={phase}
            disabled={!isClickable}
            title={status === 'locked' ? PHASE_LOCK_TOOLTIPS[phase] : undefined}
            onClick={() => {
              if (!isClickable) return;
              if (params.id && PHASE_ROUTES[phase]) {
                void navigate({ to: PHASE_ROUTES[phase].replace('$id', params.id) as never });
              } else {
                onPhaseClick?.(phase);
              }
            }}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors rounded-sm mx-1",
              status === "active" &&
                "bg-accent text-foreground",
              status === "done" &&
                "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              status === "locked" &&
                "text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {/* Phase indicator */}
            <span
              className={cn(
                "flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-[10px] font-bold",
                status === "active" && "bg-primary text-primary-foreground",
                status === "done" && "bg-success text-success-foreground",
                status === "locked" && "bg-muted text-muted-foreground/40"
              )}
            >
              {status === "done" ? (
                <IconCheck size={10} stroke={3} />
              ) : status === "locked" ? (
                <IconLock size={10} stroke={2} />
              ) : (
                phase
              )}
            </span>
            <span className="truncate">{name}</span>
          </button>
        );
      })}
    </aside>
  );
}
