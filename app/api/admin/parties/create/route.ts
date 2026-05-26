// Owner-only: creates a party from scratch (walk-in / phone bookings).
//
// - Recalculates all pricing server-side from the raw inputs using the
//   same logic as /book, so the owner can't tamper with totals
// - Conflict-checks against blocked_dates (refuses to insert if the day
//   already has a full block from another party)
// - Inserts party_add_ons rows (the trigger keeps add_ons_total_cents in sync)
// - Creates a Stripe Invoice for either the full amount or the deposit,
//   sends Stripe's standard hosted-invoice email, then sends our themed
//   wrapper email on top

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { calculatePartyPricing, type PackageId, type ExtensionId } from '@/lib/pricing';
import { INVOICE_THEMES, type InvoiceThemeSlug } from '@/lib/invoice-themes';
import { sendCreatedPartyInvoice } from '@/lib/email';

export const maxDuration = 60;

const AddOnSchema = z.object({
  catalog_id: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(160),
  unit_price_cents: z.coerce.number().int().min(0).max(1_000_000),
  qty: z.coerce.number().int().min(1).max(200).default(1),
  notes: z.string().max(500).optional(),
});

const CreateSchema = z.object({
  package: z.enum(['private', 'semi']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  extension_minutes: z.coerce.number().int().min(0).max(60).default(0),
  child_name: z.string().min(1).max(120),
  child_age: z.coerce.number().int().min(0).max(20).optional(),
  headcount: z.coerce.number().int().min(1).max(40),
  notes: z.string().max(1000).optional(),
  parent_name: z.string().min(1).max(160),
  email: z.string().email().max(160),
  phone: z.string().min(7).max(40),
  invoice_theme: z.string().refine((v): v is InvoiceThemeSlug => v in INVOICE_THEMES),
  invoice_type: z.enum(['full', 'deposit_only']),
  add_ons: z.array(AddOnSchema).max(40).default([]),
});

export async function POST(request: Request) {
  const me = await requireOwner();

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Conflict check — any FULL block on this date kills the create
  const { data: blocks } = await db
    .from('blocked_dates')
    .select('date, block_type, reason')
    .eq('date', body.date);
  const fullBlock = (blocks ?? []).find((b: any) => b.block_type === 'full');
  if (fullBlock) {
    return NextResponse.json(
      { error: `That date is fully blocked: ${fullBlock.reason ?? 'another party'}.` },
      { status: 409 },
    );
  }

  // Authoritative pricing from raw inputs
  const dateObj = new Date(`${body.date}T${body.start_time}:00`);
  const pricing = calculatePartyPricing({
    packageId: body.package as PackageId,
    date: dateObj,
    time: body.start_time,
    extensionId: body.extension_minutes === 60 ? ('60m' as ExtensionId) : null,
    headcount: body.headcount,
  });

  // Insert the party row
  const { data: created, error: insertErr } = await db
    .from('parties')
    .insert({
      package: body.package,
      date: body.date,
      start_time: body.start_time,
      duration_minutes: 120,
      extension_minutes: body.extension_minutes,
      child_name: body.child_name,
      child_age: body.child_age ?? null,
      headcount: body.headcount,
      notes: body.notes ?? null,
      parent_name: body.parent_name,
      email: body.email.toLowerCase(),
      phone: body.phone,
      subtotal_cents: pricing.subtotalCents,
      discount_cents: pricing.discountCents,
      tax_cents: pricing.taxCents,
      total_cents: pricing.totalCents,
      deposit_cents: body.invoice_type === 'deposit_only' ? pricing.depositCents : pricing.totalCents,
      status: 'confirmed',
      weekday_discount_applied: pricing.discountApplied,
      invoice_theme: body.invoice_theme,
    })
    .select('id')
    .single();

  if (insertErr || !created) {
    return NextResponse.json(
      { error: `Could not create party: ${insertErr?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }
  const partyId = created.id;

  // Insert add-ons (only meaningful for 'full' invoice; for 'deposit_only' the
  // owner adds them later before the balance invoice)
  if (body.invoice_type === 'full' && body.add_ons.length > 0) {
    const rows = body.add_ons.map((a) => ({
      party_id: partyId,
      catalog_id: a.catalog_id ?? null,
      name: a.name,
      unit_price_cents: a.unit_price_cents,
      qty: a.qty,
      notes: a.notes ?? null,
      added_by_admin_id: me.id,
    }));
    const { error: addOnErr } = await db.from('party_add_ons').insert(rows);
    if (addOnErr) {
      console.error('Add-on insert failed (party still created):', addOnErr);
    }
  }

  // Build the Stripe Invoice
  let customerId: string;
  const existing = await stripe.customers.list({ email: body.email.toLowerCase(), limit: 1 });
  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const newCust = await stripe.customers.create({
      email: body.email.toLowerCase(),
      name: body.parent_name,
      phone: body.phone,
    });
    customerId = newCust.id;
  }

  const isFull = body.invoice_type === 'full';
  const addOnsTotalCents = body.add_ons.reduce(
    (s, a) => s + a.unit_price_cents * a.qty,
    0,
  );
  const invoiceAmountCents = isFull
    ? pricing.totalCents + (isFull ? addOnsTotalCents : 0)
    : pricing.depositCents;

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: isFull ? 7 : 3,
    auto_advance: false,
    description: isFull
      ? `Full payment for ${body.child_name}'s ${body.package} party on ${formatDateLong(body.date)} at ${formatTime(body.start_time)}.`
      : `Deposit to confirm ${body.child_name}'s ${body.package} party on ${formatDateLong(body.date)} at ${formatTime(body.start_time)}. Balance of ${fmtMoney(pricing.totalCents - pricing.depositCents)} due 7 days before the party.`,
    footer:
      'Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn NY 11235 · (718) 889-1777 · info@wonderlandplayhouse.com',
    metadata: {
      type: isFull ? 'party_full' : 'party_deposit_admin',
      party_id: partyId,
    },
  });

  // Line items
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: isFull ? pricing.totalCents : pricing.depositCents,
    currency: 'usd',
    description: isFull
      ? `${body.package === 'private' ? 'Private' : 'Semi-Private'} party (incl. tax) — ${formatDateLong(body.date)}`
      : `Deposit (50%) for ${body.package === 'private' ? 'private' : 'semi-private'} party — ${formatDateLong(body.date)}`,
  });

  if (isFull) {
    for (const a of body.add_ons) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: a.unit_price_cents * a.qty,
        currency: 'usd',
        description:
          a.qty > 1
            ? `${a.name} × ${a.qty}${a.notes ? ` — ${a.notes}` : ''}`
            : `${a.name}${a.notes ? ` — ${a.notes}` : ''}`,
      });
    }
  }

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  // Persist invoice metadata on the party so admin sees it
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
      parent_name: body.parent_name,
      email: body.email,
      child_name: body.child_name,
      date: body.date,
      start_time: body.start_time,
      kind: isFull ? 'full' : 'deposit',
      amount_cents: invoiceAmountCents,
      balance_after_cents: isFull ? 0 : pricing.totalCents - pricing.depositCents,
      hosted_invoice_url: finalized.hosted_invoice_url ?? '',
      add_ons: isFull
        ? body.add_ons.map((a) => ({
            name: a.name,
            qty: a.qty,
            unit_price_cents: a.unit_price_cents,
          }))
        : [],
      theme: body.invoice_theme,
    });
  } catch (err) {
    console.error('Themed wrapper email failed (Stripe email still sent):', err);
  }

  return NextResponse.json({
    ok: true,
    partyId,
    invoiceId: finalized.id,
    hostedUrl: finalized.hosted_invoice_url,
    amountCents: invoiceAmountCents,
  });
}

function formatDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}
function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
