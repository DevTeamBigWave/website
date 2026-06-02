// Owner-only: edit the parent-notes field on an existing party. Same column
// the customer /book flow and admin /admin/parties/new write to. Lets staff
// add follow-up info (allergies, decor changes, dietary needs) after the
// initial booking without going through Supabase or the admin reschedule flow.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { syncPartyEventByPartyId } from '@/lib/google-calendar';

const Schema = z.object({
  notes: z.string().max(2000).nullable(),
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
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const trimmed = body.notes?.trim() ?? '';
  const db = supabaseAdmin();
  const { error } = await db
    .from('parties')
    .update({ notes: trimmed.length > 0 ? trimmed : null })
    .eq('id', partyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calendar event description includes the parent notes — keep it in sync.
  void syncPartyEventByPartyId(partyId);

  return NextResponse.json({ ok: true, notes: trimmed || null });
}
