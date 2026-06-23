// Clover REST API wrapper. Production base: https://api.clover.com
// Sandbox: https://apisandbox.dev.clover.com
//
// Requires env vars:
//   CLOVER_ACCESS_TOKEN — long-lived API token from Clover dashboard
//   CLOVER_MERCHANT_ID  — the merchant's MID
//   CLOVER_API_BASE     — optional override (defaults to prod)

import { supabaseAdmin } from '@/lib/supabase';

const DEFAULT_BASE = 'https://api.clover.com';

function base(): string {
  return process.env.CLOVER_API_BASE ?? DEFAULT_BASE;
}

function token(): string {
  const t = process.env.CLOVER_ACCESS_TOKEN;
  if (!t) throw new Error('CLOVER_ACCESS_TOKEN is not set');
  return t;
}

function merchantId(): string {
  const m = process.env.CLOVER_MERCHANT_ID;
  if (!m) throw new Error('CLOVER_MERCHANT_ID is not set');
  return m;
}

export function cloverConfigured(): boolean {
  return !!(process.env.CLOVER_ACCESS_TOKEN && process.env.CLOVER_MERCHANT_ID);
}

// Clover stores timestamps as ms since epoch. Helper to convert.
function fromCloverTs(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

type CloverPayment = {
  id: string;
  amount: number;
  tipAmount?: number;
  taxAmount?: number;
  createdTime: number;
  modifiedTime?: number;
  order?: { id?: string };
  employee?: { id?: string };
  device?: { id?: string };
  tender?: { label?: string; labelKey?: string };
  result?: string;
  refunds?: { elements?: Array<{ amount?: number }> } | Array<{ amount?: number }>;
  voided?: boolean;
};

// Fetch all payments updated since `sinceMs`. Paginates.
async function listPayments(sinceMs: number): Promise<CloverPayment[]> {
  const all: CloverPayment[] = [];
  const limit = 100;
  let offset = 0;
  // Clover supports filter: modifiedTime>=<ms>
  while (true) {
    const url = new URL(`${base()}/v3/merchants/${merchantId()}/payments`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('filter', `modifiedTime>=${sinceMs}`);
    url.searchParams.set('expand', 'order,tender,employee,device,refunds');
    url.searchParams.set('orderBy', 'modifiedTime');
    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${token()}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Clover ${res.status}: ${txt.slice(0, 300)}`);
    }
    const data = (await res.json()) as { elements: CloverPayment[] };
    const els = data.elements ?? [];
    all.push(...els);
    if (els.length < limit) break;
    offset += limit;
    if (offset > 10_000) break; // safety
  }
  return all;
}

export type SyncResult = {
  payments_pulled: number;
  payments_inserted: number;
  payments_updated: number;
  from_ts: string;
  to_ts: string;
};

// Pull Clover payments modified since the last successful sync (or `daysBack`
// days back if no prior sync), upsert into clover_payments, log to clover_sync_log.
export async function syncCloverPayments(daysBack = 7): Promise<SyncResult> {
  if (!cloverConfigured()) {
    throw new Error('Clover not configured (set CLOVER_ACCESS_TOKEN + CLOVER_MERCHANT_ID)');
  }

  const db = supabaseAdmin();

  // Start a sync log row
  const { data: logRow } = await db
    .from('clover_sync_log')
    .insert({ sync_started_at: new Date().toISOString() })
    .select()
    .single();
  const logId = logRow?.id;

  try {
    // Find last successful sync
    const { data: lastSync } = await db
      .from('clover_sync_log')
      .select('to_clover_ts')
      .not('to_clover_ts', 'is', null)
      .order('sync_finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceMs = lastSync?.to_clover_ts
      ? new Date(lastSync.to_clover_ts).getTime() - 1000 * 60 // 1min overlap
      : Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const payments = await listPayments(sinceMs);
    let inserted = 0;
    let updated = 0;

    for (const p of payments) {
      // Clover returns `refunds` as either a plain array OR a wrapped
      // `{ elements: [...] }` depending on the expand syntax. Normalize.
      const refundList = Array.isArray(p.refunds)
        ? p.refunds
        : Array.isArray(p.refunds?.elements)
          ? p.refunds.elements
          : [];
      const refundedTotal = refundList.reduce(
        (s: number, r: { amount?: number }) => s + (r.amount ?? 0),
        0,
      );
      const status: 'paid' | 'refunded' | 'voided' = p.voided
        ? 'voided'
        : refundedTotal >= p.amount && p.amount > 0
          ? 'refunded'
          : 'paid';

      const row = {
        clover_payment_id: p.id,
        clover_order_id: p.order?.id ?? null,
        amount_cents: p.amount ?? 0,
        tip_cents: p.tipAmount ?? 0,
        tax_cents: p.taxAmount ?? 0,
        status,
        tender_type: p.tender?.labelKey ?? p.tender?.label ?? null,
        employee_clover_id: p.employee?.id ?? null,
        device_id: p.device?.id ?? null,
        refunded_amount_cents: refundedTotal,
        created_at_clover: fromCloverTs(p.createdTime)!,
        updated_at_clover: fromCloverTs(p.modifiedTime ?? p.createdTime),
        raw: p as any,
        synced_at: new Date().toISOString(),
      };

      // Check if exists for inserted vs updated count
      const { data: existing } = await db
        .from('clover_payments')
        .select('id')
        .eq('clover_payment_id', p.id)
        .maybeSingle();

      if (existing) {
        await db.from('clover_payments').update(row).eq('id', existing.id);
        updated += 1;
      } else {
        await db.from('clover_payments').insert(row);
        inserted += 1;
      }
    }

    const result: SyncResult = {
      payments_pulled: payments.length,
      payments_inserted: inserted,
      payments_updated: updated,
      from_ts: new Date(sinceMs).toISOString(),
      to_ts: new Date().toISOString(),
    };

    if (logId) {
      await db
        .from('clover_sync_log')
        .update({
          sync_finished_at: new Date().toISOString(),
          from_clover_ts: result.from_ts,
          to_clover_ts: result.to_ts,
          payments_pulled: result.payments_pulled,
          payments_inserted: result.payments_inserted,
          payments_updated: result.payments_updated,
        })
        .eq('id', logId);
    }

    return result;
  } catch (err) {
    if (logId) {
      await db
        .from('clover_sync_log')
        .update({
          sync_finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : 'unknown',
        })
        .eq('id', logId);
    }
    throw err;
  }
}
