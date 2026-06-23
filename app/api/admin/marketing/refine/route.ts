// Owner-only: revise an existing draft with plain-English instructions.
// Backs the "Refine with AI" box on the Saturday card — owner types
// "shorter, lead with the open play angle" and we re-roll the copy.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import {
  refineSaturdayEmail,
  getActivePromoCodesForCopy,
} from '@/lib/weekly-marketing';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Schema = z.object({
  subject: z.string().min(1).max(160),
  body_text: z.string().min(1).max(8000),
  cta_label: z.string().max(40).optional(),
  cta_href: z.string().max(200).optional(),
  instructions: z.string().min(2).max(2000),
});

export async function POST(req: Request) {
  await requireOwner();
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Invalid input', detail: err }, { status: 400 });
  }
  try {
    const codes = await getActivePromoCodesForCopy();
    const out = await refineSaturdayEmail(
      {
        subject: body.subject,
        body_text: body.body_text,
        cta_label: body.cta_label ?? null,
        cta_href: body.cta_href ?? null,
      },
      body.instructions,
      codes,
    );
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Refine failed' },
      { status: 500 },
    );
  }
}
