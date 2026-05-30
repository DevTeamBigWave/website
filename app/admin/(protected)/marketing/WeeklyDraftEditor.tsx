'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Draft = {
  id: string;
  target_send_date: string;
  notes_for_generator: string | null;
  pre_subject: string | null;
  pre_body: string | null;
  pre_cta_label: string | null;
  pre_cta_href: string | null;
  status: string;
} | null;

export function WeeklyDraftEditor({
  targetDate,
  initial,
  recipientCount,
}: {
  targetDate: string;
  initial: Draft;
  recipientCount: number;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial?.notes_for_generator ?? '');
  const [preSubject, setPreSubject] = useState(initial?.pre_subject ?? '');
  const [preBody, setPreBody] = useState(initial?.pre_body ?? '');
  const [preCtaLabel, setPreCtaLabel] = useState(initial?.pre_cta_label ?? '');
  const [preCtaHref, setPreCtaHref] = useState(initial?.pre_cta_href ?? '');
  const [advanced, setAdvanced] = useState(!!(initial?.pre_subject || initial?.pre_body));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const hasAnything = notes || preSubject || preBody;

  const save = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/marketing/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_send_date: targetDate,
          notes_for_generator: notes || undefined,
          pre_subject: preSubject || undefined,
          pre_body: preBody || undefined,
          pre_cta_label: preCtaLabel || undefined,
          pre_cta_href: preCtaHref || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Save failed: ${data.error ?? 'unknown'}`);
      } else {
        setFeedback('Saved ✓');
        router.refresh();
        setTimeout(() => setFeedback(null), 3000);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    if (
      !confirm(
        `Send the Saturday email to ${recipientCount} subscribers right now? This uses today's notes/pre-write — or AI-generates if both are blank. Saves any unsaved edits first.`,
      )
    ) {
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      // Persist any in-progress edits so the send picks them up.
      await fetch('/api/admin/marketing/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_send_date: targetDate,
          notes_for_generator: notes || undefined,
          pre_subject: preSubject || undefined,
          pre_body: preBody || undefined,
          pre_cta_label: preCtaLabel || undefined,
          pre_cta_href: preCtaHref || undefined,
        }),
      });
      const res = await fetch(
        `/api/admin/marketing/send-saturday?date=${encodeURIComponent(targetDate)}`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setFeedback(`Send failed: ${data.error ?? `HTTP ${res.status}`}`);
      } else if (data.skipped) {
        setFeedback(`Skipped: ${data.skipped}`);
      } else {
        setFeedback(`Sent to ${data.sent}/${data.total}${data.failed ? ` (${data.failed} failed)` : ''} ✓`);
        router.refresh();
      }
    } catch (err) {
      setFeedback(`Send failed: ${err instanceof Error ? err.message : 'network'}`);
    } finally {
      setSending(false);
    }
  };

  const mode = preSubject && preBody ? 'manual' : 'ai';

  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <Field label="Events / promos / context for this week (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={`e.g.\n- Halloween bash Oct 30 at 4pm — kids in costume get a free goodie bag\n- Mon-Thu 20% off still running\n- New entertainment: glam spa day station ($175)`}
          className={inputCls}
        />
      </Field>

      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        className="text-xs font-semibold text-coral hover:text-coral-700"
      >
        {advanced ? '− Hide manual write override' : '+ Write the full email myself instead'}
      </button>

      {advanced && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            If you fill in subject AND body, the AI is skipped — Saturday sends exactly this.
            Leave them blank to use Claude with the notes above.
          </p>
          <Field label="Subject (manual)">
            <input
              type="text"
              value={preSubject}
              onChange={(e) => setPreSubject(e.target.value)}
              maxLength={160}
              className={inputCls}
            />
          </Field>
          <Field label="Body (manual — paragraphs separated by blank lines)">
            <textarea
              value={preBody}
              onChange={(e) => setPreBody(e.target.value)}
              rows={8}
              maxLength={8000}
              className={`${inputCls} font-sans`}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CTA label (optional)">
              <input
                type="text"
                value={preCtaLabel}
                onChange={(e) => setPreCtaLabel(e.target.value)}
                maxLength={40}
                className={inputCls}
              />
            </Field>
            <Field label="CTA link (optional)">
              <input
                type="url"
                value={preCtaHref}
                onChange={(e) => setPreCtaHref(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          {mode === 'manual' ? (
            <>
              <strong>Manual.</strong> Saturday sends your exact subject + body to{' '}
              {recipientCount} subscriber{recipientCount === 1 ? '' : 's'}.
            </>
          ) : hasAnything ? (
            <>
              <strong>AI-assisted.</strong> Saturday morning, Claude writes using
              your notes + Wonderland voice. Sends to {recipientCount} subscriber
              {recipientCount === 1 ? '' : 's'}.
            </>
          ) : (
            <>
              <strong>Full auto.</strong> No notes — Saturday morning Claude
              writes from scratch using brand voice + seasonal context. Sends to{' '}
              {recipientCount} subscriber{recipientCount === 1 ? '' : 's'}.
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {feedback && <span className="text-xs text-slate-500">{feedback}</span>}
          <button
            type="button"
            onClick={save}
            disabled={busy || sending}
            className="rounded-full border-2 border-coral bg-white px-5 py-2 text-sm font-bold text-coral hover:bg-coral-50 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          {initial?.status !== 'sent' && (
            <button
              type="button"
              onClick={sendNow}
              disabled={busy || sending || recipientCount === 0}
              className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send now'}
            </button>
          )}
        </div>
      </div>

      {initial?.status === 'sent' && (
        <p className="text-xs text-sky-700">
          ✓ Already sent for {new Date(targetDate + 'T00:00:00').toLocaleDateString()}. Next Saturday will be a new draft.
        </p>
      )}
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
