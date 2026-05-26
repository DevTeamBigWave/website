// Owner-only: deletes a party. Voids any open Stripe invoice first so it
// doesn't sit around in the dashboard. Add-ons cascade via FK.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;
  const db = supabaseAdmin();

  const { data: party } = await db
    .from('parties')
    .select('id, balance_invoice_id')
    .eq('id', partyId)
    .maybeSingle();

  if (!party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  if (party.balance_invoice_id) {
    try {
      const invoice = await stripe.invoices.retrieve(party.balance_invoice_id);
      if (invoice.status === 'open' || invoice.status === 'draft') {
        await stripe.invoices.voidInvoice(party.balance_invoice_id);
      }
    } catch (err) {
      console.warn('Stripe invoice void failed (continuing with delete):', err);
    }
  }

  const { error } = await db.from('parties').delete().eq('id', partyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
