// Owner-only audit of party ↔ Google Calendar event consistency.
//
// Surfaces:
//   - Parties with duplicate calendar events (race-condition leftovers from
//     before the createPartyEventIfNotExists atomic-claim fix).
//   - Parties with NO calendar event (something went wrong during creation
//     or the integration was down at the time).
//
// For duplicates, identifies which event is the "tracked" one (matches
// party.google_calendar_event_id in the DB — that's the one our system
// will keep updating on reschedules/edits) and which are orphans (safe
// to delete from Google Calendar manually).

import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { getIntegration, getValidAccessToken } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PartyRow = {
  id: string;
  child_name: string | null;
  date: string;
  start_time: string;
  package: string;
  status: string;
  google_calendar_event_id: string | null;
};

type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  created: string;
  htmlLink: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });

const fmtCreated = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/New_York',
  });

export default async function CalendarAuditPage() {
  await requireOwner();
  const db = supabaseAdmin();

  // Window: 90 days back through 365 days forward. Wide enough to catch
  // any party that's been booked and not yet held, narrow enough that
  // the Google Calendar list call returns < 250 events (the API page size).
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const to = new Date();
  to.setDate(to.getDate() + 365);

  // 1. Pull all confirmed parties in window.
  const { data: parties = [], error: partyErr } = await db
    .from('parties')
    .select('id, child_name, date, start_time, package, status, google_calendar_event_id')
    .eq('status', 'confirmed')
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (partyErr) {
    return (
      <div className="p-6">
        <ErrorBanner title="DB query failed" detail={partyErr.message} />
      </div>
    );
  }

  // 2. Pull all events from the connected Google Calendar in the same window.
  const integration = await getIntegration();
  if (!integration) {
    return (
      <div className="p-6">
        <ErrorBanner
          title="No Google Calendar integration connected"
          detail="Connect Google Calendar at /admin/integrations/google to run this audit."
        />
      </div>
    );
  }

  let calendarEvents: CalendarEvent[] = [];
  let calendarErr: string | null = null;
  try {
    const accessToken = await getValidAccessToken(integration);
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id)}/events` +
      `?timeMin=${encodeURIComponent(from.toISOString())}` +
      `&timeMax=${encodeURIComponent(to.toISOString())}` +
      `&singleEvents=true&orderBy=startTime&maxResults=500`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      calendarErr = `Calendar list failed: ${res.status} ${await res.text()}`;
    } else {
      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          summary?: string;
          status?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          created?: string;
          htmlLink?: string;
        }>;
      };
      calendarEvents = (data.items ?? [])
        .filter((ev) => ev.status !== 'cancelled' && ev.start?.dateTime && ev.end?.dateTime)
        .map((ev) => ({
          id: ev.id,
          summary: ev.summary ?? '(untitled)',
          start: ev.start!.dateTime!,
          end: ev.end!.dateTime!,
          created: ev.created ?? '',
          htmlLink: ev.htmlLink ?? '',
        }));
    }
  } catch (err) {
    calendarErr = err instanceof Error ? err.message : 'Unknown error';
  }

  if (calendarErr) {
    return (
      <div className="p-6">
        <ErrorBanner title="Could not fetch Google Calendar events" detail={calendarErr} />
      </div>
    );
  }

  // 3. For each party, find matching events. A match = event whose summary
  // contains the child's name AND the event's start time falls on the
  // party's date. Lenient on title format so manual edits / older title
  // variants still match.
  const partyAudit = (parties as PartyRow[]).map((p) => {
    const childLower = (p.child_name ?? '').toLowerCase().trim();
    const matches = calendarEvents.filter((ev) => {
      if (!childLower) return false;
      if (!ev.summary.toLowerCase().includes(childLower)) return false;
      // Same calendar date in NYC (party.date is YYYY-MM-DD)
      const eventDateNYC = new Date(ev.start).toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
      });
      return eventDateNYC === p.date;
    });
    return { party: p, matches };
  });

  const duplicates = partyAudit.filter((a) => a.matches.length >= 2);
  const missing = partyAudit.filter((a) => a.matches.length === 0);
  const healthy = partyAudit.filter((a) => a.matches.length === 1);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Calendar audit</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirmed parties from {fmtDate(from.toISOString())} through{' '}
          {fmtDate(to.toISOString())} vs. Google Calendar events.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Healthy" value={healthy.length} tone="ok" />
        <StatCard label="Duplicates" value={duplicates.length} tone="warn" />
        <StatCard label="Missing event" value={missing.length} tone="bad" />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl text-slate-700">
          Duplicates ({duplicates.length})
        </h2>
        {duplicates.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ No parties with duplicate calendar events. Clean.
          </p>
        ) : (
          <div className="space-y-3">
            {duplicates.map(({ party, matches }) => {
              // The "tracked" event is the one whose ID matches the DB column
              // — our system updates that one on reschedules. Anything else
              // is orphan / safe to delete.
              const tracked = matches.find(
                (m) => m.id === party.google_calendar_event_id,
              );
              const orphans = matches.filter(
                (m) => m.id !== party.google_calendar_event_id,
              );
              return (
                <div
                  key={party.id}
                  className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5"
                >
                  <p className="font-display text-lg text-slate-700">
                    {party.child_name} — {fmtDate(party.date)} · {matches.length} events
                  </p>
                  <p className="text-xs text-slate-500">
                    Party ID: <code className="font-mono">{party.id}</code>
                  </p>
                  <ul className="mt-3 space-y-2">
                    {matches.map((ev) => {
                      const isTracked = ev.id === party.google_calendar_event_id;
                      return (
                        <li
                          key={ev.id}
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            isTracked
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-coral bg-white'
                          }`}
                        >
                          <p className="font-bold">
                            {isTracked ? (
                              <span className="text-emerald-700">✓ KEEP (tracked)</span>
                            ) : (
                              <span className="text-coral-700">✗ DELETE (orphan)</span>
                            )}{' '}
                            · {ev.summary}
                          </p>
                          <p className="mt-1 text-slate-600">
                            Starts {fmtTime(ev.start)} · Created{' '}
                            {fmtCreated(ev.created)}
                          </p>
                          <p className="mt-1">
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-coral-700 underline"
                            >
                              Open in Google Calendar →
                            </a>
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-slate-400">
                            Event ID: {ev.id}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  {!tracked && (
                    <p className="mt-2 rounded bg-coral-50 p-2 text-[11px] text-coral-700">
                      ⚠️ None of the events match the tracked ID on the party row
                      ({party.google_calendar_event_id ?? 'null'}). Pick the one
                      that looks right and the rest are safe to delete; consider
                      updating the DB column afterwards.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-slate-700">
          Missing event ({missing.length})
        </h2>
        {missing.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ Every confirmed party has at least one calendar event.
          </p>
        ) : (
          <div className="space-y-2">
            {missing.map(({ party }) => (
              <div
                key={party.id}
                className="rounded-xl border border-coral bg-white p-3 text-sm"
              >
                <p className="font-bold text-slate-700">
                  {party.child_name} — {fmtDate(party.date)} · {party.start_time}
                </p>
                <p className="text-xs text-slate-500">
                  Party ID: <code className="font-mono">{party.id}</code>
                </p>
                <p className="mt-1 text-[11px] text-coral-700">
                  No matching event on Google Calendar.
                  {party.google_calendar_event_id
                    ? ` DB has stale event ID ${party.google_calendar_event_id} — was probably deleted manually.`
                    : ' Never created.'}{' '}
                  Open the party detail and tap any payment-related action to
                  regenerate the event, or manually create it in Google Calendar.
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'bad';
}) {
  const colors =
    tone === 'ok'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-coral-50 text-coral-700 border-coral-200';
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 ${colors}`}>
      <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}

function ErrorBanner({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-coral bg-coral-50 p-5">
      <p className="text-sm font-bold text-coral-700">{title}</p>
      <p className="mt-2 text-[11px] font-mono text-coral-700/70">{detail}</p>
    </div>
  );
}
