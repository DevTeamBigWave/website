import { NextResponse } from 'next/server';
import { syncSpecialHoursToGbp } from '@/lib/gbp';
import { supabaseAdmin } from '@/lib/supabase';

// Drop venue hours overrides whose date is already in the past — they're done
// and no longer affect Google or bookings, so keep the table tidy.
async function cleanupPastOverrides() {
  const nycToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  try {
    await supabaseAdmin().from('venue_hours_override').delete().lt('date', nycToday);
  } catch (err) {
    console.warn('[gbp-sync] past-override cleanup failed (non-fatal):', err);
  }
}

// Daily cron — pushes special hours to Google Business Profile based on
// confirmed private parties in the next 90 days. Open play visitors see
// accurate "closed during private party" hours on Google Maps + Search.
//
// Schedule on cron-job.org:
//   URL:    https://<domain>/api/cron/sync-gbp-hours
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every day at 02:00 America/New_York (low-traffic time)

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await cleanupPastOverrides();
    const result = await syncSpecialHoursToGbp();
    console.log('[gbp-sync] ok:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed';
    console.error('[gbp-sync] failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
