import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCodeForTokens, decodeIdTokenEmail } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

// Must exactly match the redirect_uri sent on /connect AND the one
// registered in Google Cloud → OAuth Client → Authorized redirect URIs.
const PRODUCTION_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com';
const PRODUCTION_REDIRECT_URI = `${PRODUCTION_BASE_URL}/api/google/callback`;

export async function GET(request: Request) {
  const me = await requireOwner();
  const url = new URL(request.url);

  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/integrations/google?error=${encodeURIComponent(error)}`,
        PRODUCTION_BASE_URL,
      ),
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL('/admin/integrations/google?error=state_mismatch', PRODUCTION_BASE_URL),
    );
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, PRODUCTION_REDIRECT_URI);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.redirect(
      new URL(
        `/admin/integrations/google?error=${encodeURIComponent(msg)}`,
        PRODUCTION_BASE_URL,
      ),
    );
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      new URL('/admin/integrations/google?error=no_refresh_token', PRODUCTION_BASE_URL),
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
    new URL('/admin/integrations/google?connected=1', PRODUCTION_BASE_URL),
  );
}
