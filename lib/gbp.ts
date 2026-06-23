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

// Open play hours: 12:00–19:30 daily. If we want to mark a date as "open with
// closure window for private party", we build TWO open periods (before + after).
const OPEN_START_MIN = 12 * 60; // 12:00 → 720
const OPEN_END_MIN = 19 * 60 + 30; // 19:30 → 1170

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

  // Pull blocked_dates joined with parties so we know the party time window
  const { data: blocks = [] } = await db
    .from('blocked_dates')
    .select(`
      date,
      block_type,
      parties ( start_time, duration_minutes, extension_minutes )
    `)
    .gte('date', startDate)
    .lte('date', endDate);

  const periods: SpecialHourPeriod[] = [];

  for (const row of (blocks ?? []) as any[]) {
    const date = parseDate(row.date);

    if (row.block_type === 'full') {
      // Full-day closure
      periods.push({ startDate: date, endDate: date, closed: true });
      continue;
    }

    if (row.block_type === 'partial' && row.parties) {
      const startTime = row.parties.start_time;
      const totalMin =
        (row.parties.duration_minutes ?? 120) + (row.parties.extension_minutes ?? 0);
      const partyStart = parseSqlTime(startTime);
      const partyStartMin = partyStart.hours * 60 + partyStart.minutes;
      const partyEndMin = partyStartMin + totalMin;

      // Period 1: open from venue open until party starts (if there's a gap)
      if (partyStartMin > OPEN_START_MIN) {
        periods.push({
          startDate: date,
          endDate: date,
          openTime: { hours: OPEN_START_MIN / 60, minutes: 0 },
          closeTime: minutesToHM(partyStartMin),
        });
      }

      // Period 2: open from party end until venue closes (if there's a gap)
      if (partyEndMin < OPEN_END_MIN) {
        periods.push({
          startDate: date,
          endDate: date,
          openTime: minutesToHM(partyEndMin),
          closeTime: minutesToHM(OPEN_END_MIN),
        });
      }

      // If party fills the entire open window, mark closed
      if (partyStartMin <= OPEN_START_MIN && partyEndMin >= OPEN_END_MIN) {
        periods.push({ startDate: date, endDate: date, closed: true });
      }
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
