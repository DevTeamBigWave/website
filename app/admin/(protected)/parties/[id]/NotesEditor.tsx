'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NotesEditor({
  partyId,
  initial,
}: {
  partyId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirror what's saved so the read-view updates without a hard refresh.
  const [saved, setSaved] = useState<string | null>(initial);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/notes`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Could not save (${res.status})`);
        return;
      }
      setSaved(data.notes ?? null);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Notes from parent
          </p>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue(saved ?? '');
              setError(null);
            }}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-coral"
          >
            Cancel
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          maxLength={2000}
          autoFocus
          placeholder="Allergies, decor theme, special requests…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
        />
        {error && <p className="mt-1 text-xs text-coral-700">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Notes from parent
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[10px] font-bold uppercase tracking-wider text-coral hover:text-coral-700"
        >
          {saved ? 'Edit' : '+ Add'}
        </button>
      </div>
      {saved ? (
        <p className="mt-1 whitespace-pre-wrap">{saved}</p>
      ) : (
        <p className="mt-1 italic text-slate-400">
          None yet — tap Add to capture allergies, decor theme, special requests.
        </p>
      )}
    </div>
  );
}
