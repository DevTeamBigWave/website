'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Method = 'zelle' | 'cash' | 'clover';
const METHODS: Array<{ value: Method; label: string }> = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'clover', label: 'Clover' },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function ManualPaymentRecorder({
  partyId,
  depositCents,
  depositPaidAt,
  depositMethod,
  balanceDueCents,
  balancePaidAt,
  balancePaidAmountCents,
  balanceMethod,
  hasCalendarEvent,
}: {
  partyId: string;
  depositCents: number;
  depositPaidAt: string | null;
  depositMethod: string | null;
  balanceDueCents: number;
  balancePaidAt: string | null;
  balancePaidAmountCents: number;
  balanceMethod: string | null;
  // Promo-code bookings create the calendar event up front. Knowing whether
  // one already exists lets the confirm dialog avoid the misleading
  // "creates the calendar event" line when it's already there.
  hasCalendarEvent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  // Default flow: tap a method → confirm dialog → fetch. customAmountCents
  // bypasses the stored deposit_cents (used by the "Different amount" path).
  const submit = async (
    kind: 'deposit' | 'balance',
    method: Method,
    customAmountCents?: number,
    skipConfirm?: boolean,
  ) => {
    if (busy) return;
    const amount =
      customAmountCents != null
        ? customAmountCents
        : kind === 'deposit'
          ? depositCents
          : balanceDueCents;
    const label = METHODS.find((m) => m.value === method)?.label ?? method;
    if (!skipConfirm) {
      const tail =
        kind === 'balance'
          ? 'records the balance payment.'
          : hasCalendarEvent
            ? 'marks the deposit as received. Calendar event already exists.'
            : 'creates the calendar event.';
      if (
        !confirm(
          `Mark the ${kind} of ${fmt(amount)} as paid via ${label}? This closes the Stripe invoice as paid out-of-band and ${tail}`,
        )
      ) {
        return;
      }
    }
    setBusy(`${kind}-${method}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/mark-paid`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          method,
          ...(customAmountCents != null ? { amount_cents: customAmountCents } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Could not mark paid (${res.status})`);
        return;
      }
      setCustomOpen(false);
      setCustomAmount('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(null);
    }
  };

  // Custom-amount path: user has already explicitly opened the custom card
  // and typed a number — that IS the confirmation, no native dialog needed
  // (and iOS sometimes mis-renders confirm() inside a nested form).
  const onCustomPick = async (method: Method) => {
    const dollars = parseFloat(customAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Enter a deposit amount in dollars before picking a method.');
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents < 50) {
      setError('Minimum deposit is $0.50.');
      return;
    }
    await submit('deposit', method, cents, true);
  };

  return (
    <div className="space-y-4">
      <Section
        title={`Deposit · ${fmt(depositCents)}`}
        status={
          depositPaidAt
            ? `Paid ${new Date(depositPaidAt).toLocaleDateString()}${
                depositMethod ? ` · ${depositMethod}` : ''
              } ✓`
            : 'Not paid yet'
        }
      >
        <div className="space-y-2">
          {!depositPaidAt && (
            <ButtonGroup
              onPick={(method) => submit('deposit', method)}
              busyKey={busy?.startsWith('deposit-') ? busy.replace('deposit-', '') : null}
            />
          )}
          {!customOpen ? (
            <button
              type="button"
              onClick={() => {
                setCustomOpen(true);
                setError(null);
              }}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 underline hover:text-coral"
            >
              {depositPaidAt ? 'Override with custom amount' : 'Different amount?'}
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-coral bg-coral-50/40 p-3">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Custom deposit amount
                </span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    step="0.01"
                    min="0.50"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="e.g. 200.00"
                    style={{ width: 96 }}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
                  />
                  <span className="ml-1 text-[11px] text-slate-500">received via</span>
                </div>
              </label>
              <ButtonGroup
                onPick={onCustomPick}
                busyKey={busy?.startsWith('deposit-') ? busy.replace('deposit-', '') : null}
              />
              {error && (
                <p className="text-xs font-semibold text-coral-700">{error}</p>
              )}
              {depositPaidAt && (
                <p className="text-[11px] text-slate-500">
                  Heads up — this will replace the previous deposit (
                  {fmt(depositCents)}
                  {depositMethod ? ` · ${depositMethod}` : ''}).
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  setCustomAmount('');
                  setError(null);
                }}
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 underline hover:text-slate-600"
              >
                Cancel custom amount
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section
        title={
          balanceDueCents > 0
            ? `Balance owed · ${fmt(balanceDueCents)}`
            : 'Balance · paid in full'
        }
        status={
          balanceDueCents > 0
            ? balancePaidAmountCents > 0
              ? `Already received ${fmt(balancePaidAmountCents)}${
                  balanceMethod ? ` (${balanceMethod})` : ''
                } — more owed`
              : 'Nothing received yet'
            : balancePaidAt
              ? `Last paid ${new Date(balancePaidAt).toLocaleDateString()}${
                  balanceMethod ? ` · ${balanceMethod}` : ''
                } ✓`
              : 'No balance owed'
        }
      >
        {balanceDueCents > 0 && (
          <ButtonGroup
            onPick={(method) => submit('balance', method)}
            busyKey={busy?.startsWith('balance-') ? busy.replace('balance-', '') : null}
          />
        )}
      </Section>

      {/* Error from non-custom paths (Zelle/Cash/Clover on the default
          deposit OR balance) — the custom-amount path renders its own
          inline error inside the card so it's visible right at the action. */}
      {error && !customOpen && <p className="text-xs text-coral-700">{error}</p>}
      <p className="text-[11px] text-slate-400">
        Use these when a customer pays outside Stripe — Zelle, cash, or in-person on Clover.
        Stripe card payments record automatically.
      </p>
    </div>
  );
}

function Section({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="text-xs text-slate-500">{status}</p>
      </div>
      {children}
    </div>
  );
}

function ButtonGroup({
  onPick,
  busyKey,
}: {
  onPick: (m: Method) => void;
  busyKey: string | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {METHODS.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onPick(m.value)}
          disabled={busyKey !== null}
          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:border-coral hover:text-coral disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyKey === m.value ? '…' : m.label}
        </button>
      ))}
    </div>
  );
}
