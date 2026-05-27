import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';
import { computePartyFinancials } from '@/lib/parties';
import { SeedTestPartyButton } from './SeedTestPartyButton';

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
  deposit_cents: number;
  deposit_paid_at: string | null;
  add_ons_total_cents: number | null;
  gift_card_applied_cents: number | null;
  balance_paid_amount_cents: number | null;
  manual_discount_percent: number | null;
};

type TimeFilter = 'upcoming' | 'today' | 'past' | 'all';

function nycToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function AdminPartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const timeFilter: TimeFilter =
    sp.time === 'today' || sp.time === 'past' || sp.time === 'all'
      ? sp.time
      : 'upcoming';

  const db = supabaseAdmin();
  // Pull a wider window than the previous 200-most-recent: we need to bucket
  // by time, and the page lets you flip to "All" or "Past" any time.
  const { data: parties = [] } = await db
    .from('parties')
    .select(
      'id, date, start_time, package, status, child_name, child_age, parent_name, email, phone, headcount, total_cents, deposit_cents, deposit_paid_at, add_ons_total_cents, gift_card_applied_cents, balance_paid_amount_cents, manual_discount_percent',
    )
    .order('date', { ascending: false })
    .limit(500);

  const all = (parties ?? []) as PartyRow[];
  const today = nycToday();

  // Counts for the filter pills
  const counts = {
    upcoming: 0,
    today: 0,
    past: 0,
    all: all.length,
  };
  for (const p of all) {
    if (p.date === today) counts.today += 1;
    if (p.date >= today && (p.status === 'hold' || p.status === 'confirmed')) {
      counts.upcoming += 1;
    }
    if (p.date < today) counts.past += 1;
  }

  // Apply the active filter
  let visible = all;
  if (timeFilter === 'upcoming') {
    visible = all.filter(
      (p) => p.date >= today && (p.status === 'hold' || p.status === 'confirmed'),
    );
  } else if (timeFilter === 'today') {
    visible = all.filter((p) => p.date === today);
  } else if (timeFilter === 'past') {
    visible = all.filter((p) => p.date < today);
  }

  // Sort: upcoming ascending (next-up first); past + all descending (most recent first)
  if (timeFilter === 'upcoming' || timeFilter === 'today') {
    visible = [...visible].sort((a, b) =>
      a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Parties</h1>
          <p className="mt-1 text-sm text-slate-500">
            {visible.length} {visible.length === 1 ? 'party' : 'parties'} ·{' '}
            <span className="capitalize">{timeFilter}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {me.role === 'owner' && (
            <Link
              href="/admin/parties/new"
              className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600"
            >
              + New party
            </Link>
          )}
          {me.role === 'owner' && <SeedTestPartyButton />}
        </div>
      </header>

      <TimeFilterPills active={timeFilter} counts={counts} />

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center text-slate-400 shadow-sm">
          No parties in this view.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <PartyCard key={p.id} party={p} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PartyCard({ party: p, today }: { party: PartyRow; today: string }) {
  const isToday = p.date === today;
  const isPast = p.date < today;
  const fin = computePartyFinancials(p);
  const owes = fin.balance_due_cents;

  return (
    <li>
      <Link
        href={`/admin/parties/${p.id}`}
        className={`block rounded-2xl border bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow ${
          isToday
            ? 'border-coral border-l-4 border-l-coral'
            : 'border-slate-100'
        } ${isPast ? 'opacity-80' : ''}`}
      >
        {/* Top row: badges */}
        {(isToday || owes > 0 || p.status === 'cancelled' || p.status === 'hold') && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {isToday && (
              <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Today
              </span>
            )}
            {owes > 0 && (
              <span className="rounded-full bg-coral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coral-700">
                Owes {fmtMoney(owes)}
              </span>
            )}
            <StatusPill status={p.status} />
          </div>
        )}

        {/* Main row: date, child, parent, package */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className={`min-w-0 ${isPast ? 'text-slate-500' : 'text-slate-700'}`}>
            <p className="font-display text-lg leading-tight">{fmtDate(p.date)}</p>
            <p className="text-xs text-slate-500">{fmtTime(p.start_time)}</p>
          </div>
          <div className="min-w-0">
            <p className={`truncate text-base font-semibold ${isPast ? 'text-slate-500' : 'text-slate-700'}`}>
              {p.child_name ?? '—'}
              {p.child_age != null && (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  turning {p.child_age}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-500">
              {p.parent_name} · {p.headcount} kids · <span className="capitalize">{p.package}</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`font-display text-base ${isPast ? 'text-slate-500' : 'text-slate-700'}`}>
              {fmtMoney(p.total_cents)}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function TimeFilterPills({
  active,
  counts,
}: {
  active: TimeFilter;
  counts: Record<TimeFilter, number>;
}) {
  const options: Array<{ value: TimeFilter; label: string }> = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'today', label: 'Today' },
    { value: 'past', label: 'Past' },
    { value: 'all', label: 'All' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={opt.value === 'upcoming' ? '/admin/parties' : `/admin/parties?time=${opt.value}`}
          className={
            opt.value === active
              ? 'rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400'
          }
        >
          {opt.label} <span className="ml-1 opacity-70">({counts[opt.value]})</span>
        </Link>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  // Confirmed is the default "good" state — no pill needed (less visual noise
  // on a list where most rows are confirmed). Only show hold / cancelled /
  // completed.
  if (status === 'confirmed') return null;
  const styles: Record<string, string> = {
    hold: 'bg-sunshine-100 text-slate-700',
    completed: 'bg-sky-100 text-sky-600',
    cancelled: 'bg-slate-100 text-slate-500',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}
