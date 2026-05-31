// Monthly cron: rotates the active skip-deposit promo code.
//
// Schedule (cron-job.org): 1st of every month, ~6:00 AM ET, header
//   x-cron-secret: <CRON_SECRET>
//
// What it does:
//   1. Generates a fresh SKIP-XXXX-XXXX code valid for the calendar month.
//   2. Expires any prior promo whose valid_until is past (defensive — they
//      should already be expired by their own timestamp, but we don't want
//      multiple lingering codes if a month was skipped).
//   3. Returns the new code in JSON so the owner can see what was issued
//      in the cron-job.org dashboard.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  generatePromoCode,
  disableActiveSkipDepositCodes,
} from '@/lib/promo-codes';

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-cron-secret') === secret;
}

function endOfMonth(d: Date): Date {
  // Last instant of the month, in UTC. Codes are valid through the rotation
  // window — the next month's cron run drops a new one.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date();
  const validUntil = endOfMonth(now);

  // Try a handful of times in the (very unlikely) case of a collision —
  // 30^8 ≈ 6.5e11, but defensive.
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

  // Supersede any prior live skip-deposit code so only the new one is
  // active. Keeps history intact (sets disabled_at instead of deleting).
  await disableActiveSkipDepositCodes();

  const { data, error } = await db
    .from('promo_codes')
    .insert({
      code,
      kind: 'skip_deposit',
      valid_from: now.toISOString(),
      valid_until: validUntil.toISOString(),
      rotation_origin: 'monthly_cron',
    })
    .select('id, code, valid_until')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Insert failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    issued: data.code,
    valid_until: data.valid_until,
  });
}

// Allow GET for cron-job.org's preferred verb too — same logic
export async function GET(request: Request) {
  return POST(request);
}
