import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { DisconnectButton } from './DisconnectButton';

export const dynamic = 'force-dynamic';

export default async function GoogleIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;

  const db = supabaseAdmin();
  const { data: integration } = await db
    .from('google_integrations')
    .select('google_email, calendar_id, connected_at, last_used_at')
    .eq('scope', 'calendar')
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Google Calendar</h1>
        <p className="mt-1 text-sm text-slate-500">
          When connected, every confirmed party automatically becomes an event
          in your Google Calendar — with title, time, parent contact, and party
          notes. Cancellations remove the event.
        </p>
      </header>

      {sp.connected && (
        <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5">
          <p className="font-display text-lg text-slate-700">Connected ✓</p>
          <p className="mt-1 text-sm text-slate-600">
            Future confirmed parties will sync to your Google Calendar.
          </p>
        </div>
      )}

      {sp.error && (
        <div className="rounded-2xl border-2 border-coral-200 bg-coral-50 p-5">
          <p className="font-display text-lg text-coral-700">Connection failed</p>
          <p className="mt-1 text-sm text-coral-700">
            {decodeURIComponent(sp.error)}
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {integration ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-coral">
                  Connected
                </p>
                <p className="mt-1 font-display text-xl text-slate-700">
                  {integration.google_email ?? 'Google account'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Calendar: <code className="rounded bg-slate-100 px-1.5 py-0.5">{integration.calendar_id}</code>
                </p>
              </div>
              <DisconnectButton />
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Connected {fmtAgo(integration.connected_at)} ·{' '}
              {integration.last_used_at
                ? `Last used ${fmtAgo(integration.last_used_at)}`
                : 'Never used yet'}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Not connected
            </p>
            <p className="mt-1 font-display text-xl text-slate-700">
              Sync confirmed parties to your calendar
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Sign in once with the Google account that owns the calendar
              where you want events to land (usually{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">
                info@wonderlandplayhouse.com
              </code>
              ).
            </p>
            <a
              href="/api/google/connect"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow-playful hover:bg-coral-600"
            >
              Connect Google Calendar
            </a>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-cream-deep p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          How it works
        </p>
        <ol className="mt-3 space-y-2 text-sm text-slate-600">
          <li>1. Someone books a party at /book and pays the 50% deposit.</li>
          <li>2. Stripe webhook flips the party to confirmed.</li>
          <li>3. Postgres trigger blocks the date from open play.</li>
          <li>4. Our webhook creates a Google Calendar event with title, time, parent contact, and party details.</li>
          <li>5. You see it in your Google Calendar with reminders 24h and 1h before.</li>
        </ol>
      </section>
    </div>
  );
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
