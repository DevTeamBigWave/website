'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PACKAGES,
  PRIVATE_PARTY_TIMES,
  calculatePartyPricing,
  type PackageId,
} from '@/lib/pricing';
import { ADD_ON_CATALOG, CATEGORY_LABEL, type AddOnCatalogItem } from '@/lib/add-ons';
import { INVOICE_THEME_LIST, type InvoiceThemeSlug } from '@/lib/invoice-themes';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Years between the child's DOB and a given party date (whole years, party-day rule)
function ageOnDate(dob: string, partyDate: string): number {
  const b = new Date(`${dob}T00:00:00`);
  const p = new Date(`${partyDate}T00:00:00`);
  let age = p.getFullYear() - b.getFullYear();
  const m = p.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && p.getDate() < b.getDate())) age--;
  return age;
}

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
  const [childDob, setChildDob] = useState('');
  const [headcount, setHeadcount] = useState(String(PACKAGES.private.includedKids));
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice settings
  const [invoiceType, setInvoiceType] = useState<'full' | 'deposit_only' | 'custom_deposit'>('deposit_only');
  // Custom deposit amount in dollars (string for the input). Only honored
  // when invoiceType === 'custom_deposit'. Falls back to standard 50% if
  // empty or invalid.
  const [customDepositDollars, setCustomDepositDollars] = useState('');
  const [theme, setTheme] = useState<InvoiceThemeSlug>('wonderland');
  // F&F discount: percent OR flat-$ override. Matches computePartyFinancials
  // semantics — cents > 0 wins over percent (so picking a custom $ amount
  // takes precedence). One state for each so the picker can show both
  // shortcut tiles AND the two custom inputs without fighting itself.
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountCents, setDiscountCents] = useState<number>(0);
  const [discountPctInput, setDiscountPctInput] = useState<string>('');
  const [discountDollarInput, setDiscountDollarInput] = useState<string>('');

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

  // Custom (non-catalog) add-ons added by the owner. Mirrors the existing-
  // party AddOnsEditor's custom item flow. Persisted with the party at
  // submit time and treated identically to catalog items downstream.
  type CustomAddOn = {
    name: string;
    priceDollars: string;
    qty: string;
    notes: string;
  };
  const [customAddOns, setCustomAddOns] = useState<CustomAddOn[]>([]);
  const [customDraft, setCustomDraft] = useState<CustomAddOn>({
    name: '',
    priceDollars: '',
    qty: '1',
    notes: '',
  });
  const [customOpen, setCustomOpen] = useState(false);

  // Time slots depend on package
  // Admin can override the customer-facing semi-private slot restriction
  // (the public /book flow only offers 1pm/2pm for semi). Showing every
  // hourly slot here so Gaby can take whatever time the family negotiates.
  const timeOptions = PRIVATE_PARTY_TIMES;

  // Grouped catalog for the grid
  const grouped = useMemo(() => {
    return ADD_ON_CATALOG.reduce<Record<string, AddOnCatalogItem[]>>((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
  }, []);

  // Selected add-ons (only meaningful for 'full' invoices). Catalog items
  // come from the grid, custom items from the expander below it. The API
  // schema accepts both shapes (catalog_id is optional).
  const selectedAddOns = useMemo(() => {
    const catalogItems = ADD_ON_CATALOG.filter((c) => addOnRows[c.id]?.checked).map((c) => {
      const r = addOnRows[c.id];
      return {
        catalog_id: c.id,
        name: c.name,
        unit_price_cents: Math.round(parseFloat(r.priceDollars || '0') * 100) || 0,
        qty: parseInt(r.qty || '1', 10) || 1,
      };
    });
    const customItems = customAddOns.map((c) => ({
      name: c.name.trim(),
      unit_price_cents: Math.round(parseFloat(c.priceDollars || '0') * 100) || 0,
      qty: parseInt(c.qty || '1', 10) || 1,
      ...(c.notes.trim() ? { notes: c.notes.trim() } : {}),
    }));
    return [...catalogItems, ...customItems];
  }, [addOnRows, customAddOns]);

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

  // Mirror the server pricing math so every amount displayed here matches
  // what the customer is actually about to be invoiced.
  //
  // - Full invoice → grand total (party + add-ons) minus F&F discount on the
  //   whole grand total. Same formula as computePartyFinancials.
  // - Deposit only → 50% of (party − F&F discount on party only). Matches the
  //   customer-side /book deposit, which never bills add-ons up front.
  // - Custom deposit → typed amount, capped at the all-inclusive grand total.
  const partyTotalCents = pricing?.totalCents ?? 0;
  const grandPreDiscount = partyTotalCents + addOnsTotalCents;
  // Custom-$ wins over percent — matches computePartyFinancials.
  const grandManualDiscount = Math.min(
    grandPreDiscount,
    discountCents > 0
      ? discountCents
      : Math.round((grandPreDiscount * discountPercent) / 100),
  );
  const fullAfterDiscount = grandPreDiscount - grandManualDiscount;

  // Deposit-only path discounts the party portion only (matches /book).
  const partyManualDiscount = Math.min(
    partyTotalCents,
    discountCents > 0
      ? Math.round((discountCents * partyTotalCents) / Math.max(1, grandPreDiscount))
      : Math.round((partyTotalCents * discountPercent) / 100),
  );
  const partyAfterDiscount = partyTotalCents - partyManualDiscount;
  const depositAfterDiscount = Math.round(partyAfterDiscount / 2);

  // Custom deposit amount: parse whatever the owner typed. Empty / invalid
  // falls back to the standard 50%, so the "what we'll invoice" pill never
  // displays NaN while they're still typing.
  const customDepositCents = (() => {
    const n = parseFloat(customDepositDollars);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  })();

  const invoiceAmountCents =
    invoiceType === 'full'
      ? fullAfterDiscount
      : invoiceType === 'custom_deposit'
        ? customDepositCents || depositAfterDiscount
        : depositAfterDiscount;

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
    if (invoiceType === 'custom_deposit') {
      if (customDepositCents < 50) {
        setError('Custom deposit must be at least $0.50.');
        return;
      }
      if (customDepositCents > fullAfterDiscount) {
        setError('Custom deposit cannot exceed the grand total.');
        return;
      }
    }

    const verb =
      invoiceType === 'full'
        ? 'Send full invoice'
        : invoiceType === 'custom_deposit'
          ? 'Send custom deposit invoice'
          : 'Send deposit invoice';
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
          child_dob: childDob || undefined,
          headcount: parseInt(headcount, 10),
          notes: notes.trim() || undefined,
          parent_name: parentName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          invoice_theme: theme,
          invoice_type: invoiceType,
          ...(invoiceType === 'custom_deposit'
            ? { custom_deposit_cents: customDepositCents }
            : {}),
          manual_discount_percent: discountCents > 0 ? 0 : discountPercent,
          ...(discountCents > 0 ? { manual_discount_cents: discountCents } : {}),
          add_ons: selectedAddOns,
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
    <div className="grid w-full max-w-full gap-6 overflow-x-hidden pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      {/* Main column */}
      <div className="min-w-0 space-y-6">
        {/* Party details */}
        <Card title="Party details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Package">
              <select
                value={pkg}
                onChange={(e) => {
                  const next = e.target.value as PackageId;
                  setPkg(next);
                  // Admin uses the hourly grid for both packages — keep
                  // whatever time is already chosen instead of forcing
                  // semi back to 1pm.
                  if (!startTime) setStartTime(to24h(PRIVATE_PARTY_TIMES[0]));
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
                onFocus={(e) => e.currentTarget.select()}
                min={1}
                max={40}
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {pkg === 'private'
                  ? '15 kids + birthday child included (16 total). Each extra kid +$25.'
                  : '10 kids + birthday child included (11 total). Each extra kid +$25.'}
                {pricing && pricing.extraKidCount > 0 && (
                  <span className="ml-1 font-semibold text-coral">
                    · +{pricing.extraKidCount} extra ({fmt(pricing.extraKidCents)})
                  </span>
                )}
              </p>
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
            <Field label="Child date of birth">
              <input
                type="date"
                value={childDob}
                onChange={(e) => setChildDob(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
              {childDob && date && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Turning {ageOnDate(childDob, date)} on the party day
                </p>
              )}
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
          <div className="grid gap-2 sm:grid-cols-3">
            <ChoiceCard
              checked={invoiceType === 'deposit_only'}
              onClick={() => setInvoiceType('deposit_only')}
              title="Deposit only (50%)"
              blurb="Lock the date. Add-ons + balance get invoiced later."
              amount={pricing ? fmt(depositAfterDiscount) : null}
            />
            <ChoiceCard
              checked={invoiceType === 'full'}
              onClick={() => setInvoiceType('full')}
              title="Full payment"
              blurb="One invoice for the whole thing — party + add-ons + tax."
              amount={pricing ? fmt(fullAfterDiscount) : null}
            />
            <ChoiceCard
              checked={invoiceType === 'custom_deposit'}
              onClick={() => setInvoiceType('custom_deposit')}
              title="Custom deposit"
              blurb="Pick the exact deposit amount. Balance is the remainder."
              amount={
                invoiceType === 'custom_deposit' && customDepositCents > 0
                  ? fmt(customDepositCents)
                  : null
              }
            />
          </div>

          {invoiceType === 'custom_deposit' && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-cream-deep p-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Deposit amount
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-display text-2xl text-slate-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={customDepositDollars}
                    onChange={(e) =>
                      setCustomDepositDollars(e.target.value.replace(/[^0-9.]/g, ''))
                    }
                    placeholder={pricing ? (pricing.depositCents / 100).toFixed(0) : '0'}
                    className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 font-display text-2xl text-slate-700 focus:border-coral focus:outline-none"
                  />
                  {pricing && (
                    <span className="text-xs text-slate-400">
                      of {fmt(fullAfterDiscount)} total
                    </span>
                  )}
                </div>
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Use this for legacy parties, smaller-deposit arrangements, or
                anything outside the standard 50% rule. Balance shows as owed
                once the deposit is recorded.
              </p>
            </div>
          )}
        </Card>

        {/* Friends & family discount — shortcut tiles + custom % + custom $ */}
        <Card
          title="Friends & family discount"
          subtitle="Owner-applied courtesy. Comes off the grand total on the invoice."
        >
          <div className="grid grid-cols-4 gap-2">
            {([0, 10, 15, 20] as const).map((v) => {
              const isSelected =
                discountCents === 0 && discountPercent === v && !(v === 0 && discountCents > 0);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setDiscountPercent(v);
                    setDiscountCents(0);
                    setDiscountPctInput(v > 0 ? String(v) : '');
                    setDiscountDollarInput('');
                  }}
                  className={`rounded-2xl border-2 px-2 py-3 text-center transition ${
                    isSelected
                      ? 'border-coral bg-coral-50 shadow-card'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p
                    className={`font-display text-base ${
                      isSelected ? 'text-coral' : 'text-slate-700'
                    }`}
                  >
                    {v === 0 ? 'None' : `${v}% off`}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custom %
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="e.g. 25"
                  value={discountPctInput}
                  onChange={(e) => setDiscountPctInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                />
                <span className="text-sm text-slate-400">%</span>
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(discountPctInput, 10);
                    if (!Number.isFinite(n) || n < 0 || n > 100) return;
                    setDiscountPercent(n);
                    setDiscountCents(0);
                    setDiscountDollarInput('');
                  }}
                  className="ml-auto rounded-full bg-coral px-3 py-1 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-coral-600"
                >
                  Apply
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Scales with add-ons.</p>
            </label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custom $
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={discountDollarInput}
                  onChange={(e) =>
                    setDiscountDollarInput(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = parseFloat(discountDollarInput);
                    if (!Number.isFinite(n) || n < 0) return;
                    setDiscountCents(Math.round(n * 100));
                    setDiscountPercent(0);
                    setDiscountPctInput('');
                  }}
                  className="ml-auto rounded-full bg-coral px-3 py-1 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-coral-600"
                >
                  Apply
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Fixed amount.</p>
            </label>
          </div>

          {(discountPercent > 0 || discountCents > 0) && pricing && (
            <p className="mt-3 text-xs text-slate-500">
              Current: <strong className="text-coral">
                {discountCents > 0
                  ? `${fmt(grandManualDiscount)} off`
                  : `${discountPercent}% off · ${fmt(grandManualDiscount)}`}
              </strong>
            </p>
          )}
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

        {/* Add-ons grid — always shown. For deposit-only the ticked add-ons
            are persisted on the party but invoiced later with the balance. */}
        <Card
          title="Add-ons"
          subtitle={
            invoiceType === 'full'
              ? 'Tick everything for the full invoice. Adjust price/qty per row.'
              : 'Optional. Saved on the party — invoiced with the balance later, not on this deposit.'
          }
        >
          {customAddOns.length > 0 && (
            <div className="mb-4 space-y-1.5 rounded-xl border border-slate-200 bg-cream-deep p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Custom items
              </p>
              {customAddOns.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{c.name}</p>
                    {c.notes && <p className="truncate text-xs text-slate-400">{c.notes}</p>}
                  </div>
                  <div className="flex flex-none items-center gap-2 text-sm">
                    <span className="font-semibold text-coral">
                      ${parseFloat(c.priceDollars || '0').toFixed(2)} × {c.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomAddOns((arr) => arr.filter((_, j) => j !== i))}
                      className="rounded-full px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-coral"
                      aria-label={`Remove ${c.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                        className={`flex flex-col gap-2 rounded-xl border px-3 py-3 transition sm:flex-row sm:items-center sm:gap-3 ${
                          r.checked
                            ? 'border-coral bg-coral-50'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={r.checked}
                            onChange={() => toggleAddOn(c.id)}
                            className="h-5 w-5 flex-none accent-coral"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-slate-700">{c.name}</p>
                            {c.hint && <p className="text-xs text-slate-400">{c.hint}</p>}
                          </div>
                        </div>
                        <div className="flex flex-none items-center justify-end gap-1.5 pl-8 sm:pl-0">
                          {c.fixed ? (
                            <span className="font-display text-sm text-coral">{fmt(c.price_cents)}</span>
                          ) : (
                            <>
                              <span className="text-sm text-slate-400">$</span>
                              <input
                                type="number"
                                onFocus={(e) => e.currentTarget.select()}
                                step="0.01"
                                min="0"
                                value={r.priceDollars}
                                onChange={(e) => setAddOnField(c.id, 'priceDollars', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: 88 }}
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
                              />
                              <span className="ml-1 text-sm text-slate-400">×</span>
                              <input
                                type="number"
                                onFocus={(e) => e.currentTarget.select()}
                                min="1"
                                value={r.qty}
                                onChange={(e) => setAddOnField(c.id, 'qty', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: 64 }}
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
                              />
                            </>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Custom item — mirrors the existing-party AddOnsEditor expander
              so Gaby can add ad-hoc items (e.g. specialty cake, character
              from a non-standard vendor) at booking creation. */}
          <details
            open={customOpen}
            onToggle={(e) => setCustomOpen((e.currentTarget as HTMLDetailsElement).open)}
            className="mt-4 rounded-xl border border-slate-200 bg-white"
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">
              + Custom item (not in catalog)
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Name on invoice
                  </span>
                  <input
                    type="text"
                    value={customDraft.name}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Price (USD)
                  </span>
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    step="0.01"
                    min="0"
                    value={customDraft.priceDollars}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, priceDollars: e.target.value }))
                    }
                    className="mt-1 w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Qty
                  </span>
                  <input
                    type="number"
                    onFocus={(e) => e.currentTarget.select()}
                    min="1"
                    value={customDraft.qty}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, qty: e.target.value }))
                    }
                    className="mt-1 w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Notes (optional)
                </span>
                <input
                  type="text"
                  value={customDraft.notes}
                  onChange={(e) =>
                    setCustomDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  placeholder="e.g. Lactose-free, specific flavor"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const name = customDraft.name.trim();
                  const priceCents = Math.round(
                    parseFloat(customDraft.priceDollars || '0') * 100,
                  );
                  const qty = parseInt(customDraft.qty || '1', 10) || 1;
                  if (!name) {
                    setError('Custom item needs a name.');
                    return;
                  }
                  if (!Number.isFinite(priceCents) || priceCents < 0) {
                    setError('Custom item needs a price.');
                    return;
                  }
                  setError(null);
                  setCustomAddOns((arr) => [...arr, { ...customDraft, qty: String(qty) }]);
                  setCustomDraft({ name: '', priceDollars: '', qty: '1', notes: '' });
                  setCustomOpen(false);
                }}
                className="rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-600"
              >
                Add custom item
              </button>
            </div>
          </details>
        </Card>
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
              {addOnsTotalCents > 0 && (
                <Row label="Add-ons" value={fmt(addOnsTotalCents)} />
              )}
              {grandManualDiscount > 0 && (
                <Row
                  label={
                    discountCents > 0
                      ? 'Friends & family discount'
                      : `Friends & family ${discountPercent}% off`
                  }
                  value={`−${fmt(grandManualDiscount)}`}
                  accent
                />
              )}
              <Row
                label="Grand total"
                value={<strong>{fmt(fullAfterDiscount)}</strong>}
              />
              <hr className="border-slate-100" />
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {invoiceType === 'full' ? 'Invoice now' : 'Deposit now'}
                </span>
                <span className="font-display text-2xl text-coral">
                  {fmt(invoiceAmountCents)}
                </span>
              </div>
              {invoiceType !== 'full' && fullAfterDiscount - invoiceAmountCents > 0 && (
                <p className="text-xs text-slate-400">
                  Balance of {fmt(fullAfterDiscount - invoiceAmountCents)} invoiced later.
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
          {pricing ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {invoiceType === 'full' ? 'Invoice now' : 'Deposit now'}
              </p>
              <p className="font-display text-lg text-coral">{fmt(invoiceAmountCents)}</p>
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-500">
              Pick a date to see the total
            </p>
          )}
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
  amount: string | null;
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
        {amount ? (
          <p className="font-display text-base text-coral">{amount}</p>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Pick a date
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{blurb}</p>
    </button>
  );
}
