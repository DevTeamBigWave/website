import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendPartySevenDayReminder,
  sendPartyTwentyFourHourReminder,
} from '@/lib/email';

// Daily cron — sends reminders for parties:
// - exactly 7 days out (7-day reminder)
// - exactly 1 day out (24-hour reminder)
//
// Idempotent: each party sends at most one of each via the
// reminder_7d_sent_at / reminder_24h_sent_at columns (added by this route's
// migration once we set the cron up).
//
// To schedule on Railway: Settings → Cron → add a cron job with command:
//   curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://website-production-4594.up.railway.app/api/cron/party-reminders
// And schedule: 0 13 * * *  (1pm UTC = 9am Eastern, daily)

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — allow if not configured
  return request.headers.get('x-cron-secret') === secret;
}

function isoDateNYC(offsetDays: number): string {
  // Compute target date in America/New_York to align with the party.date column
  const now = new Date();
  const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(target); // YYYY-MM-DD
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const today = isoDateNYC(0);
  const sevenDaysOut = isoDateNYC(7);
  const oneDayOut = isoDateNYC(1);

  const results = {
    seven_day: { found: 0, sent: 0, skipped: 0, errors: [] as string[] },
    one_day: { found: 0, sent: 0, skipped: 0, errors: [] as string[] },
    ran_for_date: today,
  };

  // 7-day reminders
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

  // 24-hour reminders
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
