// Owner-only: marks a deposit or balance as paid manually (Zelle, cash, or
// Clover swipe). Does the same downstream work the Stripe webhook would do
// on invoice.paid: voids any open Stripe invoice, fires the Google Calendar
// event when the deposit lands, and updates payment timestamps.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { createPartyEvent } from '@/lib/google-calendar';
import { computePartyFinancials } from '@/lib/parties';
import { sendManualPaymentReceived } from '@/lib/email';

const Schema = z.object({
  kind: z.enum(['deposit', 'balance']),
  method: z.enum(['zelle', 'cash', 'clover']),
});

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
      'id, date, start_time, package, child_name, child_age, parent_name, email, phone, headcount, notes, total_cents, duration_minutes, extension_minutes, deposit_cents, deposit_paid_at, deposit_payment_method, add_ons_total_cents, gift_card_applied_cents, manual_discount_percent, balance_paid_at, balance_paid_amount_cents, balance_payment_method, balance_invoice_id, weekday_discount_applied, inspiration_image_urls, promo_code_id, google_calendar_event_id',
    )
    .eq('id', partyId)
    .maybeSingle();
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  if (body.kind === 'deposit') {
    if (party.deposit_paid_at) {
      return NextResponse.json(
        { error: 'Deposit already marked paid.' },
        { status: 409 },
      );
    }
    await db
      .from('parties')
      .update({
        deposit_paid_at: new Date().toISOString(),
        deposit_payment_method: body.method,
      })
      .eq('id', partyId);
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
  }

  // Confirmation email so the customer has written proof we got their payment
  try {
    const fin = computePartyFinancials({
      ...(party as any),
      // Re-run with the just-applied payment so the email shows the correct balance
      deposit_paid_at:
        body.kind === 'deposit' ? new Date().toISOString() : party.deposit_paid_at,
      balance_paid_amount_cents:
        body.kind === 'balance'
          ? (party.balance_paid_amount_cents ?? 0) +
            Math.max(0, computePartyFinancials(party as any).balance_due_cents)
          : party.balance_paid_amount_cents ?? 0,
    });
    await sendManualPaymentReceived({
      parent_name: party.parent_name,
      email: party.email,
      child_name: party.child_name,
      date: party.date,
      kind: body.kind,
      method: body.method,
      amount_cents:
        body.kind === 'deposit'
          ? party.deposit_cents
          : amountClosedCents || computePartyFinancials(party as any).balance_due_cents,
      remaining_balance_cents: fin.balance_due_cents,
    });
  } catch (err) {
    console.error('Manual-payment confirmation email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
