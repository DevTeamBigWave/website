// Owner-only: moves a confirmed party to a new date / time. Hard conflict
// check (no override). Updates the calendar event, emails customer + owner.
//
// What stays the same: add-ons, deposit_paid_at, balance_paid_amount_cents,
// gift card application, friends-&-family discount, promo code, child info,
// contact info, headcount. No re-pricing — if the new slot qualifies for a
// different discount tier, the owner adjusts manually.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { partyTimesFor, type PackageId } from '@/lib/pricing';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';
import { sendPartyRescheduled, sendOwnerNotification } from '@/lib/email';

export const maxDuration = 30;

const Schema = z.object({
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_start_time: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().max(500).optional(),
});

function to24h(slot: string): string {
  // Accepts "10:00 AM" → "10:00"
  const [hm, period] = slot.split(' ');
  const [h, m] = hm.split(':');
  let hh = parseInt(h, 10);
  if (period === 'PM' && hh < 12) hh += 12;
  if (period === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${m}`;
}

function nycToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Date must be today or future (NYC-local)
  if (body.new_date < nycToday()) {
    return NextResponse.json(
      { error: 'New date must be today or later.' },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const { data: party, error: pErr } = await db
    .from('parties')
    .select('id, date, start_time, package, child_name, parent_name, email, status')
    .eq('id', partyId)
    .maybeSingle();
  if (pErr || !party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }
  if (party.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Cannot reschedule a cancelled party. Restore it first.' },
      { status: 409 },
    );
  }

  // No-op shortcut
  if (party.date === body.new_date && party.start_time === body.new_start_time) {
    return NextResponse.json(
      { error: 'New date/time is the same as the current one.' },
      { status: 400 },
    );
  }

  // Validate the slot is allowed for the party's package
  const validSlots = partyTimesFor(party.package as PackageId).map(to24h);
  if (!validSlots.includes(body.new_start_time)) {
    return NextResponse.json(
      {
        error: `Time slot is not valid for ${party.package === 'private' ? 'Private' : 'Semi-Private'} parties.`,
      },
      { status: 400 },
    );
  }

  // Hard conflict check: another non-cancelled party already on this date,
  // OR a full-day block (e.g., venue closure) on this date.
  const { data: conflicts } = await db
    .from('blocked_dates')
    .select('date, block_type, reason, party_id')
    .eq('date', body.new_date);
  const hit = (conflicts ?? []).find(
    (b: any) => b.party_id !== partyId, // a different party
  );
  if (hit) {
    return NextResponse.json(
      {
        error:
          hit.block_type === 'full'
            ? `That date is fully booked: ${hit.reason ?? 'another party'}.`
            : `That date already has a private party booked — Wonderland is closed to additional parties.`,
      },
      { status: 409 },
    );
  }

  // Persist the move. The sync_blocked_dates_from_party trigger automatically
  // repoints the blocked_dates row to the new date.
  const oldDate = party.date;
  const oldStartTime = party.start_time;
  const { error: updErr } = await db
    .from('parties')
    .update({ date: body.new_date, start_time: body.new_start_time })
    .eq('id', partyId);
  if (updErr) {
    return NextResponse.json(
      { error: `Could not save reschedule: ${updErr.message}` },
      { status: 500 },
    );
  }

  // Refetch the full party so the email templates have everything they need
  const { data: refreshed } = await db
    .from('parties')
    .select('*')
    .eq('id', partyId)
    .maybeSingle();
  const fullParty = refreshed ?? party;

  // Customer + owner emails. Fire-and-forget — DB is already saved.
  Promise.allSettled([
    sendPartyRescheduled({
      party: fullParty,
      oldDate,
      oldStartTime,
      reason: body.reason,
    }),
    sendOwnerNotification({
      subject: `↻ Party rescheduled: ${fullParty.child_name ?? 'party'} · ${oldDate} → ${body.new_date}`,
      party: fullParty,
    }),
  ]).catch((err) => console.error('Reschedule emails failed:', err));

  // Calendar event time + description re-sync. notifyAttendees=true so
  // Google sends the parent its native "event moved" iCal notice.
  void syncPartyEventByPartyId(partyId, { notifyAttendees: true });

  return NextResponse.json({
    ok: true,
    old_date: oldDate,
    old_start_time: oldStartTime,
    new_date: body.new_date,
    new_start_time: body.new_start_time,
  });
}
