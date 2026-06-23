import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getAppointmentType } from '@/lib/appointments';
import { createAppointmentEvent } from '@/lib/google-calendar';

const AppointmentSchema = z.object({
  type: z.enum(['tour', 'inquiry', 'planning']),
  startISO: z.string(),
  parentName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  let body;
  try {
    body = AppointmentSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const type = await getAppointmentType(body.type);
  if (!type) {
    return NextResponse.json({ error: 'Unknown appointment type' }, { status: 404 });
  }

  const startAt = new Date(body.startISO);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: 'Invalid startISO' }, { status: 400 });
  }
  const endAt = new Date(startAt.getTime() + type.duration_minutes * 60 * 1000);

  // Guard: must be at least 1 hour in the future
  if (startAt.getTime() < Date.now() + 60 * 60 * 1000) {
    return NextResponse.json(
      { error: 'That slot is in the past or too soon. Please pick a later time.' },
      { status: 409 },
    );
  }

  const db = supabaseAdmin();

  // Conflict guard — reject if another confirmed appointment overlaps
  const { data: existing } = await db
    .from('appointments')
    .select('id')
    .eq('status', 'confirmed')
    .lt('start_at', endAt.toISOString())
    .gt('end_at', startAt.toISOString());

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'That time was just taken. Please pick another slot.' },
      { status: 409 },
    );
  }

  const { data: appt, error } = await db
    .from('appointments')
    .insert({
      type_id: type.id,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      parent_name: body.parentName,
      email: body.email,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
      status: 'confirmed',
    })
    .select()
    .single();

  if (error || !appt) {
    return NextResponse.json(
      { error: 'Could not save appointment', detail: error?.message },
      { status: 500 },
    );
  }

  // Create Google Calendar event with customer as attendee (non-blocking)
  try {
    const title = `${type.name} — ${body.parentName}`;
    const description = [
      `Type: ${type.name}`,
      `Contact: ${body.parentName} · ${body.email}${body.phone ? ` · ${body.phone}` : ''}`,
      body.notes ? `\nNotes:\n${body.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const eventId = await createAppointmentEvent({
      title,
      description,
      startISO: startAt.toISOString(),
      endISO: endAt.toISOString(),
      attendeeEmail: body.email,
      attendeeName: body.parentName,
    });

    if (eventId) {
      await db
        .from('appointments')
        .update({ google_calendar_event_id: eventId })
        .eq('id', appt.id);
    }
  } catch (err) {
    console.error('Calendar event for appointment failed:', err);
    // Don't fail the booking — the DB record + email are the source of truth
  }

  return NextResponse.json({
    id: appt.id,
    startISO: startAt.toISOString(),
    endISO: endAt.toISOString(),
    typeName: type.name,
  });
}
