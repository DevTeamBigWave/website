import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; addOnId: string }> },
) {
  await requireAdmin();
  const { id: partyId, addOnId } = await params;

  const db = supabaseAdmin();
  const { error } = await db
    .from('party_add_ons')
    .delete()
    .eq('id', addOnId)
    .eq('party_id', partyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
