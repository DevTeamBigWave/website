// Party balance arithmetic — single source of truth for what's owed.
//
// Tax model (8.875% NYC sales tax):
//   - Mon-Thu 20% private discount is applied PRE-tax inside calculatePartyPricing
//     and baked into parties.subtotal_cents.
//   - Friends-&-family discount is applied PRE-tax here, on the combined
//     subtotal (party + add-ons). It reduces the taxable amount.
//   - Tax is calculated on the post-F&F subtotal — which means ADD-ONS
//     ARE TAXED. (Previously the stored parties.tax_cents only covered the
//     party itself, leaving add-ons untaxed — fixed now.)

const TAX_RATE = 0.08875;

export type PartyFinancials = {
  // Pre-tax breakdown
  party_pre_tax_cents: number;       // parties.subtotal_cents (party post-Mon-Thu, pre-tax)
  add_ons_total_cents: number;       // sum of add-on rows (pre-tax)
  combined_pre_tax_cents: number;    // party + add-ons, pre-F&F
  manual_discount_percent: number;
  manual_discount_cents: number;     // resolved discount amount in $
  // Label for the discount line on invoices/emails/calendar:
  //   - "Promo CODE" when promo_code is present on the row (customer used a code)
  //   - "Friends & family discount" otherwise (admin-applied)
  manual_discount_label: string;
  taxable_subtotal_cents: number;    // combined − F&F (what tax is applied to)
  tax_cents: number;                 // 8.875% of taxable_subtotal
  grand_total_cents: number;         // taxable_subtotal + tax
  // Payments
  gift_card_applied_cents: number;
  deposit_paid_cents: number;
  balance_paid_cents: number;
  balance_due_cents: number;
  // Legacy alias — kept so older callers that read base_total_cents
  // (admin party detail "Party total" label) keep working. Now refers
  // to the party-portion-incl-its-own-tax-share for display purposes:
  // party_pre_tax + tax * (party / combined).
  base_total_cents: number;
};

export type PartyRowForFinancials = {
  subtotal_cents: number;            // party post-Mon-Thu, pre-tax (now canonical)
  total_cents?: number | null;       // legacy: party + tax-on-party — used only for safety fallback
  add_ons_total_cents?: number | null;
  gift_card_applied_cents?: number | null;
  deposit_cents: number;
  deposit_paid_at?: string | null;
  // Used to flag Groupon-prepaid parties. When method='groupon' we
  // intentionally DON'T credit deposit_cents against the customer's
  // balance — the $499 went to Groupon's books for revenue tracking
  // only; what the customer owes us is just the add-ons + tax.
  deposit_payment_method?: string | null;
  balance_paid_amount_cents?: number | null;
  manual_discount_percent?: number | null;
  manual_discount_cents?: number | null; // flat-$ override; preempts percent
  // Optional. When set (caller fetched the related promo_codes row), the
  // discount line is labeled "Promo CODE" instead of "Friends & family".
  // Customer-facing renderers (invoice, confirmation email, calendar event,
  // admin detail) should populate this; back-office paths that don't show
  // the label (cron reminders, list views) can leave it null.
  //
  // Accepts both array and object form — PostgREST's embedded select
  // returns `promo_code: [{...}]` when the relationship is detected as
  // many, even though our parties.promo_code_id is single-valued. We
  // normalize internally.
  promo_code?:
    | { code: string; label?: string | null }
    | Array<{ code: string; label?: string | null }>
    | null;
};

export function computePartyFinancials(p: PartyRowForFinancials): PartyFinancials {
  const partyPreTax = p.subtotal_cents;
  const addOnsTotal = p.add_ons_total_cents ?? 0;
  const giftCard = p.gift_card_applied_cents ?? 0;
  // Groupon-prepaid: the deposit_cents on the row exists for revenue
  // accounting (counts in the Party Deposits line) but isn't a credit
  // the customer can apply against their add-on balance — Groupon paid
  // us via their remittance, not the customer paying us.
  const isGrouponPrepaid = p.deposit_payment_method === 'groupon';
  const depositPaid =
    !p.deposit_paid_at || isGrouponPrepaid ? 0 : p.deposit_cents;
  const balancePaid = p.balance_paid_amount_cents ?? 0;
  const pct = p.manual_discount_percent ?? 0;
  const flatCents = p.manual_discount_cents ?? 0;

  const combinedPreTax = partyPreTax + addOnsTotal;
  // Discounts (% and flat $) apply to the PARTY portion only — never to
  // add-ons. Add-ons always stay at their full unit price.
  //   - percent → multiply against partyPreTax, not combinedPreTax
  //   - flat $  → kept as-is, just capped at partyPreTax so we can't
  //               negate the party portion
  // Custom-$ takes precedence over % (admin endpoint zeroes one when
  // setting the other, but we defend here too).
  const rawDiscount = flatCents > 0 ? flatCents : Math.round((partyPreTax * pct) / 100);
  const manualDiscount = Math.min(rawDiscount, partyPreTax);

  const taxableSubtotal = combinedPreTax - manualDiscount;
  const taxCents = Math.round(taxableSubtotal * TAX_RATE);
  const grandTotal = taxableSubtotal + taxCents;
  const balanceDue = Math.max(0, grandTotal - depositPaid - balancePaid - giftCard);

  // Legacy "base_total_cents" — party portion incl. its proportional share
  // of the post-discount tax. Used by displays that show "Party total" as
  // a single line. When add-ons are zero this collapses to partyPreTax + tax.
  const partyTaxShare = combinedPreTax > 0
    ? Math.round((partyPreTax * taxCents) / combinedPreTax)
    : taxCents;
  const baseTotalLegacy = partyPreTax + partyTaxShare;

  const promoRow = Array.isArray(p.promo_code) ? p.promo_code[0] : p.promo_code;
  const discountLabel = promoRow
    ? `Promo ${promoRow.code}`
    : 'Friends & family discount';

  return {
    party_pre_tax_cents: partyPreTax,
    add_ons_total_cents: addOnsTotal,
    combined_pre_tax_cents: combinedPreTax,
    manual_discount_percent: flatCents > 0 ? 0 : pct,
    manual_discount_cents: manualDiscount,
    manual_discount_label: discountLabel,
    taxable_subtotal_cents: taxableSubtotal,
    tax_cents: taxCents,
    grand_total_cents: grandTotal,
    gift_card_applied_cents: giftCard,
    deposit_paid_cents: depositPaid,
    balance_paid_cents: balancePaid,
    balance_due_cents: balanceDue,
    base_total_cents: baseTotalLegacy,
  };
}

// ============================================================================
// Time-slot conflict detection
//
// Two parties on the same date conflict if their 2-hour windows overlap when
// each is expanded by BUFFER_MINUTES on both sides — the buffer represents
// setup + cleanup time we need between bookings. A 12pm party (12–2pm) thus
// blocks any new slot from 10:30am through 4:30pm start.
// ============================================================================

export const BUFFER_MINUTES = 30;

export type DayBooking = {
  id: string;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  duration_minutes: number;
  extension_minutes: number | null;
};

function parseTimeToMinutes(t: string): number {
  // Accepts "HH:MM" or "HH:MM:SS" or "10:00 AM"
  if (t.includes('AM') || t.includes('PM')) {
    const [hm, period] = t.split(' ');
    let [h, m] = hm.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + (m || 0);
  }
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function partyTimeConflict(
  newStart: string, // "HH:MM" or "HH:MM AM/PM"
  newDurationMin: number,
  others: DayBooking[],
): DayBooking | null {
  const nStart = parseTimeToMinutes(newStart);
  const nEnd = nStart + newDurationMin;
  for (const o of others) {
    const oStart = parseTimeToMinutes(o.start_time);
    const oEnd = oStart + o.duration_minutes + (o.extension_minutes ?? 0);
    if (nStart < oEnd + BUFFER_MINUTES && oStart < nEnd + BUFFER_MINUTES) {
      return o;
    }
  }
  return null;
}
