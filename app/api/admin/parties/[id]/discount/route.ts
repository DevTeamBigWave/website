// Owner-only: sets the friends & family discount on a party.
//
// Accepts EITHER a percent (0/10/15/20) OR a flat dollar amount.
// Setting one zeroes the other so the two paths never conflict.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';

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

  const updates: Record<string, unknown> = {};
  if (typeof body.percent === 'number') {
    updates.manual_discount_percent = body.percent;
    updates.manual_discount_cents = 0;
  } else {
    updates.manual_discount_cents = body.amount_cents;
    updates.manual_discount_percent = 0;
  }

  const db = supabaseAdmin();
  const { error } = await db.from('parties').update(updates).eq('id', partyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void syncPartyEventByPartyId(partyId);
  return NextResponse.json({ ok: true, ...updates });
}
