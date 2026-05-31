// Create + send a Stripe Invoice for the party balance.
//
// Branded with the venue's name/logo at the Stripe account level (set in
// Stripe dashboard → Settings → Branding). Line items show the party
// package + each add-on, plus a clear note about the deposit already paid.

import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { computePartyFinancials } from '@/lib/parties';

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type PartyForInvoice = {
  id: string;
  parent_name: string;
  email: string;
  phone: string | null;
  date: string;
  start_time: string;
  package: string;
  child_name: string | null;
  subtotal_cents: number;       // party post-Mon-Thu, pre-tax (canonical)
  total_cents: number;          // legacy: party + party-only tax
  deposit_cents: number;
  deposit_paid_at: string | null;
  add_ons_total_cents: number | null;
  gift_card_applied_cents: number | null;
  balance_paid_amount_cents: number | null;
  balance_invoice_id: string | null;
  manual_discount_percent: number | null;
  manual_discount_cents: number | null;
  // Set by callers that did the promo_codes join — used to label the
  // invoice line item "Promo CODE" instead of "Friends & family".
  promo_code?:
    | { code: string; label?: string | null }
    | Array<{ code: string; label?: string | null }>
    | null;
};

type AddOnRow = {
  id: string;
  name: string;
  unit_price_cents: number;
  qty: number;
  notes: string | null;
};

export async function createOrUpdateBalanceInvoice(
  party: PartyForInvoice,
  addOns: AddOnRow[],
): Promise<{ invoiceId: string; hostedUrl: string; balanceDueCents: number }> {
  const db = supabaseAdmin();
  const financials = computePartyFinancials(party);

  if (financials.balance_due_cents <= 0) {
    throw new Error('No balance due — nothing to invoice.');
  }
  if (financials.balance_due_cents < 50) {
    throw new Error('Balance is under Stripe minimum of $0.50.');
  }

  // If a prior open invoice exists, void it so we don't double-charge
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

  // Find or create a Stripe customer for this parent
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

  // Create a draft invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: 7,
    auto_advance: false, // we'll finalize manually so line items attach first
    description: `Balance for ${party.child_name ?? 'birthday'}'s ${party.package} party on ${formatDateLong(party.date)} at ${formatTime(party.start_time)}.`,
    footer: [
      'Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn NY 11235 · (718) 889-1777 · info@wonderlandplayhouse.com',
      '',
      `Prefer no card fee? Send via Zelle to info@wonderlandplayhouse.com — please reference ${party.child_name ?? 'the party'} in the memo. Cash also accepted at the Playhouse.`,
    ].join('\n'),
    metadata: {
      type: 'party_balance',
      party_id: party.id,
    },
  });

  // Itemize pre-tax: party portion, every add-on, then F&F discount,
  // then a single NYC tax line on the post-discount subtotal. This is
  // what reconciles "add-ons get taxed too" with the canonical
  // computePartyFinancials math.
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: financials.party_pre_tax_cents,
    currency: 'usd',
    description: `${packageLabel(party.package)} party — ${formatDateLong(party.date)}`,
  });

  for (const item of addOns) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: item.unit_price_cents * item.qty,
      currency: 'usd',
      description:
        item.qty > 1
          ? `${item.name} × ${item.qty}${item.notes ? ` − ${item.notes}` : ''}`
          : `${item.name}${item.notes ? ` − ${item.notes}` : ''}`,
    });
  }

  // Pre-tax discount — labeled "Promo CODE" when a customer code was used
  // at booking, "Friends & family" when admin applied it manually.
  if (financials.manual_discount_cents > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: -financials.manual_discount_cents,
      currency: 'usd',
      description:
        financials.manual_discount_percent > 0
          ? `${financials.manual_discount_label} (${financials.manual_discount_percent}% off)`
          : financials.manual_discount_label,
    });
  }

  // NYC sales tax on the post-discount subtotal — taxes add-ons too.
  if (financials.tax_cents > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: financials.tax_cents,
      currency: 'usd',
      description: 'NYC sales tax (8.875%)',
    });
  }

  // Credits already paid: deposit (only if actually received), gift card,
  // and any prior balance payments. deposit_paid_at is the source of truth
  // for whether the customer has actually paid the deposit.
  const depositActuallyPaid = party.deposit_paid_at ? party.deposit_cents : 0;
  const creditPaid =
    depositActuallyPaid +
    (party.gift_card_applied_cents ?? 0) +
    (party.balance_paid_amount_cents ?? 0);
  if (creditPaid > 0) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: -creditPaid,
      currency: 'usd',
      description: buildCreditDescription({
        deposit: depositActuallyPaid,
        giftCard: party.gift_card_applied_cents ?? 0,
        priorBalance: party.balance_paid_amount_cents ?? 0,
      }),
    });
  }

  // Finalize + send
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  // Persist
  await db
    .from('parties')
    .update({
      balance_invoice_id: finalized.id,
      balance_invoice_hosted_url: finalized.hosted_invoice_url,
      balance_invoice_sent_at: new Date().toISOString(),
    })
    .eq('id', party.id);

  return {
    invoiceId: finalized.id!,
    hostedUrl: finalized.hosted_invoice_url ?? '',
    balanceDueCents: financials.balance_due_cents,
  };
}

function buildCreditDescription(args: {
  deposit: number;
  giftCard: number;
  priorBalance: number;
}): string {
  const parts: string[] = [];
  if (args.deposit > 0) parts.push(`deposit ${fmtMoney(args.deposit)}`);
  if (args.giftCard > 0) parts.push(`gift card ${fmtMoney(args.giftCard)}`);
  if (args.priorBalance > 0) parts.push(`prior payment ${fmtMoney(args.priorBalance)}`);
  return `Credit applied — ${parts.join(', ')}`;
}

function packageLabel(p: string) {
  return p === 'private' ? 'Private' : 'Semi-Private';
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
