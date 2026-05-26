import type { EvidenceItem } from '@maestro/types';
import { EvidenceCard } from './EvidenceCard';

interface AdvocatePanelProps {
  items: EvidenceItem[];
  isStreaming: boolean;
  completed: boolean;
}

export function AdvocatePanel({ items, isStreaming, completed }: AdvocatePanelProps) {
  const advocateItems = items.filter((i) => i.passType === 'advocate');

  return (
    <div className="flex-1 rounded-lg border border-[0.5px] border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-400">Advocate</h3>
        {isStreaming && (
          <span className="text-[10px] text-emerald-400 animate-pulse">analyzing…</span>
        )}
        {completed && (
          <span className="text-[10px] text-emerald-400">✓ complete</span>
        )}
      </div>

      {isStreaming && advocateItems.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-md bg-emerald-500/10 animate-pulse"
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {advocateItems.map((item) => (
          <EvidenceCard key={item.id} item={item} />
        ))}
      </div>

      {!isStreaming && !completed && advocateItems.length === 0 && (
        <p className="text-xs text-muted-foreground">Waiting to start…</p>
      )}
    </div>
  );
}
