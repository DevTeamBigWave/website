// Owner-only: re-fires the customer payment receipt + owner notification
// for a party's current deposit and/or balance-paid state. Use when an
// older payment landed before the Stripe webhook had email-sending wired
// (admin-invoice flow before May 29, 2026), or any other time the
// confirmation email needs to be re-sent.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendManualPaymentReceived,
  sendOwnerNotification,
} from '@/lib/email';
import { computePartyFinancials } from '@/lib/parties';

const Schema = z.object({
  kind: z.enum(['deposit', 'balance']),
});

const fmtMoney = (c: number) => `$${(c / 100).toFixed(2)}`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: party } = await db
    .from('parties')
    .select('*')
    .eq('id', partyId)
    .maybeSingle();
  if (!party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  const fin = computePartyFinancials(party);

  if (body.kind === 'deposit') {
    if (!party.deposit_paid_at) {
      return NextResponse.json(
        { error: 'Deposit not paid yet — nothing to confirm.' },
        { status: 409 },
      );
    }
    const method = (party.deposit_payment_method ?? 'stripe') as
      | 'zelle' | 'cash' | 'clover' | 'groupon' | 'stripe';
    try {
      await sendManualPaymentReceived({
        parent_name: party.parent_name,
        email: party.email,
        child_name: party.child_name,
        date: party.date,
        kind: 'deposit',
        method,
        amount_cents: party.deposit_cents,
        remaining_balance_cents: fin.balance_due_cents,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Customer email failed: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 500 },
      );
    }
    try {
      await sendOwnerNotification({
        subject: `↻ Resent deposit receipt · ${fmtMoney(party.deposit_cents)} · ${party.child_name ?? 'party'}`,
        party,
      });
    } catch (err) {
      console.error('Owner notification failed (customer email still sent):', err);
    }
    return NextResponse.json({ ok: true, sent_to: party.email, amount_cents: party.deposit_cents });
  }

  // kind === 'balance'
  if (!party.balance_paid_at || (party.balance_paid_amount_cents ?? 0) <= 0) {
    return NextResponse.json(
      { error: 'No balance payment recorded yet — nothing to confirm.' },
      { status: 409 },
    );
  }
  const method = (party.balance_payment_method?.split(',')[0]?.trim() ?? 'stripe') as
    | 'zelle' | 'cash' | 'clover' | 'groupon' | 'stripe';
  try {
    await sendManualPaymentReceived({
      parent_name: party.parent_name,
      email: party.email,
      child_name: party.child_name,
      date: party.date,
      kind: 'balance',
      method,
      amount_cents: party.balance_paid_amount_cents,
      remaining_balance_cents: fin.balance_due_cents,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Customer email failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 },
    );
  }
  try {
    await sendOwnerNotification({
      subject: `↻ Resent balance receipt · ${fmtMoney(party.balance_paid_amount_cents)} · ${party.child_name ?? 'party'}`,
      party,
    });
  } catch (err) {
    console.error('Owner notification failed (customer email still sent):', err);
  }
  return NextResponse.json({
    ok: true,
    sent_to: party.email,
    amount_cents: party.balance_paid_amount_cents,
  });
}
