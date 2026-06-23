// Admin: upgrades a party to Private or downgrades it to Semi-Private.
//
// What changes:
//   - parties.package flips. The sync_blocked_dates_from_party trigger
//     (migration 0028 fires on `package` updates) automatically repoints
//     blocked_dates — a 'full' block (closes open play) for Private, a
//     'partial' block for Semi-Private.
//   - Pricing is fully recomputed from scratch via calculatePartyPricing:
//       • base price (Private $1,250 / Semi $650)
//       • included-headcount difference (Private 16 / Semi 11) → extra-kid
//         surcharge is recalculated
//       • the Mon–Thu 20% discount (Private-only) is applied on upgrade to a
//         weekday Private slot, and stripped on downgrade to Semi
//       • tax, total, and the 50% deposit all re-quote
//   - The calendar event title + description re-sync (Private ↔ Semi).
//   - afterMoneyChange voids any stale balance invoice and emails the
//     customer (if their deposit is paid) + the owner with the new totals.
//
// What stays the same: date, time, headcount, add-ons, gift card,
// already-paid amounts, child / contact info.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import {
  calculatePartyPricing,
  PACKAGES,
  type PackageId,
  type ExtensionId,
} from '@/lib/pricing';
import { partyTimeConflict } from '@/lib/parties';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';
import { afterMoneyChange } from '@/lib/after-money-change';

export const maxDuration = 30;

const Schema = z.object({
  package: z.enum(['private', 'semi']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id: partyId } = await params;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Pass { package: 'private' | 'semi' }." },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const { data: party, error: pErr } = await db
    .from('parties')
    .select(
      'id, date, start_time, package, status, child_name, headcount, duration_minutes, extension_minutes, weekday_discount_applied, manual_discount_percent, manual_discount_cents, promo_code_id, total_cents, deposit_cents, deposit_paid_at',
    )
    .eq('id', partyId)
    .maybeSingle();
  if (pErr || !party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  const newPackage = body.package as PackageId;
  const oldPackage = party.package as PackageId;

  if (party.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Cannot change a cancelled party. Restore it first.' },
      { status: 409 },
    );
  }
  if (newPackage === oldPackage) {
    return NextResponse.json(
      {
        error: `This party is already ${newPackage === 'private' ? 'Private' : 'Semi-Private'}.`,
      },
      { status: 400 },
    );
  }

  // Conflict re-check. Date/time don't move, so the only new risk on an
  // upgrade is the venue already being closed for that day, or another
  // party having been added at an overlapping time after this one booked.
  // We reuse the same checks the reschedule endpoint runs.
  const { data: blocks } = await db
    .from('blocked_dates')
    .select('block_type, reason, party_id')
    .eq('date', party.date)
    .eq('block_type', 'full');
  const fullBlock = (blocks ?? []).find((b: any) => !b.party_id);
  if (fullBlock) {
    return NextResponse.json(
      {
        error: `That date is closed: ${fullBlock.reason ?? 'venue closure'}. Resolve that first.`,
      },
      { status: 409 },
    );
  }

  const { data: sameDay } = await db
    .from('parties')
    .select('id, start_time, duration_minutes, extension_minutes')
    .eq('date', party.date)
    .in('status', ['hold', 'confirmed'])
    .neq('id', partyId);
  const duration =
    PACKAGES[newPackage].durationMinutes + (party.extension_minutes ?? 0);
  const conflict = partyTimeConflict(
    party.start_time,
    duration,
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
          'Another party on this date overlaps this time slot (parties need a 30-minute setup/cleanup gap). Reschedule one of them before changing the package.',
      },
      { status: 409 },
    );
  }

  // Server-authoritative re-pricing for the new package.
  const extensionId: ExtensionId | null =
    (party.extension_minutes ?? 0) >= 60 ? ('60m' as ExtensionId) : null;
  const recomputed = calculatePartyPricing({
    packageId: newPackage,
    date: new Date(`${party.date}T${party.start_time}`),
    time: party.start_time,
    extensionId,
    headcount: party.headcount,
  });

  // No-stacking guard: the automatic Mon–Thu 20% (Private-only) can't combine
  // with an admin Friends & family discount or a customer promo code. If
  // upgrading to Private on a weekday would trigger it on top of an existing
  // discount, block — same rule the discount endpoint enforces.
  const hasManualDiscount =
    (party.manual_discount_percent ?? 0) > 0 ||
    (party.manual_discount_cents ?? 0) > 0 ||
    !!party.promo_code_id;
  if (recomputed.discountApplied && hasManualDiscount) {
    return NextResponse.json(
      {
        error:
          'Upgrading to Private on a Mon–Thu date adds the automatic 20% discount, which can’t stack with the existing Friends & family / promo discount. Clear that discount first, then upgrade.',
      },
      { status: 409 },
    );
  }

  const updates: Record<string, unknown> = {
    package: newPackage,
    duration_minutes: PACKAGES[newPackage].durationMinutes,
    subtotal_cents: recomputed.subtotalCents,
    discount_cents: recomputed.discountCents,
    tax_cents: recomputed.taxCents,
    total_cents: recomputed.totalCents,
    weekday_discount_applied: recomputed.discountApplied,
  };

  // Re-quote the deposit only if it was the standard 50% and hasn't been
  // paid yet. A paid deposit is money in hand — it stays put and just
  // credits the new balance. Custom deposits stay put too.
  const oldStandardDeposit = Math.round(party.total_cents / 2);
  const wasStandardDeposit =
    !party.deposit_paid_at && party.deposit_cents === oldStandardDeposit;
  if (wasStandardDeposit) {
    updates.deposit_cents = recomputed.depositCents;
  }

  const { error: updErr } = await db
    .from('parties')
    .update(updates)
    .eq('id', partyId);
  if (updErr) {
    return NextResponse.json(
      { error: `Could not change package: ${updErr.message}` },
      { status: 500 },
    );
  }

  // Calendar re-sync (title + description flip Private ↔ Semi). Awaited so the
  // event reflects the change before we respond; failures are swallowed since
  // the DB change already succeeded.
  await syncPartyEventByPartyId(partyId).catch((err) =>
    console.error('package change calendar sync failed:', err),
  );

  // Customer (if deposit paid) + owner emails with the new totals; voids any
  // stale balance invoice. afterMoneyChange never throws.
  const isUpgrade = newPackage === 'private';
  const changeNote = isUpgrade
    ? 'we upgraded your party to Private — the whole venue is yours'
    : 'we changed your party to Semi-Private';
  await afterMoneyChange(partyId, changeNote);

  return NextResponse.json({
    ok: true,
    package: newPackage,
    weekday_discount_applied: recomputed.discountApplied,
    total_cents: recomputed.totalCents,
    deposit_cents: (updates.deposit_cents as number) ?? party.deposit_cents,
  });
}
