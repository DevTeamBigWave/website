// Homebase daily email parser.
//
// Approach: pull recent emails from no-reply@joinhomebase.com via Gmail API,
// extract the labor numbers + per-employee breakdown with Claude (resilient
// to format changes), upsert into daily_labor.
//
// Date semantics: a "Daily Report for ... on 05/23" email is sent the morning
// of 05/23 and the "Yesterday's Summary" section refers to 05/22. We store
// the labor for 05/22 (the date the work happened).

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { getIntegration, getValidAccessToken as getGoogleAccessToken } from '@/lib/google-calendar';

const MODEL = 'claude-sonnet-4-6';
const SENDER = 'no-reply@joinhomebase.com';

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
};

type GmailMessage = {
  id: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      body: { data?: string; size?: number };
      parts?: any[];
    }>;
    body?: { data?: string };
    mimeType?: string;
  };
};

async function getValidAccessToken(): Promise<string> {
  const integration = await getIntegration();
  if (!integration) {
    throw new Error('Google integration not connected — connect at /admin/integrations/google');
  }
  return getGoogleAccessToken(integration);
}

async function gmailFetch(path: string, accessToken: string, init?: RequestInit): Promise<any> {
  const url = `https://gmail.googleapis.com/gmail/v1${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 403 && /insufficient/i.test(txt)) {
      throw new Error(
        'Gmail scope missing — re-connect Google at /admin/integrations/google to grant inbox read access.',
      );
    }
    throw new Error(`Gmail ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

// Find Homebase emails from the last N days
async function listRecentHomebaseEmails(daysBack: number): Promise<string[]> {
  const token = await getValidAccessToken();
  const after = Math.floor(Date.now() / 1000) - daysBack * 24 * 60 * 60;
  // Gmail's search uses `after:<unix-ts>` for date filtering
  const q = `from:${SENDER} after:${after}`;
  const data: GmailListResponse = await gmailFetch(
    `/users/me/messages?q=${encodeURIComponent(q)}&maxResults=20`,
    token,
  );
  return (data.messages ?? []).map((m) => m.id);
}

function b64UrlDecode(s: string): string {
  // Gmail returns base64url; convert to standard then decode
  const fixed = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = fixed + '='.repeat((4 - (fixed.length % 4)) % 4);
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf-8');
  return atob(padded);
}

// Walks the MIME tree, prefers text/plain, falls back to text/html stripped
function extractBodyText(message: GmailMessage): string {
  const candidates: Array<{ mime: string; data: string }> = [];

  function walk(part: any) {
    if (!part) return;
    if (part.body?.data) {
      candidates.push({ mime: part.mimeType ?? 'text/plain', data: part.body.data });
    }
    if (part.parts) for (const p of part.parts) walk(p);
  }
  walk(message.payload);

  const text = candidates.find((c) => c.mime === 'text/plain');
  if (text) return b64UrlDecode(text.data);
  const html = candidates.find((c) => c.mime === 'text/html');
  if (html) {
    const raw = b64UrlDecode(html.data);
    // Strip tags, collapse whitespace
    return raw
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

type ParsedLabor = {
  labor_date: string; // YYYY-MM-DD, the date the labor happened (= report's "yesterday")
  total_cost_cents: number;
  total_hours: number;
  overtime_hours: number;
  per_employee: Array<{ name: string; scheduled: string | null; actual: string | null }>;
};

async function parseEmailWithClaude(bodyText: string, subject: string): Promise<ParsedLabor> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt = `You are extracting labor data from a Homebase daily summary email for Wonderland Playhouse.

Email subject: ${subject}

Email body (text/stripped):
${bodyText.slice(0, 6000)}

The email's subject contains a date — "Daily Report for Wonderland Playhouse on MM/DD/YYYY". That's the date the report was generated. The "Yesterday's Summary" section contains labor data for the day BEFORE the report date.

Extract these fields from the "Yesterday's Summary" section:

- labor_date: the date the labor happened (= report date minus 1 day), as YYYY-MM-DD
- total_cost_cents: "Est. Labor $" as integer cents (e.g. $142.50 → 14250)
- total_hours: "Est. Labor (hrs.)" as decimal number (e.g. 7.5)
- overtime_hours: "Overtime (hrs.)" as decimal number (e.g. 0.0)
- per_employee: array of { name, scheduled, actual } from the time card table. Scheduled and actual are strings like "12:00PM - 7:30PM" or null if missing.

If a field can't be found, return null for it.

Output JSON only, no prose, no markdown fences:
{
  "labor_date": "YYYY-MM-DD",
  "total_cost_cents": int,
  "total_hours": number,
  "overtime_hours": number,
  "per_employee": [{ "name": "string", "scheduled": "string|null", "actual": "string|null" }]
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
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

  const parsed = JSON.parse(text) as ParsedLabor;
  return parsed;
}

export type ImportResult = {
  emails_found: number;
  imported: number;
  skipped: number;
  errors: Array<{ email_id: string; error: string }>;
};

export async function importHomebaseDailyReports(daysBack = 3): Promise<ImportResult> {
  const db = supabaseAdmin();
  const accessToken = await getValidAccessToken();
  const messageIds = await listRecentHomebaseEmails(daysBack);

  const result: ImportResult = {
    emails_found: messageIds.length,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const msgId of messageIds) {
    // Skip if we already processed this Gmail message
    const { data: existing } = await db
      .from('daily_labor')
      .select('id')
      .eq('source_email_id', msgId)
      .maybeSingle();
    if (existing) {
      result.skipped += 1;
      continue;
    }

    try {
      const msg: GmailMessage = await gmailFetch(
        `/users/me/messages/${msgId}?format=full`,
        accessToken,
      );
      const subject = msg.payload.headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
      const body = extractBodyText(msg);
      if (!body) {
        result.errors.push({ email_id: msgId, error: 'empty body' });
        continue;
      }

      const parsed = await parseEmailWithClaude(body, subject);
      if (!parsed.labor_date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.labor_date)) {
        result.errors.push({ email_id: msgId, error: 'invalid labor_date' });
        continue;
      }

      // Upsert by labor_date so re-imports just refresh
      await db.from('daily_labor').upsert(
        {
          labor_date: parsed.labor_date,
          total_cost_cents: parsed.total_cost_cents ?? 0,
          total_hours: parsed.total_hours ?? null,
          per_employee: parsed.per_employee ?? [],
          source: 'homebase_email',
          source_email_id: msgId,
          raw_text: body.slice(0, 4000),
          parsed_at: new Date().toISOString(),
        },
        { onConflict: 'labor_date' },
      );

      result.imported += 1;
    } catch (err) {
      result.errors.push({
        email_id: msgId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return result;
}
