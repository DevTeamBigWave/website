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

function fmtMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
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

// Balance/payment reminders WITH the Stripe pay link. Skipped if there's no
// phone, no working pay link, or nothing meaningful owed — so we never text a
// broken or pointless reminder.
export async function sendBalancePaymentSms(
  party: PartyLike,
  opts: {
    kind: 'invoice_ready' | 'due' | 'overdue';
    payLink: string | null;
    balanceCents: number;
  },
): Promise<void> {
  const to = party.phone?.trim();
  if (!to || !opts.payLink || opts.balanceCents < 50) return;

  const first = firstName(party.parent_name);
  const who = party.child_name ? `${firstName(party.child_name)}'s` : 'your';
  const amt = fmtMoney(opts.balanceCents);

  let body: string;
  if (opts.kind === 'invoice_ready') {
    body = `Hi ${first}! The balance for ${who} party at Wonderland Playhouse (${amt}) is ready to pay: ${opts.payLink} — reply with any questions. Reply STOP to opt out.`;
  } else if (opts.kind === 'due') {
    body = `Hi ${first}! Reminder — the ${amt} balance for ${who} party at Wonderland Playhouse is now due. Pay securely here: ${opts.payLink}. Reply STOP to opt out.`;
  } else {
    body = `Hi ${first}! ${who} party is almost here and a ${amt} balance is still due. Please pay to confirm everything: ${opts.payLink}. Reply STOP to opt out.`;
  }

  await sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] balance reminder failed:', err),
  );
}

// --- Party lifecycle (text versions of the lifecycle emails) ---------------

export function sendPartyRescheduledSms(party: PartyLike): void {
  const to = party.phone?.trim();
  if (!to) return;
  const who = party.child_name ? `${firstName(party.child_name)}'s` : 'your';
  const body = `Hi ${firstName(
    party.parent_name,
  )}! ${who} party at Wonderland Playhouse has been rescheduled to ${partyWhen(
    party.date,
    party.start_time,
  )}. See you then — reply with any questions. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] reschedule failed:', err),
  );
}

export function sendPartyCancelledSms(party: PartyLike): void {
  const to = party.phone?.trim();
  if (!to) return;
  const who = party.child_name ? `${firstName(party.child_name)}'s` : 'your';
  const body = `Hi ${firstName(
    party.parent_name,
  )}! ${who} party at Wonderland Playhouse on ${partyWhen(
    party.date,
  )} has been cancelled. Questions? Call (718) 889-1777. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] cancel failed:', err),
  );
}

export function sendManualPaymentReceivedSms(args: {
  parent_name?: string | null;
  phone?: string | null;
  child_name?: string | null;
  kind: 'deposit' | 'balance';
  amountCents: number;
  remainingCents: number;
}): void {
  const to = args.phone?.trim();
  if (!to) return;
  const who = args.child_name ? `${firstName(args.child_name)}'s` : 'your';
  const tail =
    args.remainingCents > 0
      ? `Balance remaining: ${fmtMoney(args.remainingCents)}.`
      : `You're all paid up! 🎉`;
  const body = `Hi ${firstName(args.parent_name)}! We received your ${
    args.kind
  } payment of ${fmtMoney(args.amountCents)} for ${who} party at Wonderland Playhouse. ${tail} Thank you! Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] payment receipt failed:', err),
  );
}

export function sendCreatedInvoiceSms(args: {
  parent_name?: string | null;
  phone?: string | null;
  child_name?: string | null;
  kind: 'deposit' | 'full';
  amountCents: number;
  payLink: string | null;
}): void {
  const to = args.phone?.trim();
  if (!to || !args.payLink) return;
  const who = args.child_name ? `${firstName(args.child_name)}'s` : 'your';
  const label = args.kind === 'full' ? 'invoice' : 'deposit invoice';
  const body = `Hi ${firstName(args.parent_name)}! Your ${label} for ${who} party at Wonderland Playhouse (${fmtMoney(
    args.amountCents,
  )}) is ready: ${args.payLink}. Pay to lock in your date. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] created invoice failed:', err),
  );
}

export function sendOpenPlayConfirmationSms(ticket: {
  parent_name?: string | null;
  phone?: string | null;
  date: string;
}): void {
  const to = ticket.phone?.trim();
  if (!to) return;
  const body = `Hi ${firstName(
    ticket.parent_name,
  )}! You're booked for open play at Wonderland Playhouse on ${partyWhen(
    ticket.date,
  )}. Grip socks required (sold at the door). See you soon! Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] open play confirm failed:', err),
  );
}

export function sendMembershipWelcomeSms(args: {
  parent_name?: string | null;
  phone?: string | null;
  child_name?: string | null;
}): void {
  const to = args.phone?.trim();
  if (!to) return;
  const kid = args.child_name ? firstName(args.child_name) : 'your little one';
  const body = `Hi ${firstName(
    args.parent_name,
  )}! Welcome to the Wonderland Pass 🎉 ${kid} now has unlimited open play at Wonderland Playhouse. Manage anytime: https://www.wonderlandplayhouse.com/memberships/manage. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] membership welcome failed:', err),
  );
}

export function sendPlanningCallSms(args: {
  parent_name?: string | null;
  phone?: string | null;
  child_name?: string | null;
}): void {
  const to = args.phone?.trim();
  if (!to) return;
  const who = args.child_name ? `${firstName(args.child_name)}'s` : 'your';
  const body = `Hi ${firstName(
    args.parent_name,
  )}! ${who} party deposit is in and your date is locked 🎉 Want to plan theme, cake & add-ons? Grab a free 30-min call: https://www.wonderlandplayhouse.com/inquire. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] planning call failed:', err),
  );
}

export function sendBalanceUpdatedSms(
  party: PartyLike,
  opts: { changeNote: string; balanceCents: number },
): void {
  const to = party.phone?.trim();
  if (!to || opts.balanceCents < 50) return;
  const who = party.child_name ? `${firstName(party.child_name)}'s` : 'your';
  const body = `Hi ${firstName(
    party.parent_name,
  )}! ${who} party total at Wonderland Playhouse was updated (${
    opts.changeNote
  }). New balance due: ${fmtMoney(
    opts.balanceCents,
  )}. We'll text your pay link before the party. Reply STOP to opt out.`;
  void sendSms({ to, body, sender: 'system' }).catch((err) =>
    console.error('[sms-notify] balance updated failed:', err),
  );
}
