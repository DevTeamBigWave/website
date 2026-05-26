// Customer-facing: validate a promo code so /book can show "valid" before
// the parent commits to submit. Authoritative check still happens server-side
// at booking time in /api/checkout/party.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validatePromoCode } from '@/lib/promo-codes';

const Schema = z.object({ code: z.string().min(1).max(40) });

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid input' }, { status: 400 });
  }
  const v = await validatePromoCode(body.code);
  return NextResponse.json(v, { status: v.ok ? 200 : 400 });
}
