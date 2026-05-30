import Link from 'next/link';
import { getRevenue, rangeForPreset } from '@/lib/revenue';
import { cloverConfigured } from '@/lib/clover';
import { RevenueChart } from './RevenueChart';

export const dynamic = 'force-dynamic';

const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PRESETS = [
  { value: 'today', label: 'Today' },
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
  const preset = sp.range ?? 'today';
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
        <Kpi label="Processing fees" value={`−${fmt(summary.estimated_processing_fees_cents)}`} />
        <Kpi label="Labor (Homebase)" value={`−${fmt(summary.labor_cost_cents)}`} />
        <Kpi label="Net" value={fmt(summary.net_after_labor_cents)} accent />
      </div>

      {/* Per-processor fee breakdown */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Processing fee breakdown
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeeRow
            label="Stripe (online)"
            txns={summary.estimated_stripe_txns}
            rate="2.9% + $0.30 per txn"
            fees={summary.estimated_stripe_fees_cents}
            fmt={fmt}
          />
          <FeeRow
            label="Clover (in-venue)"
            txns={summary.estimated_clover_txns}
            rate="2.6% + $0.10 per txn"
            fees={summary.estimated_clover_fees_cents}
            fmt={fmt}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {summary.txn_count} transaction{summary.txn_count === 1 ? '' : 's'}
        {' · '}
        Labor from {summary.labor_days_with_data} day{summary.labor_days_with_data === 1 ? '' : 's'} of Homebase data
      </p>

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
          <li>Processing fees are estimates. Stripe: 2.9% + $0.30 per transaction. Clover: 2.6% + $0.10 per transaction. Actual fees can vary slightly with negotiated rates and card type.</li>
          <li>Zelle, cash, and Groupon payments incur no processing fees — they're excluded from the breakdown above.</li>
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

function FeeRow({
  label,
  txns,
  rate,
  fees,
  fmt,
}: {
  label: string;
  txns: number;
  rate: string;
  fees: number;
  fmt: (c: number) => string;
}) {
  const avgPerTxn = txns > 0 ? fees / txns : 0;
  return (
    <div className="rounded-xl border border-slate-100 bg-cream-deep p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="font-display text-xl text-coral">−{fmt(fees)}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {txns} transaction{txns === 1 ? '' : 's'} · {rate}
      </p>
      {txns > 0 && (
        <p className="mt-0.5 text-xs text-slate-400">
          Avg {fmt(Math.round(avgPerTxn))} per transaction
        </p>
      )}
    </div>
  );
}
