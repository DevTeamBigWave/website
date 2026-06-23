// Admin: adjust a party's headcount. Headcount is the single source of truth
// for extra-kid pricing — kids above the package's included count are billed
// at the package's extra-kid rate, folded into the party subtotal by
// calculatePartyPricing. (This is why the "Extra kid over package" add-on is
// blocked — see app/api/admin/parties/[id]/add-ons/route.ts — it would
// double-charge.)
//
// Re-prices the party (subtotal / discount / tax / total, and the 50% deposit
// when it's still standard + unpaid), re-syncs the calendar event, and emails
// the customer (when deposit paid) + owner via afterMoneyChange.

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
import { syncPartyEventByPartyId } from '@/lib/google-calendar';
import { afterMoneyChange } from '@/lib/after-money-change';

export const maxDuration = 30;

// Hard ceiling matches MAX_KIDS_PER_PARTY in lib/pricing.ts.
const Schema = z.object({
  headcount: z.coerce.number().int().min(1).max(40),
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
      { error: 'Pass { headcount } between 1 and 40.' },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const { data: party, error: pErr } = await db
    .from('parties')
    .select(
      'id, date, start_time, package, status, headcount, extension_minutes, weekday_discount_applied, total_cents, deposit_cents, deposit_paid_at',
    )
    .eq('id', partyId)
    .maybeSingle();
  if (pErr || !party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }
  if (party.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Cannot change a cancelled party. Restore it first.' },
      { status: 409 },
    );
  }
  if (body.headcount === party.headcount) {
    return NextResponse.json(
      { error: `Headcount is already ${party.headcount}.` },
      { status: 400 },
    );
  }

  const pkg = party.package as PackageId;
  const extensionId: ExtensionId | null =
    (party.extension_minutes ?? 0) >= 60 ? ('60m' as ExtensionId) : null;
  const recomputed = calculatePartyPricing({
    packageId: pkg,
    date: new Date(`${party.date}T${party.start_time}`),
    time: party.start_time,
    extensionId,
    headcount: body.headcount,
  });

  const updates: Record<string, unknown> = {
    headcount: body.headcount,
    subtotal_cents: recomputed.subtotalCents,
    discount_cents: recomputed.discountCents,
    tax_cents: recomputed.taxCents,
    total_cents: recomputed.totalCents,
    weekday_discount_applied: recomputed.discountApplied,
  };

  // Re-quote the deposit only if it was the standard 50% and hasn't been paid.
  // A paid deposit is money in hand — it stays put and credits the new balance.
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
      { error: `Could not update headcount: ${updErr.message}` },
      { status: 500 },
    );
  }

  await syncPartyEventByPartyId(partyId).catch((err) =>
    console.error('headcount change calendar sync failed:', err),
  );

  const included = PACKAGES[pkg].includedKids;
  const extra = Math.max(0, body.headcount - included);
  const changeNote =
    extra > 0
      ? `we set the headcount to ${body.headcount} kids (${extra} over the ${included} included)`
      : `we set the headcount to ${body.headcount} kids`;
  await afterMoneyChange(partyId, changeNote);

  return NextResponse.json({
    ok: true,
    headcount: body.headcount,
    extra_kid_count: recomputed.extraKidCount,
    total_cents: recomputed.totalCents,
  });
}
