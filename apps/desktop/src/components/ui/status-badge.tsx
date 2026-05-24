import * as React from "react";
import { cn } from "@/lib/utils";

type Status = "active" | "warning" | "closed" | "draft" | "locked" | "done";

const STATUS_STYLES: Record<Status, string> = {
  active: "bg-success text-success-foreground",
  done: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  draft: "bg-info text-info-foreground",
  closed: "bg-muted text-muted-foreground",
  locked: "bg-muted text-muted-foreground"
};

interface StatusBadgeProps {
  status: Status | (string & {});
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status }, ref) => {
    const styles = STATUS_STYLES[status as Status] ?? "bg-muted text-muted-foreground";
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
          styles
        )}
      >
        {status}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";

export { StatusBadge };
export type { Status };
