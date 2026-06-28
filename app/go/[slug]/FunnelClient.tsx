'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  computeFunnelResult,
  type Funnel,
  type FunnelAnswers,
  type FunnelStep,
} from '@/lib/funnels';

// GA4 step events — no-op if analytics isn't configured.
function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  w.gtag?.('event', event, params ?? {});
}

export function FunnelClient({ funnel }: { funnel: Funnel }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [segment, setSegment] = useState<string | null>(null);
  // stepIndex: 0 = segment question; 1..N = chosen segment's steps; N+1 = reveal
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<FunnelAnswers>({});

  const activeSegment = useMemo(
    () => funnel.segments.find((s) => s.value === segment) ?? null,
    [funnel, segment],
  );
  const segSteps = activeSegment?.steps ?? [];
  const totalSteps = 1 + segSteps.length; // segment + follow-ups
  const atReveal = segment != null && stepIndex >= totalSteps;

  // Progress: count the segment pick + each answered follow-up, leave room for
  // the reveal so the bar never reads 100% until they're done.
  const progress = Math.min(
    100,
    Math.round((stepIndex / (totalSteps + 1)) * 100),
  );

  function fireStarted() {
    if (!started) {
      setStarted(true);
      track('funnel_started', { funnel: funnel.slug });
    }
  }

  function pickSegment(value: string) {
    fireStarted();
    // Switching segment resets all later picks.
    if (value !== segment) setAnswers({});
    setSegment(value);
    setStepIndex(1);
    track('funnel_step_completed', { funnel: funnel.slug, step: 'segment', value });
  }

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function next(currentStep?: FunnelStep) {
    if (currentStep) {
      track('funnel_step_completed', {
        funnel: funnel.slug,
        step: currentStep.id,
      });
    }
    setStepIndex((i) => i + 1);
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-8 sm:py-12">
      {/* Header / progress */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          {funnel.eyebrow}
        </p>
        <h1 className="mt-1 font-display text-3xl text-slate-700 sm:text-4xl">
          {funnel.title}
        </h1>
        {!segment && (
          <p className="mt-2 text-slate-500">{funnel.subtitle}</p>
        )}

        <div
          className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Quiz progress"
        >
          <div
            className="h-full rounded-full bg-coral transition-all duration-300"
            style={{ width: `${Math.max(progress, 6)}%` }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1">
        {atReveal ? (
          <Reveal funnel={funnel} segment={segment!} answers={answers} router={router} />
        ) : stepIndex === 0 ? (
          <SegmentStep funnel={funnel} selected={segment} onPick={pickSegment} />
        ) : (
          <StepView
            step={segSteps[stepIndex - 1]}
            answers={answers}
            onAnswer={setAnswer}
            onNext={next}
            onBack={back}
            segmentBlurb={stepIndex === 1 ? activeSegment?.blurb : undefined}
          />
        )}
      </div>

      {/* Back from first follow-up returns to segment choice */}
      {stepIndex > 0 && !atReveal && (
        <button
          type="button"
          onClick={back}
          className="mt-6 self-start text-sm font-semibold text-slate-400 hover:text-coral"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function SegmentStep({
  funnel,
  selected,
  onPick,
}: {
  funnel: Funnel;
  selected: string | null;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-slate-700">
        {funnel.segmentStep.question}
      </h2>
      {funnel.segmentStep.help && (
        <p className="mt-1 text-sm text-slate-500">{funnel.segmentStep.help}</p>
      )}
      <div className="mt-6 space-y-3">
        {funnel.segments.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onPick(s.value)}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition hover:border-coral hover:shadow-card ${
              selected === s.value ? 'border-coral shadow-card' : 'border-slate-100'
            }`}
          >
            <span className="text-3xl" aria-hidden>
              {s.emoji}
            </span>
            <span>
              <span className="block font-display text-lg text-slate-700">
                {s.label}
              </span>
              <span className="block text-sm text-slate-500">{s.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepView({
  step,
  answers,
  onAnswer,
  onNext,
  onBack,
  segmentBlurb,
}: {
  step: FunnelStep;
  answers: FunnelAnswers;
  onAnswer: (id: string, v: string | string[]) => void;
  onNext: (s: FunnelStep) => void;
  onBack: () => void;
  segmentBlurb?: string;
}) {
  const value = answers[step.id];

  return (
    <div>
      {segmentBlurb && (
        <div className="mb-5 rounded-2xl bg-sunshine-50 p-4 text-sm text-slate-700">
          {segmentBlurb}
        </div>
      )}
      <h2 className="font-display text-2xl text-slate-700">{step.question}</h2>
      {step.help && <p className="mt-1 text-sm text-slate-500">{step.help}</p>}

      {step.kind === 'single' && (
        <div className="mt-6 space-y-3">
          {step.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onAnswer(step.id, o.value);
                onNext(step);
              }}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition hover:border-coral hover:shadow-card ${
                value === o.value ? 'border-coral shadow-card' : 'border-slate-100'
              }`}
            >
              {o.emoji && (
                <span className="text-2xl" aria-hidden>
                  {o.emoji}
                </span>
              )}
              <span>
                <span className="block font-semibold text-slate-700">{o.label}</span>
                {o.hint && <span className="block text-sm text-slate-500">{o.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {step.kind === 'multi' && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {step.options.map((o) => {
              const arr = Array.isArray(value) ? value : [];
              const on = arr.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onAnswer(
                      step.id,
                      on ? arr.filter((v) => v !== o.value) : [...arr, o.value],
                    )
                  }
                  className={`flex flex-col items-start gap-1 rounded-2xl border-2 bg-white p-4 text-left transition hover:border-coral ${
                    on ? 'border-coral shadow-card' : 'border-slate-100'
                  }`}
                >
                  {o.emoji && (
                    <span className="text-2xl" aria-hidden>
                      {o.emoji}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-700">{o.label}</span>
                </button>
              );
            })}
          </div>
          <PrimaryButton onClick={() => onNext(step)}>Continue →</PrimaryButton>
        </>
      )}

      {step.kind === 'number' && (
        <NumberStep step={step} value={value} onAnswer={onAnswer} onNext={onNext} />
      )}
    </div>
  );
}

function NumberStep({
  step,
  value,
  onAnswer,
  onNext,
}: {
  step: Extract<FunnelStep, { kind: 'number' }>;
  value: string | string[] | undefined;
  onAnswer: (id: string, v: string) => void;
  onNext: (s: FunnelStep) => void;
}) {
  const str = typeof value === 'string' ? value : '';
  const n = parseInt(str, 10);
  const valid = Number.isFinite(n) && n >= step.min && n <= step.max;
  return (
    <div className="mt-6">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={str}
        placeholder={step.placeholder}
        onChange={(e) => onAnswer(step.id, e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onNext(step);
        }}
        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-base text-slate-700 focus:border-coral focus:outline-none"
        aria-label={step.question}
      />
      <p className="mt-2 text-xs text-slate-400">
        Between {step.min} and {step.max}.
      </p>
      <PrimaryButton disabled={!valid} onClick={() => onNext(step)}>
        Continue →
      </PrimaryButton>
    </div>
  );
}

function Reveal({
  funnel,
  segment,
  answers,
  router,
}: {
  funnel: Funnel;
  segment: string;
  answers: FunnelAnswers;
  router: ReturnType<typeof useRouter>;
}) {
  const result = useMemo(
    () => computeFunnelResult(funnel, segment, answers),
    [funnel, segment, answers],
  );

  // Fire result_viewed once.
  useEffect(() => {
    track('funnel_result_viewed', {
      funnel: funnel.slug,
      segment,
      recommended: result.packageId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    // Build the prefilled handoff up front so a notify hiccup can't lose it.
    const params = new URLSearchParams({
      ...result.handoff,
      parentName: name.trim(),
      email: email.trim(),
    });
    if (phone.trim()) params.set('phone', phone.trim());
    const handoffUrl = `${funnel.handoffPath}?${params.toString()}`;

    try {
      const res = await fetch('/api/funnel/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: funnel.slug,
          segment,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          answers,
          result: {
            packageId: result.packageId,
            fromPrice: result.fromPriceLabel,
            metric: result.metricLabel,
            addOns: result.addOns.map((a) => a.name),
          },
          recommendedPackage: result.packageId,
          headcount: result.headcount,
          company, // honeypot
        }),
      });
      if (!res.ok && res.status !== 200) {
        // Capture failed server-side — let them retry rather than lose the data.
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save. Please try again.');
      }
      track('funnel_lead_captured', {
        funnel: funnel.slug,
        segment,
        recommended: result.packageId,
      });
      router.push(handoffUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
          Your match
        </p>
        <h2 className="mt-1 font-display text-3xl text-slate-700">
          {result.packageName} Party
        </h2>
        <p className="mt-1 text-slate-500">
          for about {result.headcount} kids
        </p>

        <div className="my-5 rounded-2xl bg-cream-deep p-5">
          <p className="font-display text-3xl text-slate-700">
            {result.fromPriceLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-coral">{result.metricLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{result.depositLabel}</p>
        </div>

        <ul className="space-y-2">
          {result.summary.map((s) => (
            <li key={s} className="flex gap-2 text-sm text-slate-600">
              <span className="text-coral">✓</span>
              {s}
            </li>
          ))}
        </ul>

        {result.addOns.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Your picks
            </p>
            <ul className="mt-2 space-y-1">
              {result.addOns.map((a) => (
                <li key={a.name} className="flex justify-between text-sm text-slate-600">
                  <span>{a.name}</span>
                  <span className="font-semibold text-slate-700">{a.priceLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Capture */}
      <div className="mt-6 rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <h3 className="font-display text-xl text-slate-700">
          Want us to hold your spot?
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Drop your info and we&rsquo;ll take you straight to booking — pre-filled.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Your name" value={name} onChange={setName} autoComplete="name" />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
          />
          <Field
            label="Phone (optional)"
            value={phone}
            onChange={setPhone}
            type="tel"
            autoComplete="tel"
          />
          {/* Honeypot — hidden from humans */}
          <div className="hidden" aria-hidden>
            <label>
              Company
              <input
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral-700">
            {error}
          </p>
        )}

        <PrimaryButton disabled={!canSubmit || submitting} onClick={submit}>
          {submitting ? 'Saving…' : 'Continue to booking →'}
        </PrimaryButton>
        <p className="mt-3 text-center text-xs text-slate-400">
          No spam. We&rsquo;ll only use this to help with your party.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  // Use text + inputMode for email/tel so iOS never zooms (≥16px via globals too).
  const isEmail = type === 'email';
  const isTel = type === 'tel';
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type={isEmail || isTel ? 'text' : type}
        inputMode={isEmail ? 'email' : isTel ? 'tel' : undefined}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-700 focus:border-coral focus:outline-none"
      />
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
