'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OPEN_PLAY_OPEN_HHMM, OPEN_PLAY_CLOSE_HHMM } from '@/lib/hours';

type Override = {
  date: string;
  closed: boolean;
  open_minutes: number | null;
  close_minutes: number | null;
  note: string | null;
};

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function fmtMin(min: number | null): string {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

const todayStr = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export function HoursManager({ initial }: { initial: Override[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Override[]>(initial);
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'closed' | 'custom'>('closed');
  const [open, setOpen] = useState(OPEN_PLAY_OPEN_HHMM);
  const [close, setClose] = useState(OPEN_PLAY_CLOSE_HHMM);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!date) {
      setError('Pick a date.');
      return;
    }
    if (mode === 'custom' && open >= close) {
      setError('Open time must be before close time.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/integrations/hours', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date,
          closed: mode === 'closed',
          ...(mode === 'custom' ? { open, close } : {}),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save');
        return;
      }
      router.refresh();
      // Optimistic local update
      const next: Override = {
        date,
        closed: mode === 'closed',
        open_minutes: mode === 'custom' ? toMin(open) : null,
        close_minutes: mode === 'custom' ? toMin(close) : null,
        note: note.trim() || null,
      };
      setItems((prev) => [...prev.filter((p) => p.date !== date), next].sort((a, b) => a.date.localeCompare(b.date)));
      setDate('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: string) => {
    if (!confirm(`Remove the hours override for ${fmtDate(d)}?`)) return;
    const res = await fetch(`/api/admin/integrations/hours?date=${d}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((p) => p.date !== d));
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-display text-xl text-slate-700">Custom hours &amp; closures</h2>
      <p className="mt-1 text-sm text-slate-500">
        Set special hours for a specific date — close all day, open late, or close early.
        These update your Google Maps hours <strong>and</strong> block on-site bookings/open
        play for that time.
      </p>

      {/* Existing overrides */}
      {items.length > 0 ? (
        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {items.map((o) => (
            <div key={o.date} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{fmtDate(o.date)}</p>
                <p className="text-xs text-slate-500">
                  {o.closed
                    ? 'Closed all day'
                    : `Open ${fmtMin(o.open_minutes)} – ${fmtMin(o.close_minutes)}`}
                  {o.note ? ` · ${o.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(o.date)}
                className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-coral"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">No custom hours set — your normal hours apply.</p>
      )}

      {/* Add form */}
      <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Type</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'closed' | 'custom')}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
            >
              <option value="closed">Closed all day</option>
              <option value="custom">Custom hours</option>
            </select>
          </label>
        </div>

        {mode === 'custom' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Open</span>
              <input
                type="time"
                value={open}
                onChange={(e) => setOpen(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Close</span>
              <input
                type="time"
                value={close}
                onChange={(e) => setClose(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </label>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Staff training, holiday"
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
          />
        </label>

        {error && <p className="text-xs text-coral-700">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save hours override'}
        </button>
      </div>
    </div>
  );
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

