import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { GbpSetupClient } from './GbpSetupClient';

export const dynamic = 'force-dynamic';

export default async function GbpIntegrationPage() {
  const db = supabaseAdmin();
  const { data: integration } = await db
    .from('google_integrations')
    .select('id, gbp_account_id, gbp_location_id, gbp_location_title, gbp_last_sync_at, gbp_last_sync_error')
    .eq('scope', 'calendar')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentSyncs = [] } = await db
    .from('gbp_sync_log')
    .select('id, sync_started_at, sync_finished_at, periods_pushed, date_range_start, date_range_end, error_message')
    .order('sync_started_at', { ascending: false })
    .limit(10);

  const connected = !!integration;
  const locationPicked = !!integration?.gbp_location_id;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Google Business Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Automatically push special hours to your Google Maps listing — when a private
          party is booked, customers see &ldquo;closed 2pm&ndash;4pm&rdquo; (or whatever the window is) on
          Google search + Maps.
        </p>
      </header>

      {!connected && (
        <div className="rounded-2xl border border-coral-200 bg-coral-50 p-5 text-sm text-coral-700">
          <p className="font-bold">Google not connected.</p>
          <p className="mt-1">
            Go to{' '}
            <Link href="/admin/integrations/google" className="underline">
              /admin/integrations/google
            </Link>{' '}
            and connect first.
          </p>
        </div>
      )}

      {connected && !locationPicked && (
        <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-5 text-sm text-slate-700">
          <p className="font-bold">Almost there — pick your business location below.</p>
          <p className="mt-1">
            If you don&rsquo;t see your location listed when you tap &ldquo;Load locations,&rdquo;
            you may need to re-authorize Google to include the <code>business.manage</code>{' '}
            scope. Disconnect and reconnect at{' '}
            <Link href="/admin/integrations/google" className="underline">
              /admin/integrations/google
            </Link>.
          </p>
        </div>
      )}

      {locationPicked && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Active</p>
          <p className="mt-1 font-display text-xl text-slate-700">
            {integration?.gbp_location_title ?? integration?.gbp_location_id}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono">{integration?.gbp_location_id}</p>
          {integration?.gbp_last_sync_at && (
            <p className="mt-3 text-sm text-slate-600">
              Last synced{' '}
              <strong>
                {new Date(integration.gbp_last_sync_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </strong>
            </p>
          )}
          {integration?.gbp_last_sync_error && (
            <p className="mt-2 text-sm text-coral-700">
              Last error: {integration.gbp_last_sync_error}
            </p>
          )}
        </div>
      )}

      <GbpSetupClient connected={connected} locationPicked={locationPicked} />

      {recentSyncs && recentSyncs.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-slate-700">Sync history</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Range</th>
                  <th className="px-4 py-3">Periods pushed</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSyncs.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(s.sync_started_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.date_range_start} → {s.date_range_end}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">
                      {s.periods_pushed ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {s.error_message ? (
                        <span className="text-coral-700 text-xs">{s.error_message.slice(0, 60)}</span>
                      ) : (
                        <span className="text-sky-700 text-xs">✓ ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        <p className="font-bold">Daily cron</p>
        <p className="mt-1">
          Schedule <code className="rounded bg-white px-1 py-0.5 text-xs">/api/cron/sync-gbp-hours</code> at
          cron-job.org for every day at 02:00 America/New_York with the standard{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">x-cron-secret</code> header.
          Once set up, your Google Maps listing stays in sync with new bookings automatically.
        </p>
      </div>
    </div>
  );
}
