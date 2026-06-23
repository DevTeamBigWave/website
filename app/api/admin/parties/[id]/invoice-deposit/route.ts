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
import { sendCreatedPartyInvoice, sendOwnerNotification } from '@/lib/email';
import { computePartyFinancials } from '@/lib/parties';

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
      'id, parent_name, email, phone, date, start_time, package, child_name, headcount, extension_minutes, total_cents, subtotal_cents, deposit_cents, deposit_paid_at, add_ons_total_cents, gift_card_applied_cents, balance_paid_amount_cents, manual_discount_percent, manual_discount_cents, invoice_theme, balance_invoice_id, promo_code:promo_code_id(code, label)',
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

  // The deposit amount is whatever the party row carries (50% default at
  // creation, or a custom amount the owner set). The balance shown on the
  // invoice description is the canonical computePartyFinancials grand
  // total minus what's about to be deposited.
  const fin = computePartyFinancials(party as any);
  const depositAmount = party.deposit_cents;
  const remainingAfterDeposit = Math.max(0, fin.grand_total_cents - depositAmount);

  // The Stripe invoice itemization (party + discount + balance credit)
  // still discounts the party portion only, so we recompute the per-line
  // numbers from party.total_cents. This matches the deposit-only branch
  // of /admin/parties/new and the customer /book flow.
  const pct = party.manual_discount_percent ?? 0;
  const flatCents = party.manual_discount_cents ?? 0;
  const rawPartyDiscount = flatCents > 0 ? flatCents : Math.round((party.total_cents * pct) / 100);
  const partyDiscountCents = Math.min(rawPartyDiscount, party.total_cents);

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

  // Single-line itemization keeps the math simple regardless of how the
  // deposit was set (custom amount vs default 50%). The invoice description
  // already spells out the party + balance breakdown for the customer.
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: depositAmount,
    currency: 'usd',
    description: `Deposit for ${party.child_name ?? 'the'}'s ${party.package === 'private' ? 'Private' : 'Semi-Private'} party — ${formatDateLong(party.date)}. Balance of ${fmtMoney(remainingAfterDeposit)} invoiced separately.`,
  });
  // Silence unused-var lint until we restore itemized lines if requested
  void partyDiscountCents;
  void pct;
  void flatCents;

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

  // Owner paper trail.
  sendOwnerNotification({
    subject: `📨 Deposit invoice sent · ${party.child_name ?? 'party'} · ${fmtMoney(depositAmount)}`,
    party,
  }).catch((err) => console.error('Owner notification failed:', err));

  return NextResponse.json({
    ok: true,
    invoiceId: finalized.id,
    hostedUrl: finalized.hosted_invoice_url,
    amountCents: depositAmount,
  });
}
