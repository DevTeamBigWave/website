import Link from 'next/link';
import { getRevenue, rangeForPreset } from '@/lib/revenue';
import { cloverConfigured } from '@/lib/clover';
import { RevenueChart } from './RevenueChart';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PRESETS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'ytd', label: 'YTD' },
  { value: '30d', label: '30 days' },
];

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const preset = sp.range ?? 'month';
  const range = rangeForPreset(preset);
  const summary = await getRevenue(range);
  const cloverSetup = cloverConfigured();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Revenue</h1>
          <p className="mt-1 text-sm text-slate-500">
            {summary.range.label} · {summary.txn_count} transaction{summary.txn_count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/revenue?range=${p.value}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                preset === p.value ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </header>

      {!cloverSetup && (
        <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
          <strong>Clover not connected yet.</strong> In-venue POS revenue is missing from these
          numbers. Add{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">CLOVER_ACCESS_TOKEN</code> and{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">CLOVER_MERCHANT_ID</code> in
          Railway, then schedule{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">/api/cron/sync-clover</code> hourly.
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gross revenue" value={fmt(summary.gross_cents)} accent />
        <Kpi label="Est. Stripe fees" value={`−${fmt(summary.estimated_stripe_fees_cents)}`} />
        <Kpi label="Net before labor" value={fmt(summary.net_before_labor_cents)} accent />
        <Kpi label="Transactions" value={String(summary.txn_count)} />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="font-display text-lg text-slate-700">Daily revenue</p>
        <p className="mt-1 text-xs text-slate-500">
          Gross across all sources, including Clover POS once connected.
        </p>
        <div className="mt-4">
          <RevenueChart daily={summary.daily} />
        </div>
      </div>

      {/* Breakdown by source */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="font-display text-lg text-slate-700">By source</p>
        <div className="mt-4 space-y-3">
          {summary.lines.map((l) => {
            const pct = summary.gross_cents > 0 ? (l.amount_cents / summary.gross_cents) * 100 : 0;
            return (
              <div key={l.source} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-slate-700">{l.label}</p>
                    <p className="text-xs text-slate-500">
                      {l.txn_count} txn · {pct.toFixed(0)}%
                    </p>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-coral"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                <p className="w-24 text-right font-display text-base text-slate-700">
                  {fmtShort(l.amount_cents)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm text-sm text-slate-600">
        <p className="font-bold text-slate-700">Notes on the numbers</p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>Cash basis: a sale counts on the day money is received.</li>
          <li>Gift card credit applied to a booking does NOT count as new revenue (it was already counted when the card was sold).</li>
          <li>Stripe fees are an estimate (2.9% + $0.30 per transaction). Actual fees may vary slightly.</li>
          <li>Refunds + Homebase labor cost will subtract from this when Phase 3 + 4 are live.</li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-coral-200 bg-coral-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-3xl ${accent ? 'text-coral-700' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}
