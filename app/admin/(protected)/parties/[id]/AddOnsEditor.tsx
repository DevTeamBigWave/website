'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADD_ON_CATALOG, CATEGORY_LABEL, findCatalogItem } from '@/lib/add-ons';

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
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-form state
  const [catalogId, setCatalogId] = useState<string>('');
  const [name, setName] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');

  const grouped = ADD_ON_CATALOG.reduce<Record<string, typeof ADD_ON_CATALOG>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  const onCatalogChange = (id: string) => {
    setCatalogId(id);
    if (id === '') {
      setName('');
      setPriceDollars('');
      setQty('1');
      return;
    }
    const item = findCatalogItem(id);
    if (item) {
      setName(item.name);
      setPriceDollars((item.price_cents / 100).toFixed(2));
      setQty(String(item.default_qty ?? 1));
    }
  };

  const submit = async () => {
    if (!name.trim() || !priceDollars) {
      setError('Name and price are required.');
      return;
    }
    const cents = Math.round(parseFloat(priceDollars) * 100);
    if (Number.isNaN(cents) || cents < 0) {
      setError('Price is invalid.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/add-ons`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          catalog_id: catalogId || undefined,
          name: name.trim(),
          unit_price_cents: cents,
          qty: parseInt(qty, 10) || 1,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not add.');
        setAdding(false);
        return;
      }
      setItems((prev) => [...prev, data.addOn]);
      setCatalogId('');
      setName('');
      setPriceDollars('');
      setQty('1');
      setNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAdding(false);
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

  return (
    <div className="space-y-4">
      {/* Existing list */}
      {items.length > 0 ? (
        <div className="rounded-xl border border-slate-100 divide-y divide-slate-100">
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
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Subtotal</span>
            <span className="font-display text-sm text-slate-700">{fmt(subtotal)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No add-ons yet.</p>
      )}

      {/* Add form */}
      <details className="rounded-xl border border-slate-200">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">
          + Add an item
        </summary>
        <div className="border-t border-slate-100 px-4 py-4 space-y-3">
          <Field label="Pick from catalog (or leave blank for custom)">
            <select
              value={catalogId}
              onChange={(e) => onCatalogChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
            >
              <option value="">— Custom item —</option>
              {Object.entries(grouped).map(([cat, list]) => (
                <optgroup key={cat} label={CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {fmt(c.price_cents)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Name on invoice">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Price (USD)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="mt-1 w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
            <Field label="Qty">
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1 w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Frozen theme, lactose-free"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral focus:outline-none"
            />
          </Field>

          {error && <p className="text-xs text-coral-700">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={adding}
            className="rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-playful hover:bg-coral-600 disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add to party'}
          </button>
        </div>
      </details>
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
