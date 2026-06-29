// Shared finalize helpers used by both the Stripe webhook AND any path that
// bypasses Stripe (e.g. gift card fully covering the amount). They flip the
// booking to its paid status, redeem any applied gift card, send emails, and
// create the Google Calendar event.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendPartyConfirmation,
  sendOpenPlayConfirmation,
  sendOwnerNotification,
} from '@/lib/email';
import { createPartyEventIfNotExists } from '@/lib/google-calendar';
import { redeemFromCard } from '@/lib/gift-cards';
import { maybeSendPlanningCallInvite } from '@/lib/planning-call';
import { sendPartyConfirmationSms } from '@/lib/sms-notify';

type FinalizePartyOptions = {
  paymentIntent?: string;
  giftCardId?: string;
  giftCardApplyCents?: number;
  stripeSessionId?: string;
  // Promo-code path: booking is confirmed but no deposit was actually paid.
  // Everything else (status, calendar, emails) still fires; balance shows
  // the full grand-total as owed.
  skipDeposit?: boolean;
  promoCodeId?: string;
};

export async function finalizeParty(partyId: string, opts: FinalizePartyOptions = {}) {
  const supabase = supabaseAdmin();

  // Idempotency: only flip from 'hold' → 'confirmed'. If already confirmed
  // (e.g. duplicate webhook), the second call is a no-op.
  const updates: Record<string, unknown> = {
    status: 'confirmed',
    hold_expires_at: null,
  };

  // Bug B protection: when finalizeParty fires AFTER an admin already
  // recorded the deposit manually via mark-paid (Clover/Zelle/Cash), we
  // must NOT overwrite their chosen payment method back to 'stripe'.
  // Read the current row's payment method first. If it's already set to
  // something other than 'stripe', the admin path was authoritative —
  // leave deposit_payment_method untouched in this update.
  let existingDepositMethod: string | null = null;
  if (!opts.skipDeposit) {
    const { data: pre } = await supabase
      .from('parties')
      .select('deposit_payment_method, deposit_paid_at')
      .eq('id', partyId)
      .maybeSingle();
    existingDepositMethod = pre?.deposit_payment_method ?? null;
    const manualLabelLocked =
      pre?.deposit_paid_at &&
      existingDepositMethod &&
      existingDepositMethod !== 'stripe';

    updates.deposit_paid_at = pre?.deposit_paid_at ?? new Date().toISOString();
    // Label the method only if it isn't already a manually-set non-stripe
    // value. paymentIntent → real Stripe checkout payment. giftCardId →
    // fully covered by a gift card (no Stripe round trip). Otherwise leave
    // null — never silently claim 'stripe' as a fallback.
    if (!manualLabelLocked) {
      updates.deposit_payment_method = opts.paymentIntent
        ? 'stripe'
        : opts.giftCardId
          ? 'gift_card'
          : null;
    }
  }
  if (opts.promoCodeId) updates.promo_code_id = opts.promoCodeId;
  if (opts.paymentIntent) updates.stripe_deposit_payment_intent = opts.paymentIntent;
  if (opts.giftCardId) {
    updates.gift_card_id = opts.giftCardId;
    updates.gift_card_applied_cents = opts.giftCardApplyCents ?? 0;
  }

  const { data: party, error } = await supabase
    .from('parties')
    .update(updates)
    .eq('id', partyId)
    .eq('status', 'hold')
    .select('*, promo_code:promo_code_id(code, label)')
    .single();

  if (error || !party) {
    // Either already confirmed or doesn't exist — fetch current row for
    // downstream calls (idempotent).
    const { data: existing } = await supabase
      .from('parties')
      .select('*, promo_code:promo_code_id(code, label)')
      .eq('id', partyId)
      .maybeSingle();
    if (!existing || existing.status !== 'confirmed') {
      console.error('finalizeParty: party not in hold state', { partyId, error });
      return null;
    }
    return existing;
  }

  // Redeem gift card if one was applied. Best-effort: log on failure but
  // don't fail the booking — the customer already paid (or fully covered by card).
  if (opts.giftCardId && opts.giftCardApplyCents && opts.giftCardApplyCents > 0) {
    try {
      await redeemFromCard(opts.giftCardId, opts.giftCardApplyCents, {
        partyId: party.id,
        stripeSessionId: opts.stripeSessionId,
      });
    } catch (err) {
      console.error('finalizeParty: gift card redemption failed', err);
    }
  }

  revalidatePath('/api/availability');
  revalidatePath('/book');
  revalidatePath('/');

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';

  // Fetch add-ons so both emails can itemize them — same data the calendar
  // event description uses, so the three communications match.
  const { data: addOns = [] } = await supabase
    .from('party_add_ons')
    .select('name, unit_price_cents, qty, notes')
    .eq('party_id', party.id)
    .order('created_at', { ascending: true });

  const promoFlag = !party.deposit_paid_at ? ' · promo · UNPAID' : '';
  const [, , calendarResult] = await Promise.allSettled([
    sendPartyConfirmation(party, addOns ?? []),
    sendOwnerNotification({
      subject: `🎉 New party booked: ${party.child_name}'s ${party.package} party${promoFlag}`,
      party,
      addOns: addOns ?? [],
    }),
    // Race-safe: atomic claim inside the helper. If a concurrent webhook
    // or mark-paid call already created the event, this is a no-op and
    // returns null — no duplicate in Google Calendar.
    createPartyEventIfNotExists(party, siteUrl),
  ]);

  // Auto-fire the planning-call invite the moment the deposit is recorded
  // (skips if a promo party didn't pay one — they'll get it when the
  // balance lands or when admin records a payment).
  if (party.deposit_paid_at) {
    void maybeSendPlanningCallInvite(party);
  }

  // Transactional booking confirmation by text (in addition to the email).
  // Fire-and-forget; only runs on the first hold→confirmed transition since
  // this is the update success path. Logged to the SMS inbox.
  sendPartyConfirmationSms(party);

  if (calendarResult.status === 'rejected') {
    console.error('Calendar event creation failed:', calendarResult.reason);
  }
  // (createPartyEventIfNotExists writes the ID back internally — no
  // additional update needed here.)

  return party;
}

type FinalizeOpenPlayOptions = {
  paymentIntent?: string;
  giftCardId?: string;
  giftCardApplyCents?: number;
  stripeSessionId?: string;
};

export async function finalizeOpenPlay(
  openPlayId: string,
  opts: FinalizeOpenPlayOptions = {},
) {
  const supabase = supabaseAdmin();

  const updates: Record<string, unknown> = {
    status: 'paid',
    paid_at: new Date().toISOString(),
  };
  if (opts.paymentIntent) updates.stripe_payment_intent = opts.paymentIntent;
  if (opts.giftCardId) {
    updates.gift_card_id = opts.giftCardId;
    updates.gift_card_applied_cents = opts.giftCardApplyCents ?? 0;
  }

  const { data: ticket } = await supabase
    .from('open_play')
    .update(updates)
    .eq('id', openPlayId)
    .select()
    .single();

  if (!ticket) return null;

  if (opts.giftCardId && opts.giftCardApplyCents && opts.giftCardApplyCents > 0) {
    try {
      await redeemFromCard(opts.giftCardId, opts.giftCardApplyCents, {
        openPlayId: ticket.id,
        stripeSessionId: opts.stripeSessionId,
      });
    } catch (err) {
      console.error('finalizeOpenPlay: gift card redemption failed', err);
    }
  }

  await sendOpenPlayConfirmation(ticket).catch((err) =>
    console.error('Open play confirmation email failed:', err),
  );

  return ticket;
}
