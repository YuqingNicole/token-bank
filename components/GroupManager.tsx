'use client';

import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { VendorId } from '@/lib/types';

interface GroupOption {
  hashKey: string;
  label: string;
}

interface GroupManagerProps {
  vendor: VendorId;
  groups: GroupOption[];
  onGroupsChanged: () => void;
}

export function GroupManager({ vendor, groups, onGroupsChanged }: GroupManagerProps) {
  const [adding, setAdding] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!groupId.trim() || !label.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/v1/manage/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, groupId: groupId.trim(), label: label.trim() }),
      });
      setGroupId('');
      setLabel('');
      setAdding(false);
      onGroupsChanged();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (hashKey: string) => {
    if (!confirm('Delete this group?')) return;
    await fetch('/api/v1/manage/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: hashKey }),
    });
    onGroupsChanged();
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-black/40 uppercase tracking-widest mb-2">
        Groups
      </div>
      {groups.map((g) => (
        <div
          key={g.hashKey}
          className="flex items-center justify-between px-3 py-2 border border-black/5 rounded-lg bg-black/[0.01]"
        >
          <span className="text-sm">{g.label}</span>
          <div className="flex items-center gap-1">
            <code className="text-[10px] text-black/30 font-mono">{g.hashKey.split(':')[1]}</code>
            <button
              onClick={() => handleDelete(g.hashKey)}
              className="p-1 rounded hover:bg-red-50 text-black/20 hover:text-red-500 transition-colors ml-2"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="border border-black/10 rounded-lg p-3 space-y-2">
          <input
            type="text"
            placeholder="Group ID (e.g. botearn)"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full border border-black/10 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-black/30"
          />
          <input
            type="text"
            placeholder="Label (e.g. BotEarn Warehouse)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-black/10 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-black/30"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !groupId.trim() || !label.trim()}
              className="flex-1 py-1.5 text-xs font-semibold bg-black text-white rounded-md hover:bg-black/80 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={() => { setAdding(false); setGroupId(''); setLabel(''); }}
              className="p-1.5 border border-black/10 rounded-md hover:bg-black/5 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-black/40 hover:text-black transition-colors"
        >
          <Plus size={12} /> Add Group
        </button>
      )}
    </div>
  );
}
