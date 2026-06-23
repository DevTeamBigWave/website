import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { createOrUpdateBalanceInvoice } from '@/lib/party-invoice';
import { sendBalanceInvoiceReady, sendOwnerNotification } from '@/lib/email';

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id: partyId } = await params;

  const db = supabaseAdmin();
  const { data: party, error: pErr } = await db
    .from('parties')
    .select('id, parent_name, email, phone, date, start_time, package, child_name, headcount, extension_minutes, total_cents, subtotal_cents, deposit_cents, deposit_paid_at, add_ons_total_cents, gift_card_applied_cents, balance_paid_amount_cents, balance_invoice_id, manual_discount_percent, manual_discount_cents, invoice_theme, promo_code:promo_code_id(code, label)')
    .eq('id', partyId)
    .maybeSingle();
  if (pErr || !party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  const { data: addOns = [] } = await db
    .from('party_add_ons')
    .select('id, name, unit_price_cents, qty, notes')
    .eq('party_id', partyId)
    .order('created_at', { ascending: true });

  try {
    const { invoiceId, hostedUrl, balanceDueCents } = await createOrUpdateBalanceInvoice(
      party as any,
      (addOns ?? []) as any,
    );

    // Send the branded customer-facing email with the hosted invoice link
    await sendBalanceInvoiceReady({
      parent_name: party.parent_name,
      email: party.email,
      child_name: party.child_name,
      date: party.date,
      balance_cents: balanceDueCents,
      hosted_invoice_url: hostedUrl,
      add_ons: (addOns ?? []).map((a: any) => ({
        name: a.name,
        qty: a.qty,
        unit_price_cents: a.unit_price_cents,
      })),
      theme: (party as any).invoice_theme ?? null,
    }).catch((err) => {
      console.error('Branded invoice email failed (Stripe email still sent):', err);
    });

    // Owner paper trail.
    sendOwnerNotification({
      subject: `📨 Balance invoice sent · ${party.child_name ?? 'party'} · ${fmt(balanceDueCents)}`,
      party,
      addOns: (addOns ?? []) as any,
    }).catch((err) => console.error('Owner notification failed:', err));

    return NextResponse.json({
      ok: true,
      invoiceId,
      hostedUrl,
      balanceDueCents,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invoice creation failed' },
      { status: 500 },
    );
  }
}
