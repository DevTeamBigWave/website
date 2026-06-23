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

// Flow: type notes → Generate preview (or skip and type manually) → review
// + tweak inline → optional "Refine with AI" pass → Send now. Sending
// always uses whatever's in the editable fields below, never a blind AI
// roll. So you never fire something you haven't actually read.
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
  const [refineInstructions, setRefineInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [promoCodesUsed, setPromoCodesUsed] = useState<string[]>([]);

  const hasPreview = !!(preSubject || preBody);

  const saveDraft = async () => {
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

  const generatePreview = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/marketing/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setFeedback(`Generate failed: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }
      setPreSubject(data.subject ?? '');
      setPreBody(data.body_text ?? '');
      setPreCtaLabel(data.cta_label ?? '');
      setPreCtaHref(data.cta_href ?? '');
      setPromoCodesUsed(data.promo_codes_used ?? []);
      setFeedback('Preview generated — review below before sending.');
    } catch (err) {
      setFeedback(`Generate failed: ${err instanceof Error ? err.message : 'network'}`);
    } finally {
      setGenerating(false);
    }
  };

  const refineWithAi = async () => {
    if (!preSubject || !preBody) {
      setFeedback('Generate a preview first, then refine it.');
      return;
    }
    if (refineInstructions.trim().length < 2) {
      setFeedback('Tell Claude what to change — e.g. "shorter, drop the second paragraph".');
      return;
    }
    setRefining(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/marketing/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: preSubject,
          body_text: preBody,
          cta_label: preCtaLabel || undefined,
          cta_href: preCtaHref || undefined,
          instructions: refineInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setFeedback(`Refine failed: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }
      setPreSubject(data.subject ?? preSubject);
      setPreBody(data.body_text ?? preBody);
      setPreCtaLabel(data.cta_label ?? '');
      setPreCtaHref(data.cta_href ?? '');
      setRefineInstructions('');
      setFeedback('Refined ✓');
    } catch (err) {
      setFeedback(`Refine failed: ${err instanceof Error ? err.message : 'network'}`);
    } finally {
      setRefining(false);
    }
  };

  const sendNow = async () => {
    if (!preSubject || !preBody) {
      setFeedback('Generate a preview (or type the email manually) before sending.');
      return;
    }
    if (
      !confirm(
        `Send to ${recipientCount} subscribers right now?\n\nSubject: ${preSubject}\n\n${preBody.slice(0, 200)}${preBody.length > 200 ? '…' : ''}`,
      )
    ) {
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      // Save first so the send picks up whatever's currently in the editor.
      // The send pipeline uses pre_subject/pre_body when both are set, so
      // saving = locking in exactly what we just reviewed.
      await fetch('/api/admin/marketing/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_send_date: targetDate,
          notes_for_generator: notes || undefined,
          pre_subject: preSubject,
          pre_body: preBody,
          pre_cta_label: preCtaLabel || undefined,
          pre_cta_href: preCtaHref || undefined,
        }),
      });
      const res = await fetch(
        `/api/admin/marketing/send-saturday?date=${encodeURIComponent(targetDate)}&force=1`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setFeedback(`Send failed: ${data.error ?? `HTTP ${res.status}`}`);
      } else if (data.skipped) {
        setFeedback(`Skipped: ${data.skipped}`);
      } else if (data.sent === 0) {
        setFeedback(
          `Sent 0/${data.total} — all failed. First error: ${data.first_error ?? 'unknown'}`,
        );
      } else {
        setFeedback(
          `Sent ${data.sent}/${data.total}${data.failed ? ` (${data.failed} failed${data.first_error ? `; first: ${data.first_error}` : ''})` : ''} ✓`,
        );
        router.refresh();
      }
    } catch (err) {
      setFeedback(`Send failed: ${err instanceof Error ? err.message : 'network'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <Field label="Events / promos / context for this week (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={`e.g.\n- Halloween bash Oct 30 at 4pm — kids in costume get a free goodie bag\n- Mon-Thu 20% off still running\n- New entertainment: glam spa day station ($175)`}
          className={inputCls}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generatePreview}
          disabled={generating || sending || refining}
          className="rounded-full bg-sky-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50"
        >
          {generating ? 'Generating…' : hasPreview ? 'Regenerate from scratch' : 'Generate preview'}
        </button>
        <p className="self-center text-xs text-slate-500">
          {hasPreview
            ? 'Tweak the copy below, refine with AI, or send when ready.'
            : 'Drafts using your notes + this week’s angle. Nothing sends until you tap Send.'}
        </p>
      </div>

      {hasPreview && (
        <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
              Preview · what {recipientCount} subscribers will receive
            </p>
            {promoCodesUsed.length > 0 && (
              <p className="text-[10px] uppercase tracking-wider text-sky-600">
                Codes wired in: {promoCodesUsed.join(', ')}
              </p>
            )}
          </div>
          <Field label="Subject">
            <input
              type="text"
              value={preSubject}
              onChange={(e) => setPreSubject(e.target.value)}
              maxLength={160}
              className={inputCls}
            />
          </Field>
          <Field label="Body">
            <textarea
              value={preBody}
              onChange={(e) => setPreBody(e.target.value)}
              rows={10}
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
                type="text"
                value={preCtaHref}
                onChange={(e) => setPreCtaHref(e.target.value)}
                className={inputCls}
                placeholder="/parties, /book, etc."
              />
            </Field>
          </div>

          <div className="rounded-lg border border-dashed border-sky-300 bg-white p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-sky-700">
              Refine with AI
            </p>
            <textarea
              value={refineInstructions}
              onChange={(e) => setRefineInstructions(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="e.g. shorter and warmer, drop the third paragraph, lead with the promo code, no CTA"
              className={inputCls}
            />
            <button
              type="button"
              onClick={refineWithAi}
              disabled={refining || sending || generating || !refineInstructions.trim()}
              className="mt-2 rounded-full border border-sky-500 bg-white px-4 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
            >
              {refining ? 'Refining…' : 'Apply with AI'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          Saturday {hasPreview ? 'will send this preview as-is' : 'auto-generates and sends'} to{' '}
          {recipientCount} subscriber{recipientCount === 1 ? '' : 's'}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {feedback && <span className="text-xs text-slate-500">{feedback}</span>}
          <button
            type="button"
            onClick={saveDraft}
            disabled={busy || sending || generating || refining}
            className="rounded-full border-2 border-coral bg-white px-5 py-2 text-sm font-bold text-coral hover:bg-coral-50 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={sendNow}
            disabled={busy || sending || generating || refining || recipientCount === 0 || !hasPreview}
            className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
            title={
              !hasPreview
                ? 'Generate a preview first so you can review the copy before sending.'
                : initial?.status === 'sent'
                  ? 'Draft is marked sent. Press to force a resend (?force=1).'
                  : undefined
            }
          >
            {sending
              ? 'Sending…'
              : initial?.status === 'sent'
                ? 'Force resend'
                : 'Send now'}
          </button>
        </div>
      </div>

      {initial?.status === 'sent' && (
        <p className="text-xs text-sky-700">
          ✓ Already marked sent for {new Date(targetDate + 'T00:00:00').toLocaleDateString()}.
          If Resend doesn&rsquo;t show the messages, tap <strong>Force resend</strong>.
          Next Saturday is a new draft regardless.
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
