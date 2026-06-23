'use client';

import { useEffect, useState } from 'react';

export function JoinMembershipForm({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [cancelled, setCancelled] = useState(false);
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    searchParams.then((sp) => setCancelled(sp.cancelled === 'true'));
  }, [searchParams]);

  const canSubmit =
    parentName.trim() && email.trim() && phone.trim() && childName.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/membership', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          parent_name: parentName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          child_name: childName.trim(),
          child_dob: childDob || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not start checkout. Try again.');
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10 space-y-8">
      {cancelled && (
        <div className="rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">
          Checkout cancelled. No charge made — fill out the form again whenever you&rsquo;re ready.
        </div>
      )}

      <Section number="01" title="Your info">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Your name"
            value={parentName}
            onChange={setParentName}
            name="name"
            autoComplete="name"
            required
            full
          />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            name="email"
            autoComplete="email"
            required
          />
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            type="tel"
            name="phone"
            autoComplete="tel"
            required
          />
        </div>
      </Section>

      <Section number="02" title="Your child">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Child's name"
            value={childName}
            onChange={setChildName}
            name="childName"
            required
            full
          />
          <Field
            label="Date of birth (optional)"
            value={childDob}
            onChange={setChildDob}
            type="date"
            name="childDob"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          One child per membership. Need a second? Add them after — same flow, separate
          subscription.
        </p>
      </Section>

      <div className="space-y-3">
        <div className="rounded-2xl bg-cream-deep p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Monthly
            </span>
            <span className="font-display text-3xl text-slate-700">$150<span className="ml-1 text-base font-normal text-slate-400">+ tax</span></span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Charged today and on the same date every month. Cancel anytime — no penalty,
            keep access through end of current period.
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Starting checkout…' : 'Join — $150/month →'}
        </button>
        <p className="text-center text-xs text-slate-400">
          Secure checkout via Stripe. We never see your card.
        </p>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <span className="font-display text-2xl text-coral-200">{number}</span>
        <h2 className="font-display text-2xl text-slate-700">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  full,
  name,
  autoComplete: autoCompleteProp,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  full?: boolean;
  name?: string;
  autoComplete?: string;
}) {
  const isEmail = type === 'email';
  const isTel = type === 'tel';
  const inputType = isEmail || isTel ? 'text' : type;
  const inputMode = isEmail ? 'email' : isTel ? 'tel' : undefined;
  const autoComplete =
    autoCompleteProp ?? (isEmail ? 'email' : isTel ? 'tel' : undefined);

  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-coral">*</span>}
      </span>
      <input
        type={inputType}
        inputMode={inputMode as any}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none"
      />
    </label>
  );
}
