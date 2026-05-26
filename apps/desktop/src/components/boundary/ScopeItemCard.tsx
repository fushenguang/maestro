import { useState } from 'react';
import type { ScopeItem } from '@maestro/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScopeItemCardProps {
  item: ScopeItem;
  locked: boolean;
  onConfirm: (id: string) => void;
  onEdit: (id: string, title: string, description: string) => void;
  onMarkType: (id: string, type: 'in_scope' | 'out_of_scope') => void;
}

const TYPE_LABELS: Record<string, string> = {
  in_scope: 'in scope',
  out_of_scope: 'out of scope',
  open_question: 'open question',
};

const TYPE_COLORS: Record<string, string> = {
  in_scope: 'bg-success/10 text-success border-success/30',
  out_of_scope: 'bg-muted text-muted-foreground border-border',
  open_question: 'bg-warning/10 text-warning border-warning/30',
};

export function ScopeItemCard({
  item,
  locked,
  onConfirm,
  onEdit,
  onMarkType,
}: ScopeItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDesc, setEditDesc] = useState(item.description ?? '');

  const isOpenQuestion = item.type === 'open_question';
  const needsConfirm = item.status === 'needs_confirm';

  const handleSaveEdit = () => {
    onEdit(item.id, editTitle, editDesc);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        'rounded border-[0.5px] p-3 flex flex-col gap-2 transition-all',
        isOpenQuestion && 'opacity-60 border-dashed',
        needsConfirm && 'border-warning/60',
        !isOpenQuestion && !needsConfirm && 'border-border',
        item.status === 'confirmed' && 'border-success/40',
      )}
    >
      {/* Type badge + status */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded-sm border-[0.5px]',
            TYPE_COLORS[item.type],
          )}
        >
          {TYPE_LABELS[item.type]}
        </span>
        {item.status === 'confirmed' && (
          <span className="text-[10px] text-success font-mono">confirmed</span>
        )}
        {needsConfirm && (
          <span className="text-[10px] text-warning font-mono">needs confirm</span>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <input
            className="text-xs bg-background border border-border rounded px-2 py-1 w-full"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="title"
          />
          <textarea
            className="text-xs bg-background border border-border rounded px-2 py-1 w-full resize-none"
            rows={2}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="description"
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-[10px] px-2" onClick={handleSaveEdit}>
              save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => {
                setEditing(false);
                setEditTitle(item.title);
                setEditDesc(item.description ?? '');
              }}
            >
              cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          )}
        </>
      )}

      {/* Actions */}
      {!locked && !editing && (
        <div className="flex gap-1 flex-wrap mt-0.5">
          {needsConfirm && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onConfirm(item.id)}
            >
              confirm
            </Button>
          )}
          {isOpenQuestion && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => onMarkType(item.id, 'in_scope')}
              >
                mark in scope
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => onMarkType(item.id, 'out_of_scope')}
              >
                mark out scope
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 text-muted-foreground"
            onClick={() => setEditing(true)}
          >
            edit
          </Button>
        </div>
      )}
    </div>
  );
}
