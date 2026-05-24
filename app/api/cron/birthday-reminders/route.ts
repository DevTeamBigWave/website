import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  findBirthdaysInDays,
  alreadySent,
} from '@/lib/birthday-reminders';
import { isSuppressed } from '@/lib/marketing';
import { sendBirthdayReminder } from '@/lib/email';

// Daily cron — finds kids with upcoming birthdays at 12w, 8w, and 4w and
// sends each touchpoint exactly once per year.
//
// Schedule on cron-job.org:
//   URL:    https://<your-domain>/api/cron/birthday-reminders
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every day at 09:00 America/New_York

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const TOUCHPOINTS: Array<{ days: number; type: 'birthday_12w' | 'birthday_8w' | 'birthday_4w'; label: '12w' | '8w' | '4w' }> = [
  { days: 84, type: 'birthday_12w', label: '12w' },
  { days: 56, type: 'birthday_8w', label: '8w' },
  { days: 28, type: 'birthday_4w', label: '4w' },
];

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const results: Record<string, any> = {};

  for (const tp of TOUCHPOINTS) {
    const kids = await findBirthdaysInDays(tp.days);
    const bucket = { found: kids.length, sent: 0, skipped: 0, errors: [] as string[] };

    for (const kid of kids) {
      // Suppressed?
      if (await isSuppressed(kid.parent_email, 'birthday_reminders')) {
        bucket.skipped += 1;
        continue;
      }
      const birthdayYear = parseInt(kid.next_birthday_date.split('-')[0], 10);
      if (await alreadySent(kid.child_id, tp.type, birthdayYear)) {
        bucket.skipped += 1;
        continue;
      }

      const subject = `${kid.child_name} turns ${kid.turning_age}`;

      // Pre-record (queued) so we have a row even if send fails
      const { data: row } = await db
        .from('marketing_sends')
        .insert({
          customer_id: kid.customer_id,
          child_id: kid.child_id,
          campaign_type: tp.type,
          subject,
          to_email: kid.parent_email,
          status: 'queued',
        })
        .select('id')
        .single();

      try {
        const result = await sendBirthdayReminder({
          touchpoint: tp.label,
          parent_name: kid.parent_name,
          parent_email: kid.parent_email,
          child_name: kid.child_name,
          turning_age: kid.turning_age,
          birthday_date: kid.next_birthday_date,
        });

        await db
          .from('marketing_sends')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_message_id: (result as any)?.data?.id ?? null,
          })
          .eq('id', row?.id);

        // Also denormalize on the child row
        await db
          .from('children')
          .update({
            last_birthday_reminder_sent_at: new Date().toISOString(),
            last_birthday_reminder_campaign: tp.type,
          })
          .eq('id', kid.child_id);

        bucket.sent += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        bucket.errors.push(`${kid.child_id}: ${msg}`);
        if (row?.id) {
          await db
            .from('marketing_sends')
            .update({ status: 'failed', error_message: msg })
            .eq('id', row.id);
        }
      }
    }

    results[tp.label] = bucket;
  }

  return NextResponse.json({ ok: true, results });
}
