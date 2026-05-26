import type { ScopeItem } from '@maestro/types';
import { ScopeItemCard } from './ScopeItemCard';

interface ScopeCanvasProps {
  items: ScopeItem[];
  locked: boolean;
  onConfirm: (id: string) => void;
  onEdit: (id: string, title: string, description: string) => void;
  onMarkType: (id: string, type: 'in_scope' | 'out_of_scope') => void;
}

export function ScopeCanvas({
  items,
  locked,
  onConfirm,
  onEdit,
  onMarkType,
}: ScopeCanvasProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <ScopeItemCard
          key={item.id}
          item={item}
          locked={locked}
          onConfirm={onConfirm}
          onEdit={onEdit}
          onMarkType={onMarkType}
        />
      ))}
    </div>
  );
}
