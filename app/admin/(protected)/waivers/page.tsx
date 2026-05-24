import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  signed_at: string;
  expires_at: string;
  revoked_at: string | null;
  document_version: string;
  waiver_children: Array<{ child_name: string }>;
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

export default async function AdminWaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status ?? 'active';
  const q = sp.q ?? '';

  const db = supabaseAdmin();
  let query = db
    .from('waivers')
    .select(
      'id, parent_name, parent_email, parent_phone, signed_at, expires_at, revoked_at, document_version, waiver_children(child_name)',
    )
    .order('signed_at', { ascending: false })
    .limit(200);

  if (statusFilter === 'active') {
    query = query.is('revoked_at', null).gt('expires_at', new Date().toISOString());
  } else if (statusFilter === 'expired') {
    query = query.lt('expires_at', new Date().toISOString());
  } else if (statusFilter === 'revoked') {
    query = query.not('revoked_at', 'is', null);
  }

  if (q) {
    query = query.or(`parent_name.ilike.%${q}%,parent_email.ilike.%${q}%`);
  }

  const { data } = await query;
  const rows = (data ?? []) as Row[];

  const { count: activeCount } = await db
    .from('waivers')
    .select('id', { count: 'exact', head: true })
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Waivers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeCount ?? 0} active · {rows.length} shown
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['active', 'expired', 'revoked', 'all'] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/waivers${s === 'all' ? '' : `?status=${s}`}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
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

      <form className="flex gap-2" action="/admin/waivers" method="get">
        {statusFilter !== 'all' && <input type="hidden" name="status" value={statusFilter} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search parent name or email…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-coral focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-600"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Kids</th>
              <th className="px-4 py-3">Signed</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const expired = new Date(r.expires_at) < new Date();
              const isActive = !r.revoked_at && !expired;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/waivers/${r.id}`} className="block">
                      <div className="font-semibold text-slate-700 hover:text-coral">
                        {r.parent_name}
                      </div>
                      <div className="text-xs text-slate-500">{r.parent_email}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.waiver_children.map((c) => c.child_name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.signed_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.expires_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={r.revoked_at ? 'revoked' : expired ? 'expired' : 'active'}
                      tone={r.revoked_at ? 'red' : expired ? 'gray' : 'sky'}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No waivers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'sky' | 'gray' | 'red' }) {
  const cls = {
    sky: 'bg-sky-100 text-sky-700',
    gray: 'bg-slate-100 text-slate-500',
    red: 'bg-coral-100 text-coral-700',
  }[tone];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {label}
    </span>
  );
}
