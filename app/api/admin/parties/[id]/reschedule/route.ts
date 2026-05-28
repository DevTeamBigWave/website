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
import {
  partyTimesFor,
  calculatePartyPricing,
  PACKAGES,
  type PackageId,
  type ExtensionId,
} from '@/lib/pricing';
import { partyTimeConflict } from '@/lib/parties';
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
    .select(
      'id, date, start_time, package, child_name, parent_name, email, status, headcount, duration_minutes, extension_minutes, weekday_discount_applied, total_cents, deposit_cents, deposit_paid_at',
    )
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

  // Full-day venue closure check (admin-created blocked_dates not tied to a party).
  const { data: blocks } = await db
    .from('blocked_dates')
    .select('block_type, reason, party_id')
    .eq('date', body.new_date)
    .eq('block_type', 'full');
  const fullBlock = (blocks ?? []).find((b: any) => !b.party_id);
  if (fullBlock) {
    return NextResponse.json(
      { error: `That date is fully booked: ${fullBlock.reason ?? 'venue closure'}.` },
      { status: 409 },
    );
  }

  // Time-aware conflict check: other non-cancelled parties on the new date,
  // expanded by the 30-min setup/cleanup buffer. Excludes this party itself.
  const { data: sameDay } = await db
    .from('parties')
    .select('id, start_time, duration_minutes, extension_minutes')
    .eq('date', body.new_date)
    .in('status', ['hold', 'confirmed'])
    .neq('id', partyId);
  const newDuration =
    PACKAGES[party.package as PackageId].durationMinutes +
    (party.extension_minutes ?? 0);
  const conflict = partyTimeConflict(
    body.new_start_time,
    newDuration,
    (sameDay ?? []).map((p: any) => ({
      id: p.id,
      start_time: p.start_time,
      duration_minutes: p.duration_minutes ?? 120,
      extension_minutes: p.extension_minutes ?? 0,
    })),
  );
  if (conflict) {
    return NextResponse.json(
      {
        error:
          'That time conflicts with another party on the new date (parties need a 30-minute setup/cleanup gap between them).',
      },
      { status: 409 },
    );
  }

  // Mon-Thu private discount is asymmetric on reschedule:
  // - If the OLD slot had it applied AND the NEW slot doesn't qualify → strip
  //   it (recompute pricing without the 20% off so the customer's balance
  //   reflects the new, undiscounted total).
  // - If moving from a non-eligible slot to an eligible one → do NOT
  //   auto-apply. Owner can apply manually via the friends-&-family
  //   discount picker if they want to honor a make-good.
  const oldDow = new Date(`${party.date}T00:00:00`).getDay();
  const newDow = new Date(`${body.new_date}T00:00:00`).getDay();
  const isPrivate = party.package === 'private';
  const oldEligible = isPrivate && oldDow >= 1 && oldDow <= 4;
  const newEligible = isPrivate && newDow >= 1 && newDow <= 4;
  const stripDiscount = party.weekday_discount_applied && oldEligible && !newEligible;

  const updates: Record<string, unknown> = {
    date: body.new_date,
    start_time: body.new_start_time,
  };
  let pricingNote: string | undefined;

  if (stripDiscount) {
    const recomputed = calculatePartyPricing({
      packageId: party.package as PackageId,
      date: new Date(`${body.new_date}T${body.new_start_time}:00`),
      time: body.new_start_time,
      extensionId: (party.extension_minutes ?? 0) >= 60 ? ('60m' as ExtensionId) : null,
      headcount: party.headcount,
    });
    updates.subtotal_cents = recomputed.subtotalCents;
    updates.discount_cents = recomputed.discountCents; // 0
    updates.tax_cents = recomputed.taxCents;
    updates.total_cents = recomputed.totalCents;
    updates.weekday_discount_applied = false;

    // Only re-quote the deposit if the existing one was the standard 50%
    // of the old discounted total. Custom deposits (set by the owner for a
    // legacy / negotiated party) and already-paid deposits stay put — the
    // customer paid X, that X is the deposit, balance picks up the rest.
    const oldStandardDeposit = Math.round(party.total_cents / 2);
    const wasStandardDeposit =
      !party.deposit_paid_at && party.deposit_cents === oldStandardDeposit;
    if (wasStandardDeposit) {
      updates.deposit_cents = recomputed.depositCents;
    }

    pricingNote = `The Mon–Thu 20% discount no longer applies on the new date — party total is now $${(recomputed.totalCents / 100).toFixed(2)}. Any payments you've already made carry over and credit the new balance.`;
  }

  // Persist. The sync_blocked_dates_from_party trigger repoints blocked_dates.
  const oldDate = party.date;
  const oldStartTime = party.start_time;
  const { error: updErr } = await db
    .from('parties')
    .update(updates)
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
      pricingNote,
    }),
    sendOwnerNotification({
      subject: `↻ Party rescheduled: ${fullParty.child_name ?? 'party'} · ${oldDate} → ${body.new_date}${stripDiscount ? ' · discount removed' : ''}`,
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
