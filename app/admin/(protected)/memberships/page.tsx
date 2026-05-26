import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';
import { DeleteRowButton } from '@/components/admin/DeleteRowButton';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const STATUS_TONE: Record<string, string> = {
  active: 'bg-sky-100 text-sky-700',
  past_due: 'bg-sunshine-100 text-amber-700',
  canceled: 'bg-slate-100 text-slate-500',
  paused: 'bg-slate-100 text-slate-500',
  incomplete: 'bg-coral-100 text-coral-700',
};

export default async function AdminMembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const statusFilter = sp.status ?? 'all';

  const db = supabaseAdmin();
  let q = db
    .from('memberships')
    .select(
      'id, parent_name, email, phone, child_name, child_dob, status, amount_cents, current_period_end, cancel_at_period_end, started_at, stripe_subscription_id',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data } = await q;
  const rows = (data ?? []) as any[];

  const { count: activeCount } = await db
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const { data: activeSum } = await db
    .from('memberships')
    .select('amount_cents')
    .eq('status', 'active');
  const mrrCents = (activeSum ?? []).reduce(
    (s: number, m: any) => s + (m.amount_cents ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Memberships</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'} shown
            {statusFilter !== 'all' && ` · ${statusFilter}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'active', 'past_due', 'canceled', 'incomplete'] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/memberships${s === 'all' ? '' : `?status=${s}`}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                statusFilter === s
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.replace('_', ' ')}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Active members" value={String(activeCount ?? 0)} />
        <Kpi label="MRR" value={fmt(mrrCents)} accent />
        <Kpi label="Annualized" value={fmt(mrrCents * 12)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Child</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Next renewal</th>
              <th className="px-4 py-3">Started</th>
              {me.role === 'owner' && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-700">{m.parent_name}</div>
                  <div className="text-xs text-slate-500">{m.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{m.child_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      STATUS_TONE[m.status] ?? 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                  {m.cancel_at_period_end && (
                    <span className="ml-2 text-xs text-slate-400">cancelling</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{fmt(m.amount_cents)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {m.current_period_end
                    ? new Date(m.current_period_end).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {m.started_at
                    ? new Date(m.started_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                {me.role === 'owner' && (
                  <td className="px-4 py-3 text-right">
                    <DeleteRowButton
                      endpoint={`/api/admin/memberships/${m.id}/delete`}
                      confirmMessage={`Cancel ${m.parent_name}'s Stripe subscription immediately and delete this membership row? Billing stops at once (no proration, no refund). This cannot be undone.`}
                    />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={me.role === 'owner' ? 7 : 6} className="px-4 py-12 text-center text-slate-400">
                  No memberships yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'border-coral-200 bg-coral-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-3xl ${accent ? 'text-coral-700' : 'text-slate-700'}`}>
        {value}
      </p>
    </div>
  );
}
