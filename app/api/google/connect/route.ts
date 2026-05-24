import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireOwner } from '@/lib/admin';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
];

export async function GET(request: Request) {
  await requireOwner();

  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL!;
  const redirectUri = `${origin}/api/google/callback`;

  // CSRF state — store in cookie, verify on callback
  const state = randomBytes(24).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // give us a refresh_token
    prompt: 'consent', // force refresh_token even if user previously consented
    state,
    include_granted_scopes: 'true',
  });

  // Redirect to Google's consent screen
  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

// Block POST etc to avoid CSRF
export const dynamic = 'force-dynamic';
