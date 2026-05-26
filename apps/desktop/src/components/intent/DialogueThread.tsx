import type { DialogueMessage } from '@/lib/db';
import { cn } from '@/lib/utils';

interface DialogueThreadProps {
  messages: DialogueMessage[];
  currentRound: number;
}

export function DialogueThread({ messages, currentRound }: DialogueThreadProps) {
  if (messages.length === 0) return null;

  // Group messages by round
  const byRound = new Map<number, DialogueMessage[]>();
  for (const msg of messages) {
    const list = byRound.get(msg.round) ?? [];
    list.push(msg);
    byRound.set(msg.round, list);
  }

  // Only show rounds that are before the current one (history)
  const pastRounds = Array.from(byRound.entries())
    .filter(([r]) => r < currentRound)
    .sort(([a], [b]) => a - b);

  if (pastRounds.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {pastRounds.map(([round, msgs]) => (
        <div key={round} className="flex flex-col gap-2">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Round {round - 1} · Summary
          </p>
          {msgs.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'rounded px-3 py-2 font-mono text-xs leading-5',
                msg.role === 'opus'
                  ? 'bg-muted/30 text-muted-foreground border border-border'
                  : 'bg-accent/30 text-foreground',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-semibold mr-1',
                  msg.role === 'opus' ? 'text-amber-500' : 'text-foreground/60',
                )}
              >
                {msg.role === 'opus' ? 'OPUS 4' : 'PM'}
              </span>
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
