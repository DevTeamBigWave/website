'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  signInWithPassword,
  setPassword,
  type LoginState,
} from './actions';
import { GoogleSignInButton } from './GoogleSignInButton';

const initial: LoginState = { status: 'idle' };

export default function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
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
        <h1 className="mt-1 font-display text-3xl text-slate-700">Admin sign-in</h1>
        <p className="mt-3 text-sm text-slate-500">
          Use your Google account, or sign in with email + password.
        </p>

        <div className="mt-8">
          <GoogleSignInButton />
        </div>

        <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
          <span className="flex-1 border-t border-slate-200" />
          <span>or</span>
          <span className="flex-1 border-t border-slate-200" />
        </div>

        {!showPassword ? (
          <button
            onClick={() => setShowPassword(true)}
            className="mt-6 w-full text-center text-sm font-semibold text-coral hover:text-coral-700"
          >
            Sign in with email &amp; password →
          </button>
        ) : (
          <PasswordForm
            mode={mode}
            setMode={setMode}
            action={action}
            state={state}
          />
        )}

        <p className="mt-8 text-xs text-slate-400">
          Only emails added to the admin_users allowlist can sign in.
        </p>
      </div>
    </main>
  );
}

function PasswordForm({
  mode,
  setMode,
  action,
  state,
}: {
  mode: 'signin' | 'setpw';
  setMode: (m: 'signin' | 'setpw') => void;
  action: (fd: FormData) => void;
  state: LoginState;
}) {
  if (state.status === 'password_set') {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5">
          <p className="font-display text-lg text-slate-700">Password saved</p>
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
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Email
        </span>
        <input
          type="text"
          name="email"
          inputMode="email"
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 placeholder:text-slate-300 focus:border-coral focus:outline-none"
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
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 focus:border-coral focus:outline-none"
        />
      </label>
      {state.status === 'error' && (
        <p className="text-sm text-coral-700">{state.message}</p>
      )}
      <PasswordSubmit mode={mode} />
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
  );
}

function PasswordSubmit({ mode }: { mode: 'signin' | 'setpw' }) {
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
