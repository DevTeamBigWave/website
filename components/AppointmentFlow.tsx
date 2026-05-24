'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Slot = { startISO: string; endISO: string };
type ApiResponse = {
  type: { slug: string; name: string; duration_minutes: number };
  slots: Slot[];
};

export function AppointmentFlow({
  type,
  title,
  eyebrow,
  blurb,
  successHeadline,
}: {
  type: 'tour' | 'inquiry' | 'planning';
  title: string;
  eyebrow: string;
  blurb: string;
  successHeadline: string;
}) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [typeMeta, setTypeMeta] = useState<{ name: string; duration_minutes: number } | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [details, setDetails] = useState({
    parentName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    startISO: string;
    endISO: string;
    typeName: string;
  } | null>(null);

  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedSlot) return;
    const t = setTimeout(() => {
      contactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(t);
  }, [selectedSlot]);

  useEffect(() => {
    let stop = false;
    fetch(`/api/appointments/availability?type=${type}&days=21`)
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (stop) return;
        setSlots(data.slots ?? []);
        setTypeMeta(data.type ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (stop) return;
        setLoading(false);
        setError('Could not load availability. Refresh to try again.');
      });
    return () => {
      stop = true;
    };
  }, [type]);

  // Group slots by local date
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = new Date(s.startISO).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [slots]);

  const dateKeys = useMemo(() => Array.from(slotsByDate.keys()), [slotsByDate]);

  const canSubmit =
    selectedSlot && details.parentName.trim() && details.email.trim();

  const submit = async () => {
    if (!canSubmit || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          startISO: selectedSlot.startISO,
          parentName: details.parentName.trim(),
          email: details.email.trim(),
          phone: details.phone.trim() || undefined,
          notes: details.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not book. Try again.');
        setSubmitting(false);
        return;
      }
      setConfirmed({
        startISO: data.startISO,
        endISO: data.endISO,
        typeName: data.typeName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            Booked ✓
          </p>
          <h1 className="mt-2 font-display text-3xl text-slate-700 sm:text-4xl">
            {successHeadline}
          </h1>
          <p className="mt-4 text-slate-500">
            Calendar invite sent to <strong>{details.email}</strong>.
          </p>
          <div className="my-6 rounded-2xl bg-cream-deep p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {confirmed.typeName}
            </p>
            <p className="mt-1 font-display text-2xl text-slate-700">
              {formatSlotLong(confirmed.startISO, confirmed.endISO)}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Need to reschedule or cancel? Reply to the calendar invite or email{' '}
            <a
              href="mailto:info@wonderlandplayhouse.com"
              className="font-semibold text-coral hover:text-coral-700"
            >
              info@wonderlandplayhouse.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-slate-500">{blurb}</p>
        {typeMeta && (
          <p className="mt-1 text-xs text-slate-400">
            {typeMeta.duration_minutes} minutes · free
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          <Section number="01" title="Pick a time">
            {loading ? (
              <p className="text-sm text-slate-500">Loading availability…</p>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-6">
                <p className="text-sm text-slate-600">
                  No open slots in the next 21 days. Email us at{' '}
                  <a
                    href="mailto:info@wonderlandplayhouse.com"
                    className="font-semibold text-coral hover:text-coral-700"
                  >
                    info@wonderlandplayhouse.com
                  </a>{' '}
                  and we&rsquo;ll find a time.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {dateKeys.map((key) => {
                  const daySlots = slotsByDate.get(key) ?? [];
                  return (
                    <div key={key}>
                      <p className="mb-2 font-display text-lg text-slate-700">
                        {formatDateHeader(daySlots[0]?.startISO ?? '')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((s) => {
                          const isSelected = selectedSlot?.startISO === s.startISO;
                          return (
                            <button
                              key={s.startISO}
                              type="button"
                              onClick={() => setSelectedSlot(s)}
                              className={`rounded-full border px-4 py-2 text-sm transition ${
                                isSelected
                                  ? 'border-coral bg-coral text-white shadow-playful'
                                  : 'border-slate-200 bg-white hover:border-slate-400'
                              }`}
                            >
                              {formatTime(s.startISO)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {selectedSlot && (
            <Section number="02" title="Your contact info" sectionRef={contactRef}>
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
                  label="Phone (optional)"
                  value={details.phone}
                  onChange={(v) => setDetails({ ...details, phone: v })}
                  type="tel"
                />
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Anything we should know? (optional)
                    </span>
                    <textarea
                      value={details.notes}
                      onChange={(e) =>
                        setDetails({ ...details, notes: e.target.value })
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none"
                      placeholder="Date you're thinking about, kid's age, questions..."
                    />
                  </label>
                </div>
              </div>
            </Section>
          )}

          {selectedSlot && (
            <div className="space-y-3">
              {error && (
                <p className="rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="w-full rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Booking…' : 'Confirm booking'}
              </button>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-slate-700 p-6 text-white shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-sunshine">
              Your booking
            </p>
            <h2 className="mt-2 font-display text-2xl">
              {selectedSlot ? formatSlotLong(selectedSlot.startISO, selectedSlot.endISO) : 'Pick a time'}
            </h2>
            {typeMeta && (
              <p className="mt-2 text-sm text-white/70">
                {typeMeta.name} · {typeMeta.duration_minutes} min · free
              </p>
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
  sectionRef,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  sectionRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section ref={sectionRef}>
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatSlotLong(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const date = start.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const t1 = start.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });
  const t2 = end.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${t1} – ${t2}`;
}
