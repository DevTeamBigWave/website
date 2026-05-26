'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADD_ON_CATALOG, CATEGORY_LABEL, type AddOnCatalogItem } from '@/lib/add-ons';

type AddOnRow = {
  id: string;
  catalog_id: string | null;
  name: string;
  unit_price_cents: number;
  qty: number;
  notes: string | null;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function AddOnsEditor({
  partyId,
  initial,
}: {
  partyId: string;
  initial: AddOnRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<AddOnRow[]>(initial);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-catalog-id row state (checked + qty + price override)
  type RowState = { checked: boolean; qty: string; priceDollars: string };
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    ADD_ON_CATALOG.reduce<Record<string, RowState>>((acc, c) => {
      acc[c.id] = {
        checked: false,
        qty: String(c.default_qty ?? 1),
        priceDollars: (c.price_cents / 100).toFixed(2),
      };
      return acc;
    }, {}),
  );

  const grouped = useMemo(() => {
    return ADD_ON_CATALOG.reduce<Record<string, AddOnCatalogItem[]>>((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
  }, []);

  const selected = useMemo(
    () => ADD_ON_CATALOG.filter((c) => rows[c.id]?.checked),
    [rows],
  );

  const selectedTotalCents = useMemo(
    () =>
      selected.reduce((sum, c) => {
        const r = rows[c.id];
        const cents = Math.round(parseFloat(r.priceDollars || '0') * 100) || 0;
        const qty = parseInt(r.qty || '1', 10) || 1;
        return sum + cents * qty;
      }, 0),
    [selected, rows],
  );

  // Custom-item form state
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customNotes, setCustomNotes] = useState('');
  const [customBusy, setCustomBusy] = useState(false);

  const toggleRow = (id: string) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], checked: !r[id].checked } }));
  };
  const setRowField = (id: string, field: 'qty' | 'priceDollars', value: string) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], [field]: value } }));
  };

  const addOne = async (payload: {
    catalog_id?: string;
    name: string;
    unit_price_cents: number;
    qty: number;
    notes?: string;
  }) => {
    const res = await fetch(`/api/admin/parties/${partyId}/add-ons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not add');
    return data.addOn as AddOnRow;
  };

  const submitSelected = async () => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const created: AddOnRow[] = [];
      for (const c of selected) {
        const r = rows[c.id];
        const cents = Math.round(parseFloat(r.priceDollars || '0') * 100);
        if (Number.isNaN(cents) || cents < 0) {
          throw new Error(`Invalid price for ${c.name}`);
        }
        const qty = parseInt(r.qty || '1', 10) || 1;
        const added = await addOne({
          catalog_id: c.id,
          name: c.name,
          unit_price_cents: cents,
          qty,
        });
        created.push(added);
      }
      setItems((prev) => [...prev, ...created]);
      // Reset selections (keep custom price/qty edits in place for repeat-use)
      setRows((r) => {
        const next: Record<string, RowState> = {};
        for (const id of Object.keys(r)) next[id] = { ...r[id], checked: false };
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items');
    } finally {
      setBulkBusy(false);
    }
  };

  const submitCustom = async () => {
    if (!customName.trim() || !customPrice) {
      setError('Custom name and price are required.');
      return;
    }
    const cents = Math.round(parseFloat(customPrice) * 100);
    if (Number.isNaN(cents) || cents < 0) {
      setError('Custom price is invalid.');
      return;
    }
    setCustomBusy(true);
    setError(null);
    try {
      const added = await addOne({
        name: customName.trim(),
        unit_price_cents: cents,
        qty: parseInt(customQty, 10) || 1,
        notes: customNotes.trim() || undefined,
      });
      setItems((prev) => [...prev, added]);
      setCustomName('');
      setCustomPrice('');
      setCustomQty('1');
      setCustomNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCustomBusy(false);
    }
  };

  const remove = async (addOnId: string) => {
    if (!confirm('Remove this add-on?')) return;
    const res = await fetch(`/api/admin/parties/${partyId}/add-ons/${addOnId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== addOnId));
      router.refresh();
    }
  };

  const subtotal = items.reduce((s, i) => s + i.unit_price_cents * i.qty, 0);
  // Don't show the catalog row for an item already added (deduplicates the UI)
  const addedCatalogIds = new Set(items.map((i) => i.catalog_id).filter(Boolean) as string[]);

  return (
    <div className="space-y-5">
      {/* Existing list */}
      {items.length > 0 ? (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {items.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">
                  {i.name}
                  {i.qty > 1 && <span className="ml-2 text-xs text-slate-400">× {i.qty}</span>}
                </p>
                {i.notes && <p className="mt-0.5 text-xs text-slate-500">{i.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="font-display text-sm text-coral">{fmt(i.unit_price_cents * i.qty)}</p>
                <button
                  type="button"
                  onClick={() => remove(i.id)}
                  className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-coral"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Add-ons subtotal</span>
            <span className="font-display text-sm text-slate-700">{fmt(subtotal)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No add-ons yet — tick the ones you want below.</p>
      )}

      {/* Catalog checkbox grid */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-700">Quick add from catalog</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tick everything that applies, tweak qty/price, then add them all in one shot.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {Object.entries(grouped).map(([category, list]) => (
            <div key={category} className="px-4 py-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category}
              </p>
              <div className="space-y-1.5">
                {list.map((c) => {
                  const r = rows[c.id];
                  const alreadyAdded = addedCatalogIds.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex flex-col gap-2 rounded-xl border px-3 py-3 transition sm:flex-row sm:items-center sm:gap-3 ${
                        r.checked
                          ? 'border-coral bg-coral-50'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                      } ${alreadyAdded ? 'opacity-60' : ''}`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={r.checked}
                          onChange={() => toggleRow(c.id)}
                          className="h-5 w-5 flex-none accent-coral"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-slate-700">
                            {c.name}
                            {alreadyAdded && (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                · already added
                              </span>
                            )}
                          </p>
                          {c.hint && <p className="text-xs text-slate-400">{c.hint}</p>}
                        </div>
                      </div>
                      <div className="flex flex-none items-center justify-end gap-1.5 pl-8 sm:pl-0">
                        <span className="text-sm text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.priceDollars}
                          onChange={(e) => setRowField(c.id, 'priceDollars', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 88 }}
                          className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
                        />
                        <span className="ml-1 text-sm text-slate-400">×</span>
                        <input
                          type="number"
                          min="1"
                          value={r.qty}
                          onChange={(e) => setRowField(c.id, 'qty', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 64 }}
                          className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-semibold text-slate-700 focus:border-coral focus:outline-none"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            {selected.length === 0
              ? 'Nothing selected'
              : `${selected.length} item${selected.length === 1 ? '' : 's'} · ${fmt(selectedTotalCents)}`}
          </p>
          <button
            type="button"
            onClick={submitSelected}
            disabled={selected.length === 0 || bulkBusy}
            className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkBusy ? 'Adding…' : `Add ${selected.length || ''} to party →`.trim()}
          </button>
        </div>
      </div>

      {/* Custom item */}
      <details
        open={customOpen}
        onToggle={(e) => setCustomOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-xl border border-slate-200 bg-white"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">
          + Custom item (not in catalog)
        </summary>
        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Name on invoice">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Price (USD)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="mt-1 w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Qty">
              <input
                type="number"
                min="1"
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="mt-1 w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Lactose-free, specific flavor"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
            />
          </Field>
          <button
            type="button"
            onClick={submitCustom}
            disabled={customBusy}
            className="rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-600 disabled:opacity-50"
          >
            {customBusy ? 'Adding…' : 'Add custom item'}
          </button>
        </div>
      </details>

      {error && <p className="text-xs text-coral-700">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
