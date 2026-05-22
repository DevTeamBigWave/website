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
  parent_name: string;
  total_cents: number;
};

type CustomerRow = {
  id: string;
  email: string;
  parent_name: string;
  total_parties: number | null;
  total_open_play_visits: number | null;
  lifetime_value_cents: number | null;
  last_booking_at: string | null;
};

export default async function DashboardPage() {
  const db = supabaseAdmin();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  // Run all dashboard queries in parallel
  const [
    upcomingPartiesQ,
    recentCustomersQ,
    totalCustomersQ,
    totalChildrenQ,
    monthRevenueQ,
    openPlayTodayQ,
  ] = await Promise.all([
    db
      .from('parties')
      .select('id, date, start_time, package, status, child_name, parent_name, total_cents')
      .eq('status', 'confirmed')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(8),
    db
      .from('customers')
      .select(
        'id, email, parent_name, total_parties, total_open_play_visits, lifetime_value_cents, last_booking_at',
      )
      .order('last_booking_at', { ascending: false, nullsFirst: false })
      .limit(8),
    db.from('customers').select('id', { count: 'exact', head: true }),
    db.from('children').select('id', { count: 'exact', head: true }),
    db
      .from('parties')
      .select('total_cents')
      .eq('status', 'confirmed')
      .gte('date', monthStart),
    db
      .from('open_play')
      .select('id', { count: 'exact', head: true })
      .eq('date', today)
      .in('status', ['paid', 'reserved', 'redeemed']),
  ]);

  const upcoming = (upcomingPartiesQ.data ?? []) as PartyRow[];
  const recent = (recentCustomersQ.data ?? []) as CustomerRow[];
  const totalCustomers = totalCustomersQ.count ?? 0;
  const totalChildren = totalChildrenQ.count ?? 0;
  const monthRevenue =
    (monthRevenueQ.data ?? []).reduce((s, r) => s + (r.total_cents ?? 0), 0);
  const openPlayToday = openPlayTodayQ.count ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Snapshot of today and the month so far.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={totalCustomers.toLocaleString()} note={`${totalChildren} kids tracked`} />
        <Stat label="Upcoming parties" value={upcoming.length.toString()} note="confirmed, future-dated" />
        <Stat label="Open play today" value={openPlayToday.toString()} note="reserved or paid" />
        <Stat label="Revenue this month" value={fmtMoney(monthRevenue)} note={monthStart.slice(0, 7)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming parties" href="/admin/parties">
          {upcoming.length === 0 ? (
            <Empty>No confirmed upcoming parties yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-slate-700">
                      {p.child_name ?? '—'}{' '}
                      <span className="text-slate-400">·</span>{' '}
                      <span className="text-slate-500">{p.parent_name}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(p.date)} · {fmtTime(p.start_time)} ·{' '}
                      <span className="capitalize">{p.package}</span>
                    </p>
                  </div>
                  <span className="font-display text-base text-slate-700">
                    {fmtMoney(p.total_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recently active customers" href="/admin/customers">
          {recent.length === 0 ? (
            <Empty>
              No customers yet. They&rsquo;ll show here once bookings flow.
            </Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-slate-700">{c.parent_name}</p>
                    <p className="text-xs text-slate-500">
                      {c.email} ·{' '}
                      {(c.total_parties ?? 0)} parties ·{' '}
                      {(c.total_open_play_visits ?? 0)} visits
                    </p>
                  </div>
                  <span className="font-display text-sm text-slate-700">
                    {fmtMoney(c.lifetime_value_cents ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-slate-700">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="font-display text-lg text-slate-700">{title}</h2>
        <Link href={href} className="text-xs font-semibold text-coral hover:text-coral-700">
          View all →
        </Link>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function fmtTime(t: string) {
  // Postgres time is HH:MM:SS — render as 12-hour
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}
