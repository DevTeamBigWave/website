import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { sendOwnerSaleNotification } from '@/lib/email';
import { getFunnel } from '@/lib/funnels';

// Funnel lead capture. FAIL-SAFE: store the lead FIRST via the service-role
// client, THEN notify the owner fire-and-forget. A notify failure must never
// drop a lead. Mirrors the site's store-then-notify pattern (see /api/appointments).

export const dynamic = 'force-dynamic';

const Schema = z.object({
  slug: z.string().min(1).max(64),
  segment: z.string().max(64).optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  answers: z.record(z.string(), z.any()).optional(),
  result: z.record(z.string(), z.any()).optional(),
  recommendedPackage: z.string().max(40).optional(),
  headcount: z.number().int().min(1).max(40).optional(),
  // Honeypot — hidden field; humans leave it empty, bots fill it. Accept any
  // value here so a filled honeypot passes validation and is silently dropped
  // by the handler (rather than tipping off the bot with a 400).
  company: z.string().optional(),
});

// Minimal in-memory rate limit (best-effort; resets on cold start). Keeps a
// single abusive client from hammering the endpoint without adding infra.
const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = HITS.get(ip);
  if (!rec || now > rec.resetAt) {
    HITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Honeypot tripped → pretend success, store nothing.
  if (body.company) {
    return NextResponse.json({ ok: true });
  }

  const funnel = getFunnel(body.slug);
  // Unknown slug is allowed (forward-compatible), but record the raw slug.

  const db = supabaseAdmin();

  // 1) STORE FIRST — the lead is the source of truth.
  const { data: lead, error } = await db
    .from('funnel_leads')
    .insert({
      source: body.slug,
      segment: body.segment ?? null,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim() || null,
      answers: body.answers ?? {},
      result: body.result ?? {},
      recommended_package: body.recommendedPackage ?? null,
      headcount: body.headcount ?? null,
      referrer: request.headers.get('referer'),
      user_agent: request.headers.get('user-agent'),
    })
    .select('id')
    .single();

  if (error || !lead) {
    return NextResponse.json(
      { error: 'Could not save', detail: error?.message },
      { status: 500 },
    );
  }

  // 2) NOTIFY — fire-and-forget. Never block or fail the lead on this.
  try {
    const bullets: Array<[string, string]> = [
      ['Name', body.name.trim()],
      ['Email', body.email.trim()],
      ['Phone', body.phone?.trim() || '—'],
      ['Funnel', funnel?.name ?? body.slug],
      ['Picked', body.segment ?? '—'],
      ['Recommended', body.recommendedPackage ?? '—'],
      ['Headcount', body.headcount != null ? `${body.headcount} kids` : '—'],
    ];
    // Don't await — a slow/failing email must not delay the response or the lead.
    void sendOwnerSaleNotification({
      subject: `New ${funnel?.name ?? 'funnel'} lead — ${body.name.trim()}`,
      bullets,
      adminLink: '/admin/customers',
    }).catch((err) => console.error('[funnel/lead] owner notify failed:', err));
  } catch (err) {
    console.error('[funnel/lead] notify dispatch failed (non-fatal):', err);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}
