'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INVOICE_THEME_LIST, type InvoiceThemeSlug } from '@/lib/invoice-themes';

export function InvoiceThemePicker({
  partyId,
  initial,
  locked,
}: {
  partyId: string;
  initial: InvoiceThemeSlug;
  locked: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<InvoiceThemeSlug>(initial);
  const [saving, setSaving] = useState<InvoiceThemeSlug | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (slug: InvoiceThemeSlug) => {
    if (locked || saving || slug === selected) return;
    const prev = selected;
    setSelected(slug);
    setSaving(slug);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/theme`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save theme.');
        setSelected(prev);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setSelected(prev);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {INVOICE_THEME_LIST.map((t) => {
          const isSelected = t.slug === selected;
          const isSaving = saving === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => pick(t.slug)}
              disabled={locked || !!saving}
              className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-coral shadow-card'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`mb-2 h-12 w-full rounded-lg ${t.swatchClass}`} />
              <p className="text-sm font-bold text-slate-700">{t.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.blurb}</p>
              {isSelected && !isSaving && (
                <span className="absolute right-2 top-2 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Selected
                </span>
              )}
              {isSaving && (
                <span className="absolute right-2 top-2 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Saving…
                </span>
              )}
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="mt-3 text-xs text-slate-400">
          Invoice already sent — theme is locked. Re-issuing the invoice will use the current selection.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-coral-700">{error}</p>}
    </div>
  );
}
