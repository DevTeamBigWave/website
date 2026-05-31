import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { GeneratePromoButton } from './GeneratePromoButton';
import { PromoCodeBuilder } from './PromoCodeBuilder';
import { DisableButton } from './DisableButton';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  code: string;
  kind: string;
  label: string | null;
  discount_percent: number | null;
  applies_to: string[] | null;
  channel: string | null;
  valid_from: string;
  valid_until: string;
  uses_count: number;
  max_uses: number | null;
  rotation_origin: string | null;
  disabled_at: string | null;
  notes: string | null;
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

const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const SELECT_COLS =
  'id, code, kind, label, discount_percent, applies_to, channel, valid_from, valid_until, uses_count, max_uses, rotation_origin, disabled_at, notes, created_at';

export default async function PromoCodesPage() {
  await requireOwner();
  const db = supabaseAdmin();

  const now = new Date().toISOString();
  // All active codes (not just the most recent). An owner can now have a
  // monthly auto SKIP code + multiple custom percent-off codes running at
  // the same time, so they all need to show up.
  const { data: active } = await db
    .from('promo_codes')
    .select(SELECT_COLS)
    .gt('valid_until', now)
    .lte('valid_from', now)
    .is('disabled_at', null)
    .order('created_at', { ascending: false });
  const activeCodes = (active ?? []) as Row[];

  const { data: history } = await db
    .from('promo_codes')
    .select(SELECT_COLS)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Promo codes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Custom codes for marketing campaigns, partnerships, or one-off
          discounts. The monthly auto-rotated skip-deposit code lives here
          too — it gets pulled into the Saturday marketing email automatically.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-slate-700">
            Active{activeCodes.length > 0 ? ` · ${activeCodes.length}` : ''}
          </h2>
          <div className="flex flex-wrap gap-2">
            <GeneratePromoButton />
            <PromoCodeBuilder />
          </div>
        </div>

        {activeCodes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No active codes right now. Tap <strong>Build a custom code</strong> or generate
            the monthly skip-deposit code above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeCodes.map((c) => (
              <ActiveCard key={c.id} code={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-slate-700">History</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Label / kind</th>
                <th className="px-4 py-3">Applies to</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(history ?? []).map((r) => {
                const expired = new Date(r.valid_until).getTime() < Date.now();
                const dimmed = expired || !!r.disabled_at;
                return (
                  <tr
                    key={r.id}
                    className={dimmed ? 'text-slate-400' : 'text-slate-700'}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm">{r.label ?? '—'}</div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400">
                        {kindLabel(r)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{appliesToLabel(r.applies_to)}</td>
                    <td className="px-4 py-3 text-xs">{channelLabel(r.channel)}</td>
                    <td className="px-4 py-3 text-xs">
                      {fmtDate(r.valid_until)}
                      {r.disabled_at && (
                        <span className="ml-2 text-[10px] uppercase text-coral-700">
                          disabled
                        </span>
                      )}
                      {expired && !r.disabled_at && (
                        <span className="ml-2 text-[10px] uppercase text-slate-400">
                          expired
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
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
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
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

function ActiveCard({ code: c }: { code: Row }) {
  return (
    <div className="rounded-2xl border-2 border-coral bg-coral-50 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-coral-700">
          {c.label ?? kindLabel(c)}
        </p>
        <DisableButton id={c.id} code={c.code} />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-coral-700">
        {c.code}
      </p>
      <p className="mt-1 text-xs text-coral-700/80">{kindLabel(c)}</p>
      <p className="mt-2 text-xs text-coral-700/70">
        Valid through {fmtDateShort(c.valid_until)} · {c.uses_count} use
        {c.uses_count === 1 ? '' : 's'}
        {c.max_uses ? ` / ${c.max_uses}` : ''}
      </p>
      <p className="mt-1 text-[11px] text-coral-700/60">
        {appliesToLabel(c.applies_to)} · {channelLabel(c.channel)}
      </p>
      {c.notes && (
        <p className="mt-2 rounded bg-white/60 p-2 text-[11px] text-slate-600">
          {c.notes}
        </p>
      )}
    </div>
  );
}

function kindLabel(c: Pick<Row, 'kind' | 'discount_percent'>): string {
  if (c.kind === 'skip_deposit') return 'Skip deposit';
  if (c.kind === 'percent_off')
    return c.discount_percent ? `${c.discount_percent}% off` : 'Percent off';
  return c.kind;
}

function appliesToLabel(applies_to: string[] | null): string {
  if (!applies_to || applies_to.length === 0) return 'Anything';
  const map: Record<string, string> = {
    party: 'parties',
    open_play: 'open play',
    membership: 'memberships',
    gift_card: 'gift cards',
  };
  return applies_to.map((a) => map[a] ?? a).join(', ');
}

function channelLabel(channel: string | null): string {
  if (channel === 'online') return 'Online only';
  if (channel === 'admin') return 'Phone/in-person only';
  return 'Online + phone';
}
