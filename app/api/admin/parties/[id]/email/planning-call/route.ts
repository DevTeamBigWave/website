import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPartyPlanningCallInvite } from '@/lib/email';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id: partyId } = await params;

  const db = supabaseAdmin();
  const { data: party } = await db
    .from('parties')
    .select('id, parent_name, email, child_name, date, package, add_ons_total_cents')
    .eq('id', partyId)
    .maybeSingle();
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  try {
    await sendPartyPlanningCallInvite(party);
    await db
      .from('parties')
      .update({ planning_call_email_sent_at: new Date().toISOString() })
      .eq('id', partyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Email failed' },
      { status: 500 },
    );
  }
}
