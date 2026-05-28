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
  gbp_account_id?: string | null;
  gbp_location_id?: string | null;
  gbp_location_title?: string | null;
  gbp_last_sync_at?: string | null;
  gbp_last_sync_error?: string | null;
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
    .select('id, refresh_token, access_token, access_token_expires_at, calendar_id, gbp_account_id, gbp_location_id, gbp_location_title, gbp_last_sync_at, gbp_last_sync_error')
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
  total_cents?: number | null;
  deposit_cents?: number | null;
  deposit_paid_at?: string | null;
  deposit_payment_method?: string | null;
  promo_code_id?: string | null;
  balance_paid_at?: string | null;
  balance_paid_amount_cents?: number | null;
  manual_discount_percent?: number | null;
  manual_discount_cents?: number | null;
  add_ons_total_cents?: number | null;
  inspiration_image_urls?: string[] | null;
};

type AddOnForCalendar = {
  name: string;
  unit_price_cents: number;
  qty: number;
  notes: string | null;
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function buildEventBody(
  party: PartyForCalendar,
  addOns: AddOnForCalendar[],
  siteUrl: string,
) {
  const totalMinutes = party.duration_minutes + (party.extension_minutes ?? 0);
  const startISO = `${party.date}T${party.start_time}`;
  const startDate = new Date(`${startISO}-04:00`); // America/New_York rough; we set timeZone below
  const endDate = new Date(startDate.getTime() + totalMinutes * 60_000);

  const ageBit = party.child_age ? `${ordinal(party.child_age)} ` : '';
  const summary = `🎉 ${party.child_name ?? 'Party'} — ${ageBit}birthday (${party.package === 'private' ? 'Private' : 'Semi'})`;

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const lines: (string | null)[] = [
    `Package: ${party.package === 'private' ? 'Private' : 'Semi-Private'}`,
    `Headcount: ${party.headcount} kids`,
    party.child_age ? `Turning: ${party.child_age}` : null,
    `Duration: ${totalMinutes} min${party.extension_minutes ? ' (incl. extension)' : ''}`,
    '',
    `Parent: ${party.parent_name}`,
    `Email: ${party.email}`,
    `Phone: ${party.phone}`,
  ];

  if (addOns.length > 0) {
    lines.push('', 'Add-ons:');
    for (const a of addOns) {
      const tag = a.qty > 1 ? ` × ${a.qty}` : '';
      const note = a.notes ? ` (${a.notes})` : '';
      lines.push(`  • ${a.name}${tag} — ${fmt(a.unit_price_cents * a.qty)}${note}`);
    }
  }

  if (party.total_cents != null) {
    lines.push('', 'Money:');
    lines.push(`  Party total: ${fmt(party.total_cents)}`);
    if (party.add_ons_total_cents && party.add_ons_total_cents > 0) {
      lines.push(`  + Add-ons: ${fmt(party.add_ons_total_cents)}`);
    }
    if (party.manual_discount_percent && party.manual_discount_percent > 0) {
      lines.push(`  − Friends & family ${party.manual_discount_percent}% off`);
    } else if (party.manual_discount_cents && party.manual_discount_cents > 0) {
      lines.push(`  − Friends & family discount: ${fmt(party.manual_discount_cents)}`);
    }
    // Promo-code path: no deposit was collected at booking. Show the full
    // amount as owed instead of a "Deposit: $X — unpaid" line that implies
    // only the deposit is due.
    const isPromoUnpaid = !party.deposit_paid_at && !!party.promo_code_id;
    if (isPromoUnpaid) {
      lines.push('  ⚠ Promo code applied · no payment received yet');
      lines.push(`  Balance owed: ${fmt(party.total_cents + (party.add_ons_total_cents ?? 0))}`);
    } else if (party.deposit_cents) {
      const paid = party.deposit_paid_at
        ? ` ✓ paid${party.deposit_payment_method ? ` (${party.deposit_payment_method})` : ''}`
        : ' — unpaid';
      lines.push(`  Deposit: ${fmt(party.deposit_cents)}${paid}`);
    }
    if (party.balance_paid_amount_cents && party.balance_paid_amount_cents > 0) {
      lines.push(`  Balance paid: ${fmt(party.balance_paid_amount_cents)}`);
    }
  }

  if (party.weekday_discount_applied) {
    lines.push('', 'Mon–Thu 20% discount applied');
  }

  if (party.notes) {
    lines.push('', 'Notes:', party.notes);
  }

  if (party.inspiration_image_urls && party.inspiration_image_urls.length > 0) {
    lines.push('', 'Inspiration photos:');
    for (const url of party.inspiration_image_urls) {
      lines.push(`  ${url}`);
    }
  }

  lines.push('', `Manage: ${siteUrl}/admin/parties/${party.id}`);

  return {
    summary,
    description: lines.filter((l) => l !== null).join('\n'),
    location: '3830 Nostrand Ave, Brooklyn, NY 11235',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/New_York',
    },
    // Add the parent as an attendee so Google emails them an .ics invite
    // (with the venue address pre-set). guestsCanModify=false locks the
    // event to the owner; guestsCanInviteOthers=false stops chain invites.
    attendees: [
      { email: party.email, displayName: party.parent_name, responseStatus: 'needsAction' },
    ],
    guestsCanModify: false,
    guestsCanInviteOthers: false,
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

  // Fetch add-ons so they can be itemized in the event description. Best-effort:
  // if the query fails we still create the event without them.
  let addOns: AddOnForCalendar[] = [];
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from('party_add_ons')
      .select('name, unit_price_cents, qty, notes')
      .eq('party_id', party.id)
      .order('created_at', { ascending: true });
    addOns = (data ?? []) as AddOnForCalendar[];
  } catch (err) {
    console.warn('Could not load add-ons for calendar event:', err);
  }

  const accessToken = await getValidAccessToken(integration);
  const body = buildEventBody(party, addOns, siteUrl);

  // sendUpdates=all tells Google to email the .ics invite to the attendee
  // (the parent). Without this, the attendee is silently added.
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
    throw new Error(`Calendar createEvent failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

// Re-sync the existing calendar event with the party's current state. Called
// from every code path that mutates party financials, add-ons, discount, or
// payment status so the calendar description never goes stale. Best-effort:
// silent no-op if the integration isn't connected, the party has no event,
// or Google returns 404 (event manually deleted). Failures are logged and
// swallowed — the caller's mutation must not block on a Google round-trip.
//
// sendUpdates defaults to 'none' so the parent isn't spammed with "event
// updated" emails every time the owner ticks a new add-on. Pass
// notifyAttendees=true for reschedules so Google sends its native iCal
// "event moved" notice.
export async function syncPartyEventByPartyId(
  partyId: string,
  opts: { notifyAttendees?: boolean } = {},
): Promise<void> {
  const integration = await getIntegration();
  if (!integration) return;

  const db = supabaseAdmin();
  const { data: party } = await db
    .from('parties')
    .select(
      'id, date, start_time, package, child_name, child_age, parent_name, email, phone, headcount, notes, total_cents, deposit_cents, deposit_paid_at, deposit_payment_method, promo_code_id, balance_paid_at, balance_paid_amount_cents, manual_discount_percent, manual_discount_cents, add_ons_total_cents, inspiration_image_urls, duration_minutes, extension_minutes, weekday_discount_applied, google_calendar_event_id',
    )
    .eq('id', partyId)
    .maybeSingle();

  if (!party?.google_calendar_event_id) return;

  let addOns: AddOnForCalendar[] = [];
  try {
    const { data } = await db
      .from('party_add_ons')
      .select('name, unit_price_cents, qty, notes')
      .eq('party_id', partyId)
      .order('created_at', { ascending: true });
    addOns = (data ?? []) as AddOnForCalendar[];
  } catch (err) {
    console.warn('Could not load add-ons for calendar sync:', err);
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';
  const accessToken = await getValidAccessToken(integration);
  const body = buildEventBody(party as PartyForCalendar, addOns, siteUrl);
  const sendUpdates = opts.notifyAttendees ? 'all' : 'none';

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(integration.calendar_id)}/events/${party.google_calendar_event_id}?sendUpdates=${sendUpdates}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.text();
    console.warn(`Calendar update failed: ${res.status} ${err}`);
  }
}

export async function deletePartyEvent(eventId: string): Promise<void> {
  const integration = await getIntegration();
  if (!integration) return;
  const accessToken = await getValidAccessToken(integration);
  // sendUpdates=all so the attendee (parent) gets a cancellation email
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(integration.calendar_id)}/events/${eventId}?sendUpdates=all`,
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

// List private/semi-private party events on the owner's calendar in a date
// range. Used by the sync-calendar-parties cron to surface manual calendar
// entries (pre-website parties + one-offs) as blocked_dates rows.
//
// Match rule: summary case-insensitively contains "private" or "semi". That
// catches both our own auto-created events ("🎉 Mia — birthday (Private)")
// AND hand-typed ones ("Sasha Semi-Private", "Private party for Leo").
// Cron caller filters our own out by matching event.id against the
// google_calendar_event_id we already store on parties rows.
export type ExternalPartyEvent = {
  id: string;
  summary: string;
  date: string;             // YYYY-MM-DD
  startTimeSql: string;     // HH:MM:SS (NYC local)
  durationMinutes: number;
  isPrivate: boolean;
};

export async function listPartyEvents(
  fromDate: Date,
  toDate: Date,
): Promise<ExternalPartyEvent[]> {
  const integration = await getIntegration();
  if (!integration) return [];

  const accessToken = await getValidAccessToken(integration);
  // singleEvents=true expands recurring events to their individual instances
  // so we get one block per occurrence (matters if owner ever sets up a
  // recurring "Private party" pattern — unlikely but harmless).
  const url =
    `${CALENDAR_API}/calendars/${encodeURIComponent(integration.calendar_id)}/events` +
    `?timeMin=${encodeURIComponent(fromDate.toISOString())}` +
    `&timeMax=${encodeURIComponent(toDate.toISOString())}` +
    `&singleEvents=true&orderBy=startTime&maxResults=250`;

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar list failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      status?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  const out: ExternalPartyEvent[] = [];
  for (const ev of data.items ?? []) {
    if (ev.status === 'cancelled') continue;
    const summary = (ev.summary ?? '').trim();
    if (!summary) continue;
    const lower = summary.toLowerCase();
    const isPrivate = lower.includes('private');
    const isSemi = lower.includes('semi');
    if (!isPrivate && !isSemi) continue;

    // All-day events (no time component) — skip; we can't compute a window.
    const startISO = ev.start?.dateTime;
    const endISO = ev.end?.dateTime;
    if (!startISO || !endISO) continue;

    const start = new Date(startISO);
    const end = new Date(endISO);
    const durationMinutes = Math.max(
      30,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );

    // Render the date + time in America/New_York so a 2pm party shows as
    // 2pm regardless of where the cron is running.
    const nyDateTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(start);
    const pick = (t: string) => nyDateTime.find((p) => p.type === t)?.value ?? '';
    const date = `${pick('year')}-${pick('month')}-${pick('day')}`;
    let hour = pick('hour');
    if (hour === '24') hour = '00';
    const startTimeSql = `${hour}:${pick('minute')}:00`;

    out.push({
      id: ev.id,
      summary,
      date,
      startTimeSql,
      durationMinutes,
      // If the title contains "semi" we treat it as semi (even if it also
      // contains "private", since "Semi-Private" includes both words).
      isPrivate: isPrivate && !isSemi,
    });
  }
  return out;
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
