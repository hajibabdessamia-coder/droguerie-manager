'use client';

import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NamedItem {
  id: string;
  name: string;
}

// عنصر واجهة قابل لإعادة الاستخدام لإدارة أي قائمة أسماء بسيطة (إنشاء/تسمية/حذف) —
// يُستخدم لإدارة الفئات (Categories) والوحدات (Units)، وقد يخدم قوائم مشابهة مستقبلاً
export function NamedListManager({
  items,
  onCreate,
  onRename,
  onDelete,
  addPlaceholder,
  emptyLabel,
  deleteConfirm,
  isMutating,
}: {
  items: NamedItem[] | undefined;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  addPlaceholder: string;
  emptyLabel: string;
  deleteConfirm: (name: string) => string;
  isMutating?: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const value = newName.trim();
    if (!value) return;
    onCreate(value);
    setNewName('');
  }

  function startEdit(item: NamedItem) {
    setEditingId(item.id);
    setEditValue(item.name);
  }

  function submitEdit(id: string) {
    const value = editValue.trim();
    if (value) onRename(id, value);
    setEditingId(null);
  }

  function handleDelete(item: NamedItem) {
    if (window.confirm(deleteConfirm(item.name))) onDelete(item.id);
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submitCreate} className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={addPlaceholder} />
        <Button type="submit" size="icon" variant="outline" disabled={isMutating}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      <div className="flex flex-col divide-y divide-border">
        {!items?.length && <p className="py-3 text-sm text-muted-foreground">{emptyLabel}</p>}
        {items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2">
            {editingId === item.id ? (
              <>
                <Input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitEdit(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => submitEdit(item.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm">{item.name}</span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
