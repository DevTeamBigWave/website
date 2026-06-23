// Owner-only: sets the friends & family discount on a party.
//
// Accepts EITHER a percent (0/10/15/20) OR a flat dollar amount.
// Setting one zeroes the other so the two paths never conflict.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';
import { afterMoneyChange } from '@/lib/after-money-change';

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

const Schema = z.union([
  z.object({
    percent: z.coerce.number().int().min(0).max(100),
    amount_cents: z.undefined().optional(),
  }),
  z.object({
    percent: z.undefined().optional(),
    amount_cents: z.coerce.number().int().min(0).max(1_000_000),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'Pass either { percent } (0/10/15/20) or { amount_cents } (>=0).' },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  // If this party was booked with a customer-applied promo code, the admin
  // override here REPLACES it. Clear promo_code_id too so receipts/emails
  // don't keep showing "Promo CODE" labels on an admin-set $/% amount —
  // they'd be misleading at that point.
  const { data: existing } = await db
    .from('parties')
    .select('promo_code_id, weekday_discount_applied')
    .eq('id', partyId)
    .maybeSingle();
  const hadPromo = !!existing?.promo_code_id;

  // No-stacking rule: the Mon-Thu auto 20% can't combine with any
  // additional discount. Block unless the admin is CLEARING (setting 0).
  const isClearing =
    (typeof body.percent === 'number' && body.percent === 0) ||
    (typeof body.amount_cents === 'number' && body.amount_cents === 0);
  if (existing?.weekday_discount_applied && !isClearing) {
    return NextResponse.json(
      {
        error:
          "This party already has the Mon–Thu 20% discount baked in — promotions can't stack. Reschedule to Fri–Sun first if you want to apply an additional discount.",
      },
      { status: 409 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.percent === 'number') {
    updates.manual_discount_percent = body.percent;
    updates.manual_discount_cents = 0;
  } else {
    updates.manual_discount_cents = body.amount_cents;
    updates.manual_discount_percent = 0;
  }
  if (hadPromo) updates.promo_code_id = null;

  const { error } = await db.from('parties').update(updates).eq('id', partyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void syncPartyEventByPartyId(partyId);

  // Customer + owner notifications, voids stale balance invoice if any.
  const changeNote =
    typeof body.percent === 'number'
      ? body.percent > 0
        ? `we applied a ${body.percent}% Friends & family discount`
        : 'we cleared the Friends & family discount'
      : (body.amount_cents ?? 0) > 0
        ? `we applied a ${fmt(body.amount_cents ?? 0)} Friends & family discount`
        : 'we cleared the Friends & family discount';
  void afterMoneyChange(partyId, changeNote);

  return NextResponse.json({ ok: true, ...updates });
}
