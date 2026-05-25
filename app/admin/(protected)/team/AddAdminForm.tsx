'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { addAdmin, type TeamActionState } from './actions';

const initial: TeamActionState = { status: 'idle' };

export function AddAdminForm() {
  const [state, formAction] = useActionState(addAdmin, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Email
          </span>
          <input
            type="text"
            name="email"
            inputMode="email"
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-coral focus:outline-none"
            placeholder="teammate@wonderlandplayhouse.com"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Name (optional)
          </span>
          <input
            type="text"
            name="display_name"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-coral focus:outline-none"
            placeholder="Alex"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Role
          </span>
          <select
            name="role"
            defaultValue="staff"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-coral focus:outline-none"
          >
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
            <option value="readonly">Readonly</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        {state.status === 'error' && (
          <p className="text-sm text-coral-700">{state.message}</p>
        )}
        {state.status === 'success' && (
          <p className="text-sm text-sky-600">{state.message}</p>
        )}
        <div className="ml-auto">
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Adding…' : 'Add admin'}
    </button>
  );
}
