// Admin: manage venue hours overrides (custom hours / closures) for specific
// future dates. Feeds both the GBP special-hours sync and on-site booking
// availability. Owner-only, since it changes public hours and blocks bookings.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const UpsertSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    closed: z.boolean(),
    open: z.string().regex(HHMM).optional(),
    close: z.string().regex(HHMM).optional(),
    note: z.string().max(200).optional(),
  })
  .refine((v) => v.closed || (!!v.open && !!v.close), {
    message: 'Custom hours require both an open and close time.',
  });

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function nycToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// List upcoming overrides.
export async function GET() {
  await requireOwner();
  const { data, error } = await supabaseAdmin()
    .from('venue_hours_override')
    .select('date, closed, open_minutes, close_minutes, note')
    .gte('date', nycToday())
    .order('date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ overrides: data ?? [] });
}

// Create or replace the override for a date.
export async function POST(request: Request) {
  await requireOwner();

  let body: z.infer<typeof UpsertSchema>;
  try {
    body = UpsertSchema.parse(await request.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid input';
    return NextResponse.json({ error: msg ?? 'Invalid input' }, { status: 400 });
  }

  if (body.date < nycToday()) {
    return NextResponse.json({ error: 'Pick today or a future date.' }, { status: 400 });
  }

  const openMin = body.closed ? null : toMinutes(body.open!);
  const closeMin = body.closed ? null : toMinutes(body.close!);
  if (!body.closed && openMin! >= closeMin!) {
    return NextResponse.json(
      { error: 'Open time must be before close time.' },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin()
    .from('venue_hours_override')
    .upsert(
      {
        date: body.date,
        closed: body.closed,
        open_minutes: openMin,
        close_minutes: closeMin,
        note: body.note ?? null,
      },
      { onConflict: 'date' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Remove the override for a date (?date=YYYY-MM-DD).
export async function DELETE(request: Request) {
  await requireOwner();
  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Pass ?date=YYYY-MM-DD' }, { status: 400 });
  }
  const { error } = await supabaseAdmin()
    .from('venue_hours_override')
    .delete()
    .eq('date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
