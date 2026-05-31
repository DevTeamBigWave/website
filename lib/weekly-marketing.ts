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

// Rotate marketing angles week-to-week so subscribers don't get the same
// "book now" push every Saturday. Picked deterministically by ISO week
// number so the same week always renders the same angle (lets us preview
// what's coming) and the rotation is visible — 6 angles cycles ≈monthly.
const ANGLES: Array<{
  id: string;
  name: string;
  brief: string;
}> = [
  {
    id: 'low_stim_parenting',
    name: 'Low-stim parenting moment',
    brief:
      'Open with an honest observation about parenting young kids (overstimulation at typical kids spaces, the relief of a calm venue, the loud-vs-quiet trade-off). Connect to why Wonderland is designed the way it is. Soft CTA — tour or open play, not a hard book-now.',
  },
  {
    id: 'community_brooklyn',
    name: 'Brooklyn / community moment',
    brief:
      'Lead with something local — South Brooklyn weather, a real moment from the playspace this week, a regular kid you saw, a small business neighbor. The point is community + presence, not the offer. CTA optional and gentle.',
  },
  {
    id: 'host_behind_scenes',
    name: 'Behind-the-scenes / host story',
    brief:
      'Pull back the curtain on what a Wonderland party actually feels like to host or attend — the setup, the host running the show, a parent reaction. No claims, just specifics. CTA toward /parties or a tour.',
  },
  {
    id: 'value_open_play',
    name: 'Open play / membership value',
    brief:
      'Practical value angle. Open play is $25/kid, memberships $150/month unlimited — name the math, name who memberships make sense for (frequent kid + Brooklyn weather), without being salesy. CTA toward /book/open-play or /memberships.',
  },
  {
    id: 'seasonal_book_ahead',
    name: 'Seasonal/book-ahead nudge',
    brief:
      'The classic "parties book 4-6 weeks out" reminder, but framed honestly — for an upcoming birthday season, what dates still have room, weekday discount if applicable. CTA toward /parties or /book.',
  },
  {
    id: 'parent_to_parent',
    name: 'Parent-to-parent helpful tip',
    brief:
      'Pure value — a small useful tip for parents in Brooklyn with kids 0-8 (snack handling, theme picking, the "what to skip on a kids birthday" angle). Connects loosely to Wonderland at the end. CTA can be skipped entirely.',
  },
];

// ISO week number — stable rotation key.
function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function pickAngleForDate(d: Date) {
  return ANGLES[isoWeekNumber(d) % ANGLES.length];
}

export async function generateSaturdayEmail(
  notes: string | null | undefined,
): Promise<GeneratedMarketing> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const now = new Date();
  const monthLong = now.toLocaleString('en-US', { month: 'long', timeZone: NYC });
  const dateLong = now.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: NYC,
  });
  const dayInNYC = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: NYC, day: 'numeric' }).format(now),
    10,
  );
  // Days remaining in the current NYC month — used to nudge the AI off
  // the current month's framing when there's almost none of it left.
  const yearMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: NYC,
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);
  const daysInMonth = new Date(yearMonth[0], yearMonth[1], 0).getDate();
  const daysLeftInMonth = daysInMonth - dayInNYC;
  const nextMonth = new Date(yearMonth[0], yearMonth[1] % 12, 1).toLocaleString(
    'en-US',
    { month: 'long', timeZone: NYC },
  );
  // Threshold: by the last week of the month, the AI should pivot to
  // next-month framing (any "May parties filling up" copy on May 30 reads
  // as stale by the time the recipient opens it).
  const pivotToNextMonth = daysLeftInMonth <= 7;

  const angle = pickAngleForDate(now);

  const userMessage = `Write Saturday's weekly marketing email for Wonderland Playhouse.

TODAY: ${dateLong}
Days left in ${monthLong}: ${daysLeftInMonth}
${
  pivotToNextMonth
    ? `IMPORTANT: ${monthLong} is essentially over. Frame the email around ${nextMonth} (upcoming dates, ${nextMonth} availability, seasonal hooks for ${nextMonth}). Do NOT write copy that references "${monthLong} parties filling up" or anything that will read as stale once recipients open it Saturday morning.`
    : `Frame the email around ${monthLong} (current month is mid-cycle, there's still real time left to book).`
}

THIS WEEK'S ANGLE: ${angle.name}
${angle.brief}

The angle is the LENS — what the email is about and the emotional register. Stick to it. Do NOT default to a generic "book a party" sales push unless the angle is "Seasonal/book-ahead nudge". Subscribers get this every week; rotating angles is the whole point.

${notes ? `OWNER'S NOTES / EVENTS / CONTEXT (use these in addition to the angle — they take precedence if there's a conflict):\n${notes}\n` : ''}

RULES:
- Subject line: 50-70 chars, specific, no clickbait, no emoji. Match the angle — a low-stim parenting angle shouldn't have a "spots filling fast" subject.
- Body: 80-160 words. Plain text. 2-4 short paragraphs separated by blank lines. Conversational, parent-to-parent.
- Tone: low-stim, calm, honest. Like the venue itself. No exclamation marks unless one would actually land. No "magical experiences await" filler.
- Open with something specific to the angle — observation, story, a real detail. Never "Hope you're having a great week!"
- Single CTA at the end (cta_label + cta_href from the allowed URLs). Some angles work with a soft CTA or no CTA at all — that's fine, skip it.
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
      first_error?: string;
    }
  | { ok: false; error: string };

export async function runSaturdayMarketing(
  date?: string,
  opts?: { force?: boolean },
): Promise<SaturdayRunResult> {
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

  if (draft.status === 'sent' && !opts?.force) {
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
  let firstError: string | undefined;
  const concurrency = 5;
  const queue = [...recipients];

  async function worker() {
    while (queue.length > 0) {
      const r = queue.shift();
      if (!r) break;
      // Wrap the WHOLE iteration so a row-insert RLS error or schema
      // issue can't kill the worker. Errors are surfaced via `firstError`
      // so the UI shows them to the owner.
      try {
        const { data: row, error: insertErr } = await db
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
        if (insertErr) throw new Error(`db insert: ${insertErr.message}`);

        try {
          const result = await sendMarketingCampaign({
            to: r.email,
            to_name: r.parent_name,
            subject: subject!,
            body_text: body!,
            cta_label: ctaLabel,
            cta_href: ctaHref,
          });
          // Resend's SDK returns { data, error } — a non-throwing error
          // (auth, bad domain, rate-limit) lands here without raising.
          const resendError = (result as any)?.error;
          if (resendError) {
            const msg =
              typeof resendError === 'string'
                ? resendError
                : resendError.message ?? JSON.stringify(resendError);
            throw new Error(`resend: ${msg}`);
          }
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
          const msg = err instanceof Error ? err.message : 'unknown';
          if (!firstError) firstError = `${r.email}: ${msg}`;
          if (row?.id) {
            await db
              .from('marketing_sends')
              .update({ status: 'failed', error_message: msg })
              .eq('id', row.id);
          }
        }
      } catch (outerErr) {
        failed += 1;
        const msg = outerErr instanceof Error ? outerErr.message : 'unknown';
        if (!firstError) firstError = `${r.email}: ${msg}`;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Only mark the draft as sent if at least one email actually went out —
  // otherwise leave it queued so the owner can retry without forcing.
  // Stops the "drafts looks sent but Resend is empty" mystery.
  if (sent > 0) {
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
  } else {
    await db
      .from('weekly_marketing_drafts')
      .update({
        status: 'failed',
        error_message: firstError ?? 'no recipients or all sends failed',
      })
      .eq('id', draft.id);
  }

  return {
    ok: true,
    target_date: today,
    generated_by_ai: generatedByAi,
    campaign_id: campaignId,
    sent,
    failed,
    total: recipients.length,
    first_error: firstError,
  };
}
