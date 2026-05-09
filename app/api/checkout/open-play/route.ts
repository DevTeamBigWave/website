import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateOpenPlayPricing } from '@/lib/pricing';

const OpenPlaySchema = z.object({
  date: z.string(),
  numChildren: z.coerce.number().int().min(1).max(10),
  parentName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(40),
  paymentMethod: z.enum(['online', 'at_door']),
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

  // Pay-at-door: just send the confirmation email and we're done
  if (body.paymentMethod === 'at_door') {
    return NextResponse.json({ ticketCode: ticket.ticket_code, ticketId: ticket.id });
  }

  // Online: Stripe checkout
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: body.email,
    line_items: [
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
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book/confirm?op=${ticket.ticket_code}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book?cancelled=true`,
  });

  await supabase.from('open_play').update({ stripe_session_id: session.id }).eq('id', ticket.id);

  return NextResponse.json({ url: session.url });
}
