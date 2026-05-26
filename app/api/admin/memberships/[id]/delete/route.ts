// Owner-only: cancels the Stripe subscription immediately (no proration),
// then deletes the membership row. Without the cancel, deleting the row
// would silently leave Stripe charging the card forever.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: row } = await db
    .from('memberships')
    .select('id, stripe_subscription_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (row.stripe_subscription_id && row.status !== 'canceled') {
    try {
      await stripe.subscriptions.cancel(row.stripe_subscription_id, { prorate: false });
    } catch (err: any) {
      // 'resource_missing' = already gone in Stripe; safe to proceed with row delete
      if (err?.code !== 'resource_missing') {
        return NextResponse.json(
          { error: `Stripe cancel failed: ${err?.message ?? 'unknown'}` },
          { status: 500 },
        );
      }
    }
  }

  const { error } = await db.from('memberships').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
