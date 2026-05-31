// Server-side helpers for promo codes (skip-deposit + percent-off).

import { supabaseAdmin } from '@/lib/supabase';

// Unambiguous alphabet — no I/O/0/1 confusion when read aloud or typed.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePromoCode(prefix = 'SKIP'): string {
  const block = () =>
    Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
  return `${prefix}-${block()}-${block()}`;
}

export type PromoKind = 'skip_deposit' | 'percent_off';
export type PromoChannel = 'online' | 'admin' | 'both';
export type PromoContext = 'party' | 'open_play' | 'membership' | 'gift_card';

export type PromoValidation =
  | {
      ok: true;
      id: string;
      code: string;
      kind: PromoKind;
      // Only set when kind === 'percent_off'
      discount_percent?: number | null;
      label?: string | null;
    }
  | { ok: false; reason: string };

// Validate a code against the database, including channel + product scope.
// Callers pass:
//   - context: what's being booked (party / open_play / membership / gift_card)
//   - channel: 'online' (customer entered via /book) or 'admin' (owner
//     applying via /admin/parties). Used to enforce per-code channel
//     restrictions — an admin-only code can't be used online and vice versa.
//
// Used both by the customer-facing /api/promo-code/validate endpoint (which
// passes channel='online') and the server-side /api/checkout/* paths
// (authoritative final check at booking time).
export async function validatePromoCode(
  rawCode: string,
  opts: { context: PromoContext; channel: 'online' | 'admin' },
): Promise<PromoValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Enter a code.' };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('promo_codes')
    .select(
      'id, code, kind, label, valid_from, valid_until, max_uses, uses_count, discount_percent, applies_to, channel, disabled_at',
    )
    .eq('code', code)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'Code not found.' };

  const now = Date.now();
  if (data.disabled_at) {
    return { ok: false, reason: 'Code is no longer active.' };
  }
  if (new Date(data.valid_from).getTime() > now) {
    return { ok: false, reason: 'Code is not active yet.' };
  }
  if (new Date(data.valid_until).getTime() < now) {
    return { ok: false, reason: 'Code has expired.' };
  }
  if (data.max_uses != null && data.uses_count >= data.max_uses) {
    return { ok: false, reason: 'Code has been used the maximum number of times.' };
  }

  // Channel check — null/'both' means anywhere. Otherwise must match.
  const codeChannel: PromoChannel = (data.channel ?? 'both') as PromoChannel;
  if (codeChannel !== 'both' && codeChannel !== opts.channel) {
    return {
      ok: false,
      reason:
        codeChannel === 'admin'
          ? 'This code is owner-only and can only be applied in-person or over the phone.'
          : 'This code is for online checkout only.',
    };
  }

  // Scope check — null/empty applies_to means "any product" (legacy
  // skip_deposit rows). Otherwise the booking context must appear in
  // the list.
  const scope: string[] | null = data.applies_to ?? null;
  if (scope && scope.length > 0 && !scope.includes(opts.context)) {
    const friendly: Record<PromoContext, string> = {
      party: 'birthday parties',
      open_play: 'open play',
      membership: 'memberships',
      gift_card: 'gift cards',
    };
    return {
      ok: false,
      reason: `This code only works on ${scope
        .map((s) => friendly[s as PromoContext] ?? s)
        .join(' / ')}.`,
    };
  }

  return {
    ok: true,
    id: data.id,
    code: data.code,
    kind: data.kind as PromoKind,
    discount_percent: data.discount_percent ?? null,
    label: data.label ?? null,
  };
}

// Atomically increment uses_count. Best-effort — if it fails the booking
// still proceeds (the alternative is making bookings flaky on transient
// DB errors for a benign counter).
export async function recordPromoUse(promoCodeId: string): Promise<void> {
  const db = supabaseAdmin();
  await db.rpc('promo_codes_increment_use', { p_id: promoCodeId });
}
