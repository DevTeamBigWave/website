// Owner-only: deletes a gift card and its redemption history. Parties /
// open-play rows that already used the card keep their applied amounts —
// only the FK is nulled out so history reads still work.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id } = await params;
  const db = supabaseAdmin();

  // FK is "on delete restrict" — clear redemption rows first
  const { error: redErr } = await db.from('gift_card_redemptions').delete().eq('gift_card_id', id);
  if (redErr) {
    return NextResponse.json({ error: `Could not clear redemptions: ${redErr.message}` }, { status: 500 });
  }

  const { error } = await db.from('gift_cards').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
