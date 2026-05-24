'use client';

import { useState } from 'react';

export function UnsubscribeForm({
  email,
  initialScope,
  token,
}: {
  email: string;
  initialScope: string;
  token: string;
}) {
  const [scope, setScope] = useState(initialScope);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, scope, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not unsubscribe');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Done ✓</p>
        <h1 className="mt-2 font-display text-3xl text-slate-700">
          You&rsquo;re unsubscribed.
        </h1>
        <p className="mt-3 text-slate-500">
          We&rsquo;ve removed <strong>{email}</strong> from{' '}
          {scope === 'all'
            ? 'all marketing emails'
            : scope === 'birthday_reminders'
              ? 'birthday reminder emails'
              : scope === 'promotions'
                ? 'promotional emails'
                : 'special event emails'}
          . Booking confirmations and other transactional emails will still arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-8 shadow-card">
      <h1 className="font-display text-3xl text-slate-700">Unsubscribe</h1>
      <p className="mt-3 text-slate-500">
        We&rsquo;re sorry to see you go. Pick what you&rsquo;d like to stop receiving:
      </p>

      <fieldset className="mt-6 space-y-2">
        {[
          {
            value: 'birthday_reminders',
            label: 'Birthday reminders only',
            hint: 'Stop the 12/8/4-week annual reminders. Still get promos + booking emails.',
          },
          {
            value: 'promotions',
            label: 'Promotional emails only',
            hint: 'Stop the weekly newsletter and sale alerts. Still get birthday reminders + booking emails.',
          },
          {
            value: 'all',
            label: 'All marketing emails',
            hint: 'Stop everything except booking confirmations and other transactional emails.',
          },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              scope === opt.value ? 'border-coral bg-coral-50' : 'border-slate-200 bg-white hover:border-slate-400'
            }`}
          >
            <input
              type="radio"
              name="scope"
              value={opt.value}
              checked={scope === opt.value}
              onChange={() => setScope(opt.value)}
              className="mt-1 h-4 w-4 accent-coral"
            />
            <div>
              <p className="text-sm font-bold text-slate-700">{opt.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{opt.hint}</p>
            </div>
          </label>
        ))}
      </fieldset>

      <p className="mt-5 text-xs text-slate-500">
        Email: <strong>{email}</strong>
      </p>
      {error && <p className="mt-3 text-sm text-coral-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-5 w-full rounded-full bg-coral px-6 py-3.5 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
      >
        {submitting ? 'Unsubscribing…' : 'Confirm unsubscribe'}
      </button>
    </div>
  );
}
