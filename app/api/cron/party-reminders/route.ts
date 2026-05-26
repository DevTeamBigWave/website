import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendPartySevenDayReminder,
  sendPartyTwentyFourHourReminder,
  sendBalanceInvoiceReady,
} from '@/lib/email';
import { createOrUpdateBalanceInvoice } from '@/lib/party-invoice';
import { computePartyFinancials } from '@/lib/parties';

// Daily cron — runs each of:
// - Auto-send balance invoice 14 days out (only if not already sent)
// - 7-day-out reminder email
// - 24-hour reminder email
//
// All operations are idempotent: each party gets at most one of each via the
// corresponding *_sent_at column.
//
// Schedule on cron-job.org (free):
//   URL:    https://wonderlandplayhouse.com/api/cron/party-reminders
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET from Railway env>
//   When:   Every day at 13:00 UTC (= 9am Eastern)

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Days before the party that the balance invoice auto-sends
const INVOICE_LEAD_DAYS = 14;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — allow if not configured
  return request.headers.get('x-cron-secret') === secret;
}

function isoDateNYC(offsetDays: number): string {
  const now = new Date();
  const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(target);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const today = isoDateNYC(0);
  const sevenDaysOut = isoDateNYC(7);
  const oneDayOut = isoDateNYC(1);
  const invoiceLeadDate = isoDateNYC(INVOICE_LEAD_DAYS);

  const results = {
    ran_for_date: today,
    auto_invoice: { found: 0, sent: 0, skipped: 0, errors: [] as string[] },
    seven_day: { found: 0, sent: 0, skipped: 0, errors: [] as string[] },
    one_day: { found: 0, sent: 0, skipped: 0, errors: [] as string[] },
  };

  // 1. Auto-send balance invoice 14 days out
  const { data: invoiceTargets = [] } = await db
    .from('parties')
    .select(
      'id, parent_name, email, phone, date, start_time, package, child_name, total_cents, deposit_cents, deposit_paid_at, add_ons_total_cents, gift_card_applied_cents, balance_paid_amount_cents, balance_invoice_id, balance_invoice_sent_at, manual_discount_percent, invoice_theme',
    )
    .eq('status', 'confirmed')
    .eq('date', invoiceLeadDate)
    .is('balance_invoice_sent_at', null);

  results.auto_invoice.found = (invoiceTargets ?? []).length;
  for (const party of invoiceTargets ?? []) {
    const fin = computePartyFinancials(party as any);
    if (fin.balance_due_cents < 50) {
      results.auto_invoice.skipped += 1;
      continue;
    }
    try {
      const { data: addOns = [] } = await db
        .from('party_add_ons')
        .select('id, name, unit_price_cents, qty, notes')
        .eq('party_id', party.id)
        .order('created_at', { ascending: true });

      const { hostedUrl, balanceDueCents } = await createOrUpdateBalanceInvoice(
        party as any,
        (addOns ?? []) as any,
      );

      await sendBalanceInvoiceReady({
        parent_name: party.parent_name,
        email: party.email,
        child_name: party.child_name,
        date: party.date,
        balance_cents: balanceDueCents,
        hosted_invoice_url: hostedUrl,
        add_ons: (addOns ?? []).map((a: any) => ({
          name: a.name,
          qty: a.qty,
          unit_price_cents: a.unit_price_cents,
        })),
      }).catch((err) => console.error('Auto-invoice email failed:', err));

      results.auto_invoice.sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      results.auto_invoice.errors.push(`${party.id}: ${msg}`);
    }
  }

  // 2. 7-day reminders
  const { data: sevenDay = [] } = await db
    .from('parties')
    .select('*')
    .eq('status', 'confirmed')
    .eq('date', sevenDaysOut)
    .is('reminder_7d_sent_at', null);

  results.seven_day.found = (sevenDay ?? []).length;
  for (const party of sevenDay ?? []) {
    try {
      await sendPartySevenDayReminder(party);
      await db
        .from('parties')
        .update({ reminder_7d_sent_at: new Date().toISOString() })
        .eq('id', party.id);
      results.seven_day.sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      results.seven_day.errors.push(`${party.id}: ${msg}`);
    }
  }

  // 3. 24-hour reminders
  const { data: oneDay = [] } = await db
    .from('parties')
    .select('*')
    .eq('status', 'confirmed')
    .eq('date', oneDayOut)
    .is('reminder_24h_sent_at', null);

  results.one_day.found = (oneDay ?? []).length;
  for (const party of oneDay ?? []) {
    try {
      await sendPartyTwentyFourHourReminder(party);
      await db
        .from('parties')
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq('id', party.id);
      results.one_day.sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      results.one_day.errors.push(`${party.id}: ${msg}`);
    }
  }

  return NextResponse.json(results);
}
