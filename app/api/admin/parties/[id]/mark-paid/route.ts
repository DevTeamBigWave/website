// Owner-only: marks a deposit or balance as paid manually (Zelle, cash, or
// Clover swipe). Does the same downstream work the Stripe webhook would do
// on invoice.paid: voids any open Stripe invoice, fires the Google Calendar
// event when the deposit lands, and updates payment timestamps.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { createPartyEvent, syncPartyEventByPartyId } from '@/lib/google-calendar';
import { computePartyFinancials } from '@/lib/parties';
import { sendManualPaymentReceived, sendOwnerNotification } from '@/lib/email';

const Schema = z.object({
  kind: z.enum(['deposit', 'balance']),
  method: z.enum(['zelle', 'cash', 'clover', 'groupon']),
  // Custom amount — only honored when kind='deposit'. Overrides the
  // stored deposit_cents (overwrite even if already paid). Used for
  // legacy parties and any time the owner negotiates a non-standard
  // deposit amount.
  amount_cents: z.coerce.number().int().min(50).max(2_000_000).optional(),
});

// Standing Groupon offer: $499 covers a semi-private party in full
// (the base package portion, inclusive of NYC tax). Extras + add-ons
// stay billable. If Groupon ever changes the deal we update here.
const GROUPON_SEMI_CENTS = 49900;
const TAX_RATE = 0.08875;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: party } = await db
    .from('parties')
    .select(
      'id, date, start_time, package, child_name, child_age, parent_name, email, phone, headcount, notes, total_cents, subtotal_cents, duration_minutes, extension_minutes, deposit_cents, deposit_paid_at, deposit_payment_method, add_ons_total_cents, gift_card_applied_cents, manual_discount_percent, manual_discount_cents, balance_paid_at, balance_paid_amount_cents, balance_payment_method, balance_invoice_id, weekday_discount_applied, inspiration_image_urls, promo_code_id, google_calendar_event_id',
    )
    .eq('id', partyId)
    .maybeSingle();
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  if (body.kind === 'deposit') {
    // Groupon special case: the customer paid $499 to Groupon, which
    // covers the entire base party portion (incl. NYC tax) for a
    // semi-private. We apply a F&F-style discount to bring the party-only
    // grand total to $499, then record $499 as the deposit. Extras and
    // add-ons remain billable normally — Gaby invoices the diff later.
    if (body.method === 'groupon') {
      if (party.package !== 'semi') {
        return NextResponse.json(
          { error: 'Groupon offer only applies to Semi-Private parties.' },
          { status: 400 },
        );
      }
      if (party.deposit_paid_at) {
        return NextResponse.json(
          { error: 'Deposit already marked paid.' },
          { status: 409 },
        );
      }
      // Compute the discount that, when applied to the base package
      // pre-tax, brings the post-tax party total down to $499.
      const basePrice = 65000; // Semi-Private list price, pre-tax
      const baseAfterMonThu = party.weekday_discount_applied
        ? Math.round(basePrice * 0.8)
        : basePrice;
      // Solve: taxable + round(taxable * TAX_RATE) === GROUPON_SEMI_CENTS
      let taxable = Math.round(GROUPON_SEMI_CENTS / (1 + TAX_RATE));
      while (taxable + Math.round(taxable * TAX_RATE) > GROUPON_SEMI_CENTS) taxable--;
      while (taxable + Math.round(taxable * TAX_RATE) < GROUPON_SEMI_CENTS) taxable++;
      const groupOnDiscount = Math.max(0, baseAfterMonThu - taxable);

      await db
        .from('parties')
        .update({
          deposit_paid_at: new Date().toISOString(),
          deposit_payment_method: 'groupon',
          deposit_cents: GROUPON_SEMI_CENTS,
          // Groupon discount stored as a flat-$ override — wins over any
          // existing manual_discount_percent (matches computePartyFinancials).
          manual_discount_cents: groupOnDiscount,
          manual_discount_percent: 0,
          status: 'confirmed',
          hold_expires_at: null,
        })
        .eq('id', partyId);
    } else {
      // Custom-amount deposits CAN overwrite a previously-marked paid deposit
      // (owner is correcting a mistake or restating the agreed amount).
      // Standard deposits (no custom amount) keep the "already paid" guard.
      if (party.deposit_paid_at && body.amount_cents == null) {
        return NextResponse.json(
          { error: 'Deposit already marked paid.' },
          { status: 409 },
        );
      }
      const depositUpdates: Record<string, unknown> = {
        deposit_paid_at: new Date().toISOString(),
        deposit_payment_method: body.method,
        // Recording a deposit is the contractual signal that the party is
        // happening — promote out of 'hold' so the blocked_dates trigger
        // fires and the slot stops looking available to everyone else.
        status: 'confirmed',
        hold_expires_at: null,
      };
      if (body.amount_cents != null) {
        depositUpdates.deposit_cents = body.amount_cents;
      }
      await db.from('parties').update(depositUpdates).eq('id', partyId);
    }
  } else {
    const fin = computePartyFinancials(party as any);
    const amount = fin.balance_due_cents;
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'No balance owed right now.' },
        { status: 409 },
      );
    }
    const priorMethods = party.balance_payment_method
      ? party.balance_payment_method
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    const methods = Array.from(new Set([...priorMethods, body.method])).join(', ');
    await db
      .from('parties')
      .update({
        balance_paid_at: new Date().toISOString(),
        balance_paid_amount_cents: (party.balance_paid_amount_cents ?? 0) + amount,
        balance_payment_method: methods,
      })
      .eq('id', partyId);
  }

  // Close out the open Stripe invoice so the customer sees "PAID" on the
  // hosted invoice page (not "VOIDED") and can't accidentally double-pay
  // by card. paid_out_of_band tells Stripe the payment was received
  // outside Stripe — invoice transitions to status='paid' with the date.
  let amountClosedCents = 0;
  if (party.balance_invoice_id) {
    try {
      const existing = await stripe.invoices.retrieve(party.balance_invoice_id);
      if (existing.status === 'open') {
        await stripe.invoices.pay(party.balance_invoice_id, { paid_out_of_band: true });
        amountClosedCents = existing.amount_due ?? 0;
      } else if (existing.status === 'draft') {
        // Drafts can't be paid OOB — void them instead
        await stripe.invoices.voidInvoice(party.balance_invoice_id);
      }
    } catch (err) {
      console.warn('Stripe invoice close failed (continuing):', err);
    }
  }

  // Create the calendar event the first time a deposit lands, mirroring the
  // /book flow (finalizeParty) and the Stripe webhook for admin invoices.
  // For all other mutations (balance paid, deposit paid when event already
  // exists), just re-sync the event description with the new state.
  if (body.kind === 'deposit' && !party.google_calendar_event_id) {
    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';
      const eventId = await createPartyEvent(party as any, siteUrl);
      if (eventId) {
        await db
          .from('parties')
          .update({ google_calendar_event_id: eventId })
          .eq('id', partyId);
      }
    } catch (err) {
      console.error('Calendar event creation failed (payment still recorded):', err);
    }
  } else {
    void syncPartyEventByPartyId(partyId);
  }

  // Refetch the party so emails + finance math use the post-update state.
  const { data: refreshed } = await db
    .from('parties')
    .select('*')
    .eq('id', partyId)
    .maybeSingle();
  const fullParty = refreshed ?? party;

  // Pull add-ons so the owner notification shows the full picture.
  const { data: addOns = [] } = await db
    .from('party_add_ons')
    .select('name, unit_price_cents, qty, notes')
    .eq('party_id', partyId)
    .order('created_at', { ascending: true });

  const fin = computePartyFinancials(fullParty as any);

  // Confirmation email to the customer
  try {
    await sendManualPaymentReceived({
      parent_name: fullParty.parent_name,
      email: fullParty.email,
      child_name: fullParty.child_name,
      date: fullParty.date,
      kind: body.kind,
      method: body.method,
      amount_cents:
        body.kind === 'deposit'
          ? (fullParty.deposit_cents as number)
          : amountClosedCents || fin.balance_due_cents,
      remaining_balance_cents: fin.balance_due_cents,
    });
  } catch (err) {
    console.error('Manual-payment customer email failed:', err);
  }

  // Notify the owner so the paper trail lands in their inbox too
  try {
    const amt =
      body.kind === 'deposit'
        ? (fullParty.deposit_cents as number)
        : amountClosedCents || fin.balance_due_cents;
    const methodLabel =
      body.method === 'zelle' ? 'Zelle'
      : body.method === 'cash' ? 'Cash'
      : body.method === 'groupon' ? 'Groupon'
      : 'Clover';
    const subject = `💵 Payment recorded · $${(amt / 100).toFixed(2)} ${methodLabel} · ${fullParty.child_name ?? 'party'}`;
    await sendOwnerNotification({
      subject,
      party: fullParty,
      addOns: (addOns ?? []) as any,
    });
  } catch (err) {
    console.error('Manual-payment owner email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
