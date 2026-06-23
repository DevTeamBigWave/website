// Hourly cron — pulls private/semi-private party events from the owner's
// Google Calendar and mirrors them into blocked_dates so the public booking
// pages know the venue is reserved during those windows.
//
// What this covers that our normal trigger doesn't:
//   - Parties that existed on the calendar BEFORE this website launched
//   - One-off manual calendar entries the owner types in directly
//
// Idempotent: re-running produces the same state. Reconciliation removes
// blocked_dates rows whose external_event_id is no longer in the calendar
// (event deleted or moved out of the sync window).
//
// Schedule on cron-job.org:
//   URL:    https://www.wonderlandplayhouse.com/api/cron/sync-calendar-parties
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every 30 minutes

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasCalendarIntegration, listPartyEvents } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const headerSecret = req.headers.get('x-cron-secret');
  const querySecret = new URL(req.url).searchParams.get('secret');
  return headerSecret === secret || querySecret === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    if (!(await hasCalendarIntegration())) {
      return NextResponse.json({ skipped: 'no calendar integration' });
    }

    // 6-month window — matches what we expose on the public booking calendar
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(from.getDate() + 180);

    const events = await listPartyEvents(from, to);
    const db = supabaseAdmin();

    // Skip events we created ourselves — they're already mirrored by the
    // parties trigger. Match by google_calendar_event_id.
    const ourEventIds = new Set<string>();
    const { data: ownParties, error: ownErr } = await db
      .from('parties')
      .select('google_calendar_event_id')
      .not('google_calendar_event_id', 'is', null);
    if (ownErr) throw new Error(`parties read failed: ${ownErr.message}`);
    for (const row of ownParties ?? []) {
      if (row.google_calendar_event_id) ourEventIds.add(row.google_calendar_event_id);
    }

    const externalEvents = events.filter((e) => !ourEventIds.has(e.id));

    // Nuke-and-rebuild: drop every blocked_dates row tied to an external
    // calendar event, then re-insert from the current event list. Clean,
    // idempotent, no ON CONFLICT inference needed (PostgREST upsert can't
    // target the partial unique index we have on external_event_id).
    const { error: delErr } = await db
      .from('blocked_dates')
      .delete()
      .not('external_event_id', 'is', null);
    if (delErr) throw new Error(`prune failed: ${delErr.message}`);

    let upserted = 0;
    if (externalEvents.length > 0) {
      const rows = externalEvents.map((e) => ({
        date: e.date,
        reason: e.isPrivate
          ? `Private party (calendar): ${e.summary}`
          : `Semi-private party (calendar): ${e.summary}`,
        source: 'party',
        block_type: 'partial',
        start_time: e.startTimeSql,
        duration_minutes: e.durationMinutes,
        external_event_id: e.id,
        // Surfacing the type so the open-play page can ignore semi-private
        // entries when rendering closure banners — semi keeps open play open.
        package_type: e.isPrivate ? 'private' : 'semi',
      }));
      const { error: insErr } = await db.from('blocked_dates').insert(rows);
      if (insErr) throw new Error(`insert failed: ${insErr.message}`);
      upserted = rows.length;
    }

    return NextResponse.json({
      ok: true,
      scanned: events.length,
      ours_skipped: events.length - externalEvents.length,
      upserted,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sync-calendar-parties failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
