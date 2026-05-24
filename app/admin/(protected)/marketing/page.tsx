import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getMarketingRecipients } from '@/lib/marketing';
import { ComposeMarketing } from './ComposeMarketing';

export const dynamic = 'force-dynamic';

type PastSend = {
  campaign_id: string | null;
  subject: string;
  campaign_type: string;
  status: string;
  created_at: string;
  count: number;
};

export default async function AdminMarketingPage() {
  const db = supabaseAdmin();
  const recipients = await getMarketingRecipients('promotions');

  // Past campaigns — group by campaign_id, scoped to 'promotion' (newsletter blasts)
  const { data: recent = [] } = await db
    .from('marketing_sends')
    .select('campaign_id, subject, campaign_type, status, created_at')
    .eq('campaign_type', 'promotion')
    .not('campaign_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const grouped = new Map<string, PastSend>();
  for (const row of (recent ?? []) as any[]) {
    const key = row.campaign_id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        campaign_id: key,
        subject: row.subject,
        campaign_type: row.campaign_type,
        status: row.status,
        created_at: row.created_at,
        count: 0,
      });
    }
    grouped.get(key)!.count += 1;
  }
  const campaigns = Array.from(grouped.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compose and send to {recipients.length} subscribed customer
          {recipients.length === 1 ? '' : 's'}.
        </p>
      </header>

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        <strong>How sends work:</strong> emails go out via Resend, one per recipient (no
        BCC). Each includes a personalized unsubscribe link. We log every send to
        <code className="mx-1 rounded bg-white px-1 py-0.5 text-xs">marketing_sends</code>.
        Customers who unsubscribe from promotions won&rsquo;t receive future ones.
      </div>

      <ComposeMarketing recipientCount={recipients.length} />

      <div>
        <h2 className="font-display text-xl text-slate-700">Past sends</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Recipients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.campaign_id!} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{c.subject}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.count}</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-slate-400">
                    No campaigns sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
