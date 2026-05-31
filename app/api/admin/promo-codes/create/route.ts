// Owner-only: build a custom promo code. The existing /generate endpoint
// creates a one-off skip-deposit code with auto fields; this lets the
// owner specify everything — code text, kind, discount %, applies-to,
// channel, expiration, max uses, and a human label.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePromoCode } from '@/lib/promo-codes';

const Schema = z.object({
  // Leave blank for auto-generated. Uppercased and validated server-side.
  code: z
    .string()
    .max(40)
    .regex(/^[A-Z0-9-]*$/i, 'Letters, digits, and dashes only')
    .optional(),
  label: z.string().min(1).max(80),
  kind: z.enum(['skip_deposit', 'percent_off']),
  // Required when kind=percent_off
  discount_percent: z.coerce.number().int().min(1).max(100).optional(),
  // Empty / missing = applies to everything
  applies_to: z
    .array(z.enum(['party', 'open_play', 'membership', 'gift_card']))
    .max(4)
    .optional(),
  channel: z.enum(['online', 'admin', 'both']).default('both'),
  // ISO yyyy-mm-dd from the date input — we treat as end-of-day NYC
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  max_uses: z.coerce.number().int().min(1).max(10000).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const me = await requireOwner();

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  if (body.kind === 'percent_off' && !body.discount_percent) {
    return NextResponse.json(
      { error: 'Percent-off codes need a discount % (1-100).' },
      { status: 400 },
    );
  }

  // Generate a code with a kind-appropriate prefix when one wasn't given.
  const code = body.code
    ? body.code.trim().toUpperCase()
    : generatePromoCode(body.kind === 'percent_off' ? 'SAVE' : 'SKIP');

  // valid_until = end of day NYC for the given date, expressed as UTC.
  // Easy enough without a tz library: append 23:59:59 then offset by the
  // NYC offset at that moment using Intl.
  const validUntilIso = endOfDayNYC(body.valid_until);

  const db = supabaseAdmin();
  const { data: created, error: insertErr } = await db
    .from('promo_codes')
    .insert({
      code,
      kind: body.kind,
      label: body.label,
      discount_percent: body.kind === 'percent_off' ? body.discount_percent : null,
      applies_to: body.applies_to && body.applies_to.length > 0 ? body.applies_to : null,
      channel: body.channel,
      valid_from: new Date().toISOString(),
      valid_until: validUntilIso,
      max_uses: body.max_uses ?? null,
      notes: body.notes ?? null,
      created_by_admin_id: me.id,
      rotation_origin: 'manual_admin',
    })
    .select('id, code')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      // unique violation on code
      return NextResponse.json(
        { error: `Code "${code}" already exists — pick a different one.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `Could not create code: ${insertErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: created!.id, code: created!.code });
}

function endOfDayNYC(ymd: string): string {
  // Build a Date for 23:59:59 in NYC for the given calendar date. We
  // compute the offset by formatting "now in NYC" with the same date.
  const [y, m, d] = ymd.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d, 23, 59, 59);
  // NYC offset varies (EST/EDT). Use Intl to find it for THIS date.
  const dt = new Date(utcMidnight);
  const offsetParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(dt)
    .find((p) => p.type === 'timeZoneName');
  const match = offsetParts?.value.match(/GMT([+-]\d+)/);
  const hoursOffset = match ? parseInt(match[1], 10) : -4;
  // utcMidnight currently treats the time as UTC. To make it NYC end-of-day,
  // we shift forward by -hoursOffset (since NYC is behind UTC).
  return new Date(utcMidnight - hoursOffset * 3600 * 1000).toISOString();
}
