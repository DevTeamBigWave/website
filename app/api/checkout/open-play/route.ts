import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateOpenPlayPricing } from '@/lib/pricing';
import { getGiftCardByCode, balanceCents } from '@/lib/gift-cards';
import { finalizeOpenPlay } from '@/lib/finalize-booking';

const OpenPlaySchema = z.object({
  date: z.string(),
  numChildren: z.coerce.number().int().min(1).max(10),
  parentName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(40),
  paymentMethod: z.enum(['online', 'at_door']),
  giftCardCode: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  let body;
  try {
    body = OpenPlaySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Verify the date isn't blocked by a private party
  const { data: blocks } = await supabase
    .from('blocked_dates')
    .select('block_type')
    .eq('date', body.date.split('T')[0])
    .eq('block_type', 'full');

  if (blocks && blocks.length > 0) {
    return NextResponse.json(
      { error: 'That day is closed for a private party. Please pick another day.' },
      { status: 409 }
    );
  }

  const pricing = calculateOpenPlayPricing(body.numChildren);

  const { data: ticket, error } = await supabase
    .from('open_play')
    .insert({
      date: body.date.split('T')[0],
      num_children: body.numChildren,
      parent_name: body.parentName,
      email: body.email,
      phone: body.phone,
      total_cents: pricing.totalCents,
      payment_method: body.paymentMethod,
      status: body.paymentMethod === 'at_door' ? 'reserved' : 'reserved',
    })
    .select()
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: 'Could not create reservation' }, { status: 500 });
  }

  // Pay-at-door: just send the confirmation email and we're done.
  // Note: gift cards are NOT applied to pay-at-door (the cashier will scan it manually if needed).
  if (body.paymentMethod === 'at_door') {
    return NextResponse.json({ ticketCode: ticket.ticket_code, ticketId: ticket.id });
  }

  // Gift card lookup (if a code was passed)
  let giftCardId: string | undefined;
  let giftCardApplyCents = 0;
  if (body.giftCardCode) {
    const card = await getGiftCardByCode(body.giftCardCode);
    if (!card || card.status !== 'active' || balanceCents(card) <= 0) {
      return NextResponse.json(
        { error: 'Invalid or empty gift card code.' },
        { status: 400 },
      );
    }
    giftCardId = card.id;
    giftCardApplyCents = Math.min(balanceCents(card), pricing.totalCents);
  }

  const chargeCents = pricing.totalCents - giftCardApplyCents;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';

  // $0 case: gift card covers entire amount. Skip Stripe, mark paid immediately.
  if (chargeCents <= 0) {
    await finalizeOpenPlay(ticket.id, {
      giftCardId,
      giftCardApplyCents,
    });
    return NextResponse.json({
      url: `${siteUrl}/book/confirm?op=${ticket.ticket_code}&gift=1`,
      ticketCode: ticket.ticket_code,
    });
  }

  // Stripe minimum is $0.50 — if the remainder is below that, top up the
  // card redemption back so Stripe gets at least $0.50.
  if (chargeCents > 0 && chargeCents < 50) {
    giftCardApplyCents = Math.max(0, giftCardApplyCents - (50 - chargeCents));
  }
  const finalChargeCents = pricing.totalCents - giftCardApplyCents;

  // Online: Stripe checkout. When a gift card is applied, charge the
  // remainder as a single line item (we can't preserve per-kid pricing
  // and a discount line cleanly).
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: body.email,
    line_items:
      giftCardApplyCents > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: finalChargeCents,
                product_data: {
                  name: `Open Play — ${body.numChildren} kid${body.numChildren > 1 ? 's' : ''}`,
                  description: `${new Date(body.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })} · Gift card applied (-$${(giftCardApplyCents / 100).toFixed(2)})`,
                },
              },
            },
          ]
        : [
            {
              quantity: body.numChildren,
              price_data: {
                currency: 'usd',
                unit_amount: pricing.perKidCents,
                product_data: {
                  name: 'Open Play — 2 hour pass',
                  description: new Date(body.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  }),
                },
              },
            },
          ],
    metadata: {
      open_play_id: ticket.id,
      type: 'open_play',
      ...(giftCardId
        ? { gift_card_id: giftCardId, gift_card_apply_cents: String(giftCardApplyCents) }
        : {}),
    },
    success_url: `${siteUrl}/book/confirm?op=${ticket.ticket_code}`,
    cancel_url: `${siteUrl}/book?cancelled=true`,
  });

  await supabase.from('open_play').update({ stripe_session_id: session.id }).eq('id', ticket.id);

  return NextResponse.json({ url: session.url });
}
