import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  code: string;
  amount_cents: number;
  redeemed_cents: number;
  status: string;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
  message: string | null;
  paid_at: string | null;
  recipient_emailed_at: string | null;
  created_at: string;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function AdminGiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status ?? 'all';

  const db = supabaseAdmin();
  let q = db
    .from('gift_cards')
    .select(
      'id, code, amount_cents, redeemed_cents, status, purchaser_name, purchaser_email, recipient_name, recipient_email, message, paid_at, recipient_emailed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data } = await q;
  const rows = (data ?? []) as Row[];

  // Totals across ALL cards (not just the filtered view)
  const { data: allActive } = await db
    .from('gift_cards')
    .select('amount_cents, redeemed_cents, status')
    .in('status', ['active', 'redeemed']);
  const issuedCents = (allActive ?? []).reduce((s: number, c: any) => s + (c.amount_cents ?? 0), 0);
  const redeemedCents = (allActive ?? []).reduce((s: number, c: any) => s + (c.redeemed_cents ?? 0), 0);
  const outstandingCents = issuedCents - redeemedCents;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Gift Cards</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} card{rows.length === 1 ? '' : 's'}
            {statusFilter !== 'all' && ` · ${statusFilter}`}
          </p>
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'redeemed', 'pending', 'void'] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/gift-cards${s === 'all' ? '' : `?status=${s}`}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Issued" value={fmt(issuedCents)} />
        <Stat label="Redeemed" value={fmt(redeemedCents)} />
        <Stat label="Outstanding liability" value={fmt(outstandingCents)} accent />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Bought</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const balance = r.amount_cents - r.redeemed_cents;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.code}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{fmt(r.amount_cents)}</td>
                  <td className={`px-4 py-3 font-semibold ${balance > 0 ? 'text-coral' : 'text-slate-400'}`}>
                    {fmt(balance)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{r.recipient_name}</div>
                    <div className="text-xs text-slate-400">{r.recipient_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{r.purchaser_name}</div>
                    <div className="text-xs text-slate-400">{r.purchaser_email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  No gift cards{statusFilter !== 'all' ? ` (${statusFilter})` : ''} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-coral-200 bg-coral-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-3xl ${accent ? 'text-coral-700' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-sky-100 text-sky-700'
      : status === 'redeemed'
        ? 'bg-slate-100 text-slate-500'
        : status === 'pending'
          ? 'bg-sunshine-100 text-amber-700'
          : 'bg-coral-100 text-coral-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}
