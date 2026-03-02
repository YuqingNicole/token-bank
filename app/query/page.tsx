'use client';

import React, { useState } from 'react';
import {
  Search,
  Activity,
  Clock,
  Database,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertCircle,
  Share2,
} from 'lucide-react';
import type { SubKeyRecord } from '@/lib/types';
import { VENDOR_CONFIG } from '@/lib/vendors';
import { ShareSnippet } from '@/components/ShareSnippet';

export default function UsageQuery() {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubKeyRecord | null>(null);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);

  const handleQuery = async () => {
    if (!keyInput.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setShowShare(false);

    try {
      const response = await fetch(`/api/v1/manage/keys/${encodeURIComponent(keyInput.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setResult(data as SubKeyRecord);
      } else if (response.status === 404) {
        setError('Invalid Security Key. No record found in vault.');
      } else {
        setError('Vault lookup failed. Please try again.');
      }
    } catch {
      setError('Neural link timeout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#111] font-sans selection:bg-black/10">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-black/10 bg-white shadow-sm shadow-black/5 mb-5">
            <ShieldCheck className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Key Inquiry</h1>
          <p className="text-sm text-black/60">Verify status and review vault usage</p>
        </header>

        {/* Search Box */}
        <div className="border border-black/10 rounded-2xl p-4 mb-6 bg-white shadow-sm shadow-black/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-1 border border-black/10 rounded-xl px-3 py-2 bg-black/[0.03]">
              <Search className="w-4 h-4 text-black/50" />
              <input
                type="text"
                placeholder="Enter your sk-vault-xxxx key..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm font-mono text-black placeholder:text-black/30"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              />
            </div>
            <button
              onClick={handleQuery}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 border border-black rounded-xl text-xs font-semibold tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              {loading ? 'CHECKING' : 'QUERY'}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-black/5 border border-black/10 rounded-xl p-4 flex items-center gap-3 text-xs text-black">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm shadow-black/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-[0.3em] border border-black/20 rounded-full px-3 py-0.5">
                      {VENDOR_CONFIG[result.vendor].label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.3em] border border-black/20 rounded-full px-3 py-0.5">
                      {result.group}
                    </span>
                  </div>
                  <div className="text-lg font-semibold">{result.name || 'Unnamed Key'}</div>
                  <div className="text-xs font-mono text-black/60 mt-1 truncate max-w-[260px]">
                    {result.key}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold leading-none">{result.usage}</div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-black/50 mt-1">Calls</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="border border-black/10 rounded-xl p-4 bg-black/[0.02]">
                  <div className="flex items-center gap-2 text-black/60 mb-2">
                    <Clock size={12} />
                    <span className="text-[10px] uppercase tracking-[0.3em]">Created</span>
                  </div>
                  <div className="text-xs font-mono">
                    {new Date(result.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="border border-black/10 rounded-xl p-4 bg-black/[0.02]">
                  <div className="flex items-center gap-2 text-black/60 mb-2">
                    <Zap size={12} />
                    <span className="text-[10px] uppercase tracking-[0.3em]">Status</span>
                  </div>
                  <div className="text-xs font-semibold uppercase">Authenticated</div>
                </div>
              </div>

              <div className="border border-black/10 rounded-xl p-4 bg-black/[0.02] mb-4">
                <div className="flex items-center gap-2 text-black/60 mb-1">
                  <Database size={11} />
                  <span className="text-[10px] uppercase tracking-[0.3em]">Base URL</span>
                </div>
                <code className="text-xs font-mono text-black/80 break-all">{result.baseUrl}</code>
              </div>

              <button
                onClick={() => setShowShare((s) => !s)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-black rounded-xl text-xs font-semibold tracking-[0.3em] hover:bg-black hover:text-white transition-colors"
              >
                <Share2 size={12} />
                {showShare ? 'Hide Snippet' : 'Share Snippet'}
              </button>

              {showShare && (
                <div className="mt-4 border border-black/10 rounded-xl p-4 bg-[#fefefe]">
                  <ShareSnippet subKey={result.key} vendor={result.vendor} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-black/60 hover:text-black transition-colors">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
