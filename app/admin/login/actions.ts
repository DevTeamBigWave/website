'use server';

import { cookies, headers } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

export type LoginState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { status: 'error', message: 'Please enter a valid email.' };
  }

  // Allowlist pre-check — fail closed if not in admin_users
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('admin_users')
    .select('email, active')
    .ilike('email', email)
    .eq('active', true)
    .maybeSingle();

  if (!row) {
    // Identical message to "sent" to avoid leaking which emails are admins
    return { status: 'sent', email };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
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
  );

  // Build the absolute callback URL from the inbound request
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${h.get('host') ?? 'website-production-4594.up.railway.app'}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/admin/auth/callback`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'sent', email };
}
