// Owner-only: re-sync the Google Calendar event description for every
// confirmed or held party. Useful after a buildEventBody change so the
// already-created calendar events pick up the new format without needing
// to touch each party individually.
//
// Idempotent — calling it twice in a row produces the same state. Safe to
// run as often as needed. notifyAttendees defaults to false so the
// re-sync doesn't email parents about "event updated".

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import {
  hasCalendarIntegration,
  syncPartyEventByPartyId,
} from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  await requireOwner();

  if (!(await hasCalendarIntegration())) {
    return NextResponse.json({ skipped: 'no calendar integration' });
  }

  const db = supabaseAdmin();
  const { data: parties, error } = await db
    .from('parties')
    .select('id, child_name, date')
    .in('status', ['hold', 'confirmed'])
    .not('google_calendar_event_id', 'is', null)
    .gte('date', new Date().toISOString().split('T')[0]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const p of parties ?? []) {
    try {
      await syncPartyEventByPartyId(p.id);
      results.push({ id: p.id, ok: true });
    } catch (err) {
      results.push({
        id: p.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
