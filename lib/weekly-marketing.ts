// Weekly Saturday marketing helpers — both the AI generator and the
// next-Saturday date math.

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getMarketingRecipients } from '@/lib/marketing';
import { sendMarketingCampaign } from '@/lib/email';

const MODEL = 'claude-sonnet-4-6';
const NYC = 'America/New_York';

// Returns YYYY-MM-DD of the next Saturday in NYC. If today IS Saturday,
// returns today (so the admin can prep for "this Saturday").
export function nextSaturdayNYC(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: NYC,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    const parts = fmt.formatToParts(d);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    if (weekday === 'Sat') {
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      return `${y}-${m}-${day}`;
    }
  }
  throw new Error('No Saturday found in 8 days?');
}

// Today's date in NYC as YYYY-MM-DD
export function todayNYC(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NYC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Is today Saturday in NYC?
export function isSaturdayNYC(): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: NYC, weekday: 'short' }).format(new Date());
  return weekday === 'Sat';
}

export async function getDraftForDate(date: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from('weekly_marketing_drafts')
    .select('*')
    .eq('target_send_date', date)
    .maybeSingle();
  return data;
}

// Brand context for the AI generator.
const BRAND_CONTEXT = `
Wonderland Playhouse — small, family-owned magical, low-stim birthday venue and play space in South Brooklyn (3830 Nostrand Ave, near Sheepshead Bay / Marine Park / Manhattan Beach / Brighton / Mill Basin). For kids 0–8.

Offerings:
- Private parties ($1,250 — whole venue, closed to public). Mon–Thu private parties are 20% off (limited-time).
- Semi-private parties ($650 — dedicated party room, open play continues elsewhere).
- Open play: $25/kid, 12pm–7:30pm every day (closed during private parties — booking page shows partial closures).
- Memberships: $150/month unlimited.
- Gift cards available.

Voice: warm, honest, parent-to-parent. Slight wit. NOT corporate. No exclamation marks every sentence. No "magical experiences await!" cliches. Treat the reader like an adult with limited time.

Key URLs (use as CTA links):
- /parties (party packages)
- /book (book a party online)
- /book/open-play (book open play)
- /tour (free 30-min tour)
- /inquire (book a 20-min call)
- /memberships
- /gift-cards
`;

export type GeneratedMarketing = {
  subject: string;
  body_text: string;
  cta_label?: string;
  cta_href?: string;
};

export async function generateSaturdayEmail(
  notes: string | null | undefined,
): Promise<GeneratedMarketing> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long', timeZone: NYC });
  const userMessage = `Write Saturday's weekly marketing email for Wonderland Playhouse.

CURRENT MONTH: ${month}

${notes ? `OWNER'S NOTES / EVENTS / CONTEXT (use these prominently):\n${notes}\n` : 'No specific notes from the owner this week — write something seasonally relevant and gently CTA toward booking.'}

RULES:
- Subject line: 50-70 chars, specific, no clickbait, no emoji
- Body: 80-160 words. Plain text. 2-4 short paragraphs separated by blank lines. Conversational, parent-to-parent.
- Open with something seasonal/local Brooklyn or a specific observation a parent would nod at. Not "Hope you're having a great week!"
- Single CTA at the end (cta_label + cta_href from the allowed URLs). Skip the CTA if it doesn't fit.
- DO NOT include greetings like "Hi {name}" — the template adds that.
- DO NOT sign off as "the Wonderland team" — the template handles footer.

OUTPUT JSON ONLY (no markdown, no prose around it):
{
  "subject": "string",
  "body_text": "string with \\n\\n between paragraphs",
  "cta_label": "string (optional)",
  "cta_href": "/parties or /book or /tour or /inquire or /book/open-play or /memberships or /gift-cards (optional)"
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: BRAND_CONTEXT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(text) as GeneratedMarketing;
  if (!parsed.subject || !parsed.body_text) {
    throw new Error('Generator returned invalid output');
  }
  return parsed;
}

// Shared send pipeline used by both the Saturday cron and the admin
// "Send now" button — keeps the two paths from drifting. Behavior:
//   - Picks up (or creates) the draft row for `date`
//   - Bails if already sent
//   - Uses pre_subject/pre_body when both set, otherwise AI-generates
//   - Sends to all 'promotions' subscribers in parallel, logging per-row
//   - Updates the draft row to 'sent' with the final subject/body/campaign id
export type SaturdayRunResult =
  | { ok: true; skipped?: string; draft_id?: string }
  | {
      ok: true;
      target_date: string;
      generated_by_ai: boolean;
      campaign_id: string;
      sent: number;
      failed: number;
      total: number;
    }
  | { ok: false; error: string };

export async function runSaturdayMarketing(date?: string): Promise<SaturdayRunResult> {
  const db = supabaseAdmin();
  const today = date ?? todayNYC();

  let draft = await getDraftForDate(today);
  if (!draft) {
    const { data: created } = await db
      .from('weekly_marketing_drafts')
      .insert({ target_send_date: today, status: 'queued' })
      .select()
      .single();
    draft = created!;
  }

  if (draft.status === 'sent') {
    return { ok: true, skipped: 'already sent', draft_id: draft.id };
  }

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
