'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PACKAGES,
  EXTENSIONS,
  calculatePartyPricing,
  partyTimesFor,
  getExtensionPriceCents,
  fmt,
  type PackageId,
  type ExtensionId,
} from '@/lib/pricing';
import { GiftCardInput } from '@/components/GiftCardInput';

type AvailabilityRow = {
  date: string;
  blockType: 'full' | 'partial';
  reason: string;
  package?: string;
  startTime?: string;
  totalMinutes?: number;
};

function timeStringToMinutes(t: string): number {
  // Accepts "10:00 AM" or "13:00:00"
  if (t.includes('AM') || t.includes('PM')) {
    const [hm, period] = t.split(' ');
    let [h, m] = hm.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function BookingFlow({ cancelled }: { cancelled: boolean }) {
  // Selection state
  const [packageId, setPackageId] = useState<PackageId | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState<ExtensionId | null>(null);
  const [details, setDetails] = useState({
    parentName: '',
    email: '',
    phone: '',
    childName: '',
    childDob: '',
    headcount: '',
    notes: '',
    playlistUrl: '',
  });

  // Network state
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [giftCard, setGiftCard] = useState<{ code: string; balanceCents: number } | null>(null);

  useEffect(() => {
    let stop = false;
    fetch('/api/availability?days=60')
      .then((r) => r.json())
      .then((data) => {
        if (stop) return;
        setAvailability(data.availability ?? []);
        setLoadingAvailability(false);
      })
      .catch(() => {
        if (stop) return;
        setLoadingAvailability(false);
      });
    return () => {
      stop = true;
    };
  }, []);

  // Build next 45 days
  const days = useMemo(() => {
    const arr: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 45; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>();
    for (const row of availability) {
      const arr = map.get(row.date) ?? [];
      arr.push(row);
      map.set(row.date, arr);
    }
    return map;
  }, [availability]);

  // Group days by month for header rows
  const daysByMonth = useMemo(() => {
    const groups: { label: string; days: Date[] }[] = [];
    let current: { label: string; days: Date[] } | null = null;
    for (const d of days) {
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!current || current.label !== label) {
        current = { label, days: [] };
        groups.push(current);
      }
      current.days.push(d);
    }
    return groups;
  }, [days]);

  const isDayUnavailable = (d: Date): boolean => {
    if (!packageId) return false;
    const key = isoDate(d);
    const rows = blockedByDate.get(key) ?? [];
    if (rows.some((r) => r.blockType === 'full' || r.package === 'private')) return true;
    if (packageId === 'private' && rows.length > 0) return true;
    return false;
  };

  // A proposed (start, duration) is "unavailable" if it overlaps an existing
  // party on that day. Used both to gray out time-slot buttons AND to disable
  // the 1-hour extension option when it would push into the next booking.
  const timeOverlapsExisting = (
    t: string,
    durationMinutes: number,
  ): boolean => {
    if (!date || !packageId) return false;
    const key = isoDate(date);
    const rows = blockedByDate.get(key) ?? [];
    const newStart = timeStringToMinutes(t);
    const newEnd = newStart + durationMinutes;
    return rows.some((r) => {
      if (!r.startTime) return false;
      const eStart = timeStringToMinutes(r.startTime);
      const eEnd = eStart + (r.totalMinutes ?? 120);
      return newStart < eEnd && eStart < newEnd;
    });
  };

  const isTimeUnavailable = (t: string): boolean =>
    timeOverlapsExisting(t, PACKAGES[packageId!].durationMinutes);

  // For the extension option — would adding 60 minutes cause an overlap?
  const wouldExtensionOverlap = (): boolean => {
    if (!packageId || !date || !time) return false;
    return timeOverlapsExisting(
      time,
      PACKAGES[packageId].durationMinutes + 60,
    );
  };

  const pricing = useMemo(() => {
    if (!packageId || !date || !time) return null;
    const headcount = Number(details.headcount);
    return calculatePartyPricing({
      packageId,
      date,
      time,
      extensionId,
      headcount: Number.isFinite(headcount) && headcount > 0 ? headcount : undefined,
    });
  }, [packageId, date, time, extensionId, details.headcount]);

  const headcountNum = Number(details.headcount);
  const headcountValid =
    Number.isFinite(headcountNum) && headcountNum >= 1 && headcountNum <= 40;

  const canSubmit =
    packageId &&
    date &&
    time &&
    details.parentName.trim() &&
    details.email.trim() &&
    details.phone.trim() &&
    details.childName.trim() &&
    details.childDob &&
    headcountValid &&
    pricing;

  const onSubmit = async () => {
    if (!canSubmit || !packageId || !date || !time) return;
    setSubmitting(true);
    setError(null);

    try {
      const body = {
        packageId,
        date: isoDate(date),
        time,
        extensionId,
        parentName: details.parentName.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        childName: details.childName.trim(),
        childDob: details.childDob,
        headcount: Number(details.headcount),
        notes: [details.notes, details.playlistUrl ? `Spotify: ${details.playlistUrl}` : '']
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 2000),
        ...(giftCard ? { giftCardCode: giftCard.code } : {}),
      };

      const res = await fetch('/api/checkout/party', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start checkout. Try again.');
        setSubmitting(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Checkout response missing redirect URL.');
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          Book a Party
        </p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          Lock in your child&rsquo;s date.
        </h1>
        <p className="mt-3 text-slate-500">
          Pick a package, choose your time, tell us about your kiddo. A 50%
          deposit secures the date.
        </p>
        {cancelled && (
          <div className="mt-4 rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">
            Checkout cancelled. No charge made — start again whenever you&rsquo;re ready.
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {/* Step 1 — Package */}
          <Section number="01" title="Pick your package">
            <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(PACKAGES) as PackageId[]).map((id) => {
                const pkg = PACKAGES[id];
                const selected = packageId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPackageId(id);
                      setDate(null);
                      setTime(null);
                    }}
                    className={`text-left rounded-3xl border-2 p-6 transition ${
                      selected
                        ? 'border-coral bg-coral text-white shadow-playful'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className={`text-xs font-bold uppercase tracking-wider ${
                      selected ? 'text-white/80' : 'text-slate-400'
                    }`}>
                      {pkg.name}
                    </p>
                    <p className={`mt-1 font-display text-3xl ${
                      selected ? 'text-white' : 'text-slate-700'
                    }`}>
                      ${(pkg.priceCents / 100).toLocaleString()}
                    </p>
                    <p className={`mt-2 text-sm ${
                      selected ? 'text-white/90' : 'text-slate-500'
                    }`}>
                      {pkg.description}
                    </p>
                    <ul className={`mt-4 space-y-1 text-xs ${
                      selected ? 'text-white/85' : 'text-slate-500'
                    }`}>
                      {pkg.includes.map((line) => (
                        <li key={line}>✓ {line}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Step 2 — Date + Time */}
          {packageId && (
            <Section number="02" title="Pick a date and time">
              {loadingAvailability ? (
                <p className="text-sm text-slate-500">Loading availability…</p>
              ) : (
                <>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </p>
                  <div className="space-y-6">
                    {daysByMonth.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 font-display text-lg text-slate-700">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                          {group.days.map((d) => {
                            const selected = date && sameDay(d, date);
                            const blocked = isDayUnavailable(d);
                            return (
                              <button
                                key={d.toISOString()}
                                type="button"
                                disabled={blocked}
                                onClick={() => {
                                  setDate(d);
                                  setTime(null);
                                }}
                                className={`relative rounded-xl border px-2 py-3 text-center transition ${
                                  blocked
                                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                                    : selected
                                      ? 'border-coral bg-coral text-white'
                                      : 'border-slate-200 bg-white hover:border-slate-400'
                                }`}
                              >
                                <p className="text-[10px] uppercase tracking-wider opacity-70">
                                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                </p>
                                <p className="font-display text-xl">{d.getDate()}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {date && (
                    <>
                      <p className="mt-8 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Start time
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {partyTimesFor(packageId!).map((t) => {
                          const blocked = isTimeUnavailable(t);
                          const selected = time === t;
                          const isWeekday = date.getDay() >= 1 && date.getDay() <= 4;
                          const isDiscountSlot = t === '12:00 PM' || t === '2:00 PM';
                          const willDiscount =
                            packageId === 'private' && isWeekday && isDiscountSlot;
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={blocked}
                              onClick={() => setTime(t)}
                              className={`rounded-full border px-4 py-2 text-sm transition ${
                                blocked
                                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
                                  : selected
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-slate-200 bg-white hover:border-slate-400'
                              }`}
                            >
                              {t}
                              {willDiscount && !selected && !blocked && (
                                <span className="ml-2 rounded-full bg-sunshine-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                  −20%
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {packageId === 'private' && (
                        <p className="mt-3 text-xs text-slate-400">
                          Need a different start time? Privates are flexible —{' '}
                          <a href="tel:+17188891777" className="font-semibold text-coral hover:text-coral-700">
                            call us
                          </a>{' '}
                          and we&rsquo;ll work it out.
                        </p>
                      )}
                    </>
                  )}

                  {date && time && (
                    <>
                      <p className="mt-8 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Extra time?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setExtensionId(null)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${
                            !extensionId
                              ? 'border-slate-700 bg-slate-700 text-white'
                              : 'border-slate-200 bg-white hover:border-slate-400'
                          }`}
                        >
                          Two hours is plenty
                        </button>
                        {(Object.keys(EXTENSIONS) as ExtensionId[]).map((eId) => {
                          const e = EXTENSIONS[eId];
                          const selected = extensionId === eId;
                          const overlapBlocked = wouldExtensionOverlap();
                          const extCents = getExtensionPriceCents(packageId!, eId);
                          return (
                            <button
                              key={eId}
                              type="button"
                              disabled={overlapBlocked && !selected}
                              onClick={() => setExtensionId(eId)}
                              title={
                                overlapBlocked
                                  ? 'Cannot add — would overlap with a back-to-back party'
                                  : undefined
                              }
                              className={`rounded-full border px-4 py-2 text-sm transition ${
                                overlapBlocked && !selected
                                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                                  : selected
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-slate-200 bg-white hover:border-slate-400'
                              }`}
                            >
                              +{e.label} · {fmt(extCents)}
                            </button>
                          );
                        })}
                      </div>
                      {wouldExtensionOverlap() && (
                        <p className="mt-2 text-xs text-coral-700">
                          Heads up: a 1-hour extension would overlap a back-to-back
                          party. Pick a different time slot to enable the extension.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Step 3 — Details */}
          {packageId && date && time && (
            <Section number="03" title="Your details">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldInput
                  label="Your name"
                  value={details.parentName}
                  onChange={(v) => setDetails({ ...details, parentName: v })}
                  required
                  full
                />
                <FieldInput
                  label="Email"
                  value={details.email}
                  onChange={(v) => setDetails({ ...details, email: v })}
                  required
                  type="email"
                />
                <FieldInput
                  label="Phone"
                  value={details.phone}
                  onChange={(v) => setDetails({ ...details, phone: v })}
                  required
                  type="tel"
                />
                <FieldInput
                  label="Birthday child's name"
                  value={details.childName}
                  onChange={(v) => setDetails({ ...details, childName: v })}
                  required
                />
                <FieldInput
                  label="Birthday (MM/DD/YYYY)"
                  value={details.childDob}
                  onChange={(v) => setDetails({ ...details, childDob: v })}
                  type="date"
                  required
                />
                <div>
                  <FieldInput
                    label="Total kids (incl. birthday child)"
                    value={details.headcount}
                    onChange={(v) => setDetails({ ...details, headcount: v })}
                    type="number"
                    required
                  />
                  {packageId && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      {PACKAGES[packageId].includedKids} kids included ·
                      $25/extra · max 40
                    </p>
                  )}
                </div>
                <FieldInput
                  label="Spotify playlist URL (optional)"
                  value={details.playlistUrl}
                  onChange={(v) => setDetails({ ...details, playlistUrl: v })}
                  placeholder="https://open.spotify.com/playlist/..."
                  full
                />
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Anything else? (theme ideas, allergies, etc.)
                    </span>
                    <textarea
                      value={details.notes}
                      onChange={(e) =>
                        setDetails({ ...details, notes: e.target.value })
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            </Section>
          )}

          {/* Submit */}
          {packageId && date && time && (
            <div className="space-y-3">
              {pricing && (
                <GiftCardInput
                  appliedCard={giftCard}
                  onApply={setGiftCard}
                  onClear={() => setGiftCard(null)}
                  maxApplyCents={pricing.depositCents}
                />
              )}
              {error && (
                <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit || submitting}
                className="w-full rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? 'Starting checkout…'
                  : pricing
                    ? (() => {
                        const credit = giftCard
                          ? Math.min(giftCard.balanceCents, pricing.depositCents)
                          : 0;
                        const owed = pricing.depositCents - credit;
                        return owed <= 0
                          ? `Confirm with gift card · lock the date`
                          : `Pay ${fmt(owed)} deposit & lock the date`;
                      })()
                    : 'Complete the form to continue'}
              </button>
              <p className="text-xs text-slate-400">
                You&rsquo;ll be redirected to Stripe to pay. Refundable up to 14 days before.
              </p>
            </div>
          )}
        </div>

        {/* Sticky summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-slate-700 p-6 text-white shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-sunshine">
              Your party
            </p>
            <h2 className="mt-2 font-display text-2xl">
              {packageId ? PACKAGES[packageId].name : 'Pick a package'}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {date
                ? date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
              {time ? ` · ${time}` : ''}
            </p>

            {pricing && (
              <div className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
                <Row label={PACKAGES[packageId!].name} value={fmt(pricing.baseCents)} />
                {extensionId && (
                  <Row
                    label={`+${EXTENSIONS[extensionId].label}`}
                    value={fmt(pricing.extensionCents)}
                  />
                )}
                {pricing.extraKidCount > 0 && (
                  <Row
                    label={`+${pricing.extraKidCount} extra ${pricing.extraKidCount === 1 ? 'kid' : 'kids'} ($25 ea)`}
                    value={fmt(pricing.extraKidCents)}
                  />
                )}
                {pricing.discountApplied && (
                  <Row
                    label="Mon–Thu discount"
                    value={`−${fmt(pricing.discountCents)}`}
                    accent
                  />
                )}
                <Row label="Tax (8.875%)" value={fmt(pricing.taxCents)} />
                <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-3">
                  <span className="text-sm text-white/85">Total</span>
                  <span className="font-display text-2xl">{fmt(pricing.totalCents)}</span>
                </div>
                {giftCard && (
                  <Row
                    label="Gift card"
                    value={`−${fmt(Math.min(giftCard.balanceCents, pricing.depositCents))}`}
                    accent
                  />
                )}
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-sunshine">Due today</span>
                  <span className="font-display text-3xl text-sunshine">
                    {fmt(
                      Math.max(
                        0,
                        pricing.depositCents -
                          (giftCard
                            ? Math.min(giftCard.balanceCents, pricing.depositCents)
                            : 0),
                      ),
                    )}
                  </span>
                </div>
                <p className="text-xs text-white/60">
                  Balance ({fmt(pricing.totalCents - pricing.depositCents)}) due 7 days before the party.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <span className="font-display text-2xl text-coral-200">{number}</span>
        <h2 className="font-display text-2xl text-slate-700">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-coral">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none"
      />
    </label>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={accent ? 'text-sunshine' : 'text-white/70'}>{label}</span>
      <span className={accent ? 'text-sunshine' : 'text-white'}>{value}</span>
    </div>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function sqlTime(displayTime: string): string {
  const [t, period] = displayTime.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}
