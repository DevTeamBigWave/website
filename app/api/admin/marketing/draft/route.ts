import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { nextSaturdayNYC } from '@/lib/weekly-marketing';

const Schema = z.object({
  target_send_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes_for_generator: z.string().max(2000).optional(),
  pre_subject: z.string().max(160).optional(),
  pre_body: z.string().max(8000).optional(),
  pre_cta_label: z.string().max(40).optional(),
  pre_cta_href: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  await requireAdmin();

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const date = body.target_send_date ?? nextSaturdayNYC();
  const db = supabaseAdmin();

  const payload = {
    target_send_date: date,
    notes_for_generator: body.notes_for_generator?.trim() || null,
    pre_subject: body.pre_subject?.trim() || null,
    pre_body: body.pre_body?.trim() || null,
    pre_cta_label: body.pre_cta_label?.trim() || null,
    pre_cta_href: body.pre_cta_href?.trim() || null,
    status: 'queued' as const,
  };

  const { data, error } = await db
    .from('weekly_marketing_drafts')
    .upsert(payload, { onConflict: 'target_send_date' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draft: data });
}
