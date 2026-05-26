import type { EvidenceItem } from '@maestro/types';

const BADGE_CONFIG: Record<
  EvidenceItem['badge'],
  { label: string; className: string }
> = {
  proves_problem: {
    label: 'Proves Problem',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  adjacent_signal: {
    label: 'Adjacent Signal',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  adoption_risk: {
    label: 'Adoption Risk',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  evidence_gap: {
    label: 'Evidence Gap',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
  fatal_risk: {
    label: 'Fatal Risk',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

interface EvidenceCardProps {
  item: EvidenceItem;
}

export function EvidenceCard({ item }: EvidenceCardProps) {
  const config = BADGE_CONFIG[item.badge];
  const isFatal = item.badge === 'fatal_risk';

  return (
    <div
      className={[
        'rounded-md border p-3 space-y-1',
        'border-[0.5px]',
        isFatal ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'text-[10px] font-medium px-1.5 py-0.5 rounded border',
            config.className,
          ].join(' ')}
        >
          {config.label}
        </span>
      </div>
      <p className="text-xs font-medium leading-snug">{item.title}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {item.description}
      </p>
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-blue-400 hover:underline block truncate"
        >
          {item.sourceUrl}
        </a>
      )}
    </div>
  );
}
