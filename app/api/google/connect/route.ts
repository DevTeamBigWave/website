import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
];

// Production URL is the source of truth — must match what's registered in
// Google Cloud Console under Authorized redirect URIs. Hardcoded to remove
// any chance of header weirdness producing a different value.
const PRODUCTION_REDIRECT_URI =
  'https://website-production-4594.up.railway.app/api/google/callback';

export async function GET(_request: Request) {
  await requireOwner();

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
    redirect_uri: PRODUCTION_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export const dynamic = 'force-dynamic';
