'use client';

import { useState } from 'react';

export function ManageForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/memberships/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not open portal.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-3xl bg-white p-6 shadow-card sm:p-8">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Your email
        </span>
        <input
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="parent@email.com"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base focus:border-coral focus:outline-none"
        />
      </label>
      {error && (
        <p className="mt-3 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={loading || !email.trim()}
        className="mt-5 w-full rounded-full bg-coral px-6 py-3.5 text-base font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
      >
        {loading ? 'Opening portal…' : 'Open billing portal →'}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Stripe will verify your email and open the portal directly. We never see your card details.
      </p>
    </div>
  );
}
