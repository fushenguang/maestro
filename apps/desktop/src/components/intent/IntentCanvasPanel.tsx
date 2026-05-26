import type { IntentCanvas } from '@maestro/types';
import { cn } from '@/lib/utils';

interface IntentCanvasPanelProps {
  canvas: IntentCanvas | null;
  clarityScore: number;
  openQuestionsCount: number;
}

type FieldStatus = 'confirmed' | 'partial' | 'empty';

function fieldStatus(value: string | null | undefined, confidence: number | null | undefined): FieldStatus {
  if (!value) return 'empty';
  if (confidence === null || confidence === undefined) return 'partial';
  if (confidence >= 80) return 'confirmed';
  return 'partial';
}

interface CanvasField {
  key: keyof IntentCanvas;
  label: string;
  confidenceKey: keyof IntentCanvas | null;
}

const CANVAS_FIELDS: CanvasField[] = [
  { key: 'problem', label: 'problem', confidenceKey: 'problemConfidence' },
  { key: 'rootCause', label: 'root cause', confidenceKey: 'rootCauseConfidence' },
  { key: 'mechanism', label: 'mechanism', confidenceKey: 'mechanismConfidence' },
  { key: 'targetUser', label: 'target user', confidenceKey: 'targetUserConfidence' },
  { key: 'successMetricDesc', label: 'success', confidenceKey: null },
];

export function IntentCanvasPanel({
  canvas,
  clarityScore,
  openQuestionsCount,
}: IntentCanvasPanelProps) {
  return (
    <div className="flex flex-col gap-0 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
          Intent Canvas
        </p>
        <span className="font-mono text-[10px] text-amber-500 font-semibold">LIVE</span>
      </div>

      {/* Fields */}
      <div className="flex flex-col">
        {CANVAS_FIELDS.map(({ key, label, confidenceKey }) => {
          const value = canvas ? (canvas[key] as string | null) : null;
          const confidence = canvas && confidenceKey ? (canvas[confidenceKey] as number | null) : null;
          const status = fieldStatus(value, confidence);

          return (
            <div
              key={key}
              className="flex gap-3 px-4 py-2.5 border-b border-border/50 items-start"
            >
              <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0 pt-0.5">
                {label}
              </span>
              <span
                className={cn(
                  'font-mono text-xs leading-5 flex-1',
                  status === 'confirmed' && 'text-foreground',
                  status === 'partial' && 'text-amber-500',
                  status === 'empty' && 'text-muted-foreground/50 italic',
                )}
              >
                {status === 'empty' ? 'not yet defined' : value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Clarity score */}
      <div className="px-4 py-3 border-t border-border mt-auto">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">intent clarity</span>
          <span
            className={cn(
              'font-mono text-[10px] font-semibold',
              clarityScore >= 85 ? 'text-green-500' : clarityScore >= 50 ? 'text-amber-500' : 'text-muted-foreground',
            )}
          >
            {clarityScore}%
          </span>
        </div>
        <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              clarityScore >= 85 ? 'bg-green-500' : clarityScore >= 50 ? 'bg-amber-500' : 'bg-muted-foreground/40',
            )}
            style={{ width: `${clarityScore}%` }}
          />
        </div>
        {openQuestionsCount > 0 && (
          <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
            {openQuestionsCount} open question{openQuestionsCount > 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    </div>
  );
}
