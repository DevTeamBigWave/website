import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPartyConfirmation, sendOpenPlayConfirmation, sendOwnerNotification } from '@/lib/email';

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

        // Fire emails (non-blocking — don't fail webhook if email fails)
        await Promise.allSettled([
          sendPartyConfirmation(party),
          sendOwnerNotification({
            subject: `🎉 New party booked: ${party.child_name}'s ${party.package} party`,
            party,
          }),
        ]);
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
      // Cancel any 'hold' party tied to an expired session
      const session = event.data.object as Stripe.Checkout.Session;
      const partyId = session.metadata?.party_id;
      if (partyId) {
        await supabase
          .from('parties')
          .update({ status: 'cancelled', cancellation_reason: 'Stripe session expired' })
          .eq('id', partyId)
          .eq('status', 'hold');
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
