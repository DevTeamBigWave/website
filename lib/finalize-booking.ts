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
import { createPartyEvent } from '@/lib/google-calendar';
import { redeemFromCard } from '@/lib/gift-cards';

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
  if (!opts.skipDeposit) {
    updates.deposit_paid_at = new Date().toISOString();
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
    .select()
    .single();

  if (error || !party) {
    // Either already confirmed or doesn't exist — fetch current row for
    // downstream calls (idempotent).
    const { data: existing } = await supabase
      .from('parties')
      .select('*')
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

  const [, , calendarResult] = await Promise.allSettled([
    sendPartyConfirmation(party),
    sendOwnerNotification({
      subject: `🎉 New party booked: ${party.child_name}'s ${party.package} party`,
      party,
    }),
    createPartyEvent(party, siteUrl),
  ]);

  if (calendarResult.status === 'fulfilled' && calendarResult.value) {
    await supabase
      .from('parties')
      .update({ google_calendar_event_id: calendarResult.value })
      .eq('id', party.id);
  } else if (calendarResult.status === 'rejected') {
    console.error('Calendar event creation failed:', calendarResult.reason);
  }

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
