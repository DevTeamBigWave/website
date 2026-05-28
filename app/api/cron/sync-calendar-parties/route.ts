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
//   URL:    https://<domain>/api/cron/sync-calendar-parties
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
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
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
  const { data: ownParties } = await db
    .from('parties')
    .select('google_calendar_event_id')
    .not('google_calendar_event_id', 'is', null);
  for (const row of ownParties ?? []) {
    if (row.google_calendar_event_id) ourEventIds.add(row.google_calendar_event_id);
  }

  const externalEvents = events.filter((e) => !ourEventIds.has(e.id));

  // Upsert each external event into blocked_dates. external_event_id has a
  // unique index so on_conflict updates the existing row in place.
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
  }));

  let upserted = 0;
  if (rows.length > 0) {
    const { error } = await db
      .from('blocked_dates')
      .upsert(rows, { onConflict: 'external_event_id' });
    if (error) {
      return NextResponse.json(
        { error: `Upsert failed: ${error.message}` },
        { status: 500 },
      );
    }
    upserted = rows.length;
  }

  // Reconcile: any blocked_dates row with an external_event_id we no longer
  // see in the calendar window should be deleted (event was cancelled,
  // deleted, or moved outside the 180-day window).
  const currentIds = externalEvents.map((e) => e.id);
  let pruned = 0;
  if (currentIds.length > 0) {
    const { data: stale } = await db
      .from('blocked_dates')
      .select('id, external_event_id')
      .not('external_event_id', 'is', null)
      .not('external_event_id', 'in', `(${currentIds.map((id) => `"${id}"`).join(',')})`);
    pruned = stale?.length ?? 0;
    if (pruned > 0) {
      await db
        .from('blocked_dates')
        .delete()
        .in('id', (stale ?? []).map((r: any) => r.id));
    }
  } else {
    // No external events in window — anything with external_event_id is stale
    const { data: stale } = await db
      .from('blocked_dates')
      .select('id')
      .not('external_event_id', 'is', null);
    pruned = stale?.length ?? 0;
    if (pruned > 0) {
      await db
        .from('blocked_dates')
        .delete()
        .in('id', (stale ?? []).map((r: any) => r.id));
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: events.length,
    ours_skipped: events.length - externalEvents.length,
    upserted,
    pruned,
  });
}
