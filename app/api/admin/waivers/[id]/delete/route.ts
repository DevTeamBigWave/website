// Owner-only: hard-deletes a waiver. waiver_children rows cascade.

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

  const { error } = await db.from('waivers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
