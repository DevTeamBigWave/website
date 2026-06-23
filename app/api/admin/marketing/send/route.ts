import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { getMarketingRecipients } from '@/lib/marketing';
import { sendMarketingCampaign } from '@/lib/email';

export const maxDuration = 300;

const Schema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(8000),
  cta_label: z.string().max(40).optional(),
  cta_href: z.string().url().optional(),
});

export async function POST(request: Request) {
  await requireAdmin();

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const db = supabaseAdmin();
  const recipients = await getMarketingRecipients('promotions');
  const campaignId = `promotion_${Date.now()}_${randomUUID().slice(0, 8)}`;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Light concurrency: 5 at a time to avoid hammering Resend
  const concurrency = 5;
  const queue = [...recipients];

  async function worker() {
    while (queue.length > 0) {
      const r = queue.shift();
      if (!r) break;

      const { data: row } = await db
        .from('marketing_sends')
        .insert({
          customer_id: r.customer_id,
          campaign_type: 'promotion',
          campaign_id: campaignId,
          subject: body.subject,
          to_email: r.email,
          status: 'queued',
        })
        .select('id')
        .single();

      try {
        const result = await sendMarketingCampaign({
          to: r.email,
          to_name: r.parent_name,
          subject: body.subject,
          body_text: body.body,
          cta_label: body.cta_label,
          cta_href: body.cta_href,
        });
        await db
          .from('marketing_sends')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_message_id: (result as any)?.data?.id ?? null,
          })
          .eq('id', row?.id);
        sent += 1;
      } catch (err) {
        failed += 1;
        if (row?.id) {
          await db
            .from('marketing_sends')
            .update({
              status: 'failed',
              error_message: err instanceof Error ? err.message : 'unknown',
            })
            .eq('id', row.id);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return NextResponse.json({
    ok: true,
    campaign_id: campaignId,
    sent,
    failed,
    skipped,
    total: recipients.length,
  });
}
