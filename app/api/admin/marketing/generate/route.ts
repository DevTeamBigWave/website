// Owner-only: generate a preview of the Saturday email WITHOUT sending or
// touching the draft row. Used by the "Generate preview" button — owner
// reviews the copy, optionally edits, and only then taps Send now (which
// uses whatever they save into the pre_subject/pre_body fields).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import {
  generateSaturdayEmail,
  getActivePromoCodesForCopy,
} from '@/lib/weekly-marketing';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Schema = z.object({
  notes: z.string().max(2000).optional(),
  // If provided, only these codes are passed to the AI. Empty array
  // explicitly means "no promo codes in this email". Omitted = pull
  // whatever's active.
  promo_code_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(req: Request) {
  await requireOwner();
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    body = {};
  }
  try {
    let codes = await getActivePromoCodesForCopy();
    if (body.promo_code_ids) {
      // Owner restricted to a specific subset; codes lib returns objects
      // without ids, so we re-fetch with id filter to get the matching set.
      const { supabaseAdmin } = await import('@/lib/supabase');
      const db = supabaseAdmin();
      const { data } = await db
        .from('promo_codes')
        .select('id, code, kind, label, notes, valid_until')
        .in('id', body.promo_code_ids);
      codes = (data ?? []).map((r: any) => ({
        code: r.code,
        label:
          r.label ??
          (r.kind === 'skip_deposit' ? 'Skip the deposit at checkout' : r.kind),
        description:
          r.notes ??
          (r.kind === 'skip_deposit'
            ? 'Booking goes through without paying the deposit upfront — full balance is still owed.'
            : ''),
        valid_until_label: new Date(r.valid_until).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
        }),
      }));
    }
    const out = await generateSaturdayEmail(body.notes ?? null, codes);
    return NextResponse.json({
      ok: true,
      ...out,
      promo_codes_used: codes.map((c) => c.code),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'AI generation failed' },
      { status: 500 },
    );
  }
}
