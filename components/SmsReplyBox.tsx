'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Owner/staff reply box in the SMS thread view. Sends via /api/admin/sms/send,
// then refreshes so the new message appears in the thread.
export function SmsReplyBox({ to }: { to: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sms/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to, body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send.');
        return;
      }
      setBody('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      {error && (
        <p className="mb-2 rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          }}
          rows={2}
          maxLength={1000}
          placeholder="Type a reply… (⌘/Ctrl+Enter to send)"
          className="min-h-[44px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-700 focus:border-coral focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !body.trim()}
          className="h-11 shrink-0 rounded-full bg-coral px-5 text-sm font-bold text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Sends from the business number · standard SMS, no AI.
      </p>
    </div>
  );
}
