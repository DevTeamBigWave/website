import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendPartyConfirmation,
  sendOpenPlayConfirmation,
  sendOwnerNotification,
  sendGiftCardToRecipient,
  sendGiftCardPurchaserReceipt,
} from '@/lib/email';
import { createPartyEvent } from '@/lib/google-calendar';

// Stripe sends raw bodies — App Router gives us req.text() which preserves them
export async function POST(request: Request) {
  const body = await request.text();
  const sig = (await headers()).get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Stripe webhook signature failed:', err.message);
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;

      if (type === 'party_deposit') {
        const partyId = session.metadata?.party_id;
        if (!partyId) break;

        // FLIP TO CONFIRMED — this fires the postgres trigger that blocks the date
        const { data: party, error } = await supabase
          .from('parties')
          .update({
            status: 'confirmed',
            deposit_paid_at: new Date().toISOString(),
            stripe_deposit_payment_intent: session.payment_intent as string,
            hold_expires_at: null,
          })
          .eq('id', partyId)
          .select()
          .single();

        if (error || !party) {
          console.error('Could not confirm party:', error);
          break;
        }

        // Bust the availability cache so the next visitor sees the block immediately
        revalidatePath('/api/availability');
        revalidatePath('/book');
        revalidatePath('/');

        // Fire emails + create Google Calendar event in parallel (non-blocking —
        // don't fail the webhook if any side-effect fails)
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ??
          'https://website-production-4594.up.railway.app';

        const [, , calendarResult] = await Promise.allSettled([
          sendPartyConfirmation(party),
          sendOwnerNotification({
            subject: `🎉 New party booked: ${party.child_name}'s ${party.package} party`,
            party,
          }),
          createPartyEvent(party, siteUrl),
        ]);

        // If calendar event was created, save its ID on the party row so we
        // can delete it later on cancellation
        if (
          calendarResult.status === 'fulfilled' &&
          calendarResult.value
        ) {
          await supabase
            .from('parties')
            .update({ google_calendar_event_id: calendarResult.value })
            .eq('id', party.id);
        } else if (calendarResult.status === 'rejected') {
          console.error('Calendar event creation failed:', calendarResult.reason);
        }
      }

      if (type === 'gift_card') {
        const giftCardId = session.metadata?.gift_card_id;
        if (!giftCardId) break;

        const { data: card, error: cardErr } = await supabase
          .from('gift_cards')
          .update({
            status: 'active',
            paid_at: new Date().toISOString(),
            stripe_payment_intent: session.payment_intent as string,
          })
          .eq('id', giftCardId)
          .eq('status', 'pending')
          .select()
          .single();

        if (cardErr || !card) {
          console.error('Could not activate gift card:', cardErr);
          break;
        }

        const emailResults = await Promise.allSettled([
          sendGiftCardToRecipient(card),
          sendGiftCardPurchaserReceipt(card),
        ]);

        if (emailResults[0].status === 'fulfilled') {
          await supabase
            .from('gift_cards')
            .update({ recipient_emailed_at: new Date().toISOString() })
            .eq('id', giftCardId);
        } else {
          console.error('Gift card recipient email failed:', emailResults[0].reason);
        }
        if (emailResults[1].status === 'rejected') {
          console.error('Gift card purchaser receipt failed:', emailResults[1].reason);
        }
      }

      if (type === 'open_play') {
        const ticketId = session.metadata?.open_play_id;
        if (!ticketId) break;

        const { data: ticket } = await supabase
          .from('open_play')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent: session.payment_intent as string,
          })
          .eq('id', ticketId)
          .select()
          .single();

        if (ticket) {
          await sendOpenPlayConfirmation(ticket);
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      // Cancel any 'hold' party / 'pending' gift card tied to an expired session
      const session = event.data.object as Stripe.Checkout.Session;
      const partyId = session.metadata?.party_id;
      if (partyId) {
        await supabase
          .from('parties')
          .update({ status: 'cancelled', cancellation_reason: 'Stripe session expired' })
          .eq('id', partyId)
          .eq('status', 'hold');
      }
      const giftCardId = session.metadata?.gift_card_id;
      if (giftCardId) {
        await supabase
          .from('gift_cards')
          .update({ status: 'void', voided_at: new Date().toISOString(), void_reason: 'Stripe session expired' })
          .eq('id', giftCardId)
          .eq('status', 'pending');
      }
      break;
    }

    case 'charge.refunded': {
      // Surface in admin only — don't auto-cancel since refunds can be partial
      console.log('Charge refunded:', event.data.object);
      break;
    }

    default:
      // Acknowledge but ignore — Stripe sends a lot we don't care about
      break;
  }

  return NextResponse.json({ received: true });
}

// Stripe needs the raw body, not parsed JSON. Disable body parsing.
export const config = {
  api: { bodyParser: false },
};
