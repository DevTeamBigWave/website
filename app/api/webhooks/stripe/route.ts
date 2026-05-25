import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendGiftCardToRecipient,
  sendGiftCardPurchaserReceipt,
  sendOwnerSaleNotification,
} from '@/lib/email';
import { finalizeParty, finalizeOpenPlay } from '@/lib/finalize-booking';

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

        const giftCardId = session.metadata?.gift_card_id;
        const giftCardApplyCents = session.metadata?.gift_card_apply_cents
          ? parseInt(session.metadata.gift_card_apply_cents, 10)
          : undefined;

        await finalizeParty(partyId, {
          paymentIntent: session.payment_intent as string,
          giftCardId,
          giftCardApplyCents,
          stripeSessionId: session.id,
        });
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
          sendOwnerSaleNotification({
            subject: `🎁 Gift card sold · $${(card.amount_cents / 100).toFixed(0)} from ${card.purchaser_name}`,
            bullets: [
              ['Amount', `$${(card.amount_cents / 100).toFixed(2)}`],
              ['From', `${card.purchaser_name} · ${card.purchaser_email}`],
              ['To', `${card.recipient_name} · ${card.recipient_email}`],
              ['Code', card.code],
              ...(card.message ? ([['Message', String(card.message)]] as Array<[string, string]>) : []),
            ],
            adminLink: '/admin/gift-cards',
          }),
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

        const giftCardId = session.metadata?.gift_card_id;
        const giftCardApplyCents = session.metadata?.gift_card_apply_cents
          ? parseInt(session.metadata.gift_card_apply_cents, 10)
          : undefined;

        await finalizeOpenPlay(ticketId, {
          paymentIntent: session.payment_intent as string,
          giftCardId,
          giftCardApplyCents,
          stripeSessionId: session.id,
        });
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

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const partyId = invoice.metadata?.party_id;
      const type = invoice.metadata?.type;
      if (type === 'party_balance' && partyId) {
        await supabase
          .from('parties')
          .update({
            balance_paid_at: new Date().toISOString(),
            balance_paid_amount_cents: invoice.amount_paid,
          })
          .eq('id', partyId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn('Invoice payment failed:', invoice.id, invoice.metadata);
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
