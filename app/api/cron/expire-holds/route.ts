// Hourly cron — flips abandoned 'hold' parties to 'cancelled' once their
// hold_expires_at has passed. The customer-side /book flow stamps a
// 30-minute hold window when the row is created so the slot is reserved
// during Stripe checkout; if the customer never pays, the hold sits
// forever and the calendar shows the slot as unavailable to everyone
// else. This cron is what cleans those up.
//
// The status update flips status → 'cancelled', which fires
// sync_blocked_dates_from_party (the trigger watches the status column),
// which removes the blocked_dates row. So the slot reopens automatically.
//
// Schedule on cron-job.org:
//   URL:    https://www.wonderlandplayhouse.com/api/cron/expire-holds
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every hour
//
// Idempotent — running it twice in a row produces the same state.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

  const db = supabaseAdmin();
  const nowISO = new Date().toISOString();

  // Find every party still in 'hold' whose 30-min window has passed.
  const { data: stale, error: findErr } = await db
    .from('parties')
    .select('id, child_name, date, start_time')
    .eq('status', 'hold')
    .not('hold_expires_at', 'is', null)
    .lt('hold_expires_at', nowISO);

  if (findErr) {
    console.error('expire-holds: find failed:', findErr.message);
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  const ids = stale.map((p) => p.id);
  const { error: updErr } = await db
    .from('parties')
    .update({
      status: 'cancelled',
      cancellation_reason: 'hold expired (no payment received within 30 minutes)',
    })
    .in('id', ids);

  if (updErr) {
    console.error('expire-holds: cancel update failed:', updErr.message);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    expired: ids.length,
    parties: stale.map((p) => ({
      id: p.id,
      child_name: p.child_name,
      date: p.date,
      start_time: p.start_time,
    })),
  });
}
