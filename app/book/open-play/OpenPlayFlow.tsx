'use client';

import { useEffect, useMemo, useState } from 'react';
import { OPEN_PLAY_PRICE_CENTS, calculateOpenPlayPricing, fmt } from '@/lib/pricing';
import { OPEN_PLAY_HOURS_DISPLAY } from '@/lib/hours';

type AvailabilityRow = {
  date: string;
  blockType: 'full' | 'partial';
  reason: string;
  package?: string;
  startTime?: string;
  totalMinutes?: number;
};

function sqlTimeToDisplay(sql: string, addMinutes = 0): string {
  const [h, m] = sql.split(':').map(Number);
  const total = h * 60 + m + addMinutes;
  let hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const period = hh >= 12 ? 'PM' : 'AM';
  hh = ((hh + 11) % 12) + 1;
  return `${hh}:${String(mm).padStart(2, '0')} ${period}`;
}

export function OpenPlayFlow({ cancelled }: { cancelled: boolean }) {
  const [date, setDate] = useState<Date | null>(null);
  const [numChildren, setNumChildren] = useState(1);
  const [details, setDetails] = useState({
    parentName: '',
    email: '',
    phone: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'at_door'>('online');

  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ticketCode: string;
  } | null>(null);

  useEffect(() => {
    let stop = false;
    fetch('/api/availability?days=30')
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

  const days = useMemo(() => {
    const arr: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

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

  // Days are fully closed only for 'full' blocks (e.g. holidays staff added manually).
  // Private parties create 'partial' blocks now — open play is still bookable on those
  // dates, but we show the closure window to the customer.
  const fullyBlockedByDate = useMemo(() => {
    const set = new Set<string>();
    for (const row of availability) {
      if (row.blockType === 'full') set.add(row.date);
    }
    return set;
  }, [availability]);

  const partialBlocksByDate = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>();
    for (const row of availability) {
      if (row.blockType !== 'partial' || !row.startTime) continue;
      const arr = map.get(row.date) ?? [];
      arr.push(row);
      map.set(row.date, arr);
    }
    return map;
  }, [availability]);

  const isDayClosed = (d: Date): boolean => fullyBlockedByDate.has(isoDate(d));

  const closureWindowsFor = (d: Date | null): string[] => {
    if (!d) return [];
    const rows = partialBlocksByDate.get(isoDate(d)) ?? [];
    return rows.map((r) => {
      const start = sqlTimeToDisplay(r.startTime!);
      const end = sqlTimeToDisplay(r.startTime!, r.totalMinutes ?? 120);
      return `${start} – ${end}`;
    });
  };

  const pricing = useMemo(() => calculateOpenPlayPricing(numChildren), [numChildren]);

  const canSubmit =
    date &&
    numChildren >= 1 &&
    details.parentName.trim() &&
    details.email.trim() &&
    details.phone.trim();

  const onSubmit = async () => {
    if (!canSubmit || !date) return;
    setSubmitting(true);
    setError(null);

    try {
      const body = {
        date: isoDate(date),
        numChildren,
        parentName: details.parentName.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        paymentMethod,
      };

      const res = await fetch('/api/checkout/open-play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not reserve. Try again.');
        setSubmitting(false);
        return;
      }

      if (paymentMethod === 'online') {
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError('Stripe redirect URL missing.');
          setSubmitting(false);
        }
      } else {
        // at_door: show inline confirmation
        setConfirmation({ ticketCode: data.ticketCode });
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            Reserved ✓
          </p>
          <h1 className="mt-2 font-display text-3xl text-slate-700 sm:text-4xl">
            You&rsquo;re on the list.
          </h1>
          <p className="mt-4 text-slate-500">
            Confirmation sent to <strong>{details.email}</strong>. Show this code at
            the front desk when you arrive:
          </p>

          <div className="my-6 rounded-2xl bg-cream-deep px-6 py-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
              Door code
            </p>
            <p className="mt-2 font-display text-4xl tracking-[0.2em] text-slate-700">
              {confirmation.ticketCode.toUpperCase()}
            </p>
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <strong>{date!.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong> · {numChildren} {numChildren === 1 ? 'child' : 'children'}
            </p>
            <p>Drop in any time during open hours. 2-hour stay.</p>
            <p>
              Pay <strong>{fmt(pricing.totalCents)}</strong> + tax at the door (cash or card).
            </p>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Grip socks required for kids and adults. We sell them at the door if you
            forget.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          Open Play
        </p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          Reserve a 2-hour visit.
        </h1>
        <p className="mt-3 text-slate-500">
          <strong className="text-slate-700">Open {OPEN_PLAY_HOURS_DISPLAY}.</strong>{' '}
          $25 per child + tax. Adults free, under 10 months free. Skip the
          front desk by pre-paying.
        </p>
        {cancelled && (
          <div className="mt-4 rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">
            Checkout cancelled. No charge made — pick a date below to try again.
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {/* Step 1 — Date */}
          <Section number="01" title="Pick a day">
            {loadingAvailability ? (
              <p className="text-sm text-slate-500">Loading availability…</p>
            ) : (
              <>
                <div className="space-y-6">
                  {daysByMonth.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 font-display text-lg text-slate-700">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                        {group.days.map((d) => {
                          const selected = date && sameDay(d, date);
                          const closed = isDayClosed(d);
                          const partial = partialBlocksByDate.has(isoDate(d));
                          return (
                            <button
                              key={d.toISOString()}
                              type="button"
                              disabled={closed}
                              onClick={() => setDate(d)}
                              className={`relative rounded-xl border px-2 py-3 text-center transition ${
                                closed
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
                              {closed && (
                                <p className="mt-0.5 text-[8px] font-bold uppercase opacity-60">
                                  Closed
                                </p>
                              )}
                              {partial && !closed && !selected && (
                                <span
                                  className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-sunshine"
                                  aria-label="Partial closure"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Days marked &ldquo;closed&rdquo; are fully unavailable. A yellow dot
                  means a private party is booked for part of the day — open play
                  pauses during that window only.
                </p>

                {date && closureWindowsFor(date).length > 0 && (
                  <div className="mt-4 rounded-2xl border-2 border-sunshine-200 bg-sunshine-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-coral-700">
                      Heads up — open play paused
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      A private party is booked on this date during:{' '}
                      <strong>{closureWindowsFor(date).join(' · ')}</strong>. Plan
                      your visit before or after that window.
                    </p>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Step 2 — Headcount */}
          {date && (
            <Section number="02" title="How many kids?">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNumChildren(Math.max(1, numChildren - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-700 transition hover:border-slate-400"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="font-display text-3xl text-slate-700">
                  {numChildren}
                </span>
                <button
                  type="button"
                  onClick={() => setNumChildren(Math.min(10, numChildren + 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-700 transition hover:border-slate-400"
                  aria-label="Increase"
                >
                  +
                </button>
                <span className="ml-3 text-sm text-slate-500">Adults free</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Children under 10 months are free — don&rsquo;t count them here.
              </p>
            </Section>
          )}

          {/* Step 3 — Details */}
          {date && (
            <Section number="03" title="Your contact info">
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
              </div>
            </Section>
          )}

          {/* Step 4 — Payment */}
          {date && (
            <Section number="04" title="How to pay">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`rounded-2xl border-2 p-5 text-left transition ${
                    paymentMethod === 'online'
                      ? 'border-coral bg-coral text-white shadow-playful'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p
                    className={`text-xs font-bold uppercase tracking-wider ${
                      paymentMethod === 'online' ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    Recommended
                  </p>
                  <p
                    className={`mt-1 font-display text-xl ${
                      paymentMethod === 'online' ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    Pay online now
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      paymentMethod === 'online' ? 'text-white/80' : 'text-slate-500'
                    }`}
                  >
                    Skip the front desk. Show your ticket and walk straight in.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('at_door')}
                  className={`rounded-2xl border-2 p-5 text-left transition ${
                    paymentMethod === 'at_door'
                      ? 'border-slate-700 bg-slate-700 text-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p
                    className={`text-xs font-bold uppercase tracking-wider ${
                      paymentMethod === 'at_door' ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    Or
                  </p>
                  <p
                    className={`mt-1 font-display text-xl ${
                      paymentMethod === 'at_door' ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    Pay at the door
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      paymentMethod === 'at_door' ? 'text-white/80' : 'text-slate-500'
                    }`}
                  >
                    Reserve your spot now, pay cash or card when you arrive.
                  </p>
                </button>
              </div>
            </Section>
          )}

          {/* Submit */}
          {date && (
            <div className="space-y-3">
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
                  ? paymentMethod === 'online'
                    ? 'Starting checkout…'
                    : 'Reserving…'
                  : paymentMethod === 'online'
                    ? `Pay ${fmt(pricing.totalCents)} & reserve`
                    : `Reserve (pay ${fmt(pricing.totalCents)} at door)`}
              </button>
              <p className="text-xs text-slate-400">
                {paymentMethod === 'online'
                  ? "You'll be redirected to Stripe."
                  : 'No charge now. Pay cash or card at the front desk.'}
              </p>
            </div>
          )}
        </div>

        {/* Sticky summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-slate-700 p-6 text-white shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-sunshine">
              Your visit
            </p>
            <h2 className="mt-2 font-display text-2xl">
              {date
                ? date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Pick a date'}
            </h2>

            <div className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
              <Row
                label={`${numChildren} ${numChildren === 1 ? 'child' : 'children'} × ${fmt(OPEN_PLAY_PRICE_CENTS)}`}
                value={fmt(pricing.totalCents)}
              />
              <Row label="Adults" value="Free" />
              <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-3">
                <span className="text-sm text-white/85">Total</span>
                <span className="font-display text-2xl">
                  {fmt(pricing.totalCents)}
                </span>
              </div>
              <p className="text-xs text-white/60">
                + 8.875% NYC tax at checkout
              </p>
            </div>

            <ul className="mt-6 space-y-2 border-t border-white/15 pt-4 text-xs text-white/80">
              <li>✓ 2-hour visit</li>
              <li>✓ Adults play free</li>
              <li>✓ Under 10 months free</li>
              <li>✓ Ages 0–8 only</li>
              <li>✓ Grip socks required (sold at door)</li>
            </ul>
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
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
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
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/70">{label}</span>
      <span className="text-white">{value}</span>
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
