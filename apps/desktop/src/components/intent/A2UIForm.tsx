import { useState } from 'react';
import type { IntentQuestion } from '@/lib/llm-prompts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface A2UIFormProps {
  questions: IntentQuestion[];
  round: number;
  isSubmitting?: boolean;
  onSubmit: (answers: Record<string, string>) => void;
}

export function A2UIForm({ questions, round, isSubmitting = false, onSubmit }: A2UIFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = () => {
    onSubmit(answers);
    setAnswers({});
  };

  if (questions.length === 0) return null;

  return (
    <div className="rounded border border-border bg-background">
      {/* Badge */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="font-mono text-[10px] text-amber-500 font-semibold tracking-wider uppercase">
          ⊙ opus generated
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          · round {round}
        </span>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-4 px-4 py-4">
        {questions.map((q, i) => (
          <div key={q.id} className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-foreground">
              <span className="text-muted-foreground mr-1">{i + 1}</span>
              {q.label}
            </label>
            {q.type === 'textarea' ? (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => handleChange(q.id, e.target.value)}
                placeholder={q.placeholder ?? ''}
                className={cn(
                  'w-full min-h-[60px] resize-none rounded border border-border bg-background',
                  'px-3 py-2 font-mono text-sm placeholder:text-muted-foreground/60',
                  'focus:outline-none focus:ring-1 focus:ring-ring',
                )}
              />
            ) : (
              <input
                type="text"
                value={answers[q.id] ?? ''}
                onChange={(e) => handleChange(q.id, e.target.value)}
                placeholder={q.placeholder ?? ''}
                className={cn(
                  'w-full rounded border border-border bg-background',
                  'px-3 py-2 font-mono text-sm placeholder:text-muted-foreground/60',
                  'focus:outline-none focus:ring-1 focus:ring-ring',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="px-4 pb-4">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="sm"
          className="font-mono text-xs w-full"
        >
          {isSubmitting ? 'sending…' : 'submit answers ↗'}
        </Button>
      </div>
    </div>
  );
}
