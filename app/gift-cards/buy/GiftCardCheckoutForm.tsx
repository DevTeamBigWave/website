'use client';

import { useState } from 'react';

const PRESET_AMOUNTS = [25, 50, 100, 250];

export function GiftCardCheckoutForm({ presetAmount }: { presetAmount: number | null }) {
  const [amount, setAmount] = useState<number>(
    presetAmount && PRESET_AMOUNTS.includes(presetAmount) ? presetAmount : 50,
  );
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(
    presetAmount != null && !PRESET_AMOUNTS.includes(presetAmount),
  );
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount = isCustom ? parseInt(customAmount || '0', 10) : amount;
  const canSubmit =
    effectiveAmount >= 25 &&
    effectiveAmount <= 500 &&
    purchaserName.trim() &&
    purchaserEmail.trim() &&
    recipientName.trim() &&
    recipientEmail.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/gift-card', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountCents: effectiveAmount * 100,
          purchaserName: purchaserName.trim(),
          purchaserEmail: purchaserEmail.trim(),
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          message: message.trim() || undefined,
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
    <div className="mt-10 space-y-10">
      <Section number="01" title="Pick an amount">
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((a) => {
            const selected = !isCustom && amount === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setIsCustom(false);
                  setAmount(a);
                }}
                className={`rounded-full border px-5 py-3 text-base font-bold transition ${
                  selected
                    ? 'border-coral bg-coral text-white shadow-playful'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                ${a}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`rounded-full border px-5 py-3 text-base font-bold transition ${
              isCustom
                ? 'border-coral bg-coral text-white shadow-playful'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            Custom
          </button>
        </div>
        {isCustom && (
          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Custom amount (USD)
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-display text-2xl text-slate-700">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="customAmount"
                  value={customAmount}
                  onChange={(e) =>
                    setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))
                  }
                  className="w-32 rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold focus:border-coral focus:outline-none"
                  placeholder="75"
                />
                <span className="text-xs text-slate-400">$25 – $500</span>
              </div>
            </label>
          </div>
        )}
      </Section>

      <Section number="02" title="Who's it for">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Recipient name"
            name="recipientName"
            autoComplete="off"
            value={recipientName}
            onChange={setRecipientName}
            required
          />
          <Field
            label="Recipient email"
            name="recipientEmail"
            autoComplete="off"
            value={recipientEmail}
            onChange={setRecipientEmail}
            type="email"
            required
          />
          <div className="sm:col-span-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Personal message (optional)
              </span>
              <textarea
                name="giftMessage"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none"
                placeholder="Happy birthday! Can't wait to see you and the kids at Wonderland."
              />
            </label>
          </div>
        </div>
      </Section>

      <Section number="03" title="Your info (for the receipt)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Your name"
            name="purchaserName"
            autoComplete="name"
            value={purchaserName}
            onChange={setPurchaserName}
            required
          />
          <Field
            label="Your email"
            name="purchaserEmail"
            autoComplete="email"
            value={purchaserEmail}
            onChange={setPurchaserEmail}
            type="email"
            required
          />
        </div>
      </Section>

      <div className="space-y-3">
        {error && (
          <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">{error}</p>
        )}
        <div className="rounded-2xl bg-cream-deep p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Total
            </span>
            <span className="font-display text-3xl text-slate-700">
              ${effectiveAmount || 0}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Starting checkout…' : `Send $${effectiveAmount || 0} gift card →`}
        </button>
        <p className="text-center text-xs text-slate-400">
          You&rsquo;ll pay securely via Stripe. The recipient gets their code by
          email the moment payment clears.
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
  name,
  autoComplete: autoCompleteProp,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  name?: string;
  autoComplete?: string;
}) {
  // Map "email"/"tel" types to text inputs with inputMode hints so iOS shows
  // the right keyboard but doesn't fire its overzealous pattern validator on
  // autofilled / whitespace-padded values. We validate server-side anyway.
  const isEmail = type === 'email';
  const isTel = type === 'tel';
  const inputType = isEmail || isTel ? 'text' : type;
  const inputMode = isEmail ? 'email' : isTel ? 'tel' : undefined;
  // Explicit name + autoComplete from props takes priority — critical when a
  // form has multiple name/email pairs (e.g. recipient vs purchaser) so iOS
  // autofill doesn't bounce the same value into every field.
  const autoComplete =
    autoCompleteProp ?? (isEmail ? 'email' : isTel ? 'tel' : undefined);

  return (
    <label className="block">
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
