import twilio, { type Twilio } from 'twilio';

// Lazy: avoids throwing at module-load time during `next build` page-data
// collection when the Twilio credentials aren't present in the build
// environment. Mirrors the pattern in lib/email.ts and lib/stripe.ts.
let _client: Twilio | null = null;
const client = () =>
  (_client ??= twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!));

const FROM = () => process.env.TWILIO_FROM_NUMBER!;
const OWNER = () => process.env.OWNER_NOTIFY_PHONE!;

// SMS is best-effort: if Twilio isn't configured (e.g. a preview deploy with no
// secrets) we no-op instead of throwing, so a missing text never fails a
// booking webhook. Callers already wrap us in Promise.allSettled, but this
// keeps the failure quiet and intentional.
function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

async function send(to: string | undefined | null, body: string) {
  if (!isConfigured() || !to) return null;
  return client().messages.create({ from: FROM(), to, body });
}

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Customer: party booking confirmed
// ---------------------------------------------------------------------------
export async function sendPartyConfirmationSMS(party: any) {
  const firstName = party.parent_name?.split(' ')[0] ?? 'there';
  const body =
    `Wonderland Playhouse: Hi ${firstName}! ${party.child_name}'s ${party.package} party is locked in for ` +
    `${fmtDate(party.date)} at ${party.start_time}. Deposit of ${fmtMoney(party.deposit_cents)} received — ` +
    `check your email for the full confirmation. See you soon! 🎉`;
  return send(party.phone, body);
}

// ---------------------------------------------------------------------------
// Customer: open play reserved/paid
// ---------------------------------------------------------------------------
export async function sendOpenPlayConfirmationSMS(ticket: any) {
  const firstName = ticket.parent_name?.split(' ')[0] ?? 'there';
  const body =
    `Wonderland Playhouse: Hi ${firstName}! Your Open Play visit on ${fmtDate(ticket.date)} is reserved. ` +
    `Show code ${String(ticket.ticket_code).toUpperCase()} at the door. Grip socks required.`;
  return send(ticket.phone, body);
}

// ---------------------------------------------------------------------------
// Owner: someone just paid you
// ---------------------------------------------------------------------------
export async function sendOwnerSMS(message: string) {
  return send(OWNER(), message);
}

export async function notifyOwnerNewParty(party: any) {
  const body =
    `New party booked: ${party.child_name}'s ${party.package} party on ${fmtDate(party.date)} at ` +
    `${party.start_time}. ${fmtMoney(party.deposit_cents)} deposit in, ${fmtMoney(party.total_cents - party.deposit_cents)} balance due. ` +
    `${party.parent_name} · ${party.phone}`;
  return sendOwnerSMS(body);
}
