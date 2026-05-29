import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';
import { afterMoneyChange } from '@/lib/after-money-change';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; addOnId: string }> },
) {
  await requireAdmin();
  const { id: partyId, addOnId } = await params;

  const db = supabaseAdmin();
  // Grab the row before deleting so we can name it in the customer email.
  const { data: row } = await db
    .from('party_add_ons')
    .select('name, unit_price_cents, qty')
    .eq('id', addOnId)
    .eq('party_id', partyId)
    .maybeSingle();

  const { error } = await db
    .from('party_add_ons')
    .delete()
    .eq('id', addOnId)
    .eq('party_id', partyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void syncPartyEventByPartyId(partyId);

  const noteLabel = row
    ? `we removed "${row.name}"${(row.qty ?? 1) > 1 ? ` × ${row.qty}` : ''}`
    : 'an add-on was removed';
  void afterMoneyChange(partyId, noteLabel);

  return NextResponse.json({ ok: true });
}
