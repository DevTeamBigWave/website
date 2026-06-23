'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePartyPricing, PACKAGES, type PackageId, type ExtensionId } from '@/lib/pricing';

const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

// Mirrors the server: extension is the only 60-min option; treat any stored
// extension >= 60 as the 60m add-on for re-pricing.
function extId(extensionMinutes: number | null): ExtensionId | null {
  return (extensionMinutes ?? 0) >= 60 ? ('60m' as ExtensionId) : null;
}

export function PackageCard({
  partyId,
  currentPackage,
  date,
  startTime,
  headcount,
  extensionMinutes,
  depositPaidAt,
  hasManualDiscount,
}: {
  partyId: string;
  currentPackage: PackageId;
  date: string;
  startTime: string; // "HH:MM:SS"
  headcount: number;
  extensionMinutes: number | null;
  depositPaidAt: string | null;
  hasManualDiscount: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target: PackageId = currentPackage === 'private' ? 'semi' : 'private';
  const isUpgrade = target === 'private';

  const ext = extId(extensionMinutes);
  const at = new Date(`${date}T${startTime}`);
  const currentPricing = calculatePartyPricing({
    packageId: currentPackage,
    date: at,
    time: startTime,
    extensionId: ext,
    headcount,
  });
  const newPricing = calculatePartyPricing({
    packageId: target,
    date: at,
    time: startTime,
    extensionId: ext,
    headcount,
  });

  // Heads-up: upgrading to a weekday Private auto-applies the 20% discount,
  // which the server will refuse to stack on top of an existing F&F/promo.
  const wouldStack = isUpgrade && newPricing.discountApplied && hasManualDiscount;

  const submit = async () => {
    setError(null);
    if (wouldStack) {
      setError(
        'This is a Mon–Thu date, so Private adds the automatic 20% discount — it can’t stack with the existing Friends & family / promo discount. Clear that discount first.',
      );
      return;
    }
    const verb = isUpgrade ? 'Upgrade to Private' : 'Downgrade to Semi-Private';
    if (
      !confirm(
        `${verb}? The party total re-prices to ${fmt(newPricing.totalCents)} (was ${fmt(currentPricing.totalCents)}). ${
          depositPaidAt
            ? 'The paid deposit carries over and credits the new balance.'
            : 'The 50% deposit re-quotes to ' + fmt(newPricing.depositCents) + '.'
        } The customer + owner get an email and the calendar event updates.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/package`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ package: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not change package');
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

  const currentName = PACKAGES[currentPackage].name;
  const targetName = PACKAGES[target].name;

  if (!open) {
    return (
      <div className="rounded-xl border border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">
              Currently {currentName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {isUpgrade
                ? 'Upgrade to Private — the whole venue, closed to the public. Re-prices the party, updates the calendar, and emails the customer.'
                : 'Downgrade to Semi-Private — party room only, open play continues. Re-prices the party, updates the calendar, and emails the customer.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-end rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-600 sm:self-auto"
          >
            {isUpgrade ? 'Upgrade to Private' : 'Downgrade to Semi'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-3 overflow-hidden rounded-xl border-2 border-coral bg-coral-50/50 px-4 py-4">
      <p className="text-sm font-bold text-slate-700">
        {currentName} → {targetName}
      </p>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <PreviewRow label={`${currentName} total (now)`} value={fmt(currentPricing.totalCents)} muted />
          <PreviewRow label={`${targetName} total (new)`} value={fmt(newPricing.totalCents)} strong />
          {newPricing.discountApplied && (
            <PreviewRow label="Includes Mon–Thu 20% off" value={`−${fmt(newPricing.discountCents)}`} accent />
          )}
          {!depositPaidAt && (
            <PreviewRow label="New 50% deposit" value={fmt(newPricing.depositCents)} />
          )}
        </tbody>
      </table>

      <p className="text-xs text-slate-500">
        {depositPaidAt
          ? 'Deposit already paid — it carries over and credits the new balance. We email the customer the updated total and refresh the calendar.'
          : 'No deposit paid yet, so the 50% deposit re-quotes. Add-ons, gift cards, and contact details stay the same.'}
        {currentPackage === 'private' && (
          <> Note: extra-kid headcount is recalculated — Semi-Private includes 11 kids vs Private’s 16.</>
        )}
      </p>

      {wouldStack && (
        <p className="text-xs text-coral-700">
          ⚠ This is a Mon–Thu date — Private adds the automatic 20% discount, which can’t stack with the
          existing Friends &amp; family / promo discount. Clear that discount first.
        </p>
      )}
      {error && <p className="text-xs text-coral-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || wouldStack}
          className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:opacity-50"
        >
          {busy ? 'Saving…' : isUpgrade ? 'Upgrade & notify customer' : 'Downgrade & notify customer'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
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
