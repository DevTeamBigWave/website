'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signInWithPassword, setPassword, type LoginState } from './actions';

const initial: LoginState = { status: 'idle' };

export default function AdminLoginPage() {
  const [mode, setMode] = useState<'signin' | 'setpw'>('signin');
  const [state, action] = useActionState(
    mode === 'signin' ? signInWithPassword : setPassword,
    initial,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          Wonderland Playhouse
        </p>
        <h1 className="mt-1 font-display text-3xl text-slate-700">
          {mode === 'signin' ? 'Sign in to admin' : 'Set your password'}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {mode === 'signin'
            ? 'Email and password. First time? Set your password below.'
            : 'Choose a password — at least 8 characters. Then sign in.'}
        </p>

        {state.status === 'password_set' ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5">
              <p className="font-display text-lg text-slate-700">
                Password saved
              </p>
              <p className="mt-1 text-sm text-slate-600">
                You can now sign in as <strong>{state.email}</strong>.
              </p>
            </div>
            <button
              onClick={() => setMode('signin')}
              className="w-full rounded-full bg-coral px-6 py-3 text-base font-bold text-white shadow-playful hover:bg-coral-600"
            >
              Continue to sign in
            </button>
          </div>
        ) : (
          <form action={action} className="mt-8 space-y-4">
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

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {mode === 'signin' ? 'Password' : 'New password (min 8 chars)'}
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={mode === 'setpw' ? 8 : undefined}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 placeholder:text-slate-300 focus:border-coral focus:outline-none"
              />
            </label>

            {state.status === 'error' && (
              <p className="text-sm text-coral-700">{state.message}</p>
            )}

            <SubmitButton mode={mode} />

            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'setpw' : 'signin')}
              className="w-full text-center text-sm font-semibold text-coral hover:text-coral-700"
            >
              {mode === 'signin'
                ? 'First time? Set your password →'
                : '← Back to sign in'}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-slate-400">
          Only emails in the admin_users allowlist can sign in or set a password.
        </p>
      </div>
    </main>
  );
}

function SubmitButton({ mode }: { mode: 'signin' | 'setpw' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-coral px-6 py-3 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? mode === 'signin'
          ? 'Signing in…'
          : 'Saving…'
        : mode === 'signin'
          ? 'Sign in'
          : 'Set password'}
    </button>
  );
}
