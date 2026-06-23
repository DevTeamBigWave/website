import { Resend } from 'resend';
import { unsubscribeUrl } from '@/lib/marketing';
import { getInvoiceTheme } from '@/lib/invoice-themes';
import { computePartyFinancials } from '@/lib/parties';
import { partyPortionLines, type PackageId } from '@/lib/pricing';

// Itemized party-portion rows (base + extra kids etc.) for the kvp money
// tables, formatted like the other money rows. Negative lines (Mon–Thu
// discount) render in coral with a leading minus.
function partyMoneyRows(party: any, partyPreTaxCents: number): Array<[string, string]> {
  const lines = partyPortionLines({
    packageId: party.package as PackageId,
    date: new Date(`${party.date}T${party.start_time ?? '12:00:00'}`),
    time: party.start_time ?? '12:00',
    extensionMinutes: party.extension_minutes ?? 0,
    headcount: party.headcount ?? null,
    storedSubtotalCents: partyPreTaxCents,
  });
  return lines.map((l) => [
    l.label,
    l.cents < 0
      ? `<span style="color:#ff7783;">−${fmtMoney(-l.cents)}</span>`
      : fmtMoney(l.cents),
  ]);
}

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
// Customer-facing emails that the owner has no other visibility into
// (cron reminders, planning call invite, open play receipts, etc) BCC the
// owner so Gaby gets a copy in her inbox. Emails that already trigger a
// separate sendOwnerNotification call skip the BCC to avoid two-of-everything.
const BCC_OWNER = OWNER;
const SITE = process.env.NEXT_PUBLIC_SITE_URL!;

// Balance for any party (deposit-only / custom / Groupon-with-add-ons) is
// due 3 calendar days before the party. Anything that quotes the deadline
// to the customer uses this single helper so the language never drifts.
export const BALANCE_DUE_DAYS_BEFORE = 3;
export function balanceDueDateFor(partyDate: string | Date): Date {
  const d = new Date(partyDate);
  d.setDate(d.getDate() - BALANCE_DUE_DAYS_BEFORE);
  return d;
}

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Branded shell for all customer-facing emails. Inline CSS only (Gmail strips
// <style> blocks). Renders:
//   - logo header on cream
//   - coral accent strip
//   - colored hero band with title/subtitle
//   - body content
//   - signature footer with social + address + optional unsubscribe
// ---------------------------------------------------------------------------
type BrandedOpts = {
  title: string;
  subtitle?: string;
  heroBg?: string;       // any CSS color/gradient
  heroEyebrow?: string;  // small uppercase label above title
  heroPrefixHtml?: string; // optional raw HTML rendered at top of hero (e.g. themed emoji)
  unsubscribeUrl?: string;
};

function brandedShell(opts: BrandedOpts, bodyHtml: string): string {
  const hero = opts.heroBg ?? 'linear-gradient(135deg, #ff7783 0%, #fdda26 100%)';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0; padding:0; background:#FFFBF5; font-family: 'Nunito', Helvetica, Arial, sans-serif; color:#2C4253;">
  <div style="max-width:600px; margin:0 auto; padding:24px 16px;">

    <!-- Logo header -->
    <div style="text-align:center; padding:8px 0 16px;">
      <a href="${SITE}" style="text-decoration:none;">
        <img src="${SITE}/logo.jpg" alt="Wonderland Playhouse" width="120" height="auto" style="display:inline-block; max-width:120px; height:auto; mix-blend-mode:multiply;">
      </a>
    </div>

    <!-- Hero -->
    <div style="background:${hero}; color:white; padding:36px 28px; border-radius:20px 20px 0 0;">
      ${opts.heroPrefixHtml ?? ''}
      ${opts.heroEyebrow ? `<p style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:2.5px; opacity:0.92; font-weight:700;">${escapeHtml(opts.heroEyebrow)}</p>` : ''}
      <h1 style="margin:0; font-size:28px; line-height:1.2; font-weight:800;">${escapeHtml(opts.title)}</h1>
      ${opts.subtitle ? `<p style="margin:10px 0 0; opacity:0.95; font-size:15px; line-height:1.4;">${opts.subtitle}</p>` : ''}
    </div>

    <!-- Body -->
    <div style="background:#FFFBF5; padding:32px 28px; border-radius:0 0 20px 20px; box-shadow:0 4px 24px rgba(44,66,83,0.08);">
      ${bodyHtml}
    </div>

    <!-- Footer -->
    <div style="text-align:center; padding:28px 16px 12px;">
      <p style="margin:0; font-size:13px; font-weight:700; color:#2C4253;">
        <a href="${SITE}" style="color:#ff7783; text-decoration:none;">Wonderland Playhouse</a>
      </p>
      <p style="margin:6px 0 0; font-size:12px; color:#6B7C8E; line-height:1.6;">
        3830 Nostrand Ave, Brooklyn NY 11235<br>
        <a href="tel:+17188891777" style="color:#6B7C8E; text-decoration:none;">(718) 889-1777</a>
        &nbsp;·&nbsp;
        <a href="mailto:info@wonderlandplayhouse.com" style="color:#6B7C8E; text-decoration:none;">info@wonderlandplayhouse.com</a>
      </p>
      <p style="margin:10px 0 0;">
        <a href="https://www.instagram.com/wonderlandplayhouseny" style="display:inline-block; color:#ff7783; text-decoration:none; font-size:12px; font-weight:600;">
          @wonderlandplayhouseny ↗
        </a>
      </p>
      ${opts.unsubscribeUrl ? `<p style="margin:14px 0 0; font-size:11px; color:#94A3B8;"><a href="${opts.unsubscribeUrl}" style="color:#94A3B8;">Unsubscribe</a></p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Pretty kvp table for body content
function kvpTable(rows: Array<[label: string, value: string]>): string {
  return `
    <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px;">
      ${rows
        .map(
          ([k, v], i, arr) => `
        <tr>
          <td style="padding:10px 0; color:#6B7C8E; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${escapeHtml(k)}</td>
          <td style="padding:10px 0; text-align:right; color:#2C4253; font-weight:600; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${v}</td>
        </tr>`,
        )
        .join('')}
    </table>
  `;
}

function ctaButton(label: string, href: string): string {
  return `
    <p style="margin:24px 0; text-align:center;">
      <a href="${href}" style="display:inline-block; background:#ff7783; color:white; padding:14px 32px; border-radius:999px; text-decoration:none; font-weight:800; font-size:15px; box-shadow:0 4px 12px rgba(255,119,131,0.35);">
        ${escapeHtml(label)} →
      </a>
    </p>
  `;
}

// ---------------------------------------------------------------------------
// Customer: party booking confirmed
// ---------------------------------------------------------------------------
type AddOnLite = { name: string; unit_price_cents: number; qty: number; notes?: string | null };

export async function sendPartyConfirmation(party: any, addOns: AddOnLite[] = []) {
  const balanceDueDate = balanceDueDateFor(party.date);
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  // Promo-code path: no deposit was actually paid; show the full total as
  // owed and skip the "deposit paid ✓" language entirely.
  const depositPaid = !!party.deposit_paid_at;
  const fin = computePartyFinancials(party);

  const intro = depositPaid
    ? `We got your <strong>${fmtMoney(party.deposit_cents)}</strong> deposit. ${escapeHtml(party.child_name ?? "Your child")}'s ${party.package === 'private' ? 'private' : 'semi-private'} party on <strong>${fmtDate(party.date)}</strong> at <strong>${party.start_time}</strong> is officially booked. 🎉`
    : `Your date is locked in via promo code — ${escapeHtml(party.child_name ?? "your child")}'s ${party.package === 'private' ? 'private' : 'semi-private'} party on <strong>${fmtDate(party.date)}</strong> at <strong>${party.start_time}</strong>. 🎉 We'll send your invoice separately — no card was charged today.`;

  // Itemize add-ons inline so the customer sees what they signed up for —
  // mirrors the calendar event description structure.
  const addOnsHtml = addOns.length
    ? `
        <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px;">
          <tr><th colspan="2" style="text-align:left; padding:10px 0; border-bottom:1px solid #EDE7DC; color:#6B7C8E; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:1.5px;">Add-ons</th></tr>
          ${addOns
            .map(
              (a, i, arr) => `
                <tr>
                  <td style="padding:10px 0; color:#2C4253; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${escapeHtml(a.name)}${a.qty > 1 ? ` × ${a.qty}` : ''}</td>
                  <td style="padding:10px 0; text-align:right; color:#2C4253; font-weight:600; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${fmtMoney(a.unit_price_cents * a.qty)}</td>
                </tr>`,
            )
            .join('')}
        </table>`
    : '';

  // Money rows — grand total + balance always reflect computePartyFinancials
  // (party_total + add_ons − friends-&-family discount). Same math the admin
  // page + Stripe invoice use.
  const moneyRows: Array<[string, string]> = [];
  moneyRows.push(['Package', party.package === 'private' ? 'Private' : 'Semi-Private']);
  for (const row of partyMoneyRows(party, fin.party_pre_tax_cents)) moneyRows.push(row);
  if (fin.add_ons_total_cents > 0) {
    moneyRows.push(['Add-ons', fmtMoney(fin.add_ons_total_cents)]);
  }
  if (fin.manual_discount_cents > 0) {
    moneyRows.push([
      fin.manual_discount_percent > 0
        ? `${fin.manual_discount_label} (${fin.manual_discount_percent}% off)`
        : fin.manual_discount_label,
      `<span style="color:#ff7783;">−${fmtMoney(fin.manual_discount_cents)}</span>`,
    ]);
  }
  moneyRows.push(['NYC tax (8.875%)', fmtMoney(fin.tax_cents)]);
  moneyRows.push(['Grand total', `<strong>${fmtMoney(fin.grand_total_cents)}</strong>`]);
  if (depositPaid) {
    moneyRows.push(['Deposit paid', `<span style="color:#7C8E5C;">−${fmtMoney(fin.deposit_paid_cents)} ✓</span>`]);
    if (fin.balance_paid_cents > 0) {
      moneyRows.push(['Balance paid', `<span style="color:#7C8E5C;">−${fmtMoney(fin.balance_paid_cents)} ✓</span>`]);
    }
    moneyRows.push([
      `Balance due ${fmtDate(balanceDueDate)}`,
      `<strong>${fmtMoney(fin.balance_due_cents)}</strong>`,
    ]);
  } else {
    moneyRows.push([
      'Balance owed',
      `<strong style="color:#ff7783;">${fmtMoney(fin.balance_due_cents)}</strong> · invoice coming separately`,
    ]);
  }

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">${intro}</p>
    ${addOnsHtml}
    ${kvpTable(moneyRows)}

    <div style="background:#FFF4F5; border-radius:12px; padding:18px 20px; margin:20px 0;">
      <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">Before the day</p>
      <p style="margin:0; line-height:1.65;">Sign the waiver once — it covers you for the year. Share the link with your guests too.</p>
    </div>

    ${ctaButton('Sign the waiver', `${SITE}/waiver?email=${encodeURIComponent(party.email)}`)}

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">Want to plan details? We'll reach out to schedule your planning call. Or reply to this email anytime.</p>
    <p style="margin:12px 0 0; line-height:1.55; font-size:12px; color:#94A3B8;">Deposits are non-refundable. The date may be rescheduled — just reach out and we'll find a new slot that works.</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: depositPaid ? 'Booked ✓' : 'Date held · promo applied',
      title: 'Your date is locked in.',
      subtitle: `${escapeHtml(party.child_name ?? "Your child")}'s ${party.package === 'private' ? 'private' : 'semi-private'} party · ${fmtDate(party.date)}`,
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `🎉 Your party is booked — ${fmtDate(party.date)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: party rescheduled (admin moved the date or time)
// ---------------------------------------------------------------------------
export async function sendPartyRescheduled(args: {
  party: any;
  oldDate: string;
  oldStartTime: string;
  reason?: string;
  pricingNote?: string;
}) {
  const { party, oldDate, oldStartTime, reason, pricingNote } = args;
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const child = party.child_name ?? 'your child';
  const niceTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const display = ((h + 11) % 12) + 1;
    return `${display}:${String(m).padStart(2, '0')} ${period}`;
  };

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">${escapeHtml(child)}'s party has been rescheduled. Here are the new details — your calendar invite will update automatically too.</p>

    <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px; background:#FFF4F5; border-radius:14px; overflow:hidden;">
      <tr>
        <td style="padding:14px 18px; color:#94A3B8; vertical-align:top;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#94A3B8;">Was</div>
          <div style="margin-top:2px; text-decoration:line-through;">${fmtDate(oldDate)}</div>
          <div style="font-size:13px; text-decoration:line-through;">${niceTime(oldStartTime)}</div>
        </td>
        <td style="padding:14px 18px; color:#2C4253; text-align:right; vertical-align:top;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">Now</div>
          <div style="margin-top:2px; font-weight:700;">${fmtDate(party.date)}</div>
          <div style="font-size:13px;">${niceTime(party.start_time)}</div>
        </td>
      </tr>
    </table>

    ${reason ? `<div style="background:#FFFBF5; border-left:3px solid #fdda26; padding:14px 18px; margin:20px 0; font-size:14px; line-height:1.6; color:#2C4253;"><strong style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#6B7C8E; margin-bottom:4px;">Note from us</strong>${escapeHtml(reason)}</div>` : ''}

    ${pricingNote ? `<div style="background:#FFF4F5; border-left:3px solid #ff7783; padding:14px 18px; margin:20px 0; font-size:14px; line-height:1.6; color:#2C4253;"><strong style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; margin-bottom:4px;">Pricing change</strong>${escapeHtml(pricingNote)}</div>` : ''}

    <p style="margin:0 0 16px; line-height:1.65;">
      Your <strong>${party.package === 'private' ? 'Private' : 'Semi-Private'}</strong> party, headcount, add-ons, and waiver — everything else stays the same.${pricingNote ? '' : ` <strong>Nothing was charged or refunded</strong> — your balance and paid status carry over to the new date.`}
    </p>

    <p style="margin:16px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">If this new date doesn't work either, just reply to this email or call <a href="tel:+17188891777" style="color:#6B7C8E;">(718) 889-1777</a> — we'll find something that does.</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'Rescheduled',
      title: 'Your party has a new date.',
      subtitle: `${fmtDate(oldDate)} → ${fmtDate(party.date)}`,
      heroBg: 'linear-gradient(135deg, #fdba74 0%, #ff7783 100%)',
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `↻ ${child}'s party moved to ${fmtDate(party.date)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: party total changed after the deposit was already paid (Gaby
// added or removed an add-on, applied or cleared a F&F discount, etc).
// Sends the new grand total + balance owed so the customer isn't surprised
// later. We deliberately don't include a Stripe payment link — Gaby is
// usually still editing; a fresh balance invoice will follow when she's
// done.
// ---------------------------------------------------------------------------
export async function sendPartyBalanceUpdated(args: {
  party: any;
  changeNote: string; // e.g. "We added a custom cake (+$250)" or "F&F discount applied"
}) {
  const { party, changeNote } = args;
  const fin = computePartyFinancials(party);
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;

  const moneyRows: Array<[string, string]> = [
    ...partyMoneyRows(party, fin.party_pre_tax_cents),
  ];
  if (fin.add_ons_total_cents > 0) {
    moneyRows.push(['Add-ons', fmtMoney(fin.add_ons_total_cents)]);
  }
  if (fin.manual_discount_cents > 0) {
    moneyRows.push([
      fin.manual_discount_percent > 0
        ? `${fin.manual_discount_label} (${fin.manual_discount_percent}% off)`
        : fin.manual_discount_label,
      `<span style="color:#ff7783;">−${fmtMoney(fin.manual_discount_cents)}</span>`,
    ]);
  }
  moneyRows.push(['NYC tax (8.875%)', fmtMoney(fin.tax_cents)]);
  moneyRows.push(['Grand total', `<strong>${fmtMoney(fin.grand_total_cents)}</strong>`]);
  if (fin.deposit_paid_cents > 0) {
    moneyRows.push(['Deposit paid', `<span style="color:#7C8E5C;">−${fmtMoney(fin.deposit_paid_cents)} ✓</span>`]);
  }
  if (fin.balance_paid_cents > 0) {
    moneyRows.push(['Balance paid', `<span style="color:#7C8E5C;">−${fmtMoney(fin.balance_paid_cents)} ✓</span>`]);
  }
  if (fin.gift_card_applied_cents > 0) {
    moneyRows.push(['Gift card applied', `<span style="color:#7C8E5C;">−${fmtMoney(fin.gift_card_applied_cents)} 🎁</span>`]);
  }
  moneyRows.push([
    'Balance due',
    `<strong>${fmtMoney(fin.balance_due_cents)}</strong>`,
  ]);

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">A quick update on ${escapeHtml(party.child_name ?? 'your party')} on ${fmtDate(party.date)} — ${escapeHtml(changeNote)}. Here are the new totals:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; margin:18px 0;">
      ${moneyRows
        .map(
          ([k, v], i) => `
        <tr>
          <td style="padding:8px 0; border-top:${i === 0 ? '0' : '1px solid #F0EDE9'}; color:#3D4659;">${escapeHtml(k)}</td>
          <td style="padding:8px 0; border-top:${i === 0 ? '0' : '1px solid #F0EDE9'}; text-align:right; color:#3D4659;">${v}</td>
        </tr>`,
        )
        .join('')}
    </table>

    ${
      fin.balance_due_cents > 0
        ? `<p style="margin:0 0 16px; line-height:1.65; color:#3D4659;">We'll send the updated invoice in a separate email when everything's set. No action needed right now.</p>`
        : `<p style="margin:0 0 16px; line-height:1.65; color:#3D4659;">You're paid in full — no balance owed. We're set!</p>`
    }

    <p style="margin:0 0 16px; line-height:1.65;">Questions? Just reply to this email or text the playhouse at (718) 889-1777.</p>
    <p style="margin:0; line-height:1.65;">— Wonderland Playhouse</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'Balance updated',
      title: 'Quick update on your party.',
      subtitle: `${escapeHtml(party.child_name ?? 'Your child')}'s ${party.package === 'private' ? 'private' : 'semi-private'} party · ${fmtDate(party.date)}`,
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `Updated total for ${escapeHtml(party.child_name ?? 'your')} party — ${fmtMoney(fin.grand_total_cents)}`,
    html,
  });
}

// Customer: party cancelled (admin cancelled or hold expired without payment).
// ---------------------------------------------------------------------------
export async function sendPartyCancelled(args: {
  party: any;
  reason?: string;
}) {
  const { party, reason } = args;
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">${escapeHtml(party.child_name ?? "Your child")}'s ${party.package === 'private' ? 'private' : 'semi-private'} party on ${fmtDate(party.date)} has been cancelled${reason ? ` — ${escapeHtml(reason)}` : ''}.</p>

    ${
      party.deposit_paid_at
        ? `<p style="margin:0 0 16px; line-height:1.65;">If you paid a deposit, Gaby (the playhouse owner) will be in touch about refund or transfer. Otherwise, nothing else for you to do.</p>`
        : `<p style="margin:0 0 16px; line-height:1.65;">No deposit was collected, so there's nothing to refund. The date has been released and is open for other bookings.</p>`
    }

    <p style="margin:0 0 16px; line-height:1.65;">If you'd like to rebook for a different date, our calendar is at <a href="https://www.wonderlandplayhouse.com/book" style="color:#ff7783;">wonderlandplayhouse.com/book</a>, or call (718) 889-1777.</p>
    <p style="margin:0; line-height:1.65;">— Wonderland Playhouse</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'Cancelled',
      title: "Your party's been cancelled.",
      subtitle: `${escapeHtml(party.child_name ?? 'Party')} · ${fmtDate(party.date)}`,
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: party.email,
    subject: `Cancellation: ${escapeHtml(party.child_name ?? 'party')} · ${fmtDate(party.date)}`,
    html,
  });
}

// Customer: open play paid
// ---------------------------------------------------------------------------
export async function sendOpenPlayConfirmation(ticket: any) {
  const firstName = ticket.parent_name.split(' ')[0] || ticket.parent_name;
  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)}, your open play visit is reserved.</p>

    <div style="background:#2C4253; color:white; padding:24px 20px; border-radius:16px; text-align:center; margin:24px 0;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:2.5px; opacity:0.7; font-weight:700;">Show at the door</div>
      <div style="font-size:32px; font-weight:800; letter-spacing:5px; margin-top:12px; font-family:'Courier New', monospace; color:#fdda26;">${ticket.ticket_code.toUpperCase()}</div>
    </div>

    <p style="margin:0 0 12px; line-height:1.65; font-size:14px;">Arrive any time during open hours (12pm–7:30pm). Stay up to 2 hours. <strong>Grip socks required</strong> for kids and adults — we sell them at the door if you forget.</p>

    ${ctaButton('Sign waiver now', `${SITE}/waiver?email=${encodeURIComponent(ticket.email)}`)}

    <p style="margin:16px 0 0; line-height:1.6; font-size:13px; color:#6B7C8E; text-align:center;">Once a year covers every visit — open play, parties, guest kids.</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: "You're in",
      title: 'See you soon.',
      subtitle: `Open play · ${fmtDate(ticket.date)}`,
      heroBg: 'linear-gradient(135deg, #89cff0 0%, #50758f 100%)',
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: ticket.email,
    bcc: BCC_OWNER,
    subject: `Your open play ticket — ${fmtDate(ticket.date)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: 7-day-out reminder (sent by cron)
// ---------------------------------------------------------------------------
export async function sendPartySevenDayReminder(party: any) {
  // Read balance from the canonical helper so the reminder matches every
  // other surface (admin card, calendar event, balance invoice) — the old
  // total - deposit math silently ignored add-ons + tax-on-add-ons.
  const balance = computePartyFinancials(party).balance_due_cents;
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">${escapeHtml(party.child_name ?? "Your child")}'s ${party.package === 'private' ? 'private' : 'semi-private'} party is exactly one week away. Quick pre-game checklist:</p>

    ${
      balance > 0
        ? `<div style="background:#FFF4F5; border-radius:12px; padding:18px 20px; margin:20px 0;">
             <p style="margin:0 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">Balance due in 4 days</p>
             <p style="margin:0; line-height:1.65;"><strong>${fmtMoney(balance)}</strong> is due by <strong>${fmtDate(balanceDueDateFor(party.date))}</strong> (3 days before the party). We'll send a payment link as the deadline approaches — paying ahead keeps check-in smooth on party day.</p>
           </div>`
        : ''
    }

    <ul style="margin:16px 0; padding-left:20px; line-height:1.85; color:#2C4253;">
      <li>Share the waiver link with your guests — once a year covers them all</li>
      <li>Confirm your add-ons (decor, food, entertainment) if you haven't yet</li>
      <li>Grip socks required — we sell them at the door if anyone forgets</li>
    </ul>

    ${ctaButton('Share waiver with guests', `${SITE}/waiver`)}

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">Anything we should know? Reply or call (718) 889-1777.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: 'One week to go',
      title: `${escapeHtml(party.child_name ?? "The")}'s party is almost here.`,
      subtitle: `${fmtDate(party.date)} at ${party.start_time}`,
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: party.email,
    bcc: BCC_OWNER,
    subject: `1 week until ${party.child_name}'s party at Wonderland`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: 24-hour-out reminder (sent by cron)
// ---------------------------------------------------------------------------
export async function sendPartyTwentyFourHourReminder(party: any) {
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">We're all set for ${escapeHtml(party.child_name ?? "the")}'s party tomorrow. Quick reminders:</p>

    ${kvpTable([
      ['Time', party.start_time],
      ['Headcount', `${party.headcount} kids`],
      ['Address', '3830 Nostrand Ave, Brooklyn'],
    ])}

    <div style="background:#FFF4F5; border-radius:12px; padding:18px 20px; margin:20px 0;">
      <p style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">Day-of checklist</p>
      <ul style="margin:0; padding-left:20px; line-height:1.8;">
        <li><strong>Grip socks required</strong> — for sale at the door</li>
        <li><strong>Arrive ~10 min early</strong> so we can get you set up</li>
        <li>Last call for guest waivers — once a year covers them all</li>
      </ul>
    </div>

    ${ctaButton('Share waiver with guests', `${SITE}/waiver`)}

    <p style="margin:24px 0 0; line-height:1.65; font-size:15px; font-weight:600; text-align:center;">See you tomorrow! 🎂</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: 'Tomorrow!',
      title: `It's almost party time.`,
      subtitle: `${fmtDate(party.date)} at ${party.start_time}`,
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: party.email,
    bcc: BCC_OWNER,
    subject: `🎉 Tomorrow's ${party.child_name}'s party — quick reminders`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: balance due today (3 calendar days before the party).
// Soft-firm tone. Reads balance freshly from computePartyFinancials so any
// add-ons / extras / discounts that landed between booking and now are
// reflected. payLink is the hosted Stripe invoice URL the cron mints
// (or refreshes) just before sending — always present so the CTA works.
// ---------------------------------------------------------------------------
export async function sendBalanceDueReminder(args: {
  party: any;
  payLink: string | null;
}) {
  const { party, payLink } = args;
  const fin = computePartyFinancials(party);
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const child = party.child_name ?? 'your child';

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">Just a heads-up — the balance for ${escapeHtml(child)}'s ${party.package === 'private' ? 'private' : 'semi-private'} party on <strong>${fmtDate(party.date)}</strong> is due today. Settling up ahead of time means we can focus on the kids on party day instead of payments at check-in.</p>

    <div style="background:#FFF4F5; border-radius:14px; padding:22px 24px; margin:24px 0; text-align:center;">
      <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#ff7783; font-weight:800;">Balance due today</p>
      <p style="margin:0; font-size:32px; font-weight:800; color:#2C4253;">${fmtMoney(fin.balance_due_cents)}</p>
    </div>

    ${payLink
      ? ctaButton('Pay balance now', payLink)
      : `<p style="margin:0 0 16px; line-height:1.65;">We're prepping the payment link — Gaby will send it within the next few hours. Watch for it.</p>`}

    <p style="margin:24px 0 16px; line-height:1.65; font-size:14px;">If today doesn't work, please text or call us at <a href="tel:+17188891777" style="color:#ff7783; font-weight:600;">(718) 889-1777</a> — we'd rather coordinate now than have a surprise at the door.</p>

    <p style="margin:0; line-height:1.65;">Thanks!<br/>— Wonderland Playhouse</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'Balance due today',
      title: `${fmtMoney(fin.balance_due_cents)} due for ${escapeHtml(child)}'s party.`,
      subtitle: `${fmtDate(party.date)} at ${party.start_time}`,
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: party.email,
    bcc: BCC_OWNER,
    subject: `Balance due today — ${escapeHtml(child)}'s party on ${fmtDate(party.date)}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: balance still owed 24h before the party. Slightly firmer than
// the 3-day reminder — they didn't pay then, party is tomorrow, this is
// the last automated nudge before they show up at the door.
// ---------------------------------------------------------------------------
export async function sendBalanceOverdueReminder(args: {
  party: any;
  payLink: string | null;
}) {
  const { party, payLink } = args;
  const fin = computePartyFinancials(party);
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const child = party.child_name ?? 'your child';

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">The balance for ${escapeHtml(child)}'s party <strong>tomorrow</strong> (${fmtDate(party.date)}) is still outstanding. Please settle it using the link below before you arrive — check-in is so much smoother when the payment side is handled in advance.</p>

    <div style="background:#FEF3C7; border-radius:14px; padding:22px 24px; margin:24px 0; text-align:center; border:2px solid #F59E0B;">
      <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#B45309; font-weight:800;">Outstanding balance</p>
      <p style="margin:0; font-size:32px; font-weight:800; color:#2C4253;">${fmtMoney(fin.balance_due_cents)}</p>
    </div>

    ${payLink
      ? ctaButton('Pay balance now', payLink)
      : `<p style="margin:0 0 16px; line-height:1.65;">Please text Gaby at <a href="tel:+17188891777" style="color:#ff7783; font-weight:600;">(718) 889-1777</a> for the payment link.</p>`}

    <p style="margin:24px 0 16px; line-height:1.65; font-size:14px;">If something's blocking the payment, please text us at <a href="tel:+17188891777" style="color:#ff7783; font-weight:600;">(718) 889-1777</a> today and we'll work it out together. We just want to make sure tomorrow goes smoothly for ${escapeHtml(child)}.</p>

    <p style="margin:0; line-height:1.65;">See you tomorrow!<br/>— Wonderland Playhouse</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'Last call · balance overdue',
      title: `${fmtMoney(fin.balance_due_cents)} still owed for tomorrow's party.`,
      subtitle: `${fmtDate(party.date)} at ${party.start_time}`,
      heroBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: party.email,
    bcc: BCC_OWNER,
    subject: `Last call — balance overdue for tomorrow's party`,
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
  const firstName = card.recipient_name.split(' ')[0] || card.recipient_name;
  const fromName = card.purchaser_name.split(' ')[0] || card.purchaser_name;

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;"><strong>${escapeHtml(card.purchaser_name)}</strong> sent you a gift card for Wonderland Playhouse — a magical, low-stim play space in Brooklyn for kids 0–8. Use it for open play visits, a birthday party deposit, or anything else on the menu.</p>

    ${
      card.message
        ? `<div style="background:#FFF4F5; border-left:4px solid #ff7783; padding:16px 20px; margin:24px 0; border-radius:0 8px 8px 0;">
             <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">A note from ${escapeHtml(fromName)}</p>
             <p style="margin:0; font-style:italic; line-height:1.65; color:#2C4253;">${escapeHtml(card.message)}</p>
           </div>`
        : ''
    }

    <div style="background:#2C4253; color:white; padding:28px 20px; border-radius:16px; text-align:center; margin:28px 0;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:2.5px; opacity:0.7; font-weight:700;">Your gift card code</div>
      <div style="font-size:30px; font-weight:800; letter-spacing:4px; margin-top:14px; font-family:'Courier New', monospace;">${card.code}</div>
      <div style="font-size:13px; margin-top:14px; opacity:0.75;">Balance: <strong style="color:#fdda26;">${fmtMoney(card.amount_cents)}</strong></div>
    </div>

    <p style="margin:0 0 12px; line-height:1.65; font-weight:700; color:#2C4253;">How to use it:</p>
    <ul style="margin:0 0 16px; padding-left:20px; line-height:1.8; color:#2C4253;">
      <li>Book a <a href="${SITE}/parties" style="color:#ff7783; font-weight:600;">birthday party</a> or an <a href="${SITE}/book/open-play" style="color:#ff7783; font-weight:600;">open play visit</a></li>
      <li>Enter the code at checkout — comes off your total automatically</li>
      <li>Partial balances stick around for next time. No expiration.</li>
    </ul>

    ${ctaButton('Book your visit', `${SITE}/book/open-play`)}

    <p style="margin:24px 0 0; font-size:13px; color:#6B7C8E; line-height:1.6;">Questions? Just reply or call (718) 889-1777.</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'A gift for you',
      title: `${fmtMoney(card.amount_cents)} to Wonderland Playhouse`,
      subtitle: `From ${escapeHtml(card.purchaser_name)}`,
    },
    body,
  );

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
  const firstName = card.purchaser_name.split(' ')[0] || card.purchaser_name;
  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">Your <strong>${fmtMoney(card.amount_cents)}</strong> gift card was just sent to <strong>${escapeHtml(card.recipient_name)}</strong>.</p>

    ${kvpTable([
      ['Amount', fmtMoney(card.amount_cents)],
      ['Code', `<span style="font-family:'Courier New', monospace; letter-spacing:1px;">${card.code}</span>`],
      ['Sent to', escapeHtml(card.recipient_email)],
    ])}

    <p style="margin:0 0 12px; line-height:1.65; font-size:14px; color:#6B7C8E;">Keep this email — if the recipient loses their code, we can look it up from here.</p>
  `;

  const html = brandedShell(
    {
      heroEyebrow: 'Gift card sent ✓',
      title: `${fmtMoney(card.amount_cents)} to ${escapeHtml(card.recipient_name.split(' ')[0] || card.recipient_name)}`,
      subtitle: `On its way as we speak`,
      heroBg: 'linear-gradient(135deg, #50758f 0%, #2C4253 100%)',
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: card.purchaser_email,
    subject: `Receipt: ${fmtMoney(card.amount_cents)} gift card to ${card.recipient_name}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: planning call invite (sent from admin after deposit)
// ---------------------------------------------------------------------------
export async function sendPartyPlanningCallInvite(party: {
  parent_name: string;
  email: string;
  child_name: string | null;
  date: string;
  // If passed and > 0, the customer has already picked add-ons — soften
  // the language so the call reads as optional ("looks like you're set,
  // here's the link if you want to chat anyway") instead of required.
  add_ons_total_cents?: number | null;
}) {
  const firstName = party.parent_name.split(' ')[0] || party.parent_name;
  const hasAddOns = (party.add_ons_total_cents ?? 0) > 0;
  const body = hasAddOns
    ? `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">Your deposit is in and the date is locked. We see you've picked some add-ons — looks like you're already set! If everything's exactly how you want it, no need to do anything else; the planning call below is optional.</p>
    <p style="margin:0 0 8px; line-height:1.65;">If you'd like to chat through theme details, decor specifics, timing, or anything else, grab a 30-minute slot:</p>

    ${ctaButton('Schedule planning call (optional)', `${SITE}/inquire`)}

    <p style="margin:24px 0 0; line-height:1.6; font-size:14px; color:#6B7C8E;">Prefer to skip the call? Just reply to this email and let us know — or call (718) 889-1777 with any quick questions.</p>
  `
    : `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">Your deposit is in and the date is locked. Now the fun part — let's nail down the theme, cake, food, entertainment, and any other add-ons.</p>
    <p style="margin:0 0 8px; line-height:1.65;">Grab a 30-minute slot that works for you:</p>

    ${ctaButton('Schedule planning call', `${SITE}/inquire`)}

    <p style="margin:24px 0 0; line-height:1.6; font-size:14px; color:#6B7C8E;">Already know exactly what you want? Reply to this email with the details and we can skip the call — or text (718) 889-1777.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: 'Next step',
      title: "Let's plan the details.",
      subtitle: `${escapeHtml(party.child_name ?? 'Your')} party · ${fmtDate(party.date)}`,
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: party.email,
    bcc: BCC_OWNER,
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
  theme?: string | null;
}) {
  const theme = getInvoiceTheme(args.theme);
  const firstName = args.parent_name.split(' ')[0] || args.parent_name;
  const childName = args.child_name ?? 'Birthday';
  const addOnsHtml = args.add_ons.length
    ? `
        <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px;">
          <tr><th colspan="2" style="text-align:left; padding:10px 0; border-bottom:1px solid #EDE7DC; color:#6B7C8E; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:1.5px;">Add-ons</th></tr>
          ${args.add_ons
            .map(
              (a, i, arr) => `
                <tr>
                  <td style="padding:10px 0; color:#2C4253; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${escapeHtml(a.name)}${a.qty > 1 ? ` × ${a.qty}` : ''}</td>
                  <td style="padding:10px 0; text-align:right; color:#2C4253; font-weight:600; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${fmtMoney(a.unit_price_cents * a.qty)}</td>
                </tr>`,
            )
            .join('')}
        </table>`
    : '';

  const themedHero = `
    <div style="font-size:40px; line-height:1; margin-bottom:14px;">${theme.heroEmoji}</div>
  `;

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">Here's the final invoice for <strong>${escapeHtml(childName)}'s</strong> party on <strong>${fmtDate(args.date)}</strong>. Your deposit is already credited — everything else is itemized below.</p>
    ${addOnsHtml}
    <div style="background:${theme.accentBg}; padding:24px 20px; border-radius:16px; text-align:center; margin:28px 0;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:2.5px; color:${theme.accentText}; font-weight:800;">Balance due</div>
      <div style="font-size:38px; font-weight:800; color:#2C4253; margin-top:10px;">${fmtMoney(args.balance_cents)}</div>
    </div>

    ${ctaButton('Pay by card now', args.hosted_invoice_url)}

    <div style="background:#FFFBF5; border:1px solid #EDE7DC; border-radius:14px; padding:18px 20px; margin:24px 0;">
      <p style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:1.8px; color:${theme.accentText}; font-weight:800;">Payment options</p>
      <p style="margin:0 0 10px; line-height:1.65; font-size:14px; color:#2C4253;">
        <strong>Card:</strong> Use the button above — secure Stripe checkout. A small credit-card fee applies.
      </p>
      <p style="margin:0 0 10px; line-height:1.65; font-size:14px; color:#2C4253;">
        <strong>Zelle (no fee):</strong> <a href="mailto:info@wonderlandplayhouse.com" style="color:${theme.accentText}; font-weight:700; text-decoration:none;">info@wonderlandplayhouse.com</a> &mdash; please include ${escapeHtml(childName)}'s name in the memo.
      </p>
      <p style="margin:0; line-height:1.65; font-size:14px; color:#2C4253;">
        <strong>Cash:</strong> In person at the Playhouse.
      </p>
      <p style="margin:12px 0 0; line-height:1.55; font-size:12px; color:#6B7C8E;">
        <strong>Zelle / cash balance:</strong> must be received at least <strong>3 days before the party</strong> so we can confirm before your event. Card can be paid right up to party day.
      </p>
      <p style="margin:8px 0 0; line-height:1.55; font-size:12px; color:#6B7C8E;">
        Final headcount must be confirmed 3 days before the party. Deposits and balances are non-refundable &mdash; the date may be rescheduled if you reach out ahead of time.
      </p>
    </div>

    <div style="background:${theme.accentBg}; border-radius:14px; padding:18px 20px; margin:24px 0;">
      <p style="margin:0 0 10px; font-size:11px; text-transform:uppercase; letter-spacing:1.8px; color:${theme.accentText}; font-weight:800;">Party-day reminders</p>
      <ul style="margin:0; padding-left:18px; line-height:1.65; font-size:14px; color:#2C4253;">
        <li>Shoes are not permitted beyond the entrance. Socks are required (kids &amp; adults).</li>
        <li>Booths are available for both adults and kids; spare socks can be purchased at the front if forgotten.</li>
        <li>Arrive 10&ndash;15 minutes early so the celebrant can get set up and we can greet your guests.</li>
      </ul>
    </div>

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">Questions? Reply to this email or call <a href="tel:+17188891777" style="color:#6B7C8E;">(718) 889-1777</a>.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: theme.heroEyebrow,
      title: `${childName}'s party invoice`,
      subtitle: `${fmtDate(args.date)} · balance ${fmtMoney(args.balance_cents)}`,
      heroBg: theme.heroBg,
      heroPrefixHtml: themedHero,
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: args.email,
    subject: `${childName}'s ${theme.subjectFlavor} — balance ${fmtMoney(args.balance_cents)} due`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: admin-created party (walk-in / phone booking). Variant of the
// balance-invoice email, but the party itself is brand-new and not yet paid.
// kind='full' means one invoice for the whole thing; kind='deposit' means
// this invoice is just the deposit, balance comes later.
// ---------------------------------------------------------------------------
export async function sendCreatedPartyInvoice(args: {
  parent_name: string;
  email: string;
  child_name: string;
  date: string;
  start_time: string;
  kind: 'full' | 'deposit';
  amount_cents: number;
  balance_after_cents: number;
  hosted_invoice_url: string;
  add_ons: Array<{ name: string; qty: number; unit_price_cents: number }>;
  theme: string;
}) {
  const theme = getInvoiceTheme(args.theme);
  const firstName = args.parent_name.split(' ')[0] || args.parent_name;
  const child = args.child_name;
  const isFull = args.kind === 'full';

  const niceTime = (() => {
    const [h, m] = args.start_time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const display = ((h + 11) % 12) + 1;
    return `${display}:${String(m).padStart(2, '0')} ${period}`;
  })();

  const addOnsHtml = args.add_ons.length
    ? `
        <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px;">
          <tr><th colspan="2" style="text-align:left; padding:10px 0; border-bottom:1px solid #EDE7DC; color:#6B7C8E; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:1.5px;">Add-ons included</th></tr>
          ${args.add_ons
            .map(
              (a, i, arr) => `
                <tr>
                  <td style="padding:10px 0; color:#2C4253; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${escapeHtml(a.name)}${a.qty > 1 ? ` × ${a.qty}` : ''}</td>
                  <td style="padding:10px 0; text-align:right; color:#2C4253; font-weight:600; border-bottom:${i === arr.length - 1 ? 'none' : '1px solid #EDE7DC'};">${fmtMoney(a.unit_price_cents * a.qty)}</td>
                </tr>`,
            )
            .join('')}
        </table>`
    : '';

  const themedHero = `<div style="font-size:40px; line-height:1; margin-bottom:14px;">${theme.heroEmoji}</div>`;

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">${
      isFull
        ? `Your invoice for <strong>${escapeHtml(child)}'s</strong> party on <strong>${fmtDate(args.date)}</strong> at <strong>${niceTime}</strong> is ready. Everything's itemized below.`
        : `Here's the deposit invoice to lock in <strong>${escapeHtml(child)}'s</strong> party on <strong>${fmtDate(args.date)}</strong> at <strong>${niceTime}</strong>. Pay this to confirm the date — we'll send the balance invoice closer to the party.`
    }</p>
    ${addOnsHtml}
    <div style="background:${theme.accentBg}; padding:24px 20px; border-radius:16px; text-align:center; margin:28px 0;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:2.5px; color:${theme.accentText}; font-weight:800;">${isFull ? 'Amount due' : 'Deposit due'}</div>
      <div style="font-size:38px; font-weight:800; color:#2C4253; margin-top:10px;">${fmtMoney(args.amount_cents)}</div>
      ${!isFull ? `<div style="margin-top:8px; font-size:13px; color:#6B7C8E;">Balance of <strong>${fmtMoney(args.balance_after_cents)}</strong> due later</div>` : ''}
    </div>

    ${ctaButton('Pay by card now', args.hosted_invoice_url)}

    <div style="background:#FFFBF5; border:1px solid #EDE7DC; border-radius:14px; padding:18px 20px; margin:24px 0;">
      <p style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:1.8px; color:${theme.accentText}; font-weight:800;">Payment options</p>
      <p style="margin:0 0 10px; line-height:1.65; font-size:14px; color:#2C4253;">
        <strong>Card:</strong> Use the button above — secure Stripe checkout. A small credit-card fee applies.
      </p>
      <p style="margin:0 0 10px; line-height:1.65; font-size:14px; color:#2C4253;">
        <strong>Zelle (no fee):</strong> <a href="mailto:info@wonderlandplayhouse.com" style="color:${theme.accentText}; font-weight:700; text-decoration:none;">info@wonderlandplayhouse.com</a> &mdash; please include ${escapeHtml(child)}'s name in the memo.
      </p>
      <p style="margin:0; line-height:1.65; font-size:14px; color:#2C4253;">
        <strong>Cash:</strong> In person at the Playhouse.
      </p>
      <p style="margin:12px 0 0; line-height:1.55; font-size:12px; color:#6B7C8E;">
        <strong>Zelle / cash:</strong> must be received at least <strong>3 days before the party</strong> so we can confirm before your event. Card can be paid right up to party day.
      </p>
      <p style="margin:8px 0 0; line-height:1.55; font-size:12px; color:#6B7C8E;">
        ${isFull
          ? "Full payment confirms the date. Final headcount must be confirmed 3 days before the party. Deposits and balances are non-refundable — the date may be rescheduled if you reach out ahead of time."
          : "Deposit confirms the date. Balance is due 7 days before the party. Deposits are non-refundable — the date may be rescheduled if you reach out ahead of time."}
      </p>
    </div>

    <div style="background:${theme.accentBg}; border-radius:14px; padding:18px 20px; margin:24px 0;">
      <p style="margin:0 0 10px; font-size:11px; text-transform:uppercase; letter-spacing:1.8px; color:${theme.accentText}; font-weight:800;">Party-day reminders</p>
      <ul style="margin:0; padding-left:18px; line-height:1.65; font-size:14px; color:#2C4253;">
        <li>Shoes are not permitted beyond the entrance. Socks are required (kids &amp; adults).</li>
        <li>Booths are available for both adults and kids; spare socks can be purchased at the front if forgotten.</li>
        <li>Arrive 10&ndash;15 minutes early so the celebrant can get set up and we can greet your guests.</li>
      </ul>
    </div>

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">Questions? Reply to this email or call <a href="tel:+17188891777" style="color:#6B7C8E;">(718) 889-1777</a>.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: isFull ? theme.heroEyebrow : 'Deposit · lock the date',
      title: `${child}'s party is booked!`,
      subtitle: `${fmtDate(args.date)} at ${niceTime}`,
      heroBg: theme.heroBg,
      heroPrefixHtml: themedHero,
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: args.email,
    bcc: BCC_OWNER,
    subject: isFull
      ? `${child}'s ${theme.subjectFlavor} — ${fmtMoney(args.amount_cents)} invoice`
      : `${child}'s ${theme.subjectFlavor} — deposit of ${fmtMoney(args.amount_cents)} to confirm`,
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

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">${tp.body(escapeHtml(firstName), escapeHtml(args.child_name), args.turning_age, niceDate)}</p>
    <p style="margin:0 0 16px; line-height:1.65; font-size:14px; color:#6B7C8E; font-style:italic;">${tp.urgency}</p>

    ${ctaButton('See party packages', `${SITE}/parties`)}

    <p style="margin:16px 0 0; line-height:1.65; font-size:14px; text-align:center;">Prefer to talk it through? <a href="${SITE}/inquire" style="color:#ff7783; font-weight:600;">Book a 20-min call</a>.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: tp.heading,
      title: `${escapeHtml(args.child_name)}'s ${ordinal(args.turning_age)} birthday`,
      subtitle: niceDate,
      unsubscribeUrl: unsub,
    },
    body,
  );

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
    .map((p) => `<p style="line-height:1.65; margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    ${paragraphs}
    ${
      args.cta_label && args.cta_href
        ? ctaButton(args.cta_label, args.cta_href)
        : ''
    }
  `;
  const html = brandedShell(
    {
      title: args.subject,
      heroBg: 'linear-gradient(135deg, #ff7783 0%, #fdda26 100%)',
      unsubscribeUrl: unsub,
    },
    body,
  );

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
export async function sendOwnerNotification({
  subject,
  party,
  addOns = [],
}: {
  subject: string;
  party: any;
  addOns?: AddOnLite[];
}) {
  // Promo-code bookings: no payment received. Show that clearly so the
  // owner doesn't think money landed when it didn't.
  const depositPaid = !!party.deposit_paid_at;
  const fin = computePartyFinancials(party);

  const rows: Array<[string, string]> = [
    ['Date', `${fmtDate(party.date)} at ${party.start_time}`],
    ['Package', party.package === 'private' ? 'Private' : 'Semi-Private'],
    ['Party', fmtMoney(fin.party_pre_tax_cents)],
  ];
  if (fin.add_ons_total_cents > 0) {
    rows.push(['Add-ons', fmtMoney(fin.add_ons_total_cents)]);
  }
  if (fin.manual_discount_cents > 0) {
    rows.push([
      fin.manual_discount_percent > 0
        ? `${fin.manual_discount_label} (${fin.manual_discount_percent}% off)`
        : fin.manual_discount_label,
      `<span style="color:#ff7783;">−${fmtMoney(fin.manual_discount_cents)}</span>`,
    ]);
  }
  rows.push(['NYC tax (8.875%)', fmtMoney(fin.tax_cents)]);
  rows.push(['Grand total', `<strong>${fmtMoney(fin.grand_total_cents)}</strong>`]);
  if (depositPaid) {
    rows.push(['Deposit paid', `<span style="color:#7C8E5C;">${fmtMoney(fin.deposit_paid_cents)} ✓</span>`]);
    if (fin.balance_paid_cents > 0) {
      rows.push(['Balance paid', `<span style="color:#7C8E5C;">${fmtMoney(fin.balance_paid_cents)} ✓</span>`]);
    }
    rows.push(['Balance due', `<strong>${fmtMoney(fin.balance_due_cents)}</strong>`]);
  } else {
    rows.push(['Promo code used', `<span style="color:#b45309;">⚠ no payment received yet</span>`]);
    rows.push([
      'Full balance owed',
      `<strong style="color:#ff7783;">${fmtMoney(fin.balance_due_cents)}</strong>`,
    ]);
  }
  rows.push(
    ['Birthday child', `${escapeHtml(party.child_name ?? '—')}${party.child_age != null ? `, age ${party.child_age}` : ''}`],
    ['Headcount', `${party.headcount} kids`],
    ['Parent', `${escapeHtml(party.parent_name)} · <a href="mailto:${escapeHtml(party.email)}" style="color:#ff7783;">${escapeHtml(party.email)}</a> · ${escapeHtml(party.phone)}`],
  );
  if (party.weekday_discount_applied) {
    rows.push(['Weekday discount', `applied (-${fmtMoney(party.discount_cents)})`]);
  }
  if (party.notes) {
    rows.push(['Notes', escapeHtml(party.notes)]);
  }

  // Itemized add-ons block so owner can see exactly what was ordered
  const addOnsHtml = addOns.length
    ? `
        <p style="margin:18px 0 8px; font-size:11px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; color:#6B7C8E;">Add-ons ordered</p>
        <ul style="margin:0 0 16px; padding-left:18px; font-size:14px; line-height:1.7; color:#2C4253;">
          ${addOns
            .map(
              (a) =>
                `<li>${escapeHtml(a.name)}${a.qty > 1 ? ` × ${a.qty}` : ''} — ${fmtMoney(a.unit_price_cents * a.qty)}${a.notes ? ` <span style="color:#94A3B8;">(${escapeHtml(a.notes)})</span>` : ''}</li>`,
            )
            .join('')}
        </ul>`
    : '';

  const headline = depositPaid
    ? 'Heads up — a new party booking just came in.'
    : '⚠ Heads up — a new party booking just came in via a promo code. No payment was charged. Send a deposit or full invoice from admin when ready.';

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">${headline}</p>
    ${kvpTable(rows)}
    ${addOnsHtml}
    ${ctaButton('View in admin', `${SITE}/admin/parties/${party.id}`)}
  `;
  const html = brandedShell(
    {
      heroEyebrow: depositPaid ? 'New booking' : 'New booking · promo · unpaid',
      title: subject,
      heroBg: 'linear-gradient(135deg, #ff7783 0%, #fdda26 100%)',
    },
    body,
  );
  return resend().emails.send({ from: FROM, to: OWNER, subject, html });
}

// ---------------------------------------------------------------------------
// Owner: gift card / open play / generic sale notification
// ---------------------------------------------------------------------------
export async function sendOwnerSaleNotification(args: {
  subject: string;
  bullets: Array<[label: string, value: string]>;
  adminLink?: string;
}) {
  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Heads up — a new sale just came in.</p>
    ${kvpTable(args.bullets)}
    ${args.adminLink ? ctaButton('View in admin', `${SITE}${args.adminLink}`) : ''}
  `;
  const html = brandedShell(
    {
      heroEyebrow: 'New activity',
      title: args.subject,
      heroBg: 'linear-gradient(135deg, #50758f 0%, #2C4253 100%)',
    },
    body,
  );
  return resend().emails.send({ from: FROM, to: OWNER, subject: args.subject, html });
}

// ---------------------------------------------------------------------------
// Membership welcome — sent when a new monthly subscription starts
// ---------------------------------------------------------------------------
export async function sendMembershipWelcome(args: {
  parent_name: string;
  email: string;
  child_name: string;
  amount_cents: number;
  next_billing_date: string | null;
}) {
  const firstName = args.parent_name.split(' ')[0] || args.parent_name;
  const nextBilling = args.next_billing_date
    ? new Date(args.next_billing_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)}, you're in!</p>
    <p style="margin:0 0 16px; line-height:1.65;">Welcome to the Wonderland Pass — ${escapeHtml(args.child_name)} now has unlimited open play access for the next month, and every month after.</p>

    ${kvpTable([
      ['Member', escapeHtml(args.child_name)],
      ['Monthly cost', fmtMoney(args.amount_cents) + ' + tax'],
      ['Daily limit', 'Up to 2 hours/day, 7 days a week'],
      ...(nextBilling ? ([['Next renewal', nextBilling]] as Array<[string, string]>) : []),
    ])}

    <div style="background:#FFF4F5; border-radius:12px; padding:18px 20px; margin:24px 0;">
      <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">How to use it</p>
      <p style="margin:0 0 8px; line-height:1.65;">Just walk in any open day — show your name at the front desk and we'll look you up.</p>
      <p style="margin:0; line-height:1.65; font-size:14px; color:#6B7C8E;"><em>Heads up: we close to open play during private parties. Booking page shows partial-closure windows in advance.</em></p>
    </div>

    ${ctaButton('Plan a visit', `${SITE}/book/open-play`)}

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px;">Need to update your card or cancel? <a href="${SITE}/memberships/manage" style="color:#ff7783; font-weight:600;">Manage your membership →</a> No commitment beyond next month.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: 'Welcome aboard',
      title: `${escapeHtml(args.child_name)}'s Wonderland Pass is active.`,
      subtitle: 'Unlimited monthly open play',
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: args.email,
    subject: `🎉 ${args.child_name}'s Wonderland Pass is active`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Customer: payment received confirmation (Zelle / cash / Clover swipe)
// ---------------------------------------------------------------------------
export async function sendManualPaymentReceived(args: {
  parent_name: string;
  email: string;
  child_name: string | null;
  date: string;
  kind: 'deposit' | 'balance';
  method: 'zelle' | 'cash' | 'clover' | 'groupon' | 'stripe';
  amount_cents: number;
  remaining_balance_cents: number;
}) {
  const firstName = args.parent_name.split(' ')[0] || args.parent_name;
  const child = args.child_name ?? 'your';
  const methodLabel =
    args.method === 'zelle' ? 'Zelle'
    : args.method === 'cash' ? 'cash'
    : args.method === 'groupon' ? 'Groupon voucher'
    : args.method === 'stripe' ? 'card (Stripe)'
    : 'Clover';
  const kindLabel = args.kind === 'deposit' ? 'deposit' : 'balance';
  const fullyPaid = args.remaining_balance_cents <= 0;

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;">Confirming we received your <strong>${fmtMoney(args.amount_cents)}</strong> ${kindLabel} payment via ${methodLabel} for ${escapeHtml(child)}'s party on <strong>${fmtDate(args.date)}</strong>. Thanks!</p>

    <div style="background:#F0FDF4; padding:20px; border-radius:14px; margin:24px 0; text-align:center;">
      <p style="margin:0; font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#15803d; font-weight:800;">${args.kind === 'deposit' ? 'Deposit received' : 'Balance received'}</p>
      <p style="margin:8px 0 0; font-size:32px; font-weight:800; color:#2C4253;">${fmtMoney(args.amount_cents)}</p>
      ${fullyPaid
        ? `<p style="margin:10px 0 0; font-size:13px; color:#15803d; font-weight:600;">Paid in full — you're all set ✓</p>`
        : `<p style="margin:10px 0 0; font-size:13px; color:#6B7C8E;">Remaining balance: <strong>${fmtMoney(args.remaining_balance_cents)}</strong> · due by ${fmtDate(balanceDueDateFor(args.date))}</p>`}
    </div>

    ${!fullyPaid && args.kind === 'deposit'
      ? `<p style="margin:0 0 16px; line-height:1.65; font-size:14px;">A quick heads-up: your remaining balance of <strong>${fmtMoney(args.remaining_balance_cents)}</strong> is due <strong>3 days before the party</strong> (by ${fmtDate(balanceDueDateFor(args.date))}). We'll send a payment link as the date gets closer — paying ahead means check-in is a breeze on party day.</p>`
      : ''}

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">Questions? Reply to this email or call <a href="tel:+17188891777" style="color:#6B7C8E;">(718) 889-1777</a>.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: 'Payment received',
      title: fullyPaid ? `${escapeHtml(child)}'s party is paid in full!` : `Got your ${kindLabel}`,
      subtitle: `${fmtDate(args.date)} · ${methodLabel} payment of ${fmtMoney(args.amount_cents)}`,
      heroBg: 'linear-gradient(135deg, #16a34a 0%, #65a30d 100%)',
    },
    body,
  );
  return resend().emails.send({
    from: FROM,
    to: args.email,
    subject: `Payment received — ${fmtMoney(args.amount_cents)} for ${escapeHtml(child)}'s party`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Admin invite — sent when an owner adds a new admin
// ---------------------------------------------------------------------------
export async function sendAdminInvite(args: {
  invitee_email: string;
  invitee_display_name: string | null;
  role: 'owner' | 'staff' | 'readonly';
  invited_by_name: string;
}) {
  const firstName = (args.invitee_display_name ?? args.invitee_email.split('@')[0]).split(' ')[0];
  const roleCopy = {
    owner: "You're an <strong>owner</strong> — full access to bookings, customers, billing, and team.",
    staff: "You're <strong>staff</strong> — manage bookings, customers, gift cards, and waivers.",
    readonly: "You have <strong>read-only access</strong> — view everything, change nothing.",
  }[args.role];

  const body = `
    <p style="margin:0 0 16px; line-height:1.65;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px; line-height:1.65;"><strong>${escapeHtml(args.invited_by_name)}</strong> added you to the Wonderland Playhouse admin dashboard.</p>

    <p style="margin:0 0 16px; line-height:1.65;">${roleCopy}</p>

    <div style="background:#FFF4F5; border-radius:12px; padding:18px 20px; margin:24px 0;">
      <p style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#ff7783; font-weight:800;">How to sign in</p>
      <p style="margin:0; line-height:1.65;">Tap the button below → click <strong>"Sign in with Google"</strong> → use this email (<code style="background:#fff; padding:2px 6px; border-radius:4px; font-size:13px;">${escapeHtml(args.invitee_email)}</code>). No password to remember.</p>
    </div>

    ${ctaButton('Open admin dashboard', `${SITE}/admin/login`)}

    <p style="margin:24px 0 0; line-height:1.65; font-size:14px; color:#6B7C8E;">Questions? Reply to this email or text ${escapeHtml(args.invited_by_name)}.</p>
  `;
  const html = brandedShell(
    {
      heroEyebrow: "You're in",
      title: 'Welcome to the team.',
      subtitle: 'Wonderland Playhouse admin access',
      heroBg: 'linear-gradient(135deg, #ff7783 0%, #fdda26 100%)',
    },
    body,
  );

  return resend().emails.send({
    from: FROM,
    to: args.invitee_email,
    subject: `${args.invited_by_name} invited you to Wonderland Playhouse admin`,
    html,
  });
}
