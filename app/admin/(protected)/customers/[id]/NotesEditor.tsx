'use client';

import { useState, useTransition } from 'react';
import { saveCustomerNotes } from './actions';

export function NotesEditor({
  customerId,
  initialNotes,
}: {
  customerId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [savedSnapshot, setSavedSnapshot] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = notes !== savedSnapshot;

  const onSave = () => {
    startTransition(async () => {
      await saveCustomerNotes(customerId, notes);
      setSavedSnapshot(notes);
      setSavedAt(new Date());
    });
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Internal notes
        </p>
        {savedAt && !dirty && !pending && (
          <span className="text-xs text-sky-600">Saved</span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="Private to staff — preferences, allergies, history..."
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-coral focus:outline-none"
      />
      <button
        onClick={onSave}
        disabled={!dirty || pending}
        className="mt-3 rounded-full bg-slate-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save notes'}
      </button>
    </div>
  );
}
