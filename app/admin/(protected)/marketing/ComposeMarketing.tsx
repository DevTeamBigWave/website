'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ComposeMarketing({ recipientCount }: { recipientCount: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [previewEmail, setPreviewEmail] = useState('');
  const [busy, setBusy] = useState<null | 'preview' | 'send'>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canSubmit = subject.trim() && body.trim();

  const preview = async () => {
    if (!previewEmail.trim()) {
      setFeedback('Enter an email to preview to.');
      return;
    }
    setBusy('preview');
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/marketing/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          cta_label: ctaLabel || undefined,
          cta_href: ctaHref || undefined,
          to: previewEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Preview failed: ${data.error ?? 'unknown'}`);
      } else {
        setFeedback(`Preview sent to ${previewEmail}. Check inbox.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (
      !confirm(
        `Send "${subject}" to ${recipientCount} subscriber${recipientCount === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy('send');
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/marketing/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          cta_label: ctaLabel || undefined,
          cta_href: ctaHref || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Send failed: ${data.error ?? 'unknown'}`);
        setBusy(null);
        return;
      }
      setFeedback(`Sent ${data.sent} · failed ${data.failed} · skipped ${data.skipped}`);
      setSubject('');
      setBody('');
      setCtaLabel('');
      setCtaHref('');
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <h2 className="font-display text-xl text-slate-700">Compose</h2>

      <Field label="Subject *">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          placeholder="20% off Mon–Thu private parties through end of month"
          className={inputCls}
        />
      </Field>

      <Field label="Body * (plain text — paragraphs separated by blank lines)">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder={`Quick note from us at Wonderland —\n\nWeekday afternoons are 20% off all this month. If you've been thinking about booking Mia's birthday, this is the cheapest it'll be all year.\n\nThanks,\nWonderland team`}
          className={`${inputCls} font-sans`}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CTA button label (optional)">
          <input
            type="text"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="See party packages"
            maxLength={40}
            className={inputCls}
          />
        </Field>
        <Field label="CTA button link (optional)">
          <input
            type="url"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="https://www.wonderlandplayhouse.com/parties"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <Field label="Send a test preview to one email">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              value={previewEmail}
              onChange={(e) => setPreviewEmail(e.target.value)}
              placeholder="you@email.com"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={preview}
              disabled={busy !== null || !canSubmit}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:border-coral hover:text-coral disabled:opacity-50"
            >
              {busy === 'preview' ? 'Sending…' : 'Preview'}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-coral-50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-700">
              Send to {recipientCount} subscriber{recipientCount === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-slate-500">
              Customers who unsubscribed from promotions are excluded automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={send}
            disabled={busy !== null || !canSubmit}
            className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
          >
            {busy === 'send' ? 'Sending…' : 'Send to all →'}
          </button>
        </div>

        {feedback && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{feedback}</p>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
