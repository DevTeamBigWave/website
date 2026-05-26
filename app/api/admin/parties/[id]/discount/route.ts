// Owner-only: sets the friends & family discount percent on a party.
// 0 means no discount. Other allowed values are 10, 15, 20.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  percent: z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(20)]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid percent' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('parties')
    .update({ manual_discount_percent: body.percent })
    .eq('id', partyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, percent: body.percent });
}
