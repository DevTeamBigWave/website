'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export type LoginState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'password_set'; email: string };

function authServerClient() {
  return cookies().then((cookieStore) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    ),
  );
}

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return `https://${h.get('host') ?? 'website-production-4594.up.railway.app'}`;
}

async function isAllowlisted(email: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('admin_users')
    .select('id')
    .ilike('email', email)
    .eq('active', true)
    .maybeSingle();
  return !!data;
}

// Kick off Google OAuth — Supabase generates the auth URL, we redirect to it.
// Google sends users back to Supabase, which calls our /admin/auth/callback.
// Allowlist check happens in requireAdmin() once they hit /admin.
export async function signInWithGoogle(): Promise<void> {
  const supabase = await authServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/admin/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    redirect('/admin/login?error=oauth_init_failed');
  }

  redirect(data.url);
}

// Sign in with email + password (fallback if Google is unavailable)
export async function signInWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', message: 'Email and password required.' };
  }
  if (!(await isAllowlisted(email))) {
    return { status: 'error', message: 'Invalid email or password.' };
  }

  const supabase = await authServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: 'error', message: 'Invalid email or password.' };
  }

  redirect('/admin');
}

// Set or reset a password for an allowlisted admin email.
export async function setPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', message: 'Email and password required.' };
  }
  if (password.length < 8) {
    return { status: 'error', message: 'Password must be at least 8 characters.' };
  }
  if (!(await isAllowlisted(email))) {
    return { status: 'error', message: 'That email is not an authorized admin.' };
  }

  const admin = supabaseAdmin();

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) return { status: 'error', message: error.message };
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) return { status: 'error', message: error.message };
  }

  return { status: 'password_set', email };
}
