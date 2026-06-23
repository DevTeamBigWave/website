// Birthday reminder helpers — find kids whose next birthday is in a target
// week window, with idempotency via marketing_sends.

import { supabaseAdmin } from '@/lib/supabase';

export type UpcomingBirthday = {
  child_id: string;
  child_name: string;
  date_of_birth: string;
  turning_age: number;
  next_birthday_date: string; // YYYY-MM-DD
  customer_id: string;
  parent_name: string;
  parent_email: string;
};

const NYC = 'America/New_York';

// Returns today's date in NYC as YYYY-MM-DD
function todayNYC(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NYC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// MM-DD that's `daysAhead` from today, NYC
function monthDayAhead(daysAhead: number): string {
  const now = new Date();
  const target = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: NYC,
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(target); // MM-DD
}

// Compute "turning age" — age the child becomes on their next birthday.
// E.g. DOB 2020-05-24, current year 2026 → turning 6.
function turningAge(dobIso: string): number {
  const [y, m, d] = dobIso.split('-').map(Number);
  const today = new Date();
  const thisYear = today.getFullYear();
  // If birthday this year hasn't happened yet, turning age = thisYear - y
  // Otherwise turning age = thisYear + 1 - y
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: NYC, month: '2-digit', day: '2-digit' });
  const todayMd = fmt.format(today);
  const dobMd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return todayMd <= dobMd ? thisYear - y : thisYear + 1 - y;
}

// Next birthday as YYYY-MM-DD
function nextBirthdayDate(dobIso: string): string {
  const [, m, d] = dobIso.split('-').map(Number);
  const age = turningAge(dobIso);
  const dobYear = parseInt(dobIso.split('-')[0], 10);
  const year = dobYear + age;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Find kids whose next birthday falls exactly N days from today (in NYC),
// who are subscribed and within the 0-8 target age band.
export async function findBirthdaysInDays(daysAhead: number): Promise<UpcomingBirthday[]> {
  const db = supabaseAdmin();
  const targetMonthDay = monthDayAhead(daysAhead);

  // Pull all subscribed kids with a DOB, then filter to the target MM-DD
  // (Postgres date math against MM-DD is awkward — JS filter is cleaner)
  const { data: kids = [] } = await db
    .from('children')
    .select(
      'id, name, date_of_birth, customer_id, customers ( email, parent_name )',
    )
    .eq('birthday_emails_subscribed', true)
    .not('date_of_birth', 'is', null);

  return (kids ?? [])
    .filter((k: any) => {
      const [, mm, dd] = (k.date_of_birth as string).split('-');
      return `${mm}-${dd}` === targetMonthDay;
    })
    .filter((k: any) => {
      const age = turningAge(k.date_of_birth);
      // Birthday emails target ages 1–8 (their 1st through 8th party)
      return age >= 1 && age <= 8;
    })
    .map((k: any) => ({
      child_id: k.id,
      child_name: k.name,
      date_of_birth: k.date_of_birth,
      turning_age: turningAge(k.date_of_birth),
      next_birthday_date: nextBirthdayDate(k.date_of_birth),
      customer_id: k.customer_id,
      parent_name: k.customers?.parent_name ?? '',
      parent_email: k.customers?.email ?? '',
    }))
    .filter((k: UpcomingBirthday) => k.parent_email);
}

// Has this child already received this campaign for the current birthday year?
export async function alreadySent(
  childId: string,
  campaignType: 'birthday_12w' | 'birthday_8w' | 'birthday_4w',
  birthdayYear: number,
): Promise<boolean> {
  const db = supabaseAdmin();
  // Look for any send of this type in the last 9 months (covers one birthday cycle).
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 9);
  const { data } = await db
    .from('marketing_sends')
    .select('id')
    .eq('child_id', childId)
    .eq('campaign_type', campaignType)
    .gte('created_at', cutoff.toISOString())
    .limit(1)
    .maybeSingle();
  return !!data;
}
