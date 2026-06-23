import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { computePartyFinancials } from '@/lib/parties';
import { PartyActions } from './PartyActions';
import { AddOnsEditor } from './AddOnsEditor';
import { InvoiceThemePicker } from './InvoiceThemePicker';
import { DiscountPicker } from './DiscountPicker';
import { ManualPaymentRecorder } from './ManualPaymentRecorder';
import { RescheduleCard } from './RescheduleCard';
import { PackageCard } from './PackageCard';
import { HeadcountEditor } from './HeadcountEditor';
import { NotesEditor } from './NotesEditor';
import { DeletePartyButton } from './DeletePartyButton';
import { requireAdmin } from '@/lib/admin';
import type { InvoiceThemeSlug } from '@/lib/invoice-themes';

export const dynamic = 'force-dynamic';

const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
// Pretty-prints stored payment-method strings (which can be comma-separated
// for balance payments collected across multiple rounds).
function methodLabel(raw: string): string {
  const map: Record<string, string> = {
    stripe: 'Stripe',
    zelle: 'Zelle',
    cash: 'Cash',
    clover: 'Clover',
    groupon: 'Groupon',
    gift_card: 'Gift card',
  };
  return raw
    .split(',')
    .map((m) => map[m.trim().toLowerCase()] ?? m.trim())
    .join(' · ');
}
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
        'id, date, start_time, package, status, child_name, child_age, parent_name, email, phone, headcount, notes, total_cents, subtotal_cents, discount_cents, tax_cents, deposit_cents, deposit_paid_at, deposit_payment_method, add_ons_total_cents, gift_card_applied_cents, balance_invoice_id, balance_invoice_hosted_url, balance_invoice_sent_at, balance_paid_at, balance_paid_amount_cents, balance_payment_method, planning_call_email_sent_at, extension_minutes, weekday_discount_applied, invoice_theme, manual_discount_percent, manual_discount_cents, inspiration_image_urls, promo_code_id, google_calendar_event_id, created_at, promo_code:promo_code_id(code, label)',
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
            <NotesEditor partyId={party.id} initial={(party as any).notes ?? null} />
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

          {/* Headcount & extra kids — source of truth for extra-kid pricing */}
          {(party.status === 'hold' || party.status === 'confirmed') && (
            <Card
              title="Headcount & extra kids"
              subtitle="Kids above the package's included count are auto-priced into the party total. Re-prices the party and updates the calendar + customer email."
            >
              <HeadcountEditor
                partyId={party.id}
                currentHeadcount={party.headcount}
                partyPackage={party.package as 'private' | 'semi'}
                date={party.date}
                startTime={party.start_time}
                extensionMinutes={party.extension_minutes ?? 0}
                depositPaidAt={party.deposit_paid_at}
              />
            </Card>
          )}

          {/* Add-ons */}
          <Card title="Add-ons" subtitle="Cake, entertainment, decor, extras — they show up on the balance invoice. (Extra kids are set on the Headcount card above, not here.)">
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

          {/* Discount — friends & family OR promo code, same column.
              PostgREST returns the embedded promo_code as array even though
              the FK is single-valued, so we pick the first. */}
          {(() => {
            const promoRaw = (party as any).promo_code;
            const promo = Array.isArray(promoRaw) ? promoRaw[0] : promoRaw;
            const weekdayActive = !!(party as any).weekday_discount_applied;
            return (
              <Card
                title={
                  weekdayActive
                    ? 'Mon–Thu 20% discount'
                    : promo
                      ? `Promo ${promo.code} applied`
                      : 'Friends & family discount'
                }
                subtitle={
                  weekdayActive
                    ? "Auto-applied because this party is Mon–Thu. No other discount can stack on top — reschedule to Fri–Sun to add a manual discount."
                    : promo
                      ? 'Customer used this code at booking. Setting a custom discount below will replace it.'
                      : 'Owner-applied courtesy off the grand total. Applies on the next invoice.'
                }
              >
                <DiscountPicker
                  partyId={party.id}
                  initial={((party as any).manual_discount_percent ?? 0) as number}
                  initialAmountCents={((party as any).manual_discount_cents ?? 0) as number}
                  promoCodeText={promo?.code ?? null}
                  blockedByWeekdayDiscount={weekdayActive}
                />
              </Card>
            );
          })()}

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

          {/* Reschedule */}
          {(party.status === 'hold' || party.status === 'confirmed') && (
            <Card title="Reschedule" subtitle="Move the date / time. Customer + calendar update automatically. Money state carries over.">
              <RescheduleCard
                partyId={party.id}
                partyPackage={party.package as 'private' | 'semi'}
                currentDate={party.date}
                currentStartTime={party.start_time}
              />
            </Card>
          )}

          {/* Privacy level — upgrade to Private / downgrade to Semi-Private.
              Re-prices the party. Pricing, blocked_dates, the calendar event,
              and customer + owner emails all update. Shown to all admins like
              the Reschedule / Discount cards; the endpoint enforces owner. */}
          {(party.status === 'hold' || party.status === 'confirmed') && (
            <Card
              title="Privacy level"
              subtitle="Switch between Private (whole venue) and Semi-Private (party room). Re-prices the party and updates the calendar + customer email."
            >
              <PackageCard
                partyId={party.id}
                currentPackage={party.package as 'private' | 'semi'}
                date={party.date}
                startTime={party.start_time}
                headcount={party.headcount}
                extensionMinutes={party.extension_minutes ?? 0}
                depositPaidAt={party.deposit_paid_at}
                hasManualDiscount={
                  ((party as any).manual_discount_percent ?? 0) > 0 ||
                  ((party as any).manual_discount_cents ?? 0) > 0 ||
                  !!(party as any).promo_code_id
                }
              />
            </Card>
          )}

          {/* Record manual payment (Zelle / cash / Clover) */}
          <Card
            title="Record payment received"
            subtitle="Use when the customer pays outside Stripe — Zelle, cash, or in-person Clover swipe."
          >
            <ManualPaymentRecorder
              partyId={party.id}
              partyPackage={party.package as 'private' | 'semi'}
              depositCents={party.deposit_cents}
              depositPaidAt={party.deposit_paid_at}
              depositMethod={(party as any).deposit_payment_method ?? null}
              balanceDueCents={financials.balance_due_cents}
              balancePaidAt={party.balance_paid_at}
              balancePaidAmountCents={party.balance_paid_amount_cents ?? 0}
              balanceMethod={(party as any).balance_payment_method ?? null}
              hasCalendarEvent={!!(party as any).google_calendar_event_id}
            />
          </Card>
        </div>

        {/* Right column: financials + timeline */}
        <aside className="space-y-6">
          <Card title="Financials">
            <dl className="space-y-2 text-sm">
              <Row label="Party (pre-tax)" value={fmtMoney(financials.party_pre_tax_cents)} />
              {party.discount_cents > 0 && (
                <Row label="Mon–Thu 20% off (included)" value={`−${fmtMoney(party.discount_cents)}`} accent />
              )}
              {financials.add_ons_total_cents > 0 && (
                <Row label="Add-ons" value={fmtMoney(financials.add_ons_total_cents)} />
              )}
              {financials.manual_discount_cents > 0 && (
                <Row
                  label={
                    financials.manual_discount_percent > 0
                      ? `${financials.manual_discount_label} (${financials.manual_discount_percent}% off)`
                      : financials.manual_discount_label
                  }
                  value={`−${fmtMoney(financials.manual_discount_cents)}`}
                  accent
                />
              )}
              <Row label="Taxable subtotal" value={fmtMoney(financials.taxable_subtotal_cents)} />
              <Row label="NYC tax (8.875%)" value={fmtMoney(financials.tax_cents)} />
              <hr className="border-slate-100" />
              <Row label="Grand total" value={<strong>{fmtMoney(financials.grand_total_cents)}</strong>} />
              {financials.deposit_paid_cents > 0 && (
                <Row
                  label={
                    (party as any).deposit_payment_method
                      ? `Deposit paid · ${methodLabel((party as any).deposit_payment_method)}`
                      : 'Deposit paid'
                  }
                  value={`−${fmtMoney(financials.deposit_paid_cents)}`}
                  accent
                />
              )}
              {financials.gift_card_applied_cents > 0 && (
                <Row label="Gift card applied" value={`−${fmtMoney(financials.gift_card_applied_cents)}`} accent />
              )}
              {financials.balance_paid_cents > 0 && (
                <Row
                  label={
                    (party as any).balance_payment_method
                      ? `Balance paid · ${methodLabel((party as any).balance_payment_method)}`
                      : 'Balance paid'
                  }
                  value={`−${fmtMoney(financials.balance_paid_cents)}`}
                  accent
                />
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
