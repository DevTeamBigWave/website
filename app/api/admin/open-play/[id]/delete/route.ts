// Owner-only: deletes an open-play ticket. Does NOT issue a refund —
// the owner refunds manually via the Stripe dashboard if needed.

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

  const { error } = await db.from('open_play').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
