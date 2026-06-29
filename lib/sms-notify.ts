import { sendSms } from '@/lib/sms-send';

// Automated, transactional party SMS — confirmation + reminders. Sent to the
// host who booked (they provided their number as part of the booking). Each is
// fire-and-forget and logged to the SMS inbox via sendSms; never blocks the
// booking or the reminder cron. Twilio enforces opt-outs (won't deliver to a
// number that replied STOP), so we don't need our own suppression here.

function firstName(name?: string | null): string {
  const n = (name ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

function partyWhen(date: string, startTime?: string | null): string {
  const d = new Date(`${date}T00:00:00`);
  const ds = d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return startTime ? `${ds} at ${startTime}` : ds;
}

function pkgLabel(pkg?: string | null): string {
  return pkg === 'private' ? 'Private' : 'Semi-Private';
}

type PartyLike = {
  parent_name?: string | null;
  phone?: string | null;
  package?: string | null;
  date: string;
  start_time?: string | null;
  child_name?: string | null;
};

export function sendPartyConfirmationSms(party: PartyLike): void {
  const to = party.phone?.trim();
  if (!to) return;
  const body = `Hi ${firstName(party.parent_name)}! Your ${pkgLabel(
    party.package,
  )} party at Wonderland Playhouse is confirmed for ${partyWhen(
    party.date,
    party.start_time,
  )}. We'll reach out to plan the details — reply here with any questions. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] confirmation failed:', err),
  );
}

export async function sendPartyReminderSms(
  party: PartyLike,
  daysOut: 7 | 1,
): Promise<void> {
  const to = party.phone?.trim();
  if (!to) return;
  const who = party.child_name ? `${firstName(party.child_name)}'s` : 'your';
  const when = partyWhen(party.date, party.start_time);
  const body =
    daysOut === 7
      ? `Hi ${firstName(
          party.parent_name,
        )}! ${who} party at Wonderland Playhouse is 1 week away — ${when}. We'll send final details soon. Reply with any questions! Reply STOP to opt out.`
      : `Hi ${firstName(
          party.parent_name,
        )}! Big day tomorrow — ${who} party at Wonderland Playhouse, ${when}. Can't wait to see you! Reply STOP to opt out.`;
  await sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] reminder failed:', err),
  );
}
