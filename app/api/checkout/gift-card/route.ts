import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import {
  generateUniqueGiftCardCode,
  GIFT_CARD_MIN_CENTS,
  GIFT_CARD_MAX_CENTS,
} from '@/lib/gift-cards';

const GiftCardCheckoutSchema = z.object({
  amountCents: z.coerce
    .number()
    .int()
    .min(GIFT_CARD_MIN_CENTS, `Minimum gift card amount is $${GIFT_CARD_MIN_CENTS / 100}`)
    .max(GIFT_CARD_MAX_CENTS, `Maximum gift card amount is $${GIFT_CARD_MAX_CENTS / 100}`),
  purchaserName: z.string().min(1).max(120),
  purchaserEmail: z.string().email(),
  recipientName: z.string().min(1).max(120),
  recipientEmail: z.string().email(),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let body;
  try {
    body = GiftCardCheckoutSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const db = supabaseAdmin();
  const code = await generateUniqueGiftCardCode();

  // Create pending card row. Webhook flips to 'active' on payment success.
  const { data: card, error: insertErr } = await db
    .from('gift_cards')
    .insert({
      code,
      amount_cents: body.amountCents,
      purchaser_name: body.purchaserName,
      purchaser_email: body.purchaserEmail,
      recipient_name: body.recipientName,
      recipient_email: body.recipientEmail,
      message: body.message ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (insertErr || !card) {
    return NextResponse.json(
      { error: 'Could not create gift card', detail: insertErr?.message },
      { status: 500 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: body.purchaserEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: body.amountCents,
          product_data: {
            name: `Gift card for ${body.recipientName}`,
            description: `$${(body.amountCents / 100).toFixed(0)} Wonderland Playhouse gift card`,
          },
        },
      },
    ],
    metadata: {
      type: 'gift_card',
      gift_card_id: card.id,
    },
    success_url: `${siteUrl}/gift-cards/sent?id=${card.id}`,
    cancel_url: `${siteUrl}/gift-cards/buy?cancelled=true`,
  });

  await db
    .from('gift_cards')
    .update({ stripe_session_id: session.id })
    .eq('id', card.id);

  return NextResponse.json({ url: session.url, giftCardId: card.id });
}
