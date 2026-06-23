// Owner-only: deletes an appointment (tour, planning call, etc) and its
// Google Calendar event so the owner's calendar stays clean.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { deletePartyEvent } from '@/lib/google-calendar';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: appt } = await db
    .from('appointments')
    .select('id, google_calendar_event_id')
    .eq('id', id)
    .maybeSingle();

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (appt.google_calendar_event_id) {
    try {
      await deletePartyEvent(appt.google_calendar_event_id);
    } catch (err) {
      console.warn('Calendar event delete failed (continuing):', err);
    }
  }

  const { error } = await db.from('appointments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
