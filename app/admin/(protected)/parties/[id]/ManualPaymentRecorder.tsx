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
}: {
  partyId: string;
  depositCents: number;
  depositPaidAt: string | null;
  depositMethod: string | null;
  balanceDueCents: number;
  balancePaidAt: string | null;
  balancePaidAmountCents: number;
  balanceMethod: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (kind: 'deposit' | 'balance', method: Method) => {
    const amount = kind === 'deposit' ? depositCents : balanceDueCents;
    const label = METHODS.find((m) => m.value === method)?.label ?? method;
    if (
      !confirm(
        `Mark the ${kind} of ${fmt(amount)} as paid via ${label}? This voids any open Stripe invoice and ${kind === 'deposit' ? 'creates the calendar event.' : 'records the balance payment.'}`,
      )
    ) {
      return;
    }
    setBusy(`${kind}-${method}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/mark-paid`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, method }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not mark paid');
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
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
        {!depositPaidAt && (
          <ButtonGroup
            onPick={(method) => submit('deposit', method)}
            busyKey={busy?.startsWith('deposit-') ? busy.replace('deposit-', '') : null}
          />
        )}
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

      {error && <p className="text-xs text-coral-700">{error}</p>}
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
