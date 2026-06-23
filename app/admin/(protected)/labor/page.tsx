import { supabaseAdmin } from '@/lib/supabase';
import { ImportHomebaseButton } from './ImportHomebaseButton';

export const dynamic = 'force-dynamic';

type LaborRow = {
  id: string;
  labor_date: string;
  total_cost_cents: number | null;
  total_hours: number | null;
  per_employee: any;
  expected_cost_cents: number | null;
  expected_hours: number | null;
  expected_per_employee: any;
  source: string;
  parsed_at: string;
};

const fmt = (cents: number | null) =>
  cents == null ? 'TBD' : `$${(cents / 100).toFixed(2)}`;
const fmtHrs = (h: number | null) =>
  h == null ? 'TBD' : `${Number(h).toFixed(1)} hrs`;

function nycToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function LaborPage() {
  const db = supabaseAdmin();
  const { data: rows = [] } = await db
    .from('daily_labor')
    .select(
      'id, labor_date, total_cost_cents, total_hours, per_employee, expected_cost_cents, expected_hours, expected_per_employee, source, parsed_at',
    )
    .order('labor_date', { ascending: false })
    .limit(60);
  const fetched = (rows ?? []) as LaborRow[];

  // Ensure today's row is always present at the top — if today's email
  // hasn't been imported yet, render a synthetic row with TBDs so the
  // owner sees today on the page (vs the previous behavior where today
  // simply didn't exist until tomorrow's email arrived).
  const today = nycToday();
  const list: LaborRow[] = fetched.some((r) => r.labor_date === today)
    ? fetched
    : [
        {
          id: `__today_${today}`,
          labor_date: today,
          total_cost_cents: null,
          total_hours: null,
          per_employee: [],
          expected_cost_cents: null,
          expected_hours: null,
          expected_per_employee: [],
          source: 'pending',
          parsed_at: '',
        },
        ...fetched,
      ];

  // KPIs sum actuals only — expected is forecast, mixing them would
  // inflate the totals.
  const actualRows = list.filter((r) => r.total_cost_cents != null && r.source !== 'pending');
  const totalCost = actualRows.reduce((s, r) => s + (r.total_cost_cents ?? 0), 0);
  const totalHours = actualRows.reduce((s, r) => s + (Number(r.total_hours) || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Labor</h1>
          <p className="mt-1 text-sm text-slate-500">
            {actualRows.length} day{actualRows.length === 1 ? '' : 's'} with actuals
          </p>
        </div>
        <ImportHomebaseButton />
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Last 60 days · actual cost" value={`$${(totalCost / 100).toFixed(2)}`} />
        <Kpi label="Last 60 days · actual hours" value={`${totalHours.toFixed(1)} hrs`} />
        <Kpi
          label="Avg / day"
          value={actualRows.length ? `$${(totalCost / actualRows.length / 100).toFixed(2)}` : '—'}
        />
      </div>

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        Each morning&rsquo;s Homebase email lands two columns:{' '}
        <strong>Expected</strong> for that same day (from &ldquo;What&rsquo;s Happening Today&rdquo;) and{' '}
        <strong>Actual</strong> for yesterday (from &ldquo;Yesterday&rsquo;s Summary&rdquo;).
        Today&rsquo;s actuals stay TBD until tomorrow&rsquo;s email arrives.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Expected</th>
              <th className="px-4 py-3">Actual</th>
              <th className="px-4 py-3">Δ</th>
              <th className="px-4 py-3">Employees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => {
              const isToday = r.labor_date === today;
              const delta =
                r.expected_cost_cents != null && r.total_cost_cents != null && r.source !== 'pending'
                  ? r.total_cost_cents - r.expected_cost_cents
                  : null;
              const employees = pickEmployees(r);
              return (
                <tr key={r.id} className={`hover:bg-slate-50 ${isToday ? 'bg-coral-50/40' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {isToday && (
                      <span className="mr-2 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Today
                      </span>
                    )}
                    {new Date(r.labor_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="font-semibold text-slate-700">{fmt(r.expected_cost_cents)}</div>
                    <div className="text-xs text-slate-500">{fmtHrs(r.expected_hours)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="font-semibold text-coral">
                      {r.source === 'pending' || r.total_cost_cents == null
                        ? 'TBD'
                        : `$${(r.total_cost_cents / 100).toFixed(2)}`}
                    </div>
                    <div className="text-xs text-slate-500">{fmtHrs(r.total_hours)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {delta == null ? (
                      <span className="text-slate-400">—</span>
                    ) : delta > 0 ? (
                      <span className="font-semibold text-coral-700">
                        +${(delta / 100).toFixed(2)}
                      </span>
                    ) : delta < 0 ? (
                      <span className="font-semibold text-emerald-600">
                        −${(Math.abs(delta) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-500">$0.00</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{employees}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  No labor data yet. Tap &ldquo;Import now&rdquo; above to pull the last few days from Homebase emails.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Prefer the richer per_employee list — actuals (with both scheduled +
// actual ranges) when present, otherwise the expected list from the
// morning email (scheduled only). Keeps the column non-empty for today.
function pickEmployees(r: LaborRow): string {
  const actuals = Array.isArray(r.per_employee) ? r.per_employee : [];
  const expected = Array.isArray(r.expected_per_employee) ? r.expected_per_employee : [];
  const chosen = actuals.length > 0 ? actuals : expected;
  return chosen.map((e: any) => e.name).filter(Boolean).join(', ') || '—';
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-slate-700">{value}</p>
    </div>
  );
}
