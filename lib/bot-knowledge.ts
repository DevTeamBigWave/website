// ============================================================================
// Bot knowledge — the SINGLE source of truth for what the website chat AND the
// SMS auto-responder know.
//
// Two layers, combined by buildBotSystemPrompt():
//
//   1. SYSTEM_PROMPT (curated voice + policy + menu) from chat-system-prompt.ts
//   2. PRICING FACTS derived live from lib/pricing.ts — so every dollar figure
//      the bot states is generated from the same constants the checkout charges.
//      These OVERRIDE anything in the curated prompt, eliminating drift.
//   3. (optional) the latest WEBSITE SNAPSHOT captured by the daily 2am Railway
//      cron (/api/cron/refresh-bot-knowledge), so prose/page changes on the
//      live site are picked up automatically within a day.
//
// Both chat and SMS call buildBotSystemPrompt() so they always operate from the
// exact same truth and logic.
// ============================================================================

import { SYSTEM_PROMPT } from '@/lib/chat-system-prompt';
import { supabaseAdmin } from '@/lib/supabase';
import {
  PACKAGES,
  EXTENSIONS,
  getExtensionPriceCents,
  OPEN_PLAY_PRICE_CENTS,
  ADULTS_PER_KID,
  EXTRA_ADULT_PRICE_CENTS,
  MAX_KIDS_PER_PARTY,
  TAX_RATE,
  DISCOUNT_RATE,
  PRIVATE_PARTY_TIMES,
  SEMI_PARTY_TIMES,
  fmt,
} from '@/lib/pricing';

// ---------------------------------------------------------------------------
// Layer 2: authoritative pricing facts, generated from lib/pricing.ts
// ---------------------------------------------------------------------------
export function buildPricingFacts(): string {
  const priv = PACKAGES.private;
  const semi = PACKAGES.semi;
  const privExt = getExtensionPriceCents('private', '60m' as keyof typeof EXTENSIONS);
  const semiExt = getExtensionPriceCents('semi', '60m' as keyof typeof EXTENSIONS);
  const discountPct = Math.round(DISCOUNT_RATE * 100);
  const taxPct = (TAX_RATE * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

  return `# AUTHORITATIVE PRICING (auto-generated from the live pricing engine — these numbers are always correct; if anything above conflicts, THESE win)

Private party:
- Base: ${fmt(priv.priceCents)} + tax (flat, whole venue, closed to the public)
- Includes ${priv.includedKids} kids (the birthday child + ${priv.includedKids - 1}). Each extra kid: ${fmt(priv.extraKidPriceCents)}. Hard cap ${MAX_KIDS_PER_PARTY} kids.
- Adults: ${ADULTS_PER_KID} included per kid (${priv.includedKids * ADULTS_PER_KID} at the base headcount, scales with extra kids). Each extra adult: ${fmt(EXTRA_ADULT_PRICE_CENTS)}.
- 1-hour extension: ${fmt(privExt)}
- Start times: ${PRIVATE_PARTY_TIMES.join(', ')} (each runs ${priv.durationMinutes} min)

Semi-Private party:
- Base: ${fmt(semi.priceCents)} + tax (your party room; open play continues elsewhere)
- Includes ${semi.includedKids} kids (the birthday child + ${semi.includedKids - 1}). Each extra kid: ${fmt(semi.extraKidPriceCents)}. Hard cap ${MAX_KIDS_PER_PARTY} kids.
- Adults: ${ADULTS_PER_KID} included per kid (${semi.includedKids * ADULTS_PER_KID} at the base headcount, scales with extra kids). Each extra adult: ${fmt(EXTRA_ADULT_PRICE_CENTS)}.
- 1-hour extension: ${fmt(semiExt)}
- Time slots: ${SEMI_PARTY_TIMES.join(' or ')} (only one semi per day)

Open play: ${fmt(OPEN_PLAY_PRICE_CENTS)} per child + tax (2-hour pass; adults free).

Discounts & tax:
- ${discountPct}% off Private parties booked Mon–Thu (any slot). Private only. Automatic.
- ${taxPct}% NYC sales tax on everything.
- Parties: 50% deposit at checkout, balance due 7 days before.

For ANY specific quote (extra kids, extra adults, extension, or a Mon–Thu date), call the quote_party_price tool — do not add these up by hand.`;
}

// ---------------------------------------------------------------------------
// Layer 3: the daily website snapshot (optional). Cached in-process so we hit
// Supabase at most once every few minutes, not on every chat/SMS turn.
// ---------------------------------------------------------------------------
type Snapshot = { content: string; scanned_at: string } | null;

let _snapshotCache: { value: Snapshot; at: number } | null = null;
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export async function getSiteSnapshot(now = Date.now()): Promise<Snapshot> {
  if (_snapshotCache && now - _snapshotCache.at < SNAPSHOT_TTL_MS) {
    return _snapshotCache.value;
  }
  let value: Snapshot = null;
  try {
    const { data } = await supabaseAdmin()
      .from('bot_knowledge')
      .select('content, scanned_at')
      .eq('id', 1)
      .maybeSingle();
    if (data?.content) {
      value = { content: data.content, scanned_at: data.scanned_at };
    }
  } catch (err) {
    console.warn('[bot-knowledge] snapshot read failed (non-fatal):', err);
  }
  _snapshotCache = { value, at: now };
  return value;
}

// Let the cron invalidate the in-process cache right after it writes.
export function clearSnapshotCache(): void {
  _snapshotCache = null;
}

// ---------------------------------------------------------------------------
// The combined system prompt used by BOTH chat and SMS.
// ---------------------------------------------------------------------------
export async function buildBotSystemPrompt(extra?: string): Promise<string> {
  const parts = [SYSTEM_PROMPT, buildPricingFacts()];

  const snap = await getSiteSnapshot();
  if (snap?.content) {
    parts.push(
      `# CURRENT WEBSITE CONTENT (auto-synced ${snap.scanned_at} — use for details not covered above; the AUTHORITATIVE PRICING block still wins on any price)\n\n${snap.content}`,
    );
  }

  if (extra) parts.push(extra);
  return parts.join('\n\n');
}
