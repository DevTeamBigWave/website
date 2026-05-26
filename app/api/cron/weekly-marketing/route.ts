import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getMarketingRecipients } from '@/lib/marketing';
import { sendMarketingCampaign } from '@/lib/email';
import {
  getDraftForDate,
  generateSaturdayEmail,
  todayNYC,
  isSaturdayNYC,
} from '@/lib/weekly-marketing';

// Weekly cron — runs every Saturday morning. Picks up the queued draft for
// today's date (if any), uses it as-is OR fills in with AI generation, then
// sends to all promotion-subscribed customers.
//
// Schedule on cron-job.org:
//   URL:    https://<domain>/api/cron/weekly-marketing
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every Saturday at 09:00 America/New_York

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Guardrail: only run on Saturdays (in case cron is misconfigured)
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === '1';
  const wait = searchParams.get('wait') === '1';
  if (!isSaturdayNYC() && !force) {
    return NextResponse.json({ ok: true, skipped: 'not Saturday' });
  }

  // Fire-and-forget so cron-job.org doesn't time out waiting on Claude
  // generation + parallel email sends (can take 30-90s with many subscribers).
  // Pass ?wait=1 to await results.
  if (!wait) {
    runSaturdayMarketing()
      .then((r) => console.log('[weekly-marketing] background done:', r))
      .catch((err) => console.error('[weekly-marketing] background failed:', err));
    return NextResponse.json({
      ok: true,
      mode: 'background',
      message: 'Saturday marketing kicked off in background. Check /admin/marketing in ~60s.',
    });
  }

  const result = await runSaturdayMarketing();
  return NextResponse.json(result);
}

async function runSaturdayMarketing() {
  const db = supabaseAdmin();
  const today = todayNYC();

  // Find or create the draft row for today
  let draft = await getDraftForDate(today);
  if (!draft) {
    const { data: created } = await db
      .from('weekly_marketing_drafts')
      .insert({ target_send_date: today, status: 'queued' })
      .select()
      .single();
    draft = created!;
  }

  // Don't double-send
  if (draft.status === 'sent') {
    return { ok: true, skipped: 'already sent', draft_id: draft.id };
  }

  // Decide what to send: pre-filled or AI-generated
  let subject = draft.pre_subject?.trim();
  let body = draft.pre_body?.trim();
  let ctaLabel = draft.pre_cta_label?.trim() || undefined;
  let ctaHref = draft.pre_cta_href?.trim() || undefined;
  let generatedByAi = false;

  if (!subject || !body) {
    try {
      const gen = await generateSaturdayEmail(draft.notes_for_generator);
      subject = gen.subject;
      body = gen.body_text;
      ctaLabel = gen.cta_label || undefined;
      ctaHref = gen.cta_href || undefined;
      generatedByAi = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      await db
        .from('weekly_marketing_drafts')
        .update({ status: 'failed', error_message: msg })
        .eq('id', draft.id);
      return { ok: false, error: msg };
    }
  }

  // Send
  const recipients = await getMarketingRecipients('promotions');
  const campaignId = `weekly_${today}_${randomUUID().slice(0, 6)}`;

  let sent = 0;
  let failed = 0;
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
          subject: subject!,
          to_email: r.email,
          status: 'queued',
        })
        .select('id')
        .single();
      try {
        const result = await sendMarketingCampaign({
          to: r.email,
          to_name: r.parent_name,
          subject: subject!,
          body_text: body!,
          cta_label: ctaLabel,
          cta_href: ctaHref,
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

  await db
    .from('weekly_marketing_drafts')
    .update({
      status: 'sent',
      sent_subject: subject,
      sent_body: body,
      sent_cta_label: ctaLabel ?? null,
      sent_cta_href: ctaHref ?? null,
      generated_by_ai: generatedByAi,
      campaign_id: campaignId,
      sent_at: new Date().toISOString(),
    })
    .eq('id', draft.id);

  return {
    ok: true,
    target_date: today,
    generated_by_ai: generatedByAi,
    campaign_id: campaignId,
    sent,
    failed,
    total: recipients.length,
  };
}
