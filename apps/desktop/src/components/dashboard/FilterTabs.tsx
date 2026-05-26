export type { FilterKey } from "@/lib/dashboard-utils";
import type { FilterKey } from "@/lib/dashboard-utils";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "all" },
  { key: "active", label: "active" },
  { key: "at_risk", label: "at risk" },
  { key: "closed", label: "closed" },
];

interface FilterTabsProps {
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}

export function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-2 py-[3px] font-mono text-[11px] rounded-full border transition-colors ${
            active === key
              ? "border-foreground/60 bg-secondary text-foreground"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

