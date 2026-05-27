'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIVATE_PARTY_TIMES, SEMI_PARTY_TIMES } from '@/lib/pricing';

// "10:00 AM" → "10:00"
function to24h(slot: string): string {
  const [hm, period] = slot.split(' ');
  const [h, m] = hm.split(':');
  let hh = parseInt(h, 10);
  if (period === 'PM' && hh < 12) hh += 12;
  if (period === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${m}`;
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

export function RescheduleCard({
  partyId,
  partyPackage,
  currentDate,
  currentStartTime,
}: {
  partyId: string;
  partyPackage: 'private' | 'semi';
  currentDate: string;
  currentStartTime: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState(currentDate);
  const [newTime, setNewTime] = useState(currentStartTime.slice(0, 5));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = (partyPackage === 'private' ? PRIVATE_PARTY_TIMES : SEMI_PARTY_TIMES).map(
    (s) => ({ value: to24h(s), label: s }),
  );

  const submit = async () => {
    setError(null);
    if (newDate === currentDate && newTime === currentStartTime.slice(0, 5)) {
      setError('Pick a different date or time.');
      return;
    }
    if (
      !confirm(
        `Move from ${fmtDate(currentDate)} at ${fmtTime(currentStartTime)} to ${fmtDate(newDate)} at ${fmtTime(newTime)}? The customer gets an email + calendar update. Money state stays the same — no refunds, no re-charging.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/reschedule`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          new_date: newDate,
          new_start_time: newTime,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not reschedule');
        return;
      }
      router.refresh();
      setOpen(false);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-xl border border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">Reschedule</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Move the party to a new date or time. Customer gets an email and
              Google Calendar update. Money state stays put.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-end rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-600 sm:self-auto"
          >
            Reschedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-3 overflow-hidden rounded-xl border-2 border-coral bg-coral-50/50 px-4 py-4">
      <p className="text-sm font-bold text-slate-700">
        Reschedule from {fmtDate(currentDate)} at {fmtTime(currentStartTime)}
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="New date">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="mt-1 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
          />
        </Field>
        <Field label="New start time">
          <select
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="mt-1 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
          >
            {slots.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Reason (optional, shown to the customer)">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          cols={1}
          placeholder="e.g. Family emergency, moving to next weekend"
          style={{ width: '100%', maxWidth: '100%' }}
          className="mt-1 block min-w-0 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
        />
      </Field>
      {error && <p className="text-xs text-coral-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Reschedule & notify customer'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
