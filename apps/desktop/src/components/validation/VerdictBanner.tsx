import type { ValidationVerdict } from '@maestro/types';
import { Button } from '@/components/ui/button';

interface VerdictBannerProps {
  verdict: ValidationVerdict | null;
  synthesis: string | null;
  onAccept: () => void;
  onRerun: () => void;
  accepting: boolean;
}

const VERDICT_CONFIG: Record<
  ValidationVerdict,
  { label: string; description: string; className: string; ctaLabel: string }
> = {
  go: {
    label: '✓ GO',
    description: 'Strong signal — proceed to contract definition.',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    ctaLabel: 'Accept & proceed',
  },
  no_go: {
    label: '✗ NO-GO',
    description: 'Fatal risks detected — this idea needs significant rework.',
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
    ctaLabel: 'Acknowledge & continue',
  },
  pending: {
    label: '~ AMBIGUOUS',
    description: 'Mixed signals — evidence is inconclusive. Accept risks to proceed.',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    ctaLabel: 'Accept risks & proceed',
  },
};

export function VerdictBanner({
  verdict,
  synthesis,
  onAccept,
  onRerun,
  accepting,
}: VerdictBannerProps) {
  if (!verdict) return null;

  const config = VERDICT_CONFIG[verdict];

  return (
    <div
      className={[
        'rounded-lg border border-[0.5px] p-4 space-y-3',
        config.className,
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold tracking-wide">{config.label}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRerun}
          className="text-[10px] h-6"
          disabled={accepting}
        >
          Re-run
        </Button>
      </div>

      <p className="text-xs opacity-80">{config.description}</p>

      {synthesis && (
        <p className="text-xs text-foreground/70 italic">{synthesis}</p>
      )}

      <Button
        size="sm"
        onClick={onAccept}
        disabled={accepting}
        className="w-full"
      >
        {accepting ? 'Saving…' : config.ctaLabel}
      </Button>
    </div>
  );
}
