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
import {
  sendManualPaymentReceived,
  sendOwnerNotification,
  sendBalanceInvoiceReady,
} from '@/lib/email';
import { maybeSendPlanningCallInvite } from '@/lib/planning-call';
import { createOrUpdateBalanceInvoice } from '@/lib/party-invoice';

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
      'id, date, start_time, package, child_name, child_age, parent_name, email, phone, headcount, notes, total_cents, subtotal_cents, duration_minutes, extension_minutes, deposit_cents, deposit_paid_at, deposit_payment_method, add_ons_total_cents, gift_card_applied_cents, manual_discount_percent, manual_discount_cents, balance_paid_at, balance_paid_amount_cents, balance_payment_method, balance_invoice_id, weekday_discount_applied, inspiration_image_urls, promo_code_id, google_calendar_event_id, promo_code:promo_code_id(code, label)',
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
      // Groupon-prepaid model: party portion is fully covered by Groupon's
      // remittance to us (which Gaby gets directly from Groupon — not
      // through Stripe/Clover). Customer owes us only add-ons + tax-on-
      // add-ons going forward. Zero out every party-side financial field
      // so the math + display treats the party portion as "off our books".
      //
      // The $499 lands on deposit_cents purely so the Revenue dashboard
      // can attribute the Groupon income to this party. computePartyFinancials
      // sees method='groupon' and skips crediting it against the customer's
      // balance owed (the customer never gave us \$499 — Groupon did).
      await db
        .from('parties')
        .update({
          subtotal_cents: 0,
          discount_cents: 0,
          tax_cents: 0,
          total_cents: 0,
          manual_discount_cents: 0,
          manual_discount_percent: 0,
          deposit_cents: GROUPON_SEMI_CENTS,
          deposit_paid_at: new Date().toISOString(),
          deposit_payment_method: 'groupon',
          balance_paid_at: new Date().toISOString(),
          balance_paid_amount_cents: 0,
          balance_payment_method: 'groupon',
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
    .select('*, promo_code:promo_code_id(code, label)')
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

  // Option 2: when a deposit gets recorded via mark-paid (always non-Stripe
  // by schema — Clover/Zelle/Cash/Groupon), the customer paid out-of-band
  // and Stripe doesn't know yet. Auto-mint a fresh balance invoice that
  // reflects the now-reduced amount owed so Stripe and admin agree on
  // the math without the owner having to remember to tap "Send invoice".
  // Skip when there's no balance owed (gift card or full prepay) — Stripe
  // minimum is $0.50.
  let autoInvoiceUrl: string | null = null;
  if (body.kind === 'deposit' && fin.balance_due_cents >= 50) {
    try {
      const { hostedUrl } = await createOrUpdateBalanceInvoice(
        fullParty as any,
        (addOns ?? []) as any,
      );
      autoInvoiceUrl = hostedUrl;
      // Tell the customer the balance invoice is ready so they can pay
      // online later. Same email template the manual /invoice endpoint
      // and the 14-day cron use, so branding stays consistent.
      try {
        await sendBalanceInvoiceReady({
          parent_name: fullParty.parent_name,
          email: fullParty.email,
          child_name: fullParty.child_name,
          date: fullParty.date,
          balance_cents: fin.balance_due_cents,
          hosted_invoice_url: hostedUrl,
          add_ons: (addOns ?? []).map((a: any) => ({
            name: a.name,
            qty: a.qty,
            unit_price_cents: a.unit_price_cents,
          })),
          theme: (fullParty as any).invoice_theme ?? null,
        });
      } catch (err) {
        console.error('Auto balance-invoice email failed:', err);
      }
    } catch (err) {
      // Don't block the deposit recording on an invoice-mint failure —
      // the deposit is what matters; owner can manually re-send invoice
      // from /admin/parties/[id] if Stripe was flaky.
      console.error('Auto balance-invoice mint failed (continuing):', err);
    }
  }

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

  // For deposit payments, auto-fire the planning-call invite if it hasn't
  // gone out yet (Stripe webhook does the same — whichever happens first
  // wins via the planning_call_email_sent_at idempotency check).
  if (body.kind === 'deposit') {
    void maybeSendPlanningCallInvite(fullParty as any);
  }

  return NextResponse.json({
    ok: true,
    // Surface the freshly-minted balance invoice URL when Option 2 fired
    // so the admin UI can confirm "balance invoice sent" without an
    // extra round trip.
    ...(autoInvoiceUrl ? { balance_invoice_url: autoInvoiceUrl } : {}),
  });
}
