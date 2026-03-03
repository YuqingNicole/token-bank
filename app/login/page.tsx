'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useLang, LangToggle } from '@/components/LangContext';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/vault';
  const { t } = useLang();
  const l = t.login;

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(from);
      } else {
        const data = await res.json();
        setError(data.error || l.errorInvalid);
        setPassword('');
      }
    } catch {
      setError(l.errorNetwork);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#111] font-sans flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-full border border-black/10 flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CLAUDE BRIDGE VAULT</h1>
          <p className="text-sm text-black/40 mt-1">{l.subtitle}</p>
        </div>

        {/* Lang toggle */}
        <div className="flex justify-end mb-4">
          <LangToggle />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/10 shadow-sm p-8 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-black/40 uppercase tracking-widest block mb-1.5">
              {l.passwordLabel}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder={l.passwordPlaceholder}
                className="w-full border border-black/10 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-black/30"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-black/80 disabled:opacity-40 transition-colors"
          >
            {loading ? l.verifying : l.signIn}
          </button>
        </form>

        <p className="text-center text-[11px] text-black/25 mt-6">
          {l.footer}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
