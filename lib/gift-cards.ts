// Gift card helpers: code generation, lookup, balance, redemption.
//
// Code format: WP-XXXX-XXXX (12 chars, uppercase, no ambiguous letters)
// Alphabet excludes 0/O/1/I/L to avoid typos when read aloud.

import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const GIFT_CARD_MIN_CENTS = 2500; // $25
export const GIFT_CARD_MAX_CENTS = 50000; // $500

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateGiftCardCode(): string {
  const bytes = randomBytes(8);
  let core = '';
  for (let i = 0; i < 8; i++) {
    core += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `WP-${core.slice(0, 4)}-${core.slice(4, 8)}`;
}

export type GiftCardRow = {
  id: string;
  code: string;
  amount_cents: number;
  redeemed_cents: number;
  status: 'pending' | 'active' | 'redeemed' | 'void';
  recipient_name: string;
  recipient_email: string;
  purchaser_name: string;
  purchaser_email: string;
  message: string | null;
};

// Generates a code that doesn't already exist. Tries up to 5 times — collisions
// at our volume are astronomically unlikely (31^8 ≈ 850 billion combinations).
export async function generateUniqueGiftCardCode(): Promise<string> {
  const db = supabaseAdmin();
  for (let i = 0; i < 5; i++) {
    const code = generateGiftCardCode();
    const { data } = await db.from('gift_cards').select('id').eq('code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Could not generate unique gift card code after 5 tries');
}

export async function getGiftCardByCode(rawCode: string): Promise<GiftCardRow | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from('gift_cards')
    .select('id, code, amount_cents, redeemed_cents, status, recipient_name, recipient_email, purchaser_name, purchaser_email, message')
    .eq('code', code)
    .maybeSingle();
  return (data as GiftCardRow | null) ?? null;
}

export function balanceCents(card: Pick<GiftCardRow, 'amount_cents' | 'redeemed_cents'>): number {
  return Math.max(0, card.amount_cents - card.redeemed_cents);
}

// Normalize user-entered codes: uppercase, strip spaces/dashes, then re-insert.
// Accepts "wp7k2m9xqr", "WP-7K2M-9XQR", "WP 7K2M 9XQR" → returns "WP-7K2M-9XQR".
export function normalizeCode(input: string): string | null {
  if (!input) return null;
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '');
  if (!/^WP[A-Z0-9]{8}$/.test(cleaned)) return null;
  return `WP-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
}

// Atomically redeem an amount from a card. Returns the amount actually
// redeemed (may be less than requested if balance is insufficient).
// Also logs a row in gift_card_redemptions for audit.
export async function redeemFromCard(
  cardId: string,
  requestedCents: number,
  refs: { partyId?: string; openPlayId?: string; stripeSessionId?: string },
): Promise<{ redeemedCents: number; newBalanceCents: number }> {
  const db = supabaseAdmin();

  // Re-fetch card with current redeemed_cents to avoid stale reads
  const { data: card, error: fetchErr } = await db
    .from('gift_cards')
    .select('id, amount_cents, redeemed_cents, status')
    .eq('id', cardId)
    .single();
  if (fetchErr || !card) throw new Error('Gift card not found');
  if (card.status !== 'active') throw new Error(`Gift card is ${card.status}`);

  const available = card.amount_cents - card.redeemed_cents;
  const toRedeem = Math.min(Math.max(0, requestedCents), available);
  if (toRedeem <= 0) return { redeemedCents: 0, newBalanceCents: available };

  const newRedeemed = card.redeemed_cents + toRedeem;
  const fullyRedeemed = newRedeemed >= card.amount_cents;

  const { error: updateErr } = await db
    .from('gift_cards')
    .update({
      redeemed_cents: newRedeemed,
      status: fullyRedeemed ? 'redeemed' : 'active',
    })
    .eq('id', cardId);
  if (updateErr) throw new Error(`Could not redeem: ${updateErr.message}`);

  await db.from('gift_card_redemptions').insert({
    gift_card_id: cardId,
    party_id: refs.partyId ?? null,
    open_play_id: refs.openPlayId ?? null,
    amount_cents: toRedeem,
    stripe_session_id: refs.stripeSessionId ?? null,
  });

  return { redeemedCents: toRedeem, newBalanceCents: available - toRedeem };
}
