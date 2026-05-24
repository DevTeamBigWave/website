// Revenue dashboard aggregations.
//
// Phase 1 coverage (Stripe-only, cash basis):
// - Party deposits collected via Stripe (net of any gift-card credit applied)
// - Party balance payments via Stripe invoice
// - Open play online payments
// - Gift card sales (cash-basis: revenue at sale, redemption is fulfillment)
//
// Phase 2 adds clover_payments. Phase 4 nets out labor + processing fees.

import { supabaseAdmin } from '@/lib/supabase';

export type DateRange = { from: Date; to: Date; label: string };

// Standard NYC-anchored ranges
export function rangeForPreset(preset: string): DateRange {
  const now = new Date();
  const to = endOfDayNYC(now);
  if (preset === 'today') {
    return { from: startOfDayNYC(now), to, label: 'Today' };
  }
  if (preset === 'week') {
    const monday = startOfDayNYC(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return { from: monday, to, label: 'This week' };
  }
  if (preset === 'month') {
    const d = startOfDayNYC(now);
    d.setDate(1);
    return { from: d, to, label: 'This month' };
  }
  if (preset === 'quarter') {
    const d = startOfDayNYC(now);
    const m = d.getMonth();
    d.setMonth(m - (m % 3));
    d.setDate(1);
    return { from: d, to, label: 'This quarter' };
  }
  if (preset === 'ytd') {
    const d = startOfDayNYC(now);
    d.setMonth(0);
    d.setDate(1);
    return { from: d, to, label: 'Year to date' };
  }
  if (preset === '30d') {
    const d = startOfDayNYC(now);
    d.setDate(d.getDate() - 29);
    return { from: d, to, label: 'Last 30 days' };
  }
  // default: 30d
  const d = startOfDayNYC(now);
  d.setDate(d.getDate() - 29);
  return { from: d, to, label: 'Last 30 days' };
}

function startOfDayNYC(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayNYC(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type RevenueLine = {
  source:
    | 'party_deposits'
    | 'party_balance'
    | 'open_play_online'
    | 'gift_card_sales'
    | 'clover_pos';
  label: string;
  amount_cents: number;
  txn_count: number;
};

export type RevenueSummary = {
  range: { fromISO: string; toISO: string; label: string };
  lines: RevenueLine[];
  gross_cents: number;
  // Estimated processing fees: Stripe 2.9% + 30¢ per transaction
  estimated_stripe_fees_cents: number;
  net_before_labor_cents: number;
  txn_count: number;
  // Per-day for the chart
  daily: Array<{ date: string; amount_cents: number }>;
};

const STRIPE_PCT = 0.029;
const STRIPE_FIXED_CENTS = 30;

function ymd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function getRevenue(range: DateRange): Promise<RevenueSummary> {
  const db = supabaseAdmin();
  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  // Party deposits (collected via Stripe — gift card credit doesn't count as cash)
  const { data: depParties = [] } = await db
    .from('parties')
    .select('deposit_cents, gift_card_applied_cents, deposit_paid_at')
    .gte('deposit_paid_at', fromISO)
    .lte('deposit_paid_at', toISO)
    .not('deposit_paid_at', 'is', null);

  const partyDeposits: RevenueLine = {
    source: 'party_deposits',
    label: 'Party deposits',
    amount_cents: (depParties ?? []).reduce(
      (s: number, p: any) =>
        s + Math.max(0, (p.deposit_cents ?? 0) - (p.gift_card_applied_cents ?? 0)),
      0,
    ),
    txn_count: (depParties ?? []).filter(
      (p: any) => (p.deposit_cents ?? 0) - (p.gift_card_applied_cents ?? 0) > 0,
    ).length,
  };

  // Party balances (collected via Stripe invoice)
  const { data: balParties = [] } = await db
    .from('parties')
    .select('balance_paid_amount_cents, balance_paid_at')
    .gte('balance_paid_at', fromISO)
    .lte('balance_paid_at', toISO)
    .not('balance_paid_at', 'is', null);

  const partyBalance: RevenueLine = {
    source: 'party_balance',
    label: 'Party balance payments',
    amount_cents: (balParties ?? []).reduce(
      (s: number, p: any) => s + (p.balance_paid_amount_cents ?? 0),
      0,
    ),
    txn_count: (balParties ?? []).filter(
      (p: any) => (p.balance_paid_amount_cents ?? 0) > 0,
    ).length,
  };

  // Open play online
  const { data: openPlay = [] } = await db
    .from('open_play')
    .select('total_cents, gift_card_applied_cents, paid_at, payment_method')
    .gte('paid_at', fromISO)
    .lte('paid_at', toISO)
    .eq('status', 'paid')
    .eq('payment_method', 'online');

  const openPlayLine: RevenueLine = {
    source: 'open_play_online',
    label: 'Open play (online)',
    amount_cents: (openPlay ?? []).reduce(
      (s: number, o: any) =>
        s + Math.max(0, (o.total_cents ?? 0) - (o.gift_card_applied_cents ?? 0)),
      0,
    ),
    txn_count: (openPlay ?? []).length,
  };

  // Gift card sales (revenue at sale, cash basis)
  const { data: giftCards = [] } = await db
    .from('gift_cards')
    .select('amount_cents, paid_at, status')
    .gte('paid_at', fromISO)
    .lte('paid_at', toISO)
    .in('status', ['active', 'redeemed']);

  const giftCardSales: RevenueLine = {
    source: 'gift_card_sales',
    label: 'Gift card sales',
    amount_cents: (giftCards ?? []).reduce(
      (s: number, g: any) => s + (g.amount_cents ?? 0),
      0,
    ),
    txn_count: (giftCards ?? []).length,
  };

  // Clover POS (Phase 2 — only present if synced)
  const { data: cloverRows = [] } = await db
    .from('clover_payments')
    .select('amount_cents, created_at_clover')
    .gte('created_at_clover', fromISO)
    .lte('created_at_clover', toISO)
    .eq('status', 'paid');

  const cloverLine: RevenueLine = {
    source: 'clover_pos',
    label: 'In-venue POS (Clover)',
    amount_cents: (cloverRows ?? []).reduce(
      (s: number, c: any) => s + (c.amount_cents ?? 0),
      0,
    ),
    txn_count: (cloverRows ?? []).length,
  };

  const lines = [partyDeposits, partyBalance, openPlayLine, giftCardSales, cloverLine];
  const gross = lines.reduce((s, l) => s + l.amount_cents, 0);
  const txnCount = lines.reduce((s, l) => s + l.txn_count, 0);

  // Estimated Stripe fees (only on Stripe-sourced txns)
  const stripeTxns = partyDeposits.txn_count + partyBalance.txn_count + openPlayLine.txn_count + giftCardSales.txn_count;
  const stripeAmount = partyDeposits.amount_cents + partyBalance.amount_cents + openPlayLine.amount_cents + giftCardSales.amount_cents;
  const estimatedStripeFees = Math.round(stripeAmount * STRIPE_PCT + stripeTxns * STRIPE_FIXED_CENTS);

  // Daily series (combine all sources)
  const dailyMap = new Map<string, number>();
  const addDaily = (date: string, amt: number) => {
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + amt);
  };
  (depParties ?? []).forEach((p: any) => {
    const d = ymd(new Date(p.deposit_paid_at));
    addDaily(d, Math.max(0, (p.deposit_cents ?? 0) - (p.gift_card_applied_cents ?? 0)));
  });
  (balParties ?? []).forEach((p: any) => {
    const d = ymd(new Date(p.balance_paid_at));
    addDaily(d, p.balance_paid_amount_cents ?? 0);
  });
  (openPlay ?? []).forEach((o: any) => {
    const d = ymd(new Date(o.paid_at));
    addDaily(d, Math.max(0, (o.total_cents ?? 0) - (o.gift_card_applied_cents ?? 0)));
  });
  (giftCards ?? []).forEach((g: any) => {
    const d = ymd(new Date(g.paid_at));
    addDaily(d, g.amount_cents ?? 0);
  });
  (cloverRows ?? []).forEach((c: any) => {
    const d = ymd(new Date(c.created_at_clover));
    addDaily(d, c.amount_cents ?? 0);
  });

  // Build a continuous date series so the chart has zeros for empty days
  const daily: Array<{ date: string; amount_cents: number }> = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const d = ymd(cursor);
    daily.push({ date: d, amount_cents: dailyMap.get(d) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    range: { fromISO, toISO, label: range.label },
    lines,
    gross_cents: gross,
    estimated_stripe_fees_cents: estimatedStripeFees,
    net_before_labor_cents: gross - estimatedStripeFees,
    txn_count: txnCount,
    daily,
  };
}
