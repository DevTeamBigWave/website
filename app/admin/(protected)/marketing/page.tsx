import { supabaseAdmin } from '@/lib/supabase';
import { getMarketingRecipients } from '@/lib/marketing';
import { nextSaturdayNYC, getDraftForDate } from '@/lib/weekly-marketing';
import { ComposeMarketing } from './ComposeMarketing';
import { WeeklyDraftEditor } from './WeeklyDraftEditor';

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
  const targetDate = nextSaturdayNYC();
  const draft = await getDraftForDate(targetDate);

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
          {recipients.length} subscribed customer
          {recipients.length === 1 ? '' : 's'}.
        </p>
      </header>

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        <strong>How sends work:</strong> emails go via Resend, one per recipient.
        Each includes a personalized unsubscribe link. We log every send. Customers
        who unsubscribed from promotions are excluded automatically.
      </div>

      {/* Saturday auto-email */}
      <section className="rounded-2xl border border-coral-200 bg-coral-50/40 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl text-slate-700">
            Saturday auto-email
          </h2>
          <p className="text-xs uppercase tracking-wider text-coral-700 font-bold">
            Next send: {new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Drop in events, promos, or anything to feature this week. Or leave it blank
          and Claude writes one Saturday morning based on what&rsquo;s seasonally relevant.
        </p>
        <WeeklyDraftEditor
          targetDate={targetDate}
          initial={(draft ?? null) as any}
          recipientCount={recipients.length}
        />
      </section>

      {/* Manual send */}
      <section>
        <h2 className="font-display text-xl text-slate-700">Send a one-off campaign</h2>
        <p className="mt-1 text-sm text-slate-500">For things that can&rsquo;t wait for Saturday.</p>
        <div className="mt-3">
          <ComposeMarketing recipientCount={recipients.length} />
        </div>
      </section>

      {/* Past sends */}
      <section>
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
      </section>
    </div>
  );
}
