import { Resend } from 'resend';

// Lazy: avoids throwing at module-load time during `next build` page-data
// collection when RESEND_API_KEY isn't present in the build environment.
let _resend: Resend | null = null;
const resend = () => (_resend ??= new Resend(process.env.RESEND_API_KEY!));

const FROM = () => process.env.RESEND_FROM_EMAIL!;
const OWNER = () => process.env.OWNER_NOTIFY_EMAIL!;
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL!;

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

        <p style="line-height: 1.6;"><strong>Before the day:</strong> please have everyone in your group sign the waiver. <a href="${SITE()}/waiver" style="color: #C66B3D;">Sign here</a>.</p>
        <p style="line-height: 1.6;"><strong>Want to plan details?</strong> <a href="${SITE()}/plan-call" style="color: #C66B3D;">Book a 15-minute call</a> any time before the party.</p>

        <hr style="border: none; border-top: 1px solid #1F1B16; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; color: #1F1B16; opacity: 0.6; line-height: 1.6;">
          Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn, NY 11235 · (718) 889-1777<br>
          Refundable up to 14 days before your date. After that, deposits are non-refundable but transferable.
        </p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM(),
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
        <p style="line-height: 1.6; font-size: 14px;">Save time at check-in: <a href="${SITE()}/waiver?code=${ticket.ticket_code}" style="color: #C66B3D;">sign your waiver now</a>.</p>
        <hr style="border: none; border-top: 1px solid #1F1B16; opacity: 0.1; margin: 24px 0;">
        <p style="font-size: 12px; color: #1F1B16; opacity: 0.6;">3830 Nostrand Ave, Brooklyn · (718) 889-1777</p>
      </div>
    </div>
  `;

  return resend().emails.send({
    from: FROM(),
    to: ticket.email,
    subject: `Your open play ticket — ${fmtDate(ticket.date)}`,
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
      <p><a href="${SITE()}/admin/parties/${party.id}">View in admin</a></p>
    </div>
  `;

  return resend().emails.send({ from: FROM(), to: OWNER(), subject, html });
}
