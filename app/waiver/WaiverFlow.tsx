'use client';

import { useEffect, useMemo, useState } from 'react';
import { SignatureCanvas } from '@/components/SignatureCanvas';
import {
  WAIVER_TITLE,
  WAIVER_INTRO,
  WAIVER_SECTIONS,
} from '@/lib/waiver-text';

type KnownChild = {
  id: string;
  name: string;
  date_of_birth: string | null;
  notes: string | null;
};

type LookupResult = {
  found: boolean;
  parent?: { name: string; email: string; phone: string; customer_id: string | null };
  known_children: KnownChild[];
  active_waiver?: {
    id: string;
    signed_at: string;
    expires_at: string;
    document_version: string;
    covered_children: Array<{ child_id: string | null; child_name: string }>;
    needs_resign_for_version: boolean;
  };
};

type ChildRow = {
  // local UI id (uuid client-side is fine; server uses child_id from db only if set)
  uiId: string;
  child_id: string | null;
  name: string;
  date_of_birth: string;
  allergies: string;
};

const LS_KEY = 'wonderland_waiver_email';

export function WaiverFlow({ prefillEmail, kiosk }: { prefillEmail: string; kiosk: boolean }) {
  const [step, setStep] = useState<'email' | 'status' | 'form' | 'done'>('email');
  const [email, setEmail] = useState(prefillEmail);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ expiresAt: string } | null>(null);

  // Form state
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [printedName, setPrintedName] = useState('');
  const [agreed, setAgreed] = useState(false);

  // On mount, if no prefill, check localStorage
  useEffect(() => {
    if (!prefillEmail && !kiosk && typeof window !== 'undefined') {
      const remembered = window.localStorage.getItem(LS_KEY);
      if (remembered) setEmail(remembered);
    }
  }, [prefillEmail, kiosk]);

  const doLookup = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/waivers/lookup?email=${encodeURIComponent(email.trim())}`);
      const data: LookupResult = await res.json();
      setLookup(data);

      if (data.parent) {
        setParentName(data.parent.name);
        setParentPhone(data.parent.phone);
      }
      // Seed form children from known kids
      if (data.known_children.length > 0) {
        setChildren(
          data.known_children.map((c) => ({
            uiId: c.id,
            child_id: c.id,
            name: c.name,
            date_of_birth: c.date_of_birth ?? '',
            allergies: extractAllergies(c.notes),
          })),
        );
      } else {
        setChildren([emptyChild()]);
      }
      setStep('status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!signatureDataUrl) {
      setError('Please sign above to continue.');
      return;
    }
    if (!agreed) {
      setError('You must check the box affirming you agree to continue.');
      return;
    }
    if (!printedName.trim()) {
      setError('Please print your name.');
      return;
    }
    const cleanChildren = children
      .filter((c) => c.name.trim())
      .map((c) => ({
        child_id: c.child_id ?? undefined,
        name: c.name.trim(),
        date_of_birth: c.date_of_birth || undefined,
        allergies: c.allergies.trim() || undefined,
      }));
    if (cleanChildren.length === 0) {
      setError('Add at least one child.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/waivers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          parent_name: parentName.trim(),
          parent_email: email.trim(),
          parent_phone: parentPhone.trim(),
          emergency_contact_name: emergencyName.trim() || undefined,
          emergency_contact_phone: emergencyPhone.trim() || undefined,
          signature_data_url: signatureDataUrl,
          signature_typed_name: printedName.trim(),
          agreed: true,
          children: cleanChildren,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not submit. Try again.');
        setSubmitting(false);
        return;
      }
      if (typeof window !== 'undefined' && !kiosk) {
        window.localStorage.setItem(LS_KEY, email.trim().toLowerCase());
      }
      setConfirmation({ expiresAt: data.expires_at });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step: DONE ──────────────────────────────────────────────────────────
  if (step === 'done' && confirmation) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            Signed ✓
          </p>
          <h1 className="mt-2 font-display text-4xl text-slate-700">All set!</h1>
          <p className="mt-3 text-slate-500">
            Your waiver is on file and valid through{' '}
            <strong>{new Date(confirmation.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
            You won&rsquo;t have to sign again until then.
          </p>
          {kiosk && (
            <button
              type="button"
              onClick={() => location.reload()}
              className="mt-6 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow-playful hover:bg-coral-600"
            >
              Next family →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Step: EMAIL ─────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">Waiver</p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          Sign once a year. Skip the desk paperwork.
        </h1>
        <p className="mt-3 text-slate-500">
          Type your email and we&rsquo;ll check if you&rsquo;re already on file. Active
          waivers cover open play, birthday parties, and any guest kids you bring.
        </p>

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Your email
            </span>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doLookup();
              }}
              placeholder="parent@email.com"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base focus:border-coral focus:outline-none"
            />
          </label>
          {error && <p className="mt-3 text-sm text-coral-700">{error}</p>}
          <button
            type="button"
            onClick={doLookup}
            disabled={loading || !email.trim()}
            className="mt-5 w-full rounded-full bg-coral px-6 py-3.5 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Continue →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Step: STATUS (already signed?) ──────────────────────────────────────
  if (step === 'status') {
    const active = lookup?.active_waiver;
    const stillCurrent = active && !active.needs_resign_for_version;

    if (stillCurrent) {
      const coveredNames = active!.covered_children.map((c) => c.child_name).join(', ');
      const knownNotCovered = (lookup?.known_children ?? []).filter(
        (k) => !active!.covered_children.some((c) => c.child_id === k.id),
      );
      return (
        <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
          <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
              Already on file ✓
            </p>
            <h1 className="mt-2 font-display text-3xl text-slate-700">
              You&rsquo;re good through{' '}
              {new Date(active!.expires_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}.
            </h1>
            <p className="mt-3 text-slate-500">
              Covered kids: <strong>{coveredNames || '—'}</strong>
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Just show this confirmation at the front desk, or tell them the email
              you signed with — we&rsquo;ll find you.
            </p>

            {knownNotCovered.length > 0 && (
              <div className="mt-6 rounded-2xl bg-sunshine-50 border border-sunshine-200 px-4 py-3 text-sm text-slate-700">
                <strong>Need to add another kid?</strong> We have{' '}
                {knownNotCovered.map((k) => k.name).join(', ')} on file but they&rsquo;re
                not on your current waiver. Re-sign below to include them.
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-coral hover:text-coral"
              >
                Sign a new waiver
              </button>
              {!kiosk && (
                <a
                  href="/"
                  className="rounded-full bg-slate-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-600"
                >
                  Back to site
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    // No active waiver, or version changed — go to the form
    return <FormStep />;
  }

  // ─── Step: FORM ──────────────────────────────────────────────────────────
  if (step === 'form') {
    return <FormStep />;
  }

  return null;

  // ─── Inline form component (closes over state) ───────────────────────────
  function FormStep() {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">Waiver</p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          {WAIVER_TITLE}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{WAIVER_INTRO}</p>

        <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 open:shadow-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Read full waiver text
          </summary>
          <div className="mt-4 space-y-5 text-sm leading-relaxed text-slate-600">
            {WAIVER_SECTIONS.map((s, i) => (
              <div key={i}>
                <p className="font-bold text-slate-700">{s.heading}</p>
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="mt-1">
                    {p}
                  </p>
                ))}
                {s.bullets && (
                  <ul className="ml-5 mt-2 list-disc space-y-1">
                    {s.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </details>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Field label="Your name *">
            <input
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Your phone *">
            <input
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Emergency contact name">
            <input
              type="text"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Emergency contact phone">
            <input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl text-slate-700">Children covered</p>
            <button
              type="button"
              onClick={() => setChildren((c) => [...c, emptyChild()])}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:border-coral hover:text-coral"
            >
              + Add kid
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Add every kid you bring to the venue — including birthday boy/girl and any kids you bring as guests.
          </p>

          <div className="mt-4 space-y-3">
            {children.map((c, idx) => (
              <div
                key={c.uiId}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
                  <Field label="Name *">
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) =>
                        setChildren((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, name: e.target.value } : p,
                          ),
                        )
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Date of birth">
                    <input
                      type="date"
                      value={c.date_of_birth}
                      onChange={(e) =>
                        setChildren((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, date_of_birth: e.target.value } : p,
                          ),
                        )
                      }
                      className={inputCls}
                    />
                  </Field>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setChildren((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="self-end pb-3 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-coral"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Field label="Allergies / notes (optional)">
                  <input
                    type="text"
                    value={c.allergies}
                    onChange={(e) =>
                      setChildren((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, allergies: e.target.value } : p,
                        ),
                      )
                    }
                    placeholder="Peanut allergy, etc."
                    className={inputCls}
                  />
                </Field>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <p className="font-display text-xl text-slate-700">Signature</p>
          <SignatureCanvas onChange={setSignatureDataUrl} />

          <Field label="Print full name *">
            <input
              type="text"
              value={printedName}
              onChange={(e) => setPrintedName(e.target.value)}
              placeholder="As it appears legally"
              className={inputCls}
            />
          </Field>

          <label className="flex items-start gap-3 rounded-2xl bg-cream-deep p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-5 w-5 flex-shrink-0 accent-coral"
            />
            <span>
              I certify that I am the parent or legal guardian of the child(ren) listed
              above. I have read and understood this Waiver and Release of Liability,
              and voluntarily agree to its terms.
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-coral px-6 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Sign waiver'}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Valid for 365 days. No re-signing until then.
        </p>
      </div>
    );
  }
}

function emptyChild(): ChildRow {
  return {
    uiId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()),
    child_id: null,
    name: '',
    date_of_birth: '',
    allergies: '',
  };
}

function extractAllergies(notes: string | null | undefined): string {
  if (!notes) return '';
  const m = notes.match(/allergies?:\s*(.+)/i);
  return m ? m[1].trim() : '';
}

const inputCls =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base focus:border-coral focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
