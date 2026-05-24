import { Resend } from 'resend';
import { unsubscribeUrl } from '@/lib/marketing';

let _resend: Resend | null = null;
function resend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL!;
const OWNER = process.env.OWNER_NOTIFY_EMAIL!;
const SITE = process.env.NEXT_PUBLIC_SITE_URL!;

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Customer: party booking confirmed
// ---------------------------------------------------------------------------
export async function sendPartyConfirmation(party: any) {
  const balance = party.total_cents - party.deposit_cents;
  const balanceDueDate = new Date(party.date);
  balanceDueDate.setDate(balanceDueDate.getDate() - 7);

  const html = `
    <div style="font-family: Georgia, serif; max-width: 580px; margin: 0 auto; color: #1F1B16;">
      <div style="background: #C66B3D; color: #FAF6EE; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 28px; line-height: 1.2;">Your date is locked in.</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 16px;">${party.child_name}'s ${party.package} party · ${fmtDate(party.date)}</p>
      </div>
      <div style="background: #FAF6EE; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="margin: 0 0 16px; line-height: 1.6;">Hi ${party.parent_name.split(' ')[0]},</p>
        <p style="line-height: 1.6;">We received your ${fmtMoney(party.deposit_cents)} deposit. The whole space is yours on ${fmtDate(party.date)} at ${party.start_time}.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-family: Helvetica, sans-serif; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #7A5A3F;">Package</td><td style="padding: 8px 0; text-align: right;">${party.package === 'private' ? 'Private' : 'Semi-Private'}</td></tr>
          <tr><td style="padding: 8px 0; color: #7A5A3F;">Total</td><td style="padding: 8px 0; text-align: right;">${fmtMoney(party.total_cents)}</td></tr>
          <tr><td style="padding: 8px 0; color: #7A5A3F;">Deposit paid</td><td style="padding: 8px 0; text-align: right; color: #7C8E5C;">${fmtMoney(party.deposit_cents)} ✓</td></tr>
          <tr><td style="padding: 8px 0; color: #7A5A3F;">Balance due ${fmtDate(balanceDueDate)}</td><td style="padding: 8px 0; text-align: right;"><strong>${fmtMoney(balance)}</strong></td></tr>
        </table>

        <p style="line-height: 1.6;"><strong>Before the day:</strong> sign the waiver once and you&rsquo;re covered for the year. <a href="${SITE}/waiver?email=${encodeURIComponent(party.email)}" style="color: #C66B3D;">Sign here →</a> Share the same link with your guests.</p>
        <p style="line-height: 1.6;"><strong>Want to plan details?</strong> <a href="${SITE}/plan-call" style="color: #C66B3D;">Book a 15-minute call</a> any time before the party.</p>

        <hr style="border: none; border-top: 1px solid #1F1B16; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; color: #1F1B16; opacity: 0.6; line-height: 1.6;">
          Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn, NY 11235 · (718) 889-1777<br>
          Refundable up to 14 days before your date. After that, deposits are non-refundable but transferable.
        </p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `🎉 Your party is booked — ${fmtDate(party.date)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: open play paid
// ---------------------------------------------------------------------------
export async function sendOpenPlayConfirmation(ticket: any) {
  const html = `
    <div style="font-family: Georgia, serif; max-width: 580px; margin: 0 auto; color: #1F1B16;">
      <div style="background: #1F1B16; color: #FAF6EE; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">You're in.</h1>
        <p style="margin: 8px 0 0; opacity: 0.7; font-size: 14px;">Open Play · ${fmtDate(ticket.date)}</p>
      </div>
      <div style="background: #FAF6EE; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${ticket.parent_name.split(' ')[0]} — your open play visit is reserved.</p>
        <div style="background: #F2EAD8; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #7A5A3F;">Show at the door</div>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin-top: 8px;">${ticket.ticket_code.toUpperCase()}</div>
        </div>
        <p style="line-height: 1.6; font-size: 14px;">Arrive any time during open hours. Stay up to 2 hours. Grip socks required (we sell them at the door if you forget).</p>
        <p style="line-height: 1.6; font-size: 14px;">Save time at check-in: <a href="${SITE}/waiver?email=${encodeURIComponent(ticket.email)}" style="color: #C66B3D;">sign your waiver now</a> — once a year covers every visit.</p>
        <hr style="border: none; border-top: 1px solid #1F1B16; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; color: #1F1B16; opacity: 0.6;">3830 Nostrand Ave, Brooklyn · (718) 889-1777</p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM,
    to: ticket.email,
    subject: `Your open play ticket — ${fmtDate(ticket.date)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: 7-day-out reminder (sent by cron)
// ---------------------------------------------------------------------------
export async function sendPartySevenDayReminder(party: any) {
  const balance = party.total_cents - party.deposit_cents;
  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: #ff7783; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 26px;">One week until ${party.child_name}'s party!</h1>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">${fmtDate(party.date)} at ${party.start_time}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${party.parent_name.split(' ')[0]},</p>
        <p style="line-height: 1.6;">Just a heads-up — ${party.child_name}'s ${party.package === 'private' ? 'private' : 'semi-private'} party is exactly one week away.</p>

        ${
          balance > 0
            ? `<p style="line-height: 1.6;"><strong>Balance due:</strong> ${fmtMoney(balance)} — we'll send a payment link a few days before, or you can pay at the playhouse.</p>`
            : ''
        }

        <p style="line-height: 1.6;"><strong>Before the day:</strong></p>
        <ul style="line-height: 1.8;">
          <li>Share the waiver link with your guests: <a href="${SITE}/waiver" style="color: #ff7783;">${SITE}/waiver</a> — they sign once for the whole year</li>
          <li>Confirm your add-ons (decor, food, entertainment) with us if you haven't yet</li>
          <li>Grip socks required for kids and adults — we have them at the door if anyone forgets</li>
        </ul>

        <p style="line-height: 1.6;">Anything we should know? Reply to this email or call (718) 889-1777.</p>

        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; opacity: 0.6;">Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn · (718) 889-1777</p>
      </div>
    </div>
  `;
  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `1 week until ${party.child_name}'s party at Wonderland`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: 24-hour-out reminder (sent by cron)
// ---------------------------------------------------------------------------
export async function sendPartyTwentyFourHourReminder(party: any) {
  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: #ff7783; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 26px;">Tomorrow's the day! 🎉</h1>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">${fmtDate(party.date)} at ${party.start_time}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${party.parent_name.split(' ')[0]},</p>
        <p style="line-height: 1.6;">We're set for ${party.child_name}'s party tomorrow. Quick reminders:</p>

        <ul style="line-height: 1.8;">
          <li><strong>Time:</strong> ${party.start_time}</li>
          <li><strong>Headcount:</strong> ${party.headcount} kids</li>
          <li><strong>Address:</strong> 3830 Nostrand Ave, Brooklyn — free street parking</li>
          <li><strong>Grip socks required</strong> — we sell them at the door if you forget</li>
          <li><strong>Arrive ~10 min early</strong> so we can get you set up</li>
        </ul>

        <p style="line-height: 1.6;">If guests haven't signed the waiver yet, share the link: <a href="${SITE}/waiver" style="color: #ff7783;">${SITE}/waiver</a></p>

        <p style="line-height: 1.6;">See you tomorrow!</p>

        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; opacity: 0.6;">Wonderland Playhouse · (718) 889-1777</p>
      </div>
    </div>
  `;
  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `🎉 Tomorrow's ${party.child_name}'s party — quick reminders`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Gift card recipient: you just got gifted a card
// ---------------------------------------------------------------------------
export async function sendGiftCardToRecipient(card: {
  code: string;
  amount_cents: number;
  recipient_name: string;
  recipient_email: string;
  purchaser_name: string;
  message: string | null;
}) {
  const firstName = card.recipient_name.split(' ')[0];
  const fromName = card.purchaser_name.split(' ')[0];

  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: linear-gradient(135deg, #ff7783 0%, #fdda26 100%); color: white; padding: 40px 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <p style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.95;">A gift for you</p>
        <h1 style="margin: 12px 0 0; font-size: 34px; line-height: 1.1;">${fmtMoney(card.amount_cents)} to Wonderland Playhouse</h1>
        <p style="margin: 12px 0 0; opacity: 0.95; font-size: 15px;">From ${card.purchaser_name}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${firstName},</p>
        <p style="line-height: 1.6;">${fromName} sent you a gift card for Wonderland Playhouse — a magical, low-stim play space in Brooklyn for kids 0–8. Use it for open play visits, a birthday party deposit, or anything else on the menu.</p>

        ${
          card.message
            ? `<div style="background: #FFF4F5; border-left: 4px solid #ff7783; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                 <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #ff7783; font-weight: bold;">A note from ${fromName}</p>
                 <p style="margin: 0; font-style: italic; line-height: 1.6;">${escapeHtml(card.message)}</p>
               </div>`
            : ''
        }

        <div style="background: #2C4253; color: white; padding: 28px 20px; border-radius: 16px; text-align: center; margin: 28px 0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7;">Your gift card code</div>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 3px; margin-top: 12px; font-family: 'Courier New', monospace;">${card.code}</div>
          <div style="font-size: 13px; margin-top: 12px; opacity: 0.7;">Balance: ${fmtMoney(card.amount_cents)}</div>
        </div>

        <p style="line-height: 1.6;"><strong>How to use it:</strong></p>
        <ul style="line-height: 1.8;">
          <li>Book a <a href="${SITE}/parties" style="color: #ff7783;">birthday party</a> or an <a href="${SITE}/book/open-play" style="color: #ff7783;">open play visit</a></li>
          <li>Enter the code at checkout — the balance comes off your total</li>
          <li>Partial balances stick around for next time. No expiration.</li>
        </ul>

        <p style="line-height: 1.6; margin-top: 28px;">Questions? Just reply to this email or call (718) 889-1777.</p>

        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 28px 0;">
        <p style="font-size: 12px; opacity: 0.6;">Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn · (718) 889-1777</p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM,
    to: card.recipient_email,
    subject: `🎁 ${card.purchaser_name} sent you a Wonderland Playhouse gift card`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Gift card purchaser: payment receipt confirmation
// ---------------------------------------------------------------------------
export async function sendGiftCardPurchaserReceipt(card: {
  code: string;
  amount_cents: number;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
}) {
  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: #2C4253; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Gift card sent ✓</h1>
        <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${fmtMoney(card.amount_cents)} to ${card.recipient_name}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${card.purchaser_name.split(' ')[0]},</p>
        <p style="line-height: 1.6;">Your ${fmtMoney(card.amount_cents)} gift card was sent to <strong>${card.recipient_name}</strong> at ${card.recipient_email}.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #7A8A9A;">Amount</td><td style="padding: 8px 0; text-align: right;">${fmtMoney(card.amount_cents)}</td></tr>
          <tr><td style="padding: 8px 0; color: #7A8A9A;">Code</td><td style="padding: 8px 0; text-align: right; font-family: monospace;">${card.code}</td></tr>
          <tr><td style="padding: 8px 0; color: #7A8A9A;">Sent to</td><td style="padding: 8px 0; text-align: right;">${card.recipient_email}</td></tr>
        </table>

        <p style="line-height: 1.6; font-size: 14px;">Keep this email — if the recipient loses their code, we can look it up from this receipt.</p>

        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; opacity: 0.6;">Wonderland Playhouse · (718) 889-1777</p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM,
    to: card.purchaser_email,
    subject: `Receipt: ${fmtMoney(card.amount_cents)} gift card to ${card.recipient_name}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Customer: planning call invite (sent from admin after deposit)
// ---------------------------------------------------------------------------
export async function sendPartyPlanningCallInvite(party: {
  parent_name: string;
  email: string;
  child_name: string | null;
  date: string;
}) {
  const firstName = party.parent_name.split(' ')[0];
  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: #ff7783; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 26px;">Let's plan the details.</h1>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${party.child_name ?? 'Your'} party · ${fmtDate(party.date)}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${firstName},</p>
        <p style="line-height: 1.6;">Your deposit is in and the date is locked. Now the fun part — let's lock in the theme, cake, food, entertainment, and any other add-ons.</p>
        <p style="line-height: 1.6;">Grab a 30-minute slot that works for you:</p>
        <p style="margin: 24px 0;">
          <a href="${SITE}/inquire" style="background: #ff7783; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold;">
            Schedule planning call →
          </a>
        </p>
        <p style="line-height: 1.6; font-size: 14px; color: #6B7C8E;">Prefer to chat by text? Reply to this email or call (718) 889-1777.</p>
        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; opacity: 0.6;">Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn · (718) 889-1777</p>
      </div>
    </div>
  `;
  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `Let's plan ${party.child_name ?? 'the'} party — schedule a quick call`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: balance invoice ready (admin sends from /admin/parties/[id])
// ---------------------------------------------------------------------------
export async function sendBalanceInvoiceReady(args: {
  parent_name: string;
  email: string;
  child_name: string | null;
  date: string;
  balance_cents: number;
  hosted_invoice_url: string;
  add_ons: Array<{ name: string; qty: number; unit_price_cents: number }>;
}) {
  const firstName = args.parent_name.split(' ')[0];
  const addOnsHtml = args.add_ons.length
    ? `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr><th colspan="2" style="text-align: left; padding: 8px 0; border-bottom: 1px solid #E5E5E5; color: #7A8A9A; font-weight: bold;">Add-ons</th></tr>
          ${args.add_ons
            .map(
              (a) => `
                <tr>
                  <td style="padding: 6px 0; color: #2C4253;">${a.name}${a.qty > 1 ? ` × ${a.qty}` : ''}</td>
                  <td style="padding: 6px 0; text-align: right; color: #2C4253;">${fmtMoney(a.unit_price_cents * a.qty)}</td>
                </tr>`,
            )
            .join('')}
        </table>`
    : '';

  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: #50758f; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Your party balance is ready.</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">${args.child_name ?? 'Birthday'} party · ${fmtDate(args.date)}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${firstName},</p>
        <p style="line-height: 1.6;">Here's the final invoice with everything we&rsquo;ve put together for the party. The deposit is already credited.</p>
        ${addOnsHtml}
        <div style="background: #FFF4F5; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #ff7783; font-weight: bold;">Balance due</div>
          <div style="font-size: 36px; font-weight: bold; color: #2C4253; margin-top: 8px;">${fmtMoney(args.balance_cents)}</div>
        </div>
        <p style="margin: 24px 0;">
          <a href="${args.hosted_invoice_url}" style="background: #ff7783; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold;">
            View &amp; pay invoice →
          </a>
        </p>
        <p style="line-height: 1.6; font-size: 14px;">Pay securely via Stripe. Card or bank transfer. Due 7 days before the party — pay any time before that.</p>
        <p style="line-height: 1.6; font-size: 14px;">Questions? Reply to this email or call (718) 889-1777.</p>
        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; opacity: 0.6;">Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn · (718) 889-1777</p>
      </div>
    </div>
  `;
  return resend().emails.send({
    from: FROM,
    to: args.email,
    subject: `Your party balance is ready — ${fmtMoney(args.balance_cents)} due`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Birthday reminder — 12, 8, or 4 weeks out
// ---------------------------------------------------------------------------
type BirthdayTouchpoint = '12w' | '8w' | '4w';

const TOUCHPOINT_COPY: Record<
  BirthdayTouchpoint,
  { subject: (name: string, age: number) => string; heading: string; body: (firstName: string, childName: string, age: number, dateStr: string) => string; urgency: string }
> = {
  '12w': {
    subject: (n, a) => `${n} turns ${a} soon — let's start planning`,
    heading: '12 weeks out · plenty of options',
    body: (first, child, age, date) =>
      `Hi ${first} — just a heads-up that ${child}'s ${ordinal(age)} birthday is coming up on ${date}. The best dates (weekends, especially Saturday afternoons) tend to book about 6–8 weeks out. If you're thinking about a private party at the Playhouse, this is the easy time to lock in your first-choice date.`,
    urgency: 'Plenty of weekends still open this far out.',
  },
  '8w': {
    subject: (n, a) => `8 weeks until ${n}'s ${ordinal(a)} — popular dates filling up`,
    heading: '8 weeks out · time to lock it in',
    body: (first, child, age, date) =>
      `Hi ${first} — ${child}'s ${ordinal(age)} birthday is 8 weeks out (${date}). Saturday afternoons are usually gone by this point, but Sundays and Mon–Thu afternoons (Mon–Thu private parties are 20% off) are still open.`,
    urgency: 'Most Saturdays are taken at this point. Sundays and Mon–Thu still good.',
  },
  '4w': {
    subject: (n, a) => `4 weeks until ${n}'s birthday — last-call planning`,
    heading: '4 weeks out · let\'s make it happen',
    body: (first, child, age, date) =>
      `Hi ${first} — ${child}'s ${ordinal(age)} is in 4 weeks (${date}). Most prime slots are spoken for, but we usually have a few weekday afternoons or evening private slots left. If a venue party isn't in the cards this year, we'd love to host ${child} for an open play visit on the day.`,
    urgency: 'Weekend slots are basically gone. Weekday afternoons + evenings still good.',
  },
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export async function sendBirthdayReminder(args: {
  touchpoint: BirthdayTouchpoint;
  parent_name: string;
  parent_email: string;
  child_name: string;
  turning_age: number;
  birthday_date: string; // YYYY-MM-DD
}) {
  const tp = TOUCHPOINT_COPY[args.touchpoint];
  const firstName = args.parent_name.split(' ')[0] || args.parent_name;
  const niceDate = new Date(args.birthday_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const unsub = unsubscribeUrl(SITE, args.parent_email, 'birthday_reminders');

  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: linear-gradient(135deg, #ff7783 0%, #fdda26 100%); color: white; padding: 32px 24px; border-radius: 16px 16px 0 0;">
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.95;">${tp.heading}</p>
        <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.15;">${args.child_name}'s ${ordinal(args.turning_age)} birthday</h1>
        <p style="margin: 6px 0 0; opacity: 0.95; font-size: 15px;">${niceDate}</p>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">${tp.body(firstName, args.child_name, args.turning_age, niceDate)}</p>
        <p style="line-height: 1.6; font-size: 14px; color: #6B7C8E;">${tp.urgency}</p>
        <p style="margin: 28px 0;">
          <a href="${SITE}/parties" style="background: #ff7783; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold;">
            See party packages →
          </a>
        </p>
        <p style="line-height: 1.6; font-size: 14px;">Prefer to talk it through? <a href="${SITE}/inquire" style="color: #ff7783;">Book a 20-min call</a>.</p>
        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 28px 0;">
        <p style="font-size: 11px; color: #2C4253; opacity: 0.55; line-height: 1.6;">
          Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn · (718) 889-1777<br>
          You're getting this because you booked or signed up with us. <a href="${unsub}" style="color: #2C4253; opacity: 0.7;">Unsubscribe from birthday reminders</a>.
        </p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM,
    to: args.parent_email,
    subject: tp.subject(args.child_name, args.turning_age),
    html,
  });
}

// ---------------------------------------------------------------------------
// Generic marketing campaign send (newsletter, promo blast, special event)
// ---------------------------------------------------------------------------
export async function sendMarketingCampaign(args: {
  to: string;
  to_name: string;
  subject: string;
  body_text: string; // raw text from admin; we wrap in branded layout
  cta_label?: string;
  cta_href?: string;
}) {
  const unsub = unsubscribeUrl(SITE, args.to, 'promotions');
  const firstName = args.to_name.split(' ')[0] || args.to_name;
  const paragraphs = args.body_text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="line-height: 1.65; margin: 0 0 16px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const html = `
    <div style="font-family: Nunito, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; color: #2C4253;">
      <div style="background: #ff7783; color: white; padding: 28px 24px; border-radius: 16px 16px 0 0;">
        <h1 style="margin: 0; font-size: 26px; line-height: 1.15;">${escapeHtml(args.subject)}</h1>
      </div>
      <div style="background: #FFFBF5; padding: 32px 24px; border-radius: 0 0 16px 16px;">
        <p style="line-height: 1.6;">Hi ${escapeHtml(firstName)},</p>
        ${paragraphs}
        ${
          args.cta_label && args.cta_href
            ? `<p style="margin: 24px 0;">
                 <a href="${args.cta_href}" style="background: #ff7783; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold;">
                   ${escapeHtml(args.cta_label)} →
                 </a>
               </p>`
            : ''
        }
        <hr style="border: none; border-top: 1px solid #2C4253; opacity: 0.1; margin: 28px 0;">
        <p style="font-size: 11px; color: #2C4253; opacity: 0.55; line-height: 1.6;">
          Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn · (718) 889-1777<br>
          You're on this list because you booked or signed up with us. <a href="${unsub}" style="color: #2C4253; opacity: 0.7;">Unsubscribe</a>.
        </p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM,
    to: args.to,
    subject: args.subject,
    html,
  });
}

// ---------------------------------------------------------------------------
// Owner: someone just paid you
// ---------------------------------------------------------------------------
export async function sendOwnerNotification({ subject, party }: { subject: string; party: any }) {
  const html = `
    <div style="font-family: Helvetica, sans-serif; font-size: 14px;">
      <h2 style="margin-top: 0;">${subject}</h2>
      <ul style="line-height: 1.8;">
        <li><strong>Date:</strong> ${fmtDate(party.date)} at ${party.start_time}</li>
        <li><strong>Package:</strong> ${party.package} · ${fmtMoney(party.total_cents)} total</li>
        <li><strong>Deposit paid:</strong> ${fmtMoney(party.deposit_cents)}</li>
        <li><strong>Balance due:</strong> ${fmtMoney(party.total_cents - party.deposit_cents)}</li>
        <li><strong>Birthday child:</strong> ${party.child_name}, age ${party.child_age}</li>
        <li><strong>Headcount:</strong> ${party.headcount} kids</li>
        <li><strong>Parent:</strong> ${party.parent_name} · ${party.email} · ${party.phone}</li>
        ${party.weekday_discount_applied ? `<li><strong>Weekday discount:</strong> applied (-${fmtMoney(party.discount_cents)})</li>` : ''}
        ${party.notes ? `<li><strong>Notes:</strong> ${party.notes}</li>` : ''}
      </ul>
      <p><a href="${SITE}/admin/parties/${party.id}">View in admin</a></p>
    </div>
  `;

  return resend().emails.send({ from: FROM, to: OWNER, subject, html });
}
