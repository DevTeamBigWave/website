// Google Business Profile (GBP) helpers — manages the venue's special hours
// on Google Maps + Search.
//
// Two APIs involved (Google split them across services):
//   - Account Management API → list owned accounts
//   - Business Information API → list locations + patch hours
//
// Auth: reuses the same google_integrations row as Calendar/Gmail. The
// access token must have `business.manage` scope (granted on re-auth).

import { supabaseAdmin } from '@/lib/supabase';
import { getIntegration, getValidAccessToken } from '@/lib/google-calendar';
import {
  getOverridesInRange,
  VENUE_OPEN_START_MIN,
  VENUE_OPEN_END_MIN,
} from '@/lib/venue-hours';

const ACCOUNTS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';

export type GbpAccount = {
  name: string; // "accounts/12345"
  accountName: string;
  type: string;
};

export type GbpLocation = {
  name: string; // "locations/12345"
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
};

async function gbpFetch(url: string, init?: RequestInit): Promise<any> {
  const integration = await getIntegration();
  if (!integration) {
    throw new Error('Google integration not connected — connect at /admin/integrations/google');
  }
  const accessToken = await getValidAccessToken(integration);
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 403 && /insufficient/i.test(txt)) {
      throw new Error(
        'Missing business.manage scope — re-authorize Google at /admin/integrations/google',
      );
    }
    throw new Error(`GBP ${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.json();
}

export async function listAccounts(): Promise<GbpAccount[]> {
  const data = await gbpFetch(`${ACCOUNTS_API}/accounts`);
  return (data.accounts ?? []).map((a: any) => ({
    name: a.name,
    accountName: a.accountName ?? a.name,
    type: a.type ?? 'PERSONAL',
  }));
}

export async function listLocations(accountResourceName: string): Promise<GbpLocation[]> {
  // accountResourceName format: "accounts/12345"
  // Endpoint: GET /v1/{parent=accounts/*}/locations?readMask=name,title,storefrontAddress
  const url = `${INFO_API}/${accountResourceName}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
  const data = await gbpFetch(url);
  return (data.locations ?? []).map((l: any) => ({
    name: l.name,
    title: l.title ?? l.name,
    storefrontAddress: l.storefrontAddress,
  }));
}

// Time helpers — break "HH:MM:SS" into { hours, minutes }
function parseSqlTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h, minutes: m };
}

// Convert minutes-since-midnight to { hours, minutes }
function minutesToHM(min: number): { hours: number; minutes: number } {
  return { hours: Math.floor(min / 24 / 60) === 0 ? Math.floor(min / 60) : 23, minutes: min % 60 };
}

// Convert YYYY-MM-DD to {year, month, day}
function parseDate(d: string): { year: number; month: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { year: y, month: m, day };
}

// Open-play window (11:00–19:00) lives in lib/venue-hours so the booking
// flows and this sync agree: VENUE_OPEN_START_MIN / VENUE_OPEN_END_MIN.

type SpecialHourPeriod = {
  startDate: { year: number; month: number; day: number };
  endDate?: { year: number; month: number; day: number };
  openTime?: { hours: number; minutes: number };
  closeTime?: { hours: number; minutes: number };
  closed?: boolean;
};

// Build the GBP special hour periods for the next N days based on
// blocked_dates + parties tables.
export async function buildSpecialHourPeriods(daysAhead: number): Promise<{
  periods: SpecialHourPeriod[];
  rangeStart: string;
  rangeEnd: string;
}> {
  const db = supabaseAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + daysAhead);

  const startDate = today.toISOString().split('T')[0];
  const endDate = cutoff.toISOString().split('T')[0];

  // blocked_dates carries its own time window (start_time / duration_minutes)
  // and package_type as of migrations 0026/0027 — no JOIN needed.
  const { data: blocks = [] } = await db
    .from('blocked_dates')
    .select('date, block_type, source, start_time, duration_minutes, package_type')
    .gte('date', startDate)
    .lte('date', endDate);

  // Admin-set overrides (custom hours / closures) win over party-derived hours.
  const overrides = await getOverridesInRange(startDate, endDate);
  const overrideDates = new Set(overrides.map((o) => o.date));

  const periods: SpecialHourPeriod[] = [];

  // 1) Manual overrides take precedence for their date.
  for (const o of overrides) {
    const date = parseDate(o.date);
    if (o.closed) {
      periods.push({ startDate: date, endDate: date, closed: true });
    } else if (o.open_minutes != null && o.close_minutes != null) {
      periods.push({
        startDate: date,
        endDate: date,
        openTime: minutesToHM(o.open_minutes),
        closeTime: minutesToHM(o.close_minutes),
      });
    }
  }

  // 2) Party / other blocks, only for dates without a manual override.
  for (const row of (blocks ?? []) as any[]) {
    if (overrideDates.has(row.date)) continue;
    const date = parseDate(row.date);

    if (row.block_type === 'full') {
      periods.push({ startDate: date, endDate: date, closed: true });
      continue;
    }

    // Semi-private parties keep open play running in the rest of the venue, so
    // the listing should show NORMAL hours — emit no closure for them.
    if (row.source === 'party' && row.package_type === 'semi') continue;

    // Private parties (and any other timed partial block) close the venue to
    // the public during the party window — open before and after.
    const startTime = row.start_time;
    if (!startTime) continue;
    const totalMin = row.duration_minutes ?? 120;
    const partyStart = parseSqlTime(startTime);
    const partyStartMin = partyStart.hours * 60 + partyStart.minutes;
    const partyEndMin = partyStartMin + totalMin;

    // Party fills (or exceeds) the whole open window → closed all day.
    if (partyStartMin <= VENUE_OPEN_START_MIN && partyEndMin >= VENUE_OPEN_END_MIN) {
      periods.push({ startDate: date, endDate: date, closed: true });
      continue;
    }
    // Open from venue open until the party starts.
    if (partyStartMin > VENUE_OPEN_START_MIN) {
      periods.push({
        startDate: date,
        endDate: date,
        openTime: minutesToHM(VENUE_OPEN_START_MIN),
        closeTime: minutesToHM(partyStartMin),
      });
    }
    // Open from party end until venue close.
    if (partyEndMin < VENUE_OPEN_END_MIN) {
      periods.push({
        startDate: date,
        endDate: date,
        openTime: minutesToHM(partyEndMin),
        closeTime: minutesToHM(VENUE_OPEN_END_MIN),
      });
    }
  }

  return { periods, rangeStart: startDate, rangeEnd: endDate };
}

// Push the special hours array to GBP. Replaces all existing special hours.
export async function syncSpecialHoursToGbp(): Promise<{
  locationName: string;
  periodsPushed: number;
  rangeStart: string;
  rangeEnd: string;
}> {
  const db = supabaseAdmin();
  const integration = await getIntegration();
  if (!integration?.gbp_location_id) {
    throw new Error(
      'GBP location not selected — go to /admin/integrations/gbp and pick a location',
    );
  }

  const { periods, rangeStart, rangeEnd } = await buildSpecialHourPeriods(90);

  // Log start
  const { data: logRow } = await db
    .from('gbp_sync_log')
    .insert({
      sync_started_at: new Date().toISOString(),
      date_range_start: rangeStart,
      date_range_end: rangeEnd,
    })
    .select()
    .single();

  try {
    const url = `${INFO_API}/${integration.gbp_location_id}?updateMask=specialHours`;
    const body = {
      specialHours: {
        specialHourPeriods: periods,
      },
    };

    const response = await gbpFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    await db
      .from('google_integrations')
      .update({
        gbp_last_sync_at: new Date().toISOString(),
        gbp_last_sync_error: null,
      })
      .eq('id', integration.id);

    if (logRow?.id) {
      await db
        .from('gbp_sync_log')
        .update({
          sync_finished_at: new Date().toISOString(),
          periods_pushed: periods.length,
          raw_request: body,
          raw_response: response,
        })
        .eq('id', logRow.id);
    }

    return {
      locationName: integration.gbp_location_id,
      periodsPushed: periods.length,
      rangeStart,
      rangeEnd,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await db
      .from('google_integrations')
      .update({ gbp_last_sync_error: msg })
      .eq('id', integration.id);
    if (logRow?.id) {
      await db
        .from('gbp_sync_log')
        .update({
          sync_finished_at: new Date().toISOString(),
          error_message: msg,
        })
        .eq('id', logRow.id);
    }
    throw err;
  }
}
