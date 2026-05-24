// Minimal Google Calendar API wrapper. Uses fetch + the OAuth refresh token
// flow — no googleapis SDK needed.
//
// Auth model: the owner connects their Google account once via /admin/integrations/google.
// We store the refresh_token. Every API call refreshes the access_token if
// it's expired, then hits Calendar API directly.

import { supabaseAdmin } from '@/lib/supabase';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

type IntegrationRow = {
  id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  calendar_id: string;
};

function clientId() {
  return process.env.GOOGLE_OAUTH_CLIENT_ID!;
}
function clientSecret() {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
}

export async function getIntegration(): Promise<IntegrationRow | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('google_integrations')
    .select('id, refresh_token, access_token, access_token_expires_at, calendar_id')
    .eq('scope', 'calendar')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function getValidAccessToken(integration: IntegrationRow): Promise<string> {
  // Refresh if expiring within 60s
  const expiresAt = integration.access_token_expires_at
    ? new Date(integration.access_token_expires_at).getTime()
    : 0;
  if (integration.access_token && expiresAt - Date.now() > 60_000) {
    return integration.access_token;
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: integration.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  const db = supabaseAdmin();
  await db
    .from('google_integrations')
    .update({
      access_token: data.access_token,
      access_token_expires_at: new Date(
        Date.now() + (data.expires_in - 30) * 1000,
      ).toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return data.access_token;
}

// Exchanges an OAuth authorization code for tokens. Called from
// /api/google/callback after the owner authorizes calendar access.
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  refresh_token: string;
  access_token: string;
  expires_in: number;
  id_token?: string;
}> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${err}`);
  }
  return res.json();
}

// Decodes Google's id_token (JWT) to get the user's email — no signature
// check needed because we just received the token from Google over TLS.
export function decodeIdTokenEmail(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1];
    const json = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    );
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}

// ----- Calendar event CRUD -----

export type PartyForCalendar = {
  id: string;
  package: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  duration_minutes: number;
  extension_minutes: number | null;
  child_name: string | null;
  child_age: number | null;
  parent_name: string;
  email: string;
  phone: string;
  headcount: number;
  notes: string | null;
  weekday_discount_applied: boolean | null;
};

function buildEventBody(party: PartyForCalendar, siteUrl: string) {
  const totalMinutes = party.duration_minutes + (party.extension_minutes ?? 0);
  const startISO = `${party.date}T${party.start_time}`;
  const startDate = new Date(`${startISO}-04:00`); // America/New_York rough; we set timeZone below
  const endDate = new Date(startDate.getTime() + totalMinutes * 60_000);

  const ageBit = party.child_age ? `${party.child_age}th ` : '';
  const summary = `🎉 ${party.child_name ?? 'Party'} — ${ageBit}birthday (${party.package === 'private' ? 'Private' : 'Semi'})`;

  const descLines = [
    `Package: ${party.package === 'private' ? 'Private' : 'Semi-Private'}`,
    `Headcount: ${party.headcount} kids`,
    `Parent: ${party.parent_name}`,
    `Email: ${party.email}`,
    `Phone: ${party.phone}`,
    party.weekday_discount_applied ? 'Mon–Thu 20% discount applied' : null,
    '',
    party.notes ? `Notes:\n${party.notes}` : null,
    '',
    `Manage: ${siteUrl}/admin/parties`,
  ].filter(Boolean);

  return {
    summary,
    description: descLines.join('\n'),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/New_York',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 24h before
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 7 * 24 * 60 }, // 7 days before
        { method: 'email', minutes: 7 * 24 * 60 },
      ],
    },
  };
}

// Create an event in the owner's calendar. Returns the new event ID.
// Returns null (and silently skips) if no integration is connected — that
// way booking flow keeps working even if Google Cal isn't wired up.
export async function createPartyEvent(
  party: PartyForCalendar,
  siteUrl: string,
): Promise<string | null> {
  const integration = await getIntegration();
  if (!integration) return null;

  const accessToken = await getValidAccessToken(integration);
  const body = buildEventBody(party, siteUrl);

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(integration.calendar_id)}/events`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar createEvent failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deletePartyEvent(eventId: string): Promise<void> {
  const integration = await getIntegration();
  if (!integration) return;
  const accessToken = await getValidAccessToken(integration);
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(integration.calendar_id)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.text();
    throw new Error(`Calendar deleteEvent failed: ${res.status} ${err}`);
  }
}

export async function hasCalendarIntegration(): Promise<boolean> {
  return (await getIntegration()) !== null;
}

// Query freebusy on the owner's calendar between timeMin and timeMax.
// Returns busy time ranges (ISO strings). Used to filter appointment slots.
export async function getBusyRanges(
  timeMinISO: string,
  timeMaxISO: string,
): Promise<Array<{ start: string; end: string }>> {
  const integration = await getIntegration();
  if (!integration) return [];

  const accessToken = await getValidAccessToken(integration);
  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: integration.calendar_id }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar freeBusy failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
  };
  return data.calendars[integration.calendar_id]?.busy ?? [];
}

// Generic appointment event creator (for tours, inquiry calls, planning calls).
// Returns the new event ID or null if no integration is connected.
export async function createAppointmentEvent(input: {
  title: string;
  description: string;
  startISO: string;
  endISO: string;
  attendeeEmail?: string;
  attendeeName?: string;
}): Promise<string | null> {
  const integration = await getIntegration();
  if (!integration) return null;
  const accessToken = await getValidAccessToken(integration);

  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.startISO, timeZone: 'America/New_York' },
    end: { dateTime: input.endISO, timeZone: 'America/New_York' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 24 * 60 },
      ],
    },
  };

  if (input.attendeeEmail) {
    body.attendees = [
      { email: input.attendeeEmail, displayName: input.attendeeName ?? '' },
    ];
  }

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(integration.calendar_id)}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar createAppointmentEvent failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}
