import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCodeForTokens, decodeIdTokenEmail } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const me = await requireOwner();
  const url = new URL(request.url);

  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/integrations/google?error=${encodeURIComponent(error)}`, request.url),
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL('/admin/integrations/google?error=state_mismatch', request.url),
    );
  }

  // Rebuild the same redirect_uri we sent on /connect — Google requires exact match
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL!;
  const redirectUri = `${origin}/api/google/callback`;

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, redirectUri);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.redirect(
      new URL(`/admin/integrations/google?error=${encodeURIComponent(msg)}`, request.url),
    );
  }

  if (!tokens.refresh_token) {
    // Google only returns refresh_token on the FIRST consent. If user
    // previously authorized without revoking, we won't get a new one.
    // The prompt=consent flag should force this, but just in case…
    return NextResponse.redirect(
      new URL('/admin/integrations/google?error=no_refresh_token', request.url),
    );
  }

  const email = tokens.id_token ? decodeIdTokenEmail(tokens.id_token) : null;

  const db = supabaseAdmin();
  await db.from('google_integrations').upsert(
    {
      admin_user_id: me.id,
      scope: 'calendar',
      google_email: email,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(
        Date.now() + (tokens.expires_in - 30) * 1000,
      ).toISOString(),
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'admin_user_id,scope' },
  );

  return NextResponse.redirect(
    new URL('/admin/integrations/google?connected=1', request.url),
  );
}
