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
import { partyTimeConflict } from '@/lib/parties';
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
  child_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  headcount: z.coerce.number().int().min(1).max(40),
  notes: z.string().max(1000).optional(),
  parent_name: z.string().min(1).max(160),
  email: z.string().email().max(160),
  phone: z.string().min(7).max(40),
  invoice_theme: z.string().refine((v): v is InvoiceThemeSlug => v in INVOICE_THEMES),
  invoice_type: z.enum(['full', 'deposit_only', 'custom_deposit']),
  // Required only when invoice_type === 'custom_deposit'. The Stripe floor
  // is $0.50, the upper bound is enforced server-side against the actual
  // grand total once it's been computed.
  custom_deposit_cents: z.coerce.number().int().min(50).max(2_000_000).optional(),
  manual_discount_percent: z.coerce.number().int().min(0).max(100).default(0),
  // Custom flat-$ discount override. Mirrors the existing-party
  // /discount endpoint shape — cents > 0 wins over percent.
  manual_discount_cents: z.coerce.number().int().min(0).max(2_000_000).optional(),
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

  // Conflict check:
  //  1. Full-day blocks (admin closures) → hard reject
  //  2. Existing parties on the same day → time-overlap with 30-min buffer
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

  const { data: sameDay } = await db
    .from('parties')
    .select('id, start_time, duration_minutes, extension_minutes')
    .eq('date', body.date)
    .in('status', ['hold', 'confirmed']);
  const newDuration =
    120 + (body.extension_minutes === 60 ? 60 : 0);
  const conflict = partyTimeConflict(
    body.start_time,
    newDuration,
    (sameDay ?? []).map((p: any) => ({
      id: p.id,
      start_time: p.start_time,
      duration_minutes: p.duration_minutes ?? 120,
      extension_minutes: p.extension_minutes ?? 0,
    })),
  );
  if (conflict) {
    return NextResponse.json(
      {
        error:
          'That time conflicts with another party on the same date (parties need a 30-minute setup/cleanup gap between them).',
      },
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

  // Compute invoice-side amounts up front so deposit_cents on the row matches
  // what we're actually invoicing the customer (post-discount).
  const isFullInvoice = body.invoice_type === 'full';
  const isCustomDeposit = body.invoice_type === 'custom_deposit';

  // GRAND TOTAL — always includes add-ons and applies the manual discount
  // to (party + add-ons), matching computePartyFinancials. This is the
  // canonical future amount the customer will eventually owe, used to:
  //   - validate the custom_deposit cap
  //   - show the real "balance due" on the deposit invoice description
  // The two existing modes (deposit_only / full) still compute their
  // invoice amounts the way they always did to stay consistent with the
  // customer-side /book flow (50% of party-only, no add-ons-on-deposit).
  // Custom-$ wins over percent (matches computePartyFinancials).
  const _customDiscountCents = body.manual_discount_cents ?? 0;
  const _allAddOnsCents = body.add_ons.reduce((s, a) => s + a.unit_price_cents * a.qty, 0);
  const _grandPreDiscount = pricing.totalCents + _allAddOnsCents;
  const _grandManualDiscount = Math.min(
    _grandPreDiscount,
    _customDiscountCents > 0
      ? _customDiscountCents
      : Math.round((_grandPreDiscount * body.manual_discount_percent) / 100),
  );
  const _grandAfterDiscount = _grandPreDiscount - _grandManualDiscount;

  // Legacy compatibles for full / deposit_only modes (party-only basis,
  // matching the customer /book flow).
  // For custom-$ discount on deposit_only mode, prorate the flat discount
  // across the party portion (since add-ons aren't on this invoice).
  const _addOnsTotal = isFullInvoice ? _allAddOnsCents : 0;
  const _preDiscountFull = pricing.totalCents + _addOnsTotal;
  const _manualDiscount = Math.min(
    _preDiscountFull,
    _customDiscountCents > 0
      ? Math.round(
          (_customDiscountCents * _preDiscountFull) / Math.max(1, _grandPreDiscount),
        )
      : Math.round((_preDiscountFull * body.manual_discount_percent) / 100),
  );
  const _fullAfterDiscount = _preDiscountFull - _manualDiscount;
  const _depositAfterDiscount = Math.round(_fullAfterDiscount / 2);

  // Custom deposit: validate against the all-inclusive grand total (the
  // amount the customer will actually owe in full, not just the party
  // portion). Front-end checks the same boundary; server re-validates so
  // we don't trust client math.
  if (isCustomDeposit) {
    if (body.custom_deposit_cents == null) {
      return NextResponse.json(
        { error: 'Custom deposit amount is required when invoice_type is custom_deposit.' },
        { status: 400 },
      );
    }
    if (body.custom_deposit_cents > _grandAfterDiscount) {
      return NextResponse.json(
        { error: 'Custom deposit cannot exceed the grand total (party + add-ons − discount).' },
        { status: 400 },
      );
    }
  }

  const _customDeposit = isCustomDeposit ? (body.custom_deposit_cents ?? 0) : 0;
  const _persistedDeposit = isFullInvoice
    ? _fullAfterDiscount
    : isCustomDeposit
      ? _customDeposit
      : _depositAfterDiscount;

  const { data: created, error: insertErr } = await db
    .from('parties')
    .insert({
      package: body.package,
      date: body.date,
      start_time: body.start_time,
      duration_minutes: 120,
      extension_minutes: body.extension_minutes,
      child_name: body.child_name,
      child_age: body.child_dob ? yearsBetween(body.child_dob, body.date) : null,
      child_dob: body.child_dob ?? null,
      headcount: body.headcount,
      notes: body.notes ?? null,
      parent_name: body.parent_name,
      email: body.email.trim().toLowerCase(),
      phone: body.phone,
      subtotal_cents: pricing.subtotalCents,
      discount_cents: pricing.discountCents,
      tax_cents: pricing.taxCents,
      total_cents: pricing.totalCents,
      // For full-pay we credit the whole thing (deposit = full discounted),
      // for deposit-only we credit the 50% slice, and for custom we credit
      // whatever the owner specified. All values are post-discount.
      deposit_cents: _persistedDeposit,
      status: 'confirmed',
      weekday_discount_applied: pricing.discountApplied,
      invoice_theme: body.invoice_theme,
      manual_discount_percent: _customDiscountCents > 0 ? 0 : body.manual_discount_percent,
      manual_discount_cents: _customDiscountCents,
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

  // Persist add-ons regardless of invoice_type. For deposit-only the
  // initial Stripe invoice only bills the deposit; the saved add-ons get
  // itemized later when the balance invoice goes out.
  if (body.add_ons.length > 0) {
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
      email: body.email.trim().toLowerCase(),
      name: body.parent_name,
      phone: body.phone,
    });
    customerId = newCust.id;
  }

  const isFull = isFullInvoice;
  const manualDiscountCents = _manualDiscount;
  const fullAfterDiscount = _fullAfterDiscount;
  const depositAfterDiscount = _depositAfterDiscount;
  const invoiceAmountCents = isFull
    ? fullAfterDiscount
    : isCustomDeposit
      ? _customDeposit
      : depositAfterDiscount;
  // Balance message uses the real all-inclusive future total so the
  // customer sees what they'll actually owe (party + add-ons − discount
  // − deposit they're about to pay), not just the party-only remainder.
  const balanceAfterDeposit = _grandAfterDiscount - invoiceAmountCents;

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: isFull ? 7 : 3,
    auto_advance: false,
    description: isFull
      ? `Full payment for ${body.child_name}'s ${body.package} party on ${formatDateLong(body.date)} at ${formatTime(body.start_time)}.`
      : `Deposit to confirm ${body.child_name}'s ${body.package} party on ${formatDateLong(body.date)} at ${formatTime(body.start_time)}. Balance of ${fmtMoney(balanceAfterDeposit)} due 7 days before the party.`,
    footer: [
      'Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn NY 11235 · (718) 889-1777 · info@wonderlandplayhouse.com',
      '',
      `Prefer no card fee? Send via Zelle to info@wonderlandplayhouse.com — please reference ${body.child_name}'s name in the memo. Cash also accepted at the Playhouse.`,
    ].join('\n'),
    metadata: {
      type: isFull ? 'party_full' : 'party_deposit_admin',
      party_id: partyId,
    },
  });

  // Line items vary by invoice type:
  //   - Full: itemize party, every add-on, then a negative discount line.
  //   - Custom deposit: a single line for the agreed deposit amount.
  //     Avoids the awkward case where the custom amount exceeds the
  //     party-after-discount and the "balance credit" math goes negative.
  //   - Deposit-only (standard 50%): itemize the party + discount, then a
  //     "balance" credit so the net pulls down to the deposit.
  if (isCustomDeposit) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: invoiceAmountCents,
      currency: 'usd',
      description: `Deposit for ${body.child_name}'s ${body.package === 'private' ? 'Private' : 'Semi-Private'} party — ${formatDateLong(body.date)}. Balance of ${fmtMoney(balanceAfterDeposit)} invoiced separately.`,
    });
  } else if (isFull) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: pricing.totalCents,
      currency: 'usd',
      description: `${body.package === 'private' ? 'Private' : 'Semi-Private'} party (incl. tax) — ${formatDateLong(body.date)}`,
    });
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
    if (manualDiscountCents > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: -manualDiscountCents,
        currency: 'usd',
        description:
          _customDiscountCents > 0
            ? 'Friends & family discount'
            : `Friends & family discount (${body.manual_discount_percent}% off)`,
      });
    }
  } else {
    // Deposit-only: itemize the party (so the customer sees what they're
    // committing to — party + tax + any friends-&-family discount), then
    // add a "balance — invoiced separately" credit line that pulls the
    // invoice total down to the deposit amount.
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: pricing.totalCents,
      currency: 'usd',
      description: `${body.package === 'private' ? 'Private' : 'Semi-Private'} party (incl. tax) — ${formatDateLong(body.date)}`,
    });
    if (manualDiscountCents > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: -manualDiscountCents,
        currency: 'usd',
        description:
          _customDiscountCents > 0
            ? 'Friends & family discount'
            : `Friends & family discount (${body.manual_discount_percent}% off)`,
      });
    }
    const remaining = pricing.totalCents - manualDiscountCents - depositAfterDiscount;
    if (remaining > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: -remaining,
        currency: 'usd',
        description:
          body.add_ons.length > 0
            ? `Balance + add-ons — invoiced separately closer to the party (deposit due now: ${fmtMoney(depositAfterDiscount)})`
            : `Balance — invoiced separately closer to the party (deposit due now: ${fmtMoney(depositAfterDiscount)})`,
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
      balance_after_cents: isFull ? 0 : fullAfterDiscount - depositAfterDiscount,
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
function yearsBetween(dob: string, partyDate: string): number {
  const b = new Date(`${dob}T00:00:00`);
  const p = new Date(`${partyDate}T00:00:00`);
  let age = p.getFullYear() - b.getFullYear();
  const m = p.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && p.getDate() < b.getDate())) age--;
  return age;
}
