import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendGiftCardToRecipient,
  sendGiftCardPurchaserReceipt,
  sendOwnerSaleNotification,
  sendManualPaymentReceived,
  sendOwnerNotification,
} from '@/lib/email';
import { finalizeParty, finalizeOpenPlay } from '@/lib/finalize-booking';
import { createPartyEvent, syncPartyEventByPartyId } from '@/lib/google-calendar';
import { computePartyFinancials } from '@/lib/parties';
import { maybeSendPlanningCallInvite } from '@/lib/planning-call';

const fmtMoneyShort = (c: number) => `$${(c / 100).toFixed(2)}`;

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
        // promo_code_id is set when a percent_off promo was applied during
        // checkout (skip_deposit doesn't go through Stripe so it's handled
        // synchronously in /checkout/party). Webhook is the right place to
        // record the use — abandoned carts won't burn the counter.
        const promoCodeId = session.metadata?.promo_code_id;

        await finalizeParty(partyId, {
          paymentIntent: session.payment_intent as string,
          giftCardId,
          giftCardApplyCents,
          stripeSessionId: session.id,
          ...(promoCodeId ? { promoCodeId } : {}),
        });

        if (promoCodeId) {
          const { recordPromoUse } = await import('@/lib/promo-codes');
          void recordPromoUse(promoCodeId);
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

      if (type === 'membership') {
        // Subscription-mode checkout: record the membership row from the
        // subscription that was created. We pull the subscription via the
        // session's subscription_id.
        const subscriptionId = session.subscription as string | null;
        if (!subscriptionId) break;
        await handleMembershipCheckoutCompleted(supabase, session, subscriptionId);
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

      // Owner-created via /admin/parties/new — full payment of the whole party
      if ((type === 'party_full' || type === 'party_deposit_admin') && partyId) {
        const updates: Record<string, unknown> = {
          deposit_paid_at: new Date().toISOString(),
          // Tag the method so admin card + calendar event description show
          // "Deposit paid · $X · Stripe ✓" instead of an unlabeled credit.
          deposit_payment_method: 'stripe',
        };
        // For party_full the single Stripe invoice covers everything. We
        // stamp balance_paid_at so the admin UI shows "paid in full", but
        // intentionally don't set balance_paid_amount_cents — otherwise
        // revenue.ts would count the same charge twice (once under Party
        // deposits via deposit_cents, once under Party balance).
        if (type === 'party_full') {
          updates.balance_paid_at = new Date().toISOString();
        }
        await supabase.from('parties').update(updates).eq('id', partyId);

        // Create the Google Calendar event now that the deposit's confirmed.
        // Skip if already created (idempotent across duplicate webhooks).
        let partyForEmails: any = null;
        try {
          const { data: party } = await supabase
            .from('parties')
            .select('*, promo_code:promo_code_id(code, label)')
            .eq('id', partyId)
            .maybeSingle();
          partyForEmails = party;
          if (party && !party.google_calendar_event_id) {
            const siteUrl =
              process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';
            const eventId = await createPartyEvent(party as any, siteUrl);
            if (eventId) {
              await supabase
                .from('parties')
                .update({ google_calendar_event_id: eventId })
                .eq('id', partyId);
            }
          }
        } catch (err) {
          console.error('Calendar event creation failed (party still paid):', err);
        }

        // Customer + owner notifications — the original /admin/parties/new
        // flow sends "your invoice is on the way", but until now there was
        // no email when the customer actually paid the Stripe invoice.
        if (partyForEmails) {
          const fin = computePartyFinancials(partyForEmails);
          const kind: 'deposit' | 'balance' = type === 'party_full' ? 'balance' : 'deposit';
          try {
            await sendManualPaymentReceived({
              parent_name: partyForEmails.parent_name,
              email: partyForEmails.email,
              child_name: partyForEmails.child_name,
              date: partyForEmails.date,
              kind,
              method: 'stripe',
              amount_cents: invoice.amount_paid ?? 0,
              remaining_balance_cents: fin.balance_due_cents,
            });
          } catch (err) {
            console.error('Stripe-paid customer receipt failed:', err);
          }
          try {
            await sendOwnerNotification({
              subject: `💳 Stripe ${kind} paid · ${fmtMoneyShort(invoice.amount_paid ?? 0)} · ${partyForEmails.child_name ?? 'party'}`,
              party: partyForEmails,
            });
          } catch (err) {
            console.error('Stripe-paid owner notification failed:', err);
          }
          // Auto-fire planning-call invite if not already sent. Idempotent
          // via planning_call_email_sent_at — if mark-paid beat us to it
          // this is a no-op.
          void maybeSendPlanningCallInvite(partyForEmails as any);
        }
      }

      // Balance invoice paid — accumulate so multiple round trips (initial
      // balance + later add-ons + later add-ons again) all add up correctly
      if (type === 'party_balance' && partyId) {
        const { data: current } = await supabase
          .from('parties')
          .select('balance_paid_amount_cents, balance_payment_method')
          .eq('id', partyId)
          .maybeSingle();
        const priorPaid = current?.balance_paid_amount_cents ?? 0;
        // Append 'stripe' to the payment-method list so the admin card shows
        // "Last paid · Stripe" alongside any prior Zelle/cash/Clover entries.
        const priorMethods = current?.balance_payment_method
          ? current.balance_payment_method.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
        const methods = Array.from(new Set([...priorMethods, 'stripe'])).join(', ');
        await supabase
          .from('parties')
          .update({
            balance_paid_at: new Date().toISOString(),
            balance_paid_amount_cents: priorPaid + (invoice.amount_paid ?? 0),
            balance_payment_method: methods,
          })
          .eq('id', partyId);

        // Customer receipt + owner notification — match what mark-paid does
        // for manual payments so the customer knows we got their money.
        try {
          const { data: party } = await supabase
            .from('parties')
            .select('*, promo_code:promo_code_id(code, label)')
            .eq('id', partyId)
            .maybeSingle();
          if (party) {
            const fin = computePartyFinancials(party);
            try {
              await sendManualPaymentReceived({
                parent_name: party.parent_name,
                email: party.email,
                child_name: party.child_name,
                date: party.date,
                kind: 'balance',
                method: 'stripe',
                amount_cents: invoice.amount_paid ?? 0,
                remaining_balance_cents: fin.balance_due_cents,
              });
            } catch (err) {
              console.error('Stripe balance customer receipt failed:', err);
            }
            try {
              await sendOwnerNotification({
                subject: `💳 Stripe balance paid · ${fmtMoneyShort(invoice.amount_paid ?? 0)} · ${party.child_name ?? 'party'}`,
                party,
              });
            } catch (err) {
              console.error('Stripe balance owner notification failed:', err);
            }
          }
        } catch (err) {
          console.error('Stripe balance email lookup failed:', err);
        }
      }

      // Any party-related payment closes the loop on the calendar event
      // description too (paid status, deposit method, remaining balance).
      if (
        partyId &&
        (type === 'party_balance' || type === 'party_full' || type === 'party_deposit_admin')
      ) {
        void syncPartyEventByPartyId(partyId);
      }
      // Membership renewals — bump current_period_end on success
      if (invoice.subscription) {
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
        await supabase
          .from('memberships')
          .update({
            status: 'active',
            current_period_end: invoice.period_end
              ? new Date(invoice.period_end * 1000).toISOString()
              : undefined,
          })
          .eq('stripe_subscription_id', subId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn('Invoice payment failed:', invoice.id, invoice.metadata);
      if (invoice.subscription) {
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
        await supabase
          .from('memberships')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subId);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        unpaid: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
        incomplete_expired: 'canceled',
        trialing: 'active',
        paused: 'paused',
      };
      const ourStatus = statusMap[sub.status] ?? 'incomplete';
      await supabase
        .from('memberships')
        .update({
          status: ourStatus,
          current_period_start: sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          canceled_at: sub.canceled_at
            ? new Date(sub.canceled_at * 1000).toISOString()
            : null,
          ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
        })
        .eq('stripe_subscription_id', sub.id);
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

import { sendMembershipWelcome } from '@/lib/email';

async function handleMembershipCheckoutCompleted(
  supabase: ReturnType<typeof supabaseAdmin>,
  session: Stripe.Checkout.Session,
  subscriptionId: string,
) {
  // Pull the freshly created subscription for full details
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  const email = (customer.email ?? '').trim().toLowerCase();
  const parentName =
    customer.name ??
    (session.metadata?.parent_name as string) ??
    email.split('@')[0];
  const childName =
    (session.metadata?.child_name as string) ??
    (sub.metadata?.child_name as string) ??
    'Child';
  const childDob = (sub.metadata?.child_dob as string) || null;
  const phone = customer.phone ?? (sub.metadata?.phone as string) ?? '';
  const priceId =
    typeof sub.items.data[0]?.price === 'string'
      ? (sub.items.data[0].price as unknown as string)
      : sub.items.data[0]?.price?.id ?? null;

  // Find or create customer + child in CRM
  let crmCustomerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existingCustomer) {
    crmCustomerId = existingCustomer.id;
    await supabase
      .from('customers')
      .update({ parent_name: parentName, phone })
      .eq('id', crmCustomerId);
  } else {
    const { data: newCust } = await supabase
      .from('customers')
      .insert({ email, parent_name: parentName, phone, source: 'organic' })
      .select('id')
      .single();
    crmCustomerId = newCust?.id ?? null;
  }

  let crmChildId: string | null = null;
  if (crmCustomerId) {
    const { data: existingChild } = await supabase
      .from('children')
      .select('id')
      .eq('customer_id', crmCustomerId)
      .ilike('name', childName)
      .maybeSingle();
    if (existingChild) {
      crmChildId = existingChild.id;
    } else {
      const { data: newChild } = await supabase
        .from('children')
        .insert({
          customer_id: crmCustomerId,
          name: childName,
          date_of_birth: childDob,
        })
        .select('id')
        .single();
      crmChildId = newChild?.id ?? null;
    }
  }

  await supabase.from('memberships').upsert(
    {
      customer_id: crmCustomerId,
      child_id: crmChildId,
      parent_name: parentName,
      email,
      phone,
      child_name: childName,
      child_dob: childDob,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'incomplete',
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      started_at: new Date().toISOString(),
      amount_cents: sub.items.data[0]?.price?.unit_amount ?? 15000,
    },
    { onConflict: 'stripe_subscription_id' },
  );

  try {
    await sendMembershipWelcome({
      parent_name: parentName,
      email,
      child_name: childName,
      amount_cents: sub.items.data[0]?.price?.unit_amount ?? 15000,
      next_billing_date: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (err) {
    console.error('Membership welcome email failed:', err);
  }
}
