'use client';

import { useState, useTransition } from 'react';
import { addChild, updateChild, deleteChild } from './actions';

type Child = {
  id: string;
  customer_id: string;
  name: string;
  date_of_birth: string | null;
  notes: string | null;
  birthday_emails_subscribed: boolean;
  last_birthday_reminder_sent_at: string | null;
};

export function ChildrenSection({
  customerId,
  children: initialChildren,
}: {
  customerId: string;
  children: Child[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="font-display text-lg text-slate-700">
          Children ({initialChildren.length})
        </h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white hover:bg-coral-600"
        >
          {showAdd ? 'Cancel' : '+ Add child'}
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 bg-cream-deep px-5 py-4">
          <AddChildForm
            customerId={customerId}
            onDone={() => setShowAdd(false)}
          />
        </div>
      )}

      <div className="px-5 py-2">
        {initialChildren.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No children on file. Add one to enable birthday automation.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {initialChildren.map((child) =>
              editingId === child.id ? (
                <li key={child.id} className="py-4">
                  <EditChildForm
                    child={child}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={child.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-slate-700">
                      {child.name}
                      {!child.birthday_emails_subscribed && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          No b-day emails
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {child.date_of_birth ? (
                        <>
                          DOB {fmtDate(child.date_of_birth)} · Age {age(child.date_of_birth)}
                        </>
                      ) : (
                        <span className="text-coral">No DOB on file</span>
                      )}
                      {child.notes && ` · ${child.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingId(child.id)}
                    className="text-xs font-semibold text-coral hover:text-coral-700"
                  >
                    Edit
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddChildForm({
  customerId,
  onDone,
}: {
  customerId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await addChild(customerId, {
          name,
          date_of_birth: dob || null,
          notes: notes.trim() || null,
        });
        setName('');
        setDob('');
        setNotes('');
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1.2fr_140px_1.5fr_auto] sm:items-end">
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="input"
        />
      </Field>
      <Field label="DOB">
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Notes (optional)">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Allergies, prefs..."
          className="input"
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-600 disabled:opacity-50"
      >
        {pending ? '…' : 'Add'}
      </button>
      {error && (
        <p className="text-xs text-coral-700 sm:col-span-4">{error}</p>
      )}
      <style jsx>{`
        .input {
          margin-top: 4px;
          width: 100%;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          padding: 8px 12px;
          font-size: 13px;
          color: #2C4253;
        }
        .input:focus {
          outline: none;
          border-color: #ff7783;
        }
      `}</style>
    </form>
  );
}

function EditChildForm({
  child,
  onDone,
}: {
  child: Child;
  onDone: () => void;
}) {
  const [name, setName] = useState(child.name);
  const [dob, setDob] = useState(child.date_of_birth ?? '');
  const [notes, setNotes] = useState(child.notes ?? '');
  const [subscribed, setSubscribed] = useState(child.birthday_emails_subscribed);
  const [pending, startTransition] = useTransition();

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await updateChild(child.id, child.customer_id, {
        name,
        date_of_birth: dob || null,
        notes: notes.trim() || null,
        birthday_emails_subscribed: subscribed,
      });
      onDone();
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete ${child.name}? This removes them from birthday automation.`)) return;
    startTransition(async () => {
      await deleteChild(child.id, child.customer_id);
      onDone();
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1.2fr_140px_1.5fr]">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="DOB">
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Notes">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={subscribed}
          onChange={(e) => setSubscribed(e.target.checked)}
        />
        Send birthday reminder emails
      </label>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-xs font-semibold text-coral-700 hover:text-coral disabled:opacity-50"
        >
          Delete
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold text-white hover:bg-coral-600 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .input {
          margin-top: 4px;
          width: 100%;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          padding: 8px 12px;
          font-size: 13px;
          color: #2C4253;
        }
        .input:focus {
          outline: none;
          border-color: #ff7783;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function age(dob: string): number {
  const d = new Date(dob + 'T00:00:00');
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  )
    a--;
  return a;
}
