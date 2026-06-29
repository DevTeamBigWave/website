import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { SmsReplyBox } from '@/components/SmsReplyBox';

export const dynamic = 'force-dynamic';

type MsgRow = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sender: string | null;
  status: string | null;
  error: string | null;
  created_at: string;
};

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone: rawPhone } = await params;
  const phone = decodeURIComponent(rawPhone);
  const db = supabaseAdmin();

  const [{ data: msgData }, { data: customer }] = await Promise.all([
    db
      .from('sms_messages')
      .select('id, direction, body, sender, status, error, created_at')
      .eq('contact_phone', phone)
      .order('created_at', { ascending: true })
      .limit(500),
    db
      .from('customers')
      .select('parent_name, email')
      .eq('phone', phone)
      .maybeSingle(),
  ]);

  const messages = (msgData ?? []) as MsgRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/messages"
          className="text-sm font-semibold text-slate-400 hover:text-coral"
        >
          ← All messages
        </Link>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="font-display text-2xl text-slate-700">{phone}</h1>
        {customer ? (
          <p className="mt-0.5 text-sm text-slate-500">
            {customer.parent_name}
            {customer.email ? ` · ${customer.email}` : ''}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-400">Not a saved customer</p>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No messages in this thread.
            </p>
          ) : (
            messages.map((m) => {
              const outbound = m.direction === 'outbound';
              return (
                <div
                  key={m.id}
                  className={outbound ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={
                        outbound
                          ? 'rounded-2xl rounded-br-md bg-coral px-4 py-2.5 text-sm text-white'
                          : 'rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm'
                      }
                    >
                      {m.body}
                    </div>
                    <p
                      className={`mt-1 text-[11px] text-slate-400 ${
                        outbound ? 'text-right' : 'text-left'
                      }`}
                    >
                      {outbound
                        ? m.sender === 'ai'
                          ? 'AI'
                          : m.sender === 'owner'
                            ? 'You'
                            : 'System'
                        : 'Customer'}{' '}
                      · {fmtWhen(m.created_at)}
                      {m.status === 'failed' ? (
                        <span className="text-coral"> · failed{m.error ? `: ${m.error}` : ''}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <SmsReplyBox to={phone} />
      </div>
    </div>
  );
}
