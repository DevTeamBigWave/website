import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { sendMarketingCampaign } from '@/lib/email';

const Schema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(8000),
  cta_label: z.string().max(40).optional(),
  cta_href: z.string().url().optional(),
  to: z.string().email(),
});

export async function POST(request: Request) {
  const me = await requireAdmin();

  let body;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  try {
    await sendMarketingCampaign({
      to: body.to,
      to_name: me.displayName ?? 'Preview',
      subject: `[Preview] ${body.subject}`,
      body_text: body.body,
      cta_label: body.cta_label,
      cta_href: body.cta_href,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 },
    );
  }
}
