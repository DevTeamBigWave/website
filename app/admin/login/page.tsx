'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendMagicLink, type LoginState } from './actions';

const initial: LoginState = { status: 'idle' };

export default function AdminLoginPage() {
  const [state, formAction] = useActionState(sendMagicLink, initial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          Wonderland Playhouse
        </p>
        <h1 className="mt-1 font-display text-3xl text-slate-700">
          Sign in to admin
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          We&rsquo;ll email you a one-time sign-in link. No password.
        </p>

        {state.status === 'sent' ? (
          <div className="mt-8 rounded-2xl border-2 border-sunshine-200 bg-sunshine-50 p-5">
            <p className="font-display text-lg text-slate-700">
              Check your inbox
            </p>
            <p className="mt-1 text-sm text-slate-600">
              If <strong>{state.email}</strong> is an authorized admin, a sign-in
              link is on the way. The link expires in 1 hour.
            </p>
          </div>
        ) : (
          <form action={formAction} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 placeholder:text-slate-300 focus:border-coral focus:outline-none"
                placeholder="you@wonderlandplayhouse.com"
              />
            </label>
            {state.status === 'error' && (
              <p className="text-sm text-coral-700">{state.message}</p>
            )}
            <SubmitButton />
          </form>
        )}

        <p className="mt-8 text-xs text-slate-400">
          Only emails added to the admin_users table can sign in.
        </p>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-coral px-6 py-3 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Email me a sign-in link'}
    </button>
  );
}
