'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  signInWithGoogle,
  signInWithPassword,
  setPassword,
  type LoginState,
} from './actions';

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

        <form action={signInWithGoogle} className="mt-8">
          <GoogleButton />
        </form>

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

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z" fill="#34A853" />
        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.997 10.997 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
      </svg>
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </button>
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
          type="email"
          name="email"
          required
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
