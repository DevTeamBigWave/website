// Owner-only: sends a Stripe invoice for just the deposit (50% of total).
// Used when a party was booked via promo code (no deposit collected at
// booking) and the owner wants to collect just the deposit first, leaving
// the balance for a later /invoice send.
//
// Mirrors the deposit-only path in /admin/parties/new create endpoint:
// itemize the party (with tax) + discount line, then a "balance — invoiced
// separately" credit that pulls the total down to the deposit amount. The
// invoice carries metadata.type='party_deposit_admin' so the existing
// webhook handler flips deposit_paid_at on payment.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { sendCreatedPartyInvoice } from '@/lib/email';

export const maxDuration = 60;

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function formatDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id: partyId } = await params;

  const db = supabaseAdmin();
  const { data: party, error: pErr } = await db
    .from('parties')
    .select(
      'id, parent_name, email, phone, date, start_time, package, child_name, total_cents, deposit_cents, deposit_paid_at, manual_discount_percent, invoice_theme, balance_invoice_id',
    )
    .eq('id', partyId)
    .maybeSingle();
  if (pErr || !party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  if (party.deposit_paid_at) {
    return NextResponse.json(
      { error: 'Deposit already marked paid.' },
      { status: 409 },
    );
  }

  // Math: apply any friends-&-family discount to the party total, take 50%.
  const pct = party.manual_discount_percent ?? 0;
  const discountCents = Math.round((party.total_cents * pct) / 100);
  const partyAfterDiscount = party.total_cents - discountCents;
  const depositAmount = Math.round(partyAfterDiscount / 2);
  const remainingAfterDeposit = partyAfterDiscount - depositAmount;

  if (depositAmount < 50) {
    return NextResponse.json(
      { error: 'Deposit is under Stripe minimum of $0.50.' },
      { status: 400 },
    );
  }

  // Void any prior open invoice on this party so we don't double-charge
  if (party.balance_invoice_id) {
    try {
      const existing = await stripe.invoices.retrieve(party.balance_invoice_id);
      if (existing.status === 'open' || existing.status === 'draft') {
        await stripe.invoices.voidInvoice(party.balance_invoice_id);
      }
    } catch (err) {
      console.warn('Could not void prior invoice (continuing):', err);
    }
  }

  // Find / create Stripe customer
  let customerId: string;
  const existing = await stripe.customers.list({ email: party.email, limit: 1 });
  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const created = await stripe.customers.create({
      email: party.email,
      name: party.parent_name,
      phone: party.phone ?? undefined,
    });
    customerId = created.id;
  }

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: 3,
    auto_advance: false,
    description: `Deposit to confirm ${party.child_name ?? 'the'}'s ${party.package} party on ${formatDateLong(party.date)}. Balance of ${fmtMoney(remainingAfterDeposit)} invoiced separately.`,
    footer: [
      'Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn NY 11235 · (718) 889-1777 · info@wonderlandplayhouse.com',
      '',
      `Prefer no card fee? Send via Zelle to info@wonderlandplayhouse.com — please reference ${party.child_name ?? 'the party'} in the memo. Cash also accepted at the Playhouse.`,
    ].join('\n'),
    metadata: {
      type: 'party_deposit_admin',
      party_id: partyId,
    },
  });

  // Itemize: party (with tax), discount, "balance later" credit
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: party.total_cents,
    currency: 'usd',
    description: `${party.package === 'private' ? 'Private' : 'Semi-Private'} party (incl. tax) — ${formatDateLong(party.date)}`,
  });
  if (discountCents > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: -discountCents,
      currency: 'usd',
      description: `Friends & family discount (${pct}% off)`,
    });
  }
  if (remainingAfterDeposit > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: -remainingAfterDeposit,
      currency: 'usd',
      description: `Balance — invoiced separately closer to the party (deposit due now: ${fmtMoney(depositAmount)})`,
    });
  }

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  // Persist invoice id on the party so admin sees the latest invoice
  await db
    .from('parties')
    .update({
      balance_invoice_id: finalized.id,
      balance_invoice_hosted_url: finalized.hosted_invoice_url,
      balance_invoice_sent_at: new Date().toISOString(),
    })
    .eq('id', partyId);

  // Themed wrapper email
  try {
    await sendCreatedPartyInvoice({
      parent_name: party.parent_name,
      email: party.email,
      child_name: party.child_name,
      date: party.date,
      start_time: party.start_time,
      kind: 'deposit',
      amount_cents: depositAmount,
      balance_after_cents: remainingAfterDeposit,
      hosted_invoice_url: finalized.hosted_invoice_url ?? '',
      add_ons: [],
      theme: party.invoice_theme ?? 'wonderland',
    });
  } catch (err) {
    console.error('Themed wrapper email failed (Stripe email still sent):', err);
  }

  return NextResponse.json({
    ok: true,
    invoiceId: finalized.id,
    hostedUrl: finalized.hosted_invoice_url,
    amountCents: depositAmount,
  });
}
