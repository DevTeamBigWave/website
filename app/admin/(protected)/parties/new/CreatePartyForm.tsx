'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PACKAGES,
  PRIVATE_PARTY_TIMES,
  SEMI_PARTY_TIMES,
  calculatePartyPricing,
  type PackageId,
} from '@/lib/pricing';
import { ADD_ON_CATALOG, CATEGORY_LABEL, type AddOnCatalogItem } from '@/lib/add-ons';
import { INVOICE_THEME_LIST, type InvoiceThemeSlug } from '@/lib/invoice-themes';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Convert "10:00 AM" → "10:00" for input value
function to24h(label: string): string {
  const [hm, period] = label.split(' ');
  const [hStr, mStr] = hm.split(':');
  let h = parseInt(hStr, 10);
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mStr}`;
}

type RowState = { checked: boolean; qty: string; priceDollars: string };

export function CreatePartyForm() {
  const router = useRouter();

  // Party fields
  const [pkg, setPkg] = useState<PackageId>('private');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState(to24h(PRIVATE_PARTY_TIMES[1]));
  const [extension60, setExtension60] = useState(false);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [headcount, setHeadcount] = useState('11');
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice settings
  const [invoiceType, setInvoiceType] = useState<'full' | 'deposit_only'>('deposit_only');
  const [theme, setTheme] = useState<InvoiceThemeSlug>('wonderland');

  // Add-on grid
  const [addOnRows, setAddOnRows] = useState<Record<string, RowState>>(() =>
    ADD_ON_CATALOG.reduce<Record<string, RowState>>((acc, c) => {
      acc[c.id] = {
        checked: false,
        qty: String(c.default_qty ?? 1),
        priceDollars: (c.price_cents / 100).toFixed(2),
      };
      return acc;
    }, {}),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time slots depend on package
  const timeOptions = pkg === 'private' ? PRIVATE_PARTY_TIMES : SEMI_PARTY_TIMES;

  // Grouped catalog for the grid
  const grouped = useMemo(() => {
    return ADD_ON_CATALOG.reduce<Record<string, AddOnCatalogItem[]>>((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
  }, []);

  // Selected add-ons (only meaningful for 'full' invoices)
  const selectedAddOns = useMemo(
    () =>
      ADD_ON_CATALOG.filter((c) => addOnRows[c.id]?.checked).map((c) => {
        const r = addOnRows[c.id];
        return {
          catalog_id: c.id,
          name: c.name,
          unit_price_cents: Math.round(parseFloat(r.priceDollars || '0') * 100) || 0,
          qty: parseInt(r.qty || '1', 10) || 1,
        };
      }),
    [addOnRows],
  );

  const addOnsTotalCents = selectedAddOns.reduce(
    (s, a) => s + a.unit_price_cents * a.qty,
    0,
  );

  // Live pricing math — mirrors /book exactly
  const pricing = useMemo(() => {
    if (!date) return null;
    try {
      return calculatePartyPricing({
        packageId: pkg,
        date: new Date(`${date}T${startTime}:00`),
        time: startTime,
        extensionId: extension60 ? '60m' : null,
        headcount: parseInt(headcount, 10) || PACKAGES[pkg].includedKids,
      });
    } catch {
      return null;
    }
  }, [pkg, date, startTime, extension60, headcount]);

  const invoiceAmountCents =
    invoiceType === 'full'
      ? (pricing?.totalCents ?? 0) + addOnsTotalCents
      : pricing?.depositCents ?? 0;

  const toggleAddOn = (id: string) => {
    setAddOnRows((r) => ({ ...r, [id]: { ...r[id], checked: !r[id].checked } }));
  };
  const setAddOnField = (id: string, field: 'qty' | 'priceDollars', value: string) => {
    setAddOnRows((r) => ({ ...r, [id]: { ...r[id], [field]: value } }));
  };

  const submit = async () => {
    setError(null);

    if (!date || !startTime || !childName.trim() || !parentName.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill date, time, child name, parent name, email, and phone.');
      return;
    }
    if (!pricing) {
      setError('Pricing is not ready — check the date.');
      return;
    }

    const verb = invoiceType === 'full' ? 'Send full invoice' : 'Send deposit invoice';
    if (
      !confirm(
        `${verb} of ${fmt(invoiceAmountCents)} to ${email}? This creates the party and emails the invoice immediately.`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/parties/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          package: pkg,
          date,
          start_time: startTime,
          extension_minutes: extension60 ? 60 : 0,
          child_name: childName.trim(),
          child_age: childAge ? parseInt(childAge, 10) : undefined,
          headcount: parseInt(headcount, 10),
          notes: notes.trim() || undefined,
          parent_name: parentName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          invoice_theme: theme,
          invoice_type: invoiceType,
          add_ons: invoiceType === 'full' ? selectedAddOns : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create party');
        setSubmitting(false);
        return;
      }
      router.push(`/admin/parties/${data.partyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_360px] lg:pb-0">
      {/* Main column */}
      <div className="space-y-6">
        {/* Party details */}
        <Card title="Party details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Package">
              <select
                value={pkg}
                onChange={(e) => {
                  const next = e.target.value as PackageId;
                  setPkg(next);
                  setStartTime(to24h((next === 'private' ? PRIVATE_PARTY_TIMES : SEMI_PARTY_TIMES)[0]));
                  setHeadcount(String(PACKAGES[next].includedKids));
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              >
                <option value="private">Private — $1,250 (includes 15 kids + birthday child)</option>
                <option value="semi">Semi-Private — $650 (includes 10 kids + birthday child)</option>
              </select>
            </Field>

            <Field label="Headcount (total kids incl. birthday child)">
              <input
                type="number"
                min={1}
                max={40}
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>

            <Field label="Start time">
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={to24h(t)}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Extension">
              <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={extension60}
                  onChange={(e) => setExtension60(e.target.checked)}
                  className="h-4 w-4 accent-coral"
                />
                <span>Add 1 hour ({pkg === 'private' ? '+$500' : '+$250'})</span>
              </label>
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Child name">
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Child age (turning)">
              <input
                type="number"
                min={0}
                max={20}
                value={childAge}
                onChange={(e) => setChildAge(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              placeholder="Theme, allergies, special requests…"
            />
          </Field>
        </Card>

        {/* Parent contact */}
        <Card title="Parent contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Parent name">
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
          </div>
        </Card>

        {/* Invoice type */}
        <Card title="What to invoice">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard
              checked={invoiceType === 'deposit_only'}
              onClick={() => setInvoiceType('deposit_only')}
              title="Deposit only (50%)"
              blurb="Lock the date. Add-ons + balance get invoiced later."
              amount={pricing ? fmt(pricing.depositCents) : '—'}
            />
            <ChoiceCard
              checked={invoiceType === 'full'}
              onClick={() => setInvoiceType('full')}
              title="Full payment"
              blurb="One invoice for the whole thing — party + add-ons + tax."
              amount={pricing ? fmt(pricing.totalCents + addOnsTotalCents) : '—'}
            />
          </div>
        </Card>

        {/* Theme picker */}
        <Card
          title="Invoice theme"
          subtitle="Drives the look of the email the parent receives."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {INVOICE_THEME_LIST.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setTheme(t.slug)}
                className={`overflow-hidden rounded-2xl border-2 p-3 text-left transition ${
                  theme === t.slug ? 'border-coral shadow-card' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`mb-2 h-10 w-full rounded-lg ${t.swatchClass}`} />
                <p className="text-xs font-bold text-slate-700">{t.name}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Add-ons grid (only relevant for full invoice) */}
        {invoiceType === 'full' && (
          <Card
            title="Add-ons"
            subtitle="Tick everything for the full invoice. Adjust price/qty per row."
          >
            <div className="divide-y divide-slate-100">
              {Object.entries(grouped).map(([category, list]) => (
                <div key={category} className="py-3 first:pt-0 last:pb-0">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category}
                  </p>
                  <div className="space-y-1.5">
                    {list.map((c) => {
                      const r = addOnRows[c.id];
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition ${
                            r.checked ? 'bg-coral-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={r.checked}
                            onChange={() => toggleAddOn(c.id)}
                            className="h-4 w-4 flex-none accent-coral"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-700">{c.name}</p>
                            {c.hint && <p className="truncate text-[11px] text-slate-400">{c.hint}</p>}
                          </div>
                          <div className="flex flex-none items-center gap-1">
                            <span className="text-[11px] text-slate-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.priceDollars}
                              onChange={(e) => setAddOnField(c.id, 'priceDollars', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-700 focus:border-coral focus:outline-none"
                            />
                            <span className="ml-1 text-[11px] text-slate-400">×</span>
                            <input
                              type="number"
                              min="1"
                              value={r.qty}
                              onChange={(e) => setAddOnField(c.id, 'qty', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-700 focus:border-coral focus:outline-none"
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Right column: live totals + submit */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card title="Summary">
          {pricing ? (
            <dl className="space-y-2 text-sm">
              <Row label="Package" value={fmt(pricing.baseCents)} />
              {pricing.extensionCents > 0 && (
                <Row label="Extension" value={fmt(pricing.extensionCents)} />
              )}
              {pricing.extraKidCount > 0 && (
                <Row
                  label={`Extra kids × ${pricing.extraKidCount}`}
                  value={fmt(pricing.extraKidCents)}
                />
              )}
              {pricing.discountApplied && (
                <Row
                  label="Mon–Thu 20% off"
                  value={`−${fmt(pricing.discountCents)}`}
                  accent
                />
              )}
              <Row label="Tax (8.875%)" value={fmt(pricing.taxCents)} />
              <hr className="border-slate-100" />
              <Row label="Party total" value={<strong>{fmt(pricing.totalCents)}</strong>} />
              {invoiceType === 'full' && addOnsTotalCents > 0 && (
                <Row label="Add-ons" value={fmt(addOnsTotalCents)} />
              )}
              <hr className="border-slate-100" />
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {invoiceType === 'full' ? 'Invoice now' : 'Deposit now'}
                </span>
                <span className="font-display text-2xl text-coral">
                  {fmt(invoiceAmountCents)}
                </span>
              </div>
              {invoiceType === 'deposit_only' && (
                <p className="text-xs text-slate-400">
                  Balance of {fmt(pricing.totalCents - pricing.depositCents)} invoiced later.
                </p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Pick a date to see totals.</p>
          )}
        </Card>

        {error && (
          <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !pricing}
          className="hidden w-full rounded-full bg-coral px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50 lg:block"
        >
          {submitting
            ? 'Creating…'
            : invoiceType === 'full'
              ? `Send full invoice (${fmt(invoiceAmountCents)})`
              : `Send deposit invoice (${fmt(invoiceAmountCents)})`}
        </button>
      </aside>

      {/* Mobile-only sticky submit bar — always reachable */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-6px_18px_rgba(15,23,42,0.06)] lg:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex-1 leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {invoiceType === 'full' ? 'Invoice now' : 'Deposit now'}
          </p>
          <p className="font-display text-lg text-coral">
            {pricing ? fmt(invoiceAmountCents) : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !pricing}
          className="rounded-full bg-coral px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Sending…' : invoiceType === 'full' ? 'Send invoice' : 'Send deposit'}
        </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={accent ? 'font-semibold text-coral' : 'text-slate-700'}>{value}</dd>
    </div>
  );
}

function ChoiceCard({
  checked,
  onClick,
  title,
  blurb,
  amount,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
  amount: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 p-4 text-left transition ${
        checked ? 'border-coral bg-coral-50 shadow-card' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="font-display text-base text-coral">{amount}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">{blurb}</p>
    </button>
  );
}
