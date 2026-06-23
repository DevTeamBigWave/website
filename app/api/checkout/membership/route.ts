import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

const MEMBERSHIP_AMOUNT_CENTS = 15000;

const Schema = z.object({
  parent_name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(40),
  child_name: z.string().min(1).max(120),
  child_dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'child_dob must be YYYY-MM-DD')
    .optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const db = supabaseAdmin();
  const email = body.email.trim().toLowerCase();

  // Block duplicate active memberships for same email
  const { data: existing } = await db
    .from('memberships')
    .select('id, status')
    .eq('email', email)
    .in('status', ['active', 'past_due', 'incomplete'])
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error:
          'You already have an active membership on this email. Manage it at /memberships/manage.',
      },
      { status: 409 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com';

  // Find or create Stripe customer
  let customerId: string;
  const existingStripe = await stripe.customers.list({ email, limit: 1 });
  if (existingStripe.data.length > 0) {
    customerId = existingStripe.data[0].id;
  } else {
    const created = await stripe.customers.create({
      email,
      name: body.parent_name,
      phone: body.phone,
      metadata: { type: 'membership' },
    });
    customerId = created.id;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: MEMBERSHIP_AMOUNT_CENTS,
            recurring: { interval: 'month' },
            product_data: {
              name: 'Wonderland Pass — Monthly Membership',
            },
          },
        },
      ],
      subscription_data: {
        description: `Membership for ${body.child_name}`,
        metadata: {
          parent_name: body.parent_name,
          child_name: body.child_name,
          child_dob: body.child_dob ?? '',
          phone: body.phone,
        },
      },
      metadata: {
        type: 'membership',
        parent_name: body.parent_name,
        child_name: body.child_name,
      },
      success_url: `${siteUrl}/memberships/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/memberships?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Membership checkout creation failed:', err);
    return NextResponse.json(
      {
        error:
          err?.raw?.message ??
          err?.message ??
          'Could not start checkout. Try again or email info@wonderlandplayhouse.com.',
      },
      { status: 500 },
    );
  }
}
