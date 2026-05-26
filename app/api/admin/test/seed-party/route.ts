// Owner-only: seeds a fake confirmed party with the admin's own email so
// they can exercise the close-out flow (add-ons, theme picker, send invoice)
// without taking a real customer through it.
//
// The party is marked with a recognizable parent name + notes so it's easy
// to delete after testing via the DELETE endpoint.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const me = await requireOwner();
  const db = supabaseAdmin();

  const date = new Date();
  date.setDate(date.getDate() + 14);
  const dateStr = date.toISOString().slice(0, 10);

  const PACKAGE_TOTAL_CENTS = 125000; // $1,250 private package
  const DEPOSIT_CENTS = 43500;        // matches the Hot Wheels example

  const { data, error } = await db
    .from('parties')
    .insert({
      package: 'private',
      date: dateStr,
      start_time: '12:00',
      duration_minutes: 120,
      child_name: 'Test Child',
      child_age: 4,
      headcount: 10,
      notes: '🧪 Seeded test party — safe to delete from the detail page.',
      parent_name: 'Test Parent',
      email: me.email,
      phone: '(555) 555-0100',
      subtotal_cents: PACKAGE_TOTAL_CENTS,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: PACKAGE_TOTAL_CENTS,
      deposit_cents: DEPOSIT_CENTS,
      deposit_paid_at: new Date().toISOString(),
      status: 'confirmed',
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Could not seed party' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, partyId: data.id });
}
