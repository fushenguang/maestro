import type { EvidenceItem } from '@maestro/types';
import { EvidenceCard } from './EvidenceCard';

interface ProsecutorPanelProps {
  items: EvidenceItem[];
  isStreaming: boolean;
  completed: boolean;
}

export function ProsecutorPanel({ items, isStreaming, completed }: ProsecutorPanelProps) {
  const prosecutorItems = items.filter((i) => i.passType === 'prosecutor');
  const hasFatal = prosecutorItems.some((i) => i.badge === 'fatal_risk');

  return (
    <div
      className={[
        'flex-1 rounded-lg border border-[0.5px] p-4 space-y-3',
        hasFatal
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-red-500/20 bg-red-500/5',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-red-400">Prosecutor</h3>
        {isStreaming && (
          <span className="text-[10px] text-red-400 animate-pulse">analyzing…</span>
        )}
        {completed && (
          <span className="text-[10px] text-red-400">✓ complete</span>
        )}
      </div>

      {isStreaming && prosecutorItems.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-md bg-red-500/10 animate-pulse"
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {prosecutorItems.map((item) => (
          <EvidenceCard key={item.id} item={item} />
        ))}
      </div>

      {!isStreaming && !completed && prosecutorItems.length === 0 && (
        <p className="text-xs text-muted-foreground">Waiting to start…</p>
      )}
    </div>
  );
}
