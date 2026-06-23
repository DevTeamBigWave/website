import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { INVOICE_THEMES } from '@/lib/invoice-themes';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id: partyId } = await params;
  const { theme } = (await request.json()) as { theme?: string };

  if (!theme || !(theme in INVOICE_THEMES)) {
    return NextResponse.json({ error: 'Unknown theme' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('parties')
    .update({ invoice_theme: theme })
    .eq('id', partyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, theme });
}
