import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface AddItemFormProps {
  onAdd: (type: 'in_scope' | 'out_of_scope' | 'open_question', title: string, description: string) => void;
}

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'in_scope' | 'out_of_scope' | 'open_question'>('in_scope');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(type, title.trim(), description.trim());
    setTitle('');
    setDescription('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
      >
        + add item
      </button>
    );
  }

  return (
    <div className="border border-border rounded p-3 flex flex-col gap-2 mt-2">
      <p className="text-xs font-medium text-muted-foreground">add scope item</p>
      <select
        className="text-xs bg-background border border-border rounded px-2 py-1"
        value={type}
        onChange={(e) => setType(e.target.value as typeof type)}
      >
        <option value="in_scope">in scope</option>
        <option value="out_of_scope">out of scope</option>
        <option value="open_question">open question</option>
      </select>
      <input
        className="text-xs bg-background border border-border rounded px-2 py-1"
        placeholder="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="text-xs bg-background border border-border rounded px-2 py-1 resize-none"
        rows={2}
        placeholder="description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-1">
        <Button size="sm" className="h-6 text-[10px] px-2" onClick={handleAdd}>
          add
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2"
          onClick={() => setOpen(false)}
        >
          cancel
        </Button>
      </div>
    </div>
  );
}
