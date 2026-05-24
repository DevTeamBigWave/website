// Party balance arithmetic — single source of truth for what's owed.

export type PartyFinancials = {
  base_total_cents: number;        // parties.total_cents (party + tax, before add-ons)
  add_ons_total_cents: number;     // sum of add-on rows
  gift_card_applied_cents: number; // already redeemed at deposit time
  deposit_paid_cents: number;      // deposit captured at booking
  balance_paid_cents: number;      // any payment of the balance invoice already received
  grand_total_cents: number;       // base + add-ons
  balance_due_cents: number;       // grand_total - deposit - balance_paid - gift_card_applied
};

export type PartyRowForFinancials = {
  total_cents: number;
  add_ons_total_cents?: number | null;
  gift_card_applied_cents?: number | null;
  deposit_cents: number;
  balance_paid_amount_cents?: number | null;
};

export function computePartyFinancials(p: PartyRowForFinancials): PartyFinancials {
  const baseTotal = p.total_cents;
  const addOnsTotal = p.add_ons_total_cents ?? 0;
  const giftCard = p.gift_card_applied_cents ?? 0;
  const depositPaid = p.deposit_cents;
  const balancePaid = p.balance_paid_amount_cents ?? 0;

  const grandTotal = baseTotal + addOnsTotal;
  const balanceDue = Math.max(0, grandTotal - depositPaid - balancePaid - giftCard);

  return {
    base_total_cents: baseTotal,
    add_ons_total_cents: addOnsTotal,
    gift_card_applied_cents: giftCard,
    deposit_paid_cents: depositPaid,
    balance_paid_cents: balancePaid,
    grand_total_cents: grandTotal,
    balance_due_cents: balanceDue,
  };
}
