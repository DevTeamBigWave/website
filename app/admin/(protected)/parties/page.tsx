import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type PartyRow = {
  id: string;
  date: string;
  start_time: string;
  package: string;
  status: string;
  child_name: string | null;
  child_age: number | null;
  parent_name: string;
  email: string;
  phone: string;
  headcount: number;
  total_cents: number;
  deposit_paid_at: string | null;
};

export default async function AdminPartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status ?? 'all';

  const db = supabaseAdmin();
  let q = db
    .from('parties')
    .select(
      'id, date, start_time, package, status, child_name, child_age, parent_name, email, phone, headcount, total_cents, deposit_paid_at',
    )
    .order('date', { ascending: false })
    .limit(200);

  if (statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }

  const { data: parties = [] } = await q;
  const rows = (parties ?? []) as PartyRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Parties</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? 'party' : 'parties'}{' '}
            {statusFilter !== 'all' ? `with status “${statusFilter}”` : ''}
          </p>
        </div>
        <StatusFilter active={statusFilter} />
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Headcount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No parties match the filter.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/parties/${p.id}`} className="block">
                      <div className="font-semibold text-slate-700">{fmtDate(p.date)}</div>
                      <div className="text-xs text-slate-500">{fmtTime(p.start_time)}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    <Link href={`/admin/parties/${p.id}`} className="block">{p.package}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/parties/${p.id}`} className="block">
                      {p.child_name ?? '—'}
                      {p.child_age != null && (
                        <span className="ml-1 text-xs text-slate-400">turning {p.child_age}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/parties/${p.id}`} className="block">
                      <div>{p.parent_name}</div>
                      <div className="text-xs text-slate-500">{p.email}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/parties/${p.id}`} className="block">{p.headcount}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/parties/${p.id}`} className="block">
                      <StatusPill status={p.status} />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-display text-base">
                    <Link href={`/admin/parties/${p.id}`} className="block">{fmtMoney(p.total_cents)}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusFilter({ active }: { active: string }) {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'hold', label: 'Hold' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <a
          key={opt.value}
          href={opt.value === 'all' ? '/admin/parties' : `/admin/parties?status=${opt.value}`}
          className={
            opt.value === active
              ? 'rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400'
          }
        >
          {opt.label}
        </a>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    hold: 'bg-sunshine-100 text-slate-700',
    confirmed: 'bg-coral-100 text-coral-700',
    completed: 'bg-sky-100 text-sky-600',
    cancelled: 'bg-slate-100 text-slate-500',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        styles[status] ?? 'bg-slate-100 text-slate-500'
      }`}
    >
      {status}
    </span>
  );
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}
