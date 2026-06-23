import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const db = supabaseAdmin();

  const { data: membership } = await db
    .from('memberships')
    .select('stripe_customer_id, status')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: 'No membership found for that email.' },
      { status: 404 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com';

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: `${siteUrl}/memberships`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err?.raw?.message ??
          'Could not open portal — try again or email info@wonderlandplayhouse.com.',
      },
      { status: 500 },
    );
  }
}
