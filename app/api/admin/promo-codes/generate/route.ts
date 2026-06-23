// Owner-only manual promo-code generation. Same as the cron path but
// triggered from the admin UI.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import {
  generatePromoCode,
  disableActiveSkipDepositCodes,
} from '@/lib/promo-codes';

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export async function POST() {
  const me = await requireOwner();
  const db = supabaseAdmin();
  const now = new Date();
  const validUntil = endOfMonth(now);

  let code: string | null = null;
  for (let i = 0; i < 5; i++) {
    const candidate = generatePromoCode();
    const { data: existing } = await db
      .from('promo_codes')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 });
  }

  // Only ONE active skip-deposit code at a time. Disable any prior live
  // ones so the marketing email / admin page never advertises multiple
  // competing SKIP codes. Done before insert so a brief race window with
  // the cron can't leave two codes both showing as active.
  await disableActiveSkipDepositCodes();

  const { data, error } = await db
    .from('promo_codes')
    .insert({
      code,
      kind: 'skip_deposit',
      valid_from: now.toISOString(),
      valid_until: validUntil.toISOString(),
      created_by_admin_id: me.id,
      rotation_origin: 'manual_admin',
    })
    .select('id, code, valid_until')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, code: data.code, valid_until: data.valid_until });
}
