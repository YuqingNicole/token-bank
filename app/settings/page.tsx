'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { VENDOR_CONFIG } from '@/lib/vendors';
import type { SubKeyData, VendorId } from '@/lib/types';

interface KeyRow extends SubKeyData { key: string; }

interface EditState {
  name: string;
  totalQuota: string;
  expiresAt: string;
}

function KeySettingsRow({ row, onSaved, onDeleted }: { row: KeyRow; onSaved: () => void; onDeleted: () => void; }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditState>({
    name: row.name,
    totalQuota: row.totalQuota != null ? String(row.totalQuota) : '',
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : '',
  });

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/v1/manage/keys/${encodeURIComponent(row.key)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        totalQuota: form.totalQuota ? parseInt(form.totalQuota, 10) : null,
        expiresAt: form.expiresAt || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete key "${row.name}"?`)) return;
    await fetch('/api/v1/manage/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subKey: row.key }),
    });
    onDeleted();
  };

  const remaining = row.totalQuota != null ? Math.max(0, row.totalQuota - row.usage) : null;

  return (
    <div className="border border-black/10 rounded-xl bg-white overflow-hidden">
      {/* Row header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] border border-black/15 rounded-full px-2 py-px uppercase tracking-wider text-black/50 flex-shrink-0">
            {VENDOR_CONFIG[row.vendor].label}
          </span>
          <span className="text-[10px] text-black/30 border border-black/10 rounded-full px-2 py-px flex-shrink-0">{row.group}</span>
          <span className="text-sm font-medium truncate">{row.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button onClick={() => setEditing(e => !e)} className="p-1.5 rounded hover:bg-black/5 text-black/30 hover:text-black transition-colors">
            {editing ? <ChevronUp size={14} /> : <Pencil size={13} />}
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-50 text-black/20 hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 pb-3 text-[11px] text-black/40 font-mono border-t border-black/5 pt-2">
        <span>{row.usage} used</span>
        <span>·</span>
        <span>{row.totalQuota != null ? `${remaining} remaining / ${row.totalQuota} total` : 'Unlimited quota'}</span>
        <span>·</span>
        <span>{row.expiresAt ? `Expires ${new Date(row.expiresAt).toLocaleDateString()}` : 'No expiry'}</span>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="border-t border-black/5 px-4 py-4 bg-black/[0.01] space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-black/40 uppercase tracking-widest block mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-black/40 uppercase tracking-widest block mb-1">
                Total Quota <span className="normal-case font-normal">(blank = unlimited)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={form.totalQuota}
                onChange={e => setForm(f => ({ ...f, totalQuota: e.target.value }))}
                className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-black/40 uppercase tracking-widest block mb-1">
                Expires At <span className="normal-case font-normal">(blank = never)</span>
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black/30"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-semibold rounded-lg hover:bg-black/80 disabled:opacity-50 transition-colors"
            >
              <Check size={12} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-4 py-2 border border-black/10 text-xs rounded-lg hover:bg-black/5 transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const url = vendorFilter === 'all' ? '/api/v1/manage/keys' : `/api/v1/manage/keys?vendor=${vendorFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      const rows: KeyRow[] = Object.entries(data).map(([key, val]) => ({ key, ...(val as SubKeyData) }));
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setKeys(rows);
    } finally {
      setLoading(false);
    }
  }, [vendorFilter]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const vendors = ['all', ...Object.keys(VENDOR_CONFIG)] as const;

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#111] font-sans selection:bg-black/10">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between mb-10 border-b border-black/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center">
              <Settings className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                SETTINGS
                <span className="text-[11px] px-2 py-0.5 border border-black/20 rounded-full uppercase">keys</span>
              </h1>
              <p className="text-sm text-black/60">Manage quota, expiry and key details</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-black/40 hover:text-black transition-colors">← Dashboard</a>
          </div>
        </header>

        {/* Vendor filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {vendors.map(v => (
            <button
              key={v}
              onClick={() => setVendorFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                vendorFilter === v ? 'bg-black text-white border-black' : 'border-black/10 text-black/50 hover:text-black hover:border-black/20 bg-white'
              }`}
            >
              {v === 'all' ? 'All Vendors' : VENDOR_CONFIG[v as VendorId].label}
            </button>
          ))}
        </div>

        {/* Key list */}
        {loading ? (
          <div className="text-center py-12 text-sm text-black/30">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 border border-black/10 rounded-2xl bg-white">
            <p className="text-sm text-black/30 mb-4">No keys found</p>
            <a href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold border border-black px-4 py-2 rounded-lg hover:bg-black hover:text-white transition-colors">
              <Plus size={12} /> Create a Key
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map(row => (
              <KeySettingsRow key={row.key} row={row} onSaved={loadKeys} onDeleted={loadKeys} />
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-black/5 text-xs text-black/30 text-center">
          Bridge Vault · {keys.length} key{keys.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
