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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--text)] flex items-center justify-center mb-4 shadow-vault-md">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Token Bank</h1>
          <p className="text-[13px] text-[var(--text-3)] mt-1">{l.subtitle}</p>
        </div>

        {/* Lang toggle */}
        <div className="flex justify-end mb-4">
          <LangToggle />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--border)] shadow-vault-md p-8 space-y-5">
          <div>
            <label className="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-widest block mb-2">
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
                className="focus-ring w-full border border-[var(--border)] rounded-[var(--radius-md)] px-3.5 py-2.5 pr-10 text-sm bg-[var(--surface-raised)] focus:border-[var(--border-hover)] focus:bg-[var(--surface)] transition-colors duration-[var(--duration-normal)]"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 rounded-[var(--radius-sm)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="focus-ring w-full py-2.5 bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold rounded-[var(--radius-md)] hover:opacity-90 disabled:opacity-40 transition-opacity duration-[var(--duration-fast)]"
          >
            {loading ? l.verifying : l.signIn}
          </button>
        </form>

        <p className="text-center text-[10px] text-[var(--text-4)] mt-6 font-mono">
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
