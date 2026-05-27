import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { findCatalogItem } from '@/lib/add-ons';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';

const AddSchema = z.object({
  catalog_id: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(160),
  unit_price_cents: z.coerce.number().int().min(0).max(1_000_000),
  qty: z.coerce.number().int().min(1).max(200).default(1),
  notes: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireAdmin();
  const { id: partyId } = await params;

  let body;
  try {
    body = AddSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  // Validate catalog ID if provided
  if (body.catalog_id && !findCatalogItem(body.catalog_id)) {
    return NextResponse.json({ error: 'Unknown catalog item' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('party_add_ons')
    .insert({
      party_id: partyId,
      catalog_id: body.catalog_id ?? null,
      name: body.name,
      unit_price_cents: body.unit_price_cents,
      qty: body.qty,
      notes: body.notes ?? null,
      added_by_admin_id: me.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  void syncPartyEventByPartyId(partyId);
  return NextResponse.json({ addOn: data });
}
