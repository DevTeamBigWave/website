import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { GeneratePromoButton } from './GeneratePromoButton';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  code: string;
  kind: string;
  valid_from: string;
  valid_until: string;
  uses_count: number;
  max_uses: number | null;
  rotation_origin: string | null;
  created_at: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default async function PromoCodesPage() {
  await requireOwner();
  const db = supabaseAdmin();

  const now = new Date().toISOString();
  const { data: active } = await db
    .from('promo_codes')
    .select(
      'id, code, kind, valid_from, valid_until, uses_count, max_uses, rotation_origin, created_at',
    )
    .gt('valid_until', now)
    .lte('valid_from', now)
    .order('created_at', { ascending: false })
    .limit(1);
  const activeCode = (active ?? [])[0] as Row | undefined;

  const { data: history } = await db
    .from('promo_codes')
    .select(
      'id, code, kind, valid_from, valid_until, uses_count, max_uses, rotation_origin, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Promo codes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Skip-deposit codes for pre-approved bookings. A new one is generated on
          the 1st of every month; you can also generate one on demand below.
        </p>
      </header>

      <section className="rounded-2xl border-2 border-coral bg-coral-50 p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-coral-700">
          Active code · this month
        </p>
        {activeCode ? (
          <>
            <p className="mt-2 font-mono text-3xl font-bold tracking-wider text-coral-700">
              {activeCode.code}
            </p>
            <p className="mt-2 text-sm text-coral-700/80">
              Valid through {fmtDate(activeCode.valid_until)} ·{' '}
              {activeCode.uses_count} use{activeCode.uses_count === 1 ? '' : 's'} so far
              {activeCode.max_uses ? ` (max ${activeCode.max_uses})` : ''}
            </p>
            <p className="mt-3 text-xs text-coral-700/70">
              Share verbally or by text. A parent enters this on{' '}
              <code className="rounded bg-white/60 px-1 py-0.5">/book</code> under "Have
              a promo code?" — the party books without paying the deposit but the
              full balance still shows as owed.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-coral-700">
            No active code right now. Generate one below to start using the skip-deposit flow.
          </p>
        )}
        <div className="mt-4">
          <GeneratePromoButton />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-slate-700">History</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(history ?? []).map((r) => {
                const expired = new Date(r.valid_until).getTime() < Date.now();
                return (
                  <tr key={r.id} className={expired ? 'text-slate-400' : 'text-slate-700'}>
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {fmtDate(r.valid_until)}
                      {expired && <span className="ml-2 text-xs text-slate-400">expired</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.uses_count}
                      {r.max_uses ? ` / ${r.max_uses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.rotation_origin === 'monthly_cron'
                        ? 'monthly cron'
                        : r.rotation_origin === 'manual_admin'
                          ? 'manual'
                          : '—'}
                    </td>
                  </tr>
                );
              })}
              {(history ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No codes issued yet.
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
