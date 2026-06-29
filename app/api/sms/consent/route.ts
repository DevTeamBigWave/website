import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

// SMS opt-in logger — records affirmative consent from a website form for A2P
// 10DLC audit evidence. Decoupled from checkout: called fire-and-forget, and
// always returns 200 so it can never surface an error to the booking UI.

export const dynamic = 'force-dynamic';

// Bump when the consent wording in SmsConsentCheckbox changes.
const SMS_CONSENT_VERSION = '2026-06-29';

const Schema = z.object({
  phone: z.string().min(7).max(40),
  name: z.string().max(160).optional(),
  source: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    // Don't 4xx the UI — opt-in logging is best-effort.
    return NextResponse.json({ ok: false });
  }

  try {
    await supabaseAdmin()
      .from('sms_consents')
      .insert({
        phone: body.phone.trim(),
        name: body.name?.trim() || null,
        source: body.source ?? null,
        consent_version: SMS_CONSENT_VERSION,
        ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          null,
        user_agent: request.headers.get('user-agent'),
      });
  } catch (err) {
    console.error('[sms/consent] log failed (non-fatal):', err);
  }

  return NextResponse.json({ ok: true });
}
