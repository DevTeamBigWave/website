// Owner-only: disable a promo code without waiting for valid_until.
// Sets disabled_at on the row; validatePromoCode rejects any disabled code.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id } = await params;

  const db = supabaseAdmin();
  const { error } = await db
    .from('promo_codes')
    .update({ disabled_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
