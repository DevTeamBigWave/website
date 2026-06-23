'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePartyPricing, PACKAGES, type PackageId, type ExtensionId } from '@/lib/pricing';

const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

function extId(extensionMinutes: number | null): ExtensionId | null {
  return (extensionMinutes ?? 0) >= 60 ? ('60m' as ExtensionId) : null;
}

// Headcount is the source of truth for extra-kid pricing. Kids above the
// package's included count are auto-priced into the party subtotal — there's
// no separate "extra kid" add-on (that double-charges).
export function HeadcountEditor({
  partyId,
  currentHeadcount,
  partyPackage,
  date,
  startTime,
  extensionMinutes,
  depositPaidAt,
}: {
  partyId: string;
  currentHeadcount: number;
  partyPackage: PackageId;
  date: string;
  startTime: string; // "HH:MM:SS"
  extensionMinutes: number | null;
  depositPaidAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentHeadcount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkg = PACKAGES[partyPackage];
  const included = pkg.includedKids;
  const parsed = Math.max(1, Math.min(40, parseInt(value, 10) || 0));

  const ext = extId(extensionMinutes);
  const at = new Date(`${date}T${startTime}`);
  const current = calculatePartyPricing({
    packageId: partyPackage,
    date: at,
    time: startTime,
    extensionId: ext,
    headcount: currentHeadcount,
  });
  const next = calculatePartyPricing({
    packageId: partyPackage,
    date: at,
    time: startTime,
    extensionId: ext,
    headcount: parsed,
  });

  const submit = async () => {
    setError(null);
    if (parsed === currentHeadcount) {
      setError('Pick a different headcount.');
      return;
    }
    if (
      !confirm(
        `Set headcount to ${parsed} kids? ${
          next.extraKidCount > 0
            ? `${next.extraKidCount} over the ${included} included × $${(pkg.extraKidPriceCents / 100).toFixed(0)} = ${fmt(next.extraKidCents)}. `
            : ''
        }Party total re-prices to ${fmt(next.totalCents)} (was ${fmt(current.totalCents)}). ${
          depositPaidAt
            ? 'The paid deposit carries over and credits the new balance.'
            : 'The 50% deposit re-quotes to ' + fmt(next.depositCents) + '.'
        } Customer + owner get an email and the calendar updates.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/headcount`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ headcount: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not update headcount');
        return;
      }
      router.refresh();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-xl border border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">
              {currentHeadcount} kids
              {current.extraKidCount > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {current.extraKidCount} over the {included} included ({fmt(current.extraKidCents)})
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {pkg.name} includes {included} kids. Extra kids are billed automatically at $
              {(pkg.extraKidPriceCents / 100).toFixed(0)} each — set the count here, not as an add-on.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-end rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-600 sm:self-auto"
          >
            Edit headcount
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-3 overflow-hidden rounded-xl border-2 border-coral bg-coral-50/50 px-4 py-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Total kids (including the birthday child)
        </span>
        <input
          type="number"
          min={1}
          max={40}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 block w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
        />
      </label>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <PreviewRow label={`${pkg.name} base`} value={fmt(pkg.priceCents)} />
          {next.extraKidCount > 0 && (
            <PreviewRow
              label={`Extra kids × ${next.extraKidCount} (over ${included})`}
              value={fmt(next.extraKidCents)}
            />
          )}
          {next.discountApplied && (
            <PreviewRow label="Mon–Thu 20% off" value={`−${fmt(next.discountCents)}`} accent />
          )}
          <PreviewRow label="New party total (incl. tax)" value={fmt(next.totalCents)} strong />
          <PreviewRow label="Was" value={fmt(current.totalCents)} muted />
          {!depositPaidAt && <PreviewRow label="New 50% deposit" value={fmt(next.depositCents)} />}
        </tbody>
      </table>

      <p className="text-xs text-slate-500">
        {depositPaidAt
          ? 'Deposit already paid — it carries over and credits the new balance.'
          : 'No deposit paid yet, so the 50% deposit re-quotes.'}{' '}
        Add-ons, contact details, date and time stay the same.
      </p>

      {error && <p className="text-xs text-coral-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || parsed === currentHeadcount}
          className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save & notify customer'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue(String(currentHeadcount));
            setError(null);
          }}
          disabled={busy}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  muted,
  strong,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <tr>
      <td className="py-1.5 text-slate-500">{label}</td>
      <td
        className={`py-1.5 text-right ${
          accent ? 'font-semibold text-coral' : muted ? 'text-slate-400 line-through' : 'text-slate-700'
        } ${strong ? 'font-bold' : ''}`}
      >
        {value}
      </td>
    </tr>
  );
}
