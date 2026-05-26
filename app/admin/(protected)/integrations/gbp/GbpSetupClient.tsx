'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LocOption = { name: string; title: string; addressLine?: string };
type AccountGroup = {
  accountName: string;
  accountResourceName: string;
  locations: LocOption[];
};

export function GbpSetupClient({
  connected,
  locationPicked,
}: {
  connected: boolean;
  locationPicked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<AccountGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const loadLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/integrations/gbp/list-locations');
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not load locations');
      } else {
        setAccounts(data.accounts ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const pickLocation = async (
    account: string,
    location: string,
    title: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/integrations/gbp/select-location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          account_resource_name: account,
          location_resource_name: location,
          location_title: title,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save');
      } else {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    if (!confirm('Push current special hours to Google Business Profile? This will replace any existing special hours on the listing.')) {
      return;
    }
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch('/api/admin/integrations/gbp/sync-now', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncFeedback(`Error: ${data.error}`);
      } else {
        setSyncFeedback(
          `Pushed ${data.periodsPushed} special-hour period${data.periodsPushed === 1 ? '' : 's'} covering ${data.rangeStart} → ${data.rangeEnd}. Google can take up to a few hours to reflect changes.`,
        );
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  };

  if (!connected) return null;

  return (
    <div className="space-y-4">
      {!locationPicked && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-display text-lg text-slate-700">Pick your location</p>
          <p className="mt-1 text-xs text-slate-500">
            One-time setup — choose which Google Business Profile location to sync.
          </p>

          {accounts.length === 0 && (
            <button
              type="button"
              onClick={loadLocations}
              disabled={loading}
              className="mt-4 rounded-full bg-coral px-5 py-2 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load locations'}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-coral-700">{error}</p>}

          {accounts.map((acc) => (
            <div key={acc.accountResourceName} className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {acc.accountName}
              </p>
              <div className="mt-2 space-y-2">
                {acc.locations.length === 0 ? (
                  <p className="text-sm text-slate-500">No locations under this account.</p>
                ) : (
                  acc.locations.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() =>
                        pickLocation(acc.accountResourceName, loc.name, loc.title)
                      }
                      disabled={loading}
                      className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-coral hover:shadow-card disabled:opacity-50"
                    >
                      <p className="font-semibold text-slate-700">{loc.title}</p>
                      {loc.addressLine && (
                        <p className="mt-0.5 text-xs text-slate-500">{loc.addressLine}</p>
                      )}
                      <p className="mt-0.5 text-xs font-mono text-slate-400">{loc.name}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {locationPicked && (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now →'}
          </button>
          {syncFeedback && (
            <p className="rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-700">
              {syncFeedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
