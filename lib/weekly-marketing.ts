// Weekly Saturday marketing helpers — both the AI generator and the
// next-Saturday date math.

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';

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
- Open play: $25/kid, 12pm–7pm every day.
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
