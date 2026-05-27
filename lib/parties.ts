// Party balance arithmetic — single source of truth for what's owed.

export type PartyFinancials = {
  base_total_cents: number;          // parties.total_cents (party + tax, before add-ons)
  add_ons_total_cents: number;       // sum of add-on rows
  manual_discount_percent: number;   // 0 / 10 / 15 / 20
  manual_discount_cents: number;     // percent of (base + add-ons)
  gift_card_applied_cents: number;   // already redeemed at deposit time
  deposit_paid_cents: number;        // deposit captured at booking
  balance_paid_cents: number;        // any payment of the balance invoice already received
  grand_total_cents: number;         // base + add-ons − manual discount
  balance_due_cents: number;         // grand_total − deposit − balance_paid − gift_card
};

export type PartyRowForFinancials = {
  total_cents: number;
  add_ons_total_cents?: number | null;
  gift_card_applied_cents?: number | null;
  deposit_cents: number;
  deposit_paid_at?: string | null;
  balance_paid_amount_cents?: number | null;
  manual_discount_percent?: number | null;
  manual_discount_cents?: number | null; // flat-$ override; preempts percent
};

export function computePartyFinancials(p: PartyRowForFinancials): PartyFinancials {
  const baseTotal = p.total_cents;
  const addOnsTotal = p.add_ons_total_cents ?? 0;
  const giftCard = p.gift_card_applied_cents ?? 0;
  // Only count the deposit as paid if the webhook has actually confirmed it.
  // Without this gate, admin-created parties would treat the owed deposit as
  // received the moment the row is inserted.
  const depositPaid = p.deposit_paid_at ? p.deposit_cents : 0;
  const balancePaid = p.balance_paid_amount_cents ?? 0;
  const pct = p.manual_discount_percent ?? 0;
  const flatCents = p.manual_discount_cents ?? 0;

  const preDiscountTotal = baseTotal + addOnsTotal;
  // Custom-$ takes precedence over %. The discount endpoint zeroes the other
  // when one is set, but we defend here too. Cap at preDiscountTotal so we
  // can't produce a negative grand total.
  const rawDiscount = flatCents > 0 ? flatCents : Math.round((preDiscountTotal * pct) / 100);
  const manualDiscount = Math.min(rawDiscount, preDiscountTotal);
  const grandTotal = preDiscountTotal - manualDiscount;
  const balanceDue = Math.max(0, grandTotal - depositPaid - balancePaid - giftCard);

  return {
    base_total_cents: baseTotal,
    add_ons_total_cents: addOnsTotal,
    manual_discount_percent: flatCents > 0 ? 0 : pct,
    manual_discount_cents: manualDiscount,
    gift_card_applied_cents: giftCard,
    deposit_paid_cents: depositPaid,
    balance_paid_cents: balancePaid,
    grand_total_cents: grandTotal,
    balance_due_cents: balanceDue,
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
