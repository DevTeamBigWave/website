import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';
import { NotesEditor } from './NotesEditor';
import { ChildrenSection } from './ChildrenSection';
import { DeleteRowButton } from '@/components/admin/DeleteRowButton';

export const dynamic = 'force-dynamic';

type Customer = {
  id: string;
  email: string;
  parent_name: string;
  phone: string | null;
  source: string;
  total_parties: number | null;
  total_open_play_visits: number | null;
  lifetime_value_cents: number | null;
  first_booking_at: string | null;
  last_booking_at: string | null;
  subscribed_to_marketing: boolean;
  notes: string | null;
  created_at: string;
};

type Child = {
  id: string;
  customer_id: string;
  name: string;
  date_of_birth: string | null;
  notes: string | null;
  birthday_emails_subscribed: boolean;
  last_birthday_reminder_sent_at: string | null;
};

type PartyRow = {
  id: string;
  date: string;
  start_time: string;
  package: string;
  status: string;
  child_name: string | null;
  total_cents: number;
  deposit_paid_at: string | null;
};

type OpenPlayRow = {
  id: string;
  date: string;
  num_children: number;
  total_cents: number;
  status: string;
  paid_at: string | null;
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireAdmin();
  const db = supabaseAdmin();

  const [{ data: customer }, { data: children }, { data: parties }, { data: openPlay }] =
    await Promise.all([
      db.from('customers').select('*').eq('id', id).maybeSingle(),
      db
        .from('children')
        .select('*')
        .eq('customer_id', id)
        .order('date_of_birth', { ascending: true, nullsFirst: false }),
      db
        .from('parties')
        .select(
          'id, date, start_time, package, status, child_name, total_cents, deposit_paid_at',
        )
        .eq('customer_id', id)
        .order('date', { ascending: false }),
      db
        .from('open_play')
        .select('id, date, num_children, total_cents, status, paid_at')
        .eq('customer_id', id)
        .order('date', { ascending: false }),
    ]);

  if (!customer) notFound();

  const c = customer as Customer;
  const kids = (children ?? []) as Child[];
  const partyRows = (parties ?? []) as PartyRow[];
  const openPlayRows = (openPlay ?? []) as OpenPlayRow[];

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/customers" className="text-xs font-semibold text-coral hover:text-coral-700">
          ← All customers
        </Link>
        <h1 className="mt-2 font-display text-3xl text-slate-700">{c.parent_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>{c.email}</span>
          {c.phone && <span>·</span>}
          {c.phone && <span>{c.phone}</span>}
          <span>·</span>
          <SourcePill source={c.source} />
          {!c.subscribed_to_marketing && (
            <>
              <span>·</span>
              <span className="rounded-full bg-coral-100 px-2 py-0.5 text-xs font-semibold text-coral-700">
                Unsubscribed
              </span>
            </>
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lifetime value" value={fmtMoney(c.lifetime_value_cents ?? 0)} />
        <Stat label="Parties" value={(c.total_parties ?? 0).toString()} />
        <Stat label="Open play visits" value={(c.total_open_play_visits ?? 0).toString()} />
        <Stat label="Customer since" value={fmtMonthYear(c.first_booking_at ?? c.created_at)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ChildrenSection customerId={c.id} children={kids} />

          <BookingPanel title={`Parties (${partyRows.length})`}>
            {partyRows.length === 0 ? (
              <Empty>No parties yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {partyRows.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/parties/${p.id}`} className="flex-1 hover:opacity-80">
                        <p className="font-semibold text-slate-700">
                          {p.child_name ?? '—'}{' '}
                          <span className="text-slate-400">·</span>{' '}
                          <span className="text-slate-500 capitalize">{p.package}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(p.date)} · {fmtTime(p.start_time)} ·{' '}
                          <span className="capitalize">{p.status}</span>
                        </p>
                      </Link>
                      <span className="font-display text-base text-slate-700">
                        {fmtMoney(p.total_cents)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </BookingPanel>

          <BookingPanel title={`Open play visits (${openPlayRows.length})`}>
            {openPlayRows.length === 0 ? (
              <Empty>No open play visits yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openPlayRows.map((o) => (
                  <li key={o.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-700">
                          {o.num_children} {o.num_children === 1 ? 'child' : 'children'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(o.date)} ·{' '}
                          <span className="capitalize">{o.status}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base text-slate-700">
                          {fmtMoney(o.total_cents)}
                        </span>
                        {me.role === 'owner' && (
                          <DeleteRowButton
                            endpoint={`/api/admin/open-play/${o.id}/delete`}
                            confirmMessage={`Delete this open-play ticket (${fmtDate(o.date)}, ${fmtMoney(o.total_cents)})? Does NOT issue a refund — handle that in Stripe first if needed. This cannot be undone.`}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </BookingPanel>
        </div>

        <aside className="space-y-6">
          <NotesEditor customerId={c.id} initialNotes={c.notes ?? ''} />

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Marketing
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Subscribed to all marketing emails
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  c.subscribed_to_marketing
                    ? 'bg-sky-100 text-sky-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {c.subscribed_to_marketing ? 'On' : 'Off'}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Per-child birthday reminder opt-outs are managed inside each child below.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Last booking
            </p>
            <p className="mt-2 font-display text-xl text-slate-700">
              {c.last_booking_at ? fmtDate(c.last_booking_at.slice(0, 10)) : '—'}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-display text-2xl text-slate-700">{value}</p>
    </div>
  );
}

function BookingPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="font-display text-lg text-slate-700">{title}</h2>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

function SourcePill({ source }: { source: string }) {
  const styles: Record<string, string> = {
    organic: 'bg-sky-100 text-sky-600',
    wix_import: 'bg-sunshine-100 text-slate-700',
    manual: 'bg-slate-100 text-slate-600',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
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
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
function fmtMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}
