interface ConfirmedAssumptionsProps {
  assumptions: string[];
  negatedAssumptions: string[];
}

export function ConfirmedAssumptions({
  assumptions,
  negatedAssumptions,
}: ConfirmedAssumptionsProps) {
  if (assumptions.length === 0 && negatedAssumptions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-t border-border">
      {assumptions.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Confirmed Assumptions
          </p>
          <ul className="flex flex-col gap-1">
            {assumptions.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 font-mono text-xs text-muted-foreground">
                <span className="text-green-500 mt-0.5 shrink-0">●</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {negatedAssumptions.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Negated Assumptions
          </p>
          <ul className="flex flex-col gap-1">
            {negatedAssumptions.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 font-mono text-xs text-muted-foreground">
                <span className="text-red-500 mt-0.5 shrink-0">●</span>
                {a} → 否定
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
