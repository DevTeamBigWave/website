import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type MsgRow = {
  contact_phone: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sender: string | null;
  created_at: string;
};

type Thread = {
  phone: string;
  last: MsgRow;
  count: number;
  lastInboundAt: string | null;
};

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

async function getThreads(): Promise<Thread[]> {
  const { data } = await supabaseAdmin()
    .from('sms_messages')
    .select('contact_phone, direction, body, sender, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as MsgRow[];
  const map = new Map<string, Thread>();
  for (const r of rows) {
    // rows are newest-first, so the first time we see a phone is its latest msg
    const existing = map.get(r.contact_phone);
    if (!existing) {
      map.set(r.contact_phone, {
        phone: r.contact_phone,
        last: r,
        count: 1,
        lastInboundAt: r.direction === 'inbound' ? r.created_at : null,
      });
    } else {
      existing.count += 1;
      if (!existing.lastInboundAt && r.direction === 'inbound') {
        existing.lastInboundAt = r.created_at;
      }
    }
  }
  return [...map.values()];
}

export default async function MessagesPage() {
  const threads = await getThreads();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every text to and from the business number. The AI answers
          automatically; open a thread to read it or reply yourself.
        </p>
      </header>

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No messages yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Inbound texts and replies will show up here once the Twilio webhook
            is live.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {threads.map((t) => (
            <Link
              key={t.phone}
              href={`/admin/messages/${encodeURIComponent(t.phone)}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-700">{t.phone}</p>
                <p className="truncate text-sm text-slate-500">
                  {t.last.direction === 'outbound' ? (
                    <span className="text-slate-400">
                      {t.last.sender === 'ai'
                        ? 'AI: '
                        : t.last.sender === 'owner'
                          ? 'You: '
                          : ''}
                    </span>
                  ) : null}
                  {t.last.body}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-400">{fmtWhen(t.last.created_at)}</p>
                <p className="text-xs text-slate-400">{t.count} msg</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
