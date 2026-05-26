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

  const preDiscountTotal = baseTotal + addOnsTotal;
  const manualDiscount = Math.round((preDiscountTotal * pct) / 100);
  const grandTotal = preDiscountTotal - manualDiscount;
  const balanceDue = Math.max(0, grandTotal - depositPaid - balancePaid - giftCard);

  return {
    base_total_cents: baseTotal,
    add_ons_total_cents: addOnsTotal,
    manual_discount_percent: pct,
    manual_discount_cents: manualDiscount,
    gift_card_applied_cents: giftCard,
    deposit_paid_cents: depositPaid,
    balance_paid_cents: balancePaid,
    grand_total_cents: grandTotal,
    balance_due_cents: balanceDue,
  };
}
