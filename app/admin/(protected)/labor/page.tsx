import { supabaseAdmin } from '@/lib/supabase';
import { ImportHomebaseButton } from './ImportHomebaseButton';

export const dynamic = 'force-dynamic';

type LaborRow = {
  id: string;
  labor_date: string;
  total_cost_cents: number;
  total_hours: number | null;
  per_employee: any;
  source: string;
  parsed_at: string;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function LaborPage() {
  const db = supabaseAdmin();
  const { data: rows = [] } = await db
    .from('daily_labor')
    .select('id, labor_date, total_cost_cents, total_hours, per_employee, source, parsed_at')
    .order('labor_date', { ascending: false })
    .limit(60);
  const list = (rows ?? []) as LaborRow[];

  const totalCost = list.reduce((s, r) => s + (r.total_cost_cents ?? 0), 0);
  const totalHours = list.reduce((s, r) => s + (Number(r.total_hours) || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Labor</h1>
          <p className="mt-1 text-sm text-slate-500">
            {list.length} day{list.length === 1 ? '' : 's'} of Homebase data
          </p>
        </div>
        <ImportHomebaseButton />
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Last 60 days · cost" value={fmt(totalCost)} />
        <Kpi label="Last 60 days · hours" value={`${totalHours.toFixed(1)} hrs`} />
        <Kpi label="Avg / day" value={list.length ? fmt(Math.round(totalCost / list.length)) : '—'} />
      </div>

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        Data is parsed from the daily Homebase email
        (<code className="rounded bg-white px-1 py-0.5 text-xs">no-reply@joinhomebase.com</code>)
        delivered to <code className="rounded bg-white px-1 py-0.5 text-xs">info@wonderlandplayhouse.com</code>.
        The daily cron at <code className="rounded bg-white px-1 py-0.5 text-xs">/api/cron/import-homebase</code>
        {' '}fetches them via Gmail API. Tap "Import now" to backfill manually.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Employees</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {new Date(r.labor_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 font-semibold text-coral">{fmt(r.total_cost_cents)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.total_hours != null ? `${Number(r.total_hours).toFixed(1)} hrs` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {Array.isArray(r.per_employee)
                    ? (r.per_employee as any[]).map((e) => e.name).filter(Boolean).join(', ') || '—'
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.source}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  No labor data yet. Tap &ldquo;Import now&rdquo; above to pull the last 7 days from Homebase emails.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-slate-700">{value}</p>
    </div>
  );
}
