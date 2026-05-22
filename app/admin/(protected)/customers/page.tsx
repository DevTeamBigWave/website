import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type CustomerRow = {
  id: string;
  email: string;
  parent_name: string;
  phone: string | null;
  source: string;
  total_parties: number | null;
  total_open_play_visits: number | null;
  lifetime_value_cents: number | null;
  last_booking_at: string | null;
  first_booking_at: string | null;
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const search = (sp.q ?? '').trim();
  const sort = sp.sort ?? 'recent';

  const db = supabaseAdmin();
  let q = db
    .from('customers')
    .select(
      'id, email, parent_name, phone, source, total_parties, total_open_play_visits, lifetime_value_cents, last_booking_at, first_booking_at',
    )
    .limit(500);

  if (search) {
    q = q.or(`parent_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  switch (sort) {
    case 'value':
      q = q.order('lifetime_value_cents', { ascending: false, nullsFirst: false });
      break;
    case 'parties':
      q = q.order('total_parties', { ascending: false, nullsFirst: false });
      break;
    case 'recent':
    default:
      q = q.order('last_booking_at', { ascending: false, nullsFirst: false });
  }

  const { data: customers = [] } = await q;
  const rows = (customers ?? []) as CustomerRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? 'customer' : 'customers'}
          </p>
        </div>
        <SortTabs active={sort} q={search} />
      </header>

      <form className="flex gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-coral focus:outline-none"
        />
        {sort !== 'recent' && (
          <input type="hidden" name="sort" value={sort} />
        )}
        <button
          type="submit"
          className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-center">Parties</th>
                <th className="px-4 py-3 text-center">Open play</th>
                <th className="px-4 py-3 text-right">Lifetime</th>
                <th className="px-4 py-3 text-right">Last booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {search
                      ? `No customers match “${search}”.`
                      : 'No customers yet — they show up here after a confirmed booking.'}
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">{c.parent_name}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>{c.email}</div>
                    {c.phone && <div className="text-slate-500">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <SourcePill source={c.source} />
                  </td>
                  <td className="px-4 py-3 text-center">{c.total_parties ?? 0}</td>
                  <td className="px-4 py-3 text-center">{c.total_open_play_visits ?? 0}</td>
                  <td className="px-4 py-3 text-right font-display">
                    {fmtMoney(c.lifetime_value_cents ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {c.last_booking_at ? fmtDate(c.last_booking_at) : '—'}
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

function SortTabs({ active, q }: { active: string; q: string }) {
  const options = [
    { value: 'recent', label: 'Most recent' },
    { value: 'value', label: 'Highest value' },
    { value: 'parties', label: 'Most parties' },
  ];
  const qs = q ? `&q=${encodeURIComponent(q)}` : '';
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <a
          key={opt.value}
          href={`/admin/customers?sort=${opt.value}${qs}`}
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

function SourcePill({ source }: { source: string }) {
  const styles: Record<string, string> = {
    organic: 'bg-sky-100 text-sky-600',
    wix_import: 'bg-sunshine-100 text-slate-700',
    manual: 'bg-slate-100 text-slate-600',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
        styles[source] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {source.replace('_', ' ')}
    </span>
  );
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
