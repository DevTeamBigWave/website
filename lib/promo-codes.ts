// Server-side helpers for skip-deposit promo codes.

import { supabaseAdmin } from '@/lib/supabase';

// Unambiguous alphabet — no I/O/0/1 confusion when read aloud or typed.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePromoCode(): string {
  const block = () =>
    Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
  return `SKIP-${block()}-${block()}`;
}

export type PromoValidation =
  | { ok: true; id: string; kind: 'skip_deposit' }
  | { ok: false; reason: string };

// Validate a code against the database. Used both by the customer-facing
// /api/promo-code/validate endpoint (UI preview) and the /api/checkout/party
// path (authoritative server-side check at booking time).
export async function validatePromoCode(rawCode: string): Promise<PromoValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Enter a code.' };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('promo_codes')
    .select('id, kind, valid_from, valid_until, max_uses, uses_count')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'Code not found.' };

  const now = Date.now();
  if (new Date(data.valid_from).getTime() > now) {
    return { ok: false, reason: 'Code is not active yet.' };
  }
  if (new Date(data.valid_until).getTime() < now) {
    return { ok: false, reason: 'Code has expired.' };
  }
  if (data.max_uses != null && data.uses_count >= data.max_uses) {
    return { ok: false, reason: 'Code has been used the maximum number of times.' };
  }
  return { ok: true, id: data.id, kind: data.kind as 'skip_deposit' };
}

// Atomically increment uses_count. Best-effort — if it fails the booking
// still proceeds (the alternative is making bookings flaky on transient
// DB errors for a benign counter).
export async function recordPromoUse(promoCodeId: string): Promise<void> {
  const db = supabaseAdmin();
  await db.rpc('promo_codes_increment_use', { p_id: promoCodeId });
}
