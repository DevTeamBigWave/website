import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { computePartyFinancials } from '@/lib/parties';
import { PartyActions } from './PartyActions';
import { AddOnsEditor } from './AddOnsEditor';
import { InvoiceThemePicker } from './InvoiceThemePicker';
import { DiscountPicker } from './DiscountPicker';
import { ManualPaymentRecorder } from './ManualPaymentRecorder';
import { DeletePartyButton } from './DeletePartyButton';
import { requireAdmin } from '@/lib/admin';
import type { InvoiceThemeSlug } from '@/lib/invoice-themes';

export const dynamic = 'force-dynamic';

const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
};
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  // Fire all three in parallel: auth check, party row, add-ons. Previously
  // these awaited sequentially so the page TTFB was the sum of all three.
  // requireAdmin is React.cached so the layout's call is shared, not redone.
  const [me, { data: party }, { data: addOns = [] }] = await Promise.all([
    requireAdmin(),
    db
      .from('parties')
      .select(
        'id, date, start_time, package, status, child_name, child_age, parent_name, email, phone, headcount, notes, total_cents, subtotal_cents, discount_cents, tax_cents, deposit_cents, deposit_paid_at, deposit_payment_method, add_ons_total_cents, gift_card_applied_cents, balance_invoice_id, balance_invoice_hosted_url, balance_invoice_sent_at, balance_paid_at, balance_paid_amount_cents, balance_payment_method, planning_call_email_sent_at, extension_minutes, weekday_discount_applied, invoice_theme, manual_discount_percent, inspiration_image_urls, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    db
      .from('party_add_ons')
      .select('id, catalog_id, name, unit_price_cents, qty, notes, created_at')
      .eq('party_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!party) notFound();

  const financials = computePartyFinancials(party as any);
  const balanceAlreadyPaid = !!party.balance_paid_at;
  const invoiceSent = !!party.balance_invoice_sent_at;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/parties"
            className="text-xs font-bold uppercase tracking-wider text-coral hover:text-coral-700"
          >
            ← All parties
          </Link>
          <h1 className="mt-2 font-display text-3xl text-slate-700">
            {party.child_name ?? 'Party'}
            {party.child_age != null && (
              <span className="ml-2 text-base font-normal text-slate-400">
                turning {party.child_age}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {fmtDate(party.date)} at {fmtTime(party.start_time)} · {party.package} party · {party.headcount} kids
          </p>
        </div>
        {me.role === 'owner' && <DeletePartyButton partyId={party.id} />}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* Contact card */}
          <Card title="Contact">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Row label="Parent" value={party.parent_name} />
              <Row label="Email" value={<a href={`mailto:${party.email}`} className="break-all text-coral hover:text-coral-700">{party.email}</a>} />
              <Row label="Phone" value={<a href={`tel:${party.phone}`} className="text-coral hover:text-coral-700">{party.phone}</a>} />
              <Row label="Headcount" value={`${party.headcount} kids`} />
            </dl>
            {party.notes && (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes from parent</p>
                <p className="mt-1 whitespace-pre-wrap">{party.notes}</p>
              </div>
            )}
          </Card>

          {/* Inspiration photos — only render if the customer uploaded any */}
          {Array.isArray((party as any).inspiration_image_urls) &&
            ((party as any).inspiration_image_urls as string[]).length > 0 && (
              <Card title="Inspiration photos" subtitle="Uploaded at booking — custom cake / decor reference.">
                <div className="grid grid-cols-3 gap-3">
                  {((party as any).inspiration_image_urls as string[]).map((u) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Inspiration" className="h-full w-full object-cover transition hover:scale-105" />
                    </a>
                  ))}
                </div>
              </Card>
            )}

          {/* Add-ons */}
          <Card title="Add-ons" subtitle="Cake, entertainment, decor, extras — they show up on the balance invoice.">
            <AddOnsEditor partyId={party.id} initial={(addOns ?? []) as any} />
          </Card>

          {/* Invoice theme */}
          <Card title="Invoice theme" subtitle="Pick the look for the balance-invoice email. Defaults to neutral Wonderland.">
            <InvoiceThemePicker
              partyId={party.id}
              initial={((party as any).invoice_theme ?? 'wonderland') as InvoiceThemeSlug}
              locked={false}
            />
          </Card>

          {/* Friends & family discount */}
          <Card title="Friends & family discount" subtitle="Owner-applied courtesy off the grand total. Applies on the next invoice.">
            <DiscountPicker
              partyId={party.id}
              initial={((party as any).manual_discount_percent ?? 0) as 0 | 10 | 15 | 20}
            />
          </Card>

          {/* Actions */}
          <Card title="Send to customer">
            <PartyActions
              partyId={party.id}
              depositCents={party.deposit_cents}
              depositPaidAt={party.deposit_paid_at}
              balanceDueCents={financials.balance_due_cents}
              invoiceSentAt={party.balance_invoice_sent_at}
              hostedInvoiceUrl={party.balance_invoice_hosted_url}
              balancePaidAt={party.balance_paid_at}
              planningCallSentAt={party.planning_call_email_sent_at}
            />
          </Card>

          {/* Record manual payment (Zelle / cash / Clover) */}
          <Card
            title="Record payment received"
            subtitle="Use when the customer pays outside Stripe — Zelle, cash, or in-person Clover swipe."
          >
            <ManualPaymentRecorder
              partyId={party.id}
              depositCents={party.deposit_cents}
              depositPaidAt={party.deposit_paid_at}
              depositMethod={(party as any).deposit_payment_method ?? null}
              balanceDueCents={financials.balance_due_cents}
              balancePaidAt={party.balance_paid_at}
              balancePaidAmountCents={party.balance_paid_amount_cents ?? 0}
              balanceMethod={(party as any).balance_payment_method ?? null}
            />
          </Card>
        </div>

        {/* Right column: financials + timeline */}
        <aside className="space-y-6">
          <Card title="Financials">
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={fmtMoney(party.subtotal_cents ?? 0)} />
              {party.discount_cents > 0 && (
                <Row label="Mon–Thu 20% off" value={`−${fmtMoney(party.discount_cents)}`} accent />
              )}
              {(party.tax_cents ?? 0) > 0 && (
                <Row label="Tax" value={fmtMoney(party.tax_cents)} />
              )}
              <Row label="Party total" value={fmtMoney(financials.base_total_cents)} />
              <Row label="Add-ons" value={fmtMoney(financials.add_ons_total_cents)} />
              {financials.manual_discount_cents > 0 && (
                <Row
                  label={`Friends & family ${financials.manual_discount_percent}% off`}
                  value={`−${fmtMoney(financials.manual_discount_cents)}`}
                  accent
                />
              )}
              <hr className="border-slate-100" />
              <Row label="Grand total" value={<strong>{fmtMoney(financials.grand_total_cents)}</strong>} />
              <Row label="Deposit paid" value={`−${fmtMoney(financials.deposit_paid_cents)}`} accent />
              {financials.gift_card_applied_cents > 0 && (
                <Row label="Gift card applied" value={`−${fmtMoney(financials.gift_card_applied_cents)}`} accent />
              )}
              {financials.balance_paid_cents > 0 && (
                <Row label="Balance paid" value={`−${fmtMoney(financials.balance_paid_cents)}`} accent />
              )}
              <hr className="border-slate-100" />
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Balance due</span>
                <span className={`font-display text-2xl ${balanceAlreadyPaid ? 'text-slate-400 line-through' : 'text-coral'}`}>
                  {fmtMoney(financials.balance_due_cents)}
                </span>
              </div>
              {balanceAlreadyPaid && (
                <p className="text-xs text-sky-700">Paid in full ✓</p>
              )}
            </dl>
          </Card>

          <Card title="Activity">
            <ul className="space-y-2 text-sm text-slate-600">
              <Timeline label="Booked" at={party.created_at} />
              <Timeline label="Deposit paid" at={party.deposit_paid_at} />
              {party.planning_call_email_sent_at && (
                <Timeline label="Planning-call email sent" at={party.planning_call_email_sent_at} />
              )}
              {invoiceSent && (
                <Timeline
                  label="Balance invoice sent"
                  at={party.balance_invoice_sent_at}
                  detail={party.balance_invoice_hosted_url ? (
                    <a href={party.balance_invoice_hosted_url} target="_blank" rel="noopener" className="text-coral hover:text-coral-700">View →</a>
                  ) : null}
                />
              )}
              {balanceAlreadyPaid && (
                <Timeline label={`Balance paid (${fmtMoney(party.balance_paid_amount_cents ?? 0)})`} at={party.balance_paid_at} />
              )}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-display text-lg text-slate-700">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className="flex-none text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 break-words text-right ${
          accent ? 'font-semibold text-coral' : 'text-slate-700'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Timeline({
  label,
  at,
  detail,
}: {
  label: string;
  at: string | null | undefined;
  detail?: React.ReactNode;
}) {
  if (!at) return null;
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-baseline gap-2 text-xs text-slate-400">
        {fmtDateTime(at)}
        {detail}
      </span>
    </li>
  );
}
