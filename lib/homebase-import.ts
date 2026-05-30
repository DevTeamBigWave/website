// Homebase daily email parser.
//
// Approach: pull recent emails from no-reply@joinhomebase.com via Gmail API,
// extract the labor numbers + per-employee breakdown with Claude (resilient
// to format changes), upsert into daily_labor.
//
// Date semantics: each morning's Homebase email has TWO sections we care
// about:
//   - "What's Happening Today"  → today's EXPECTED (scheduled) labor
//   - "Yesterday's Summary"     → yesterday's ACTUAL labor
// One email therefore touches two daily_labor rows. The today row gets
// expected_* populated; the yesterday row gets total_* (actual). When
// tomorrow's email arrives it fills in the actual_* on today's row.
// Net effect: today's row exists the morning it begins (expected only,
// actual = TBD), and fills in the next morning.

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

type EmployeeShift = { name: string; scheduled: string | null; actual: string | null };
type ParsedLabor = {
  // Report date from the email subject (= today, the date the email was sent)
  report_date: string;
  // Today's EXPECTED labor — extracted from "What's Happening Today"
  expected: {
    cost_cents: number | null;
    hours: number | null;
    per_employee: EmployeeShift[];
  };
  // Yesterday's ACTUAL labor — extracted from "Yesterday's Summary"
  actual: {
    labor_date: string; // = report_date − 1
    cost_cents: number | null;
    hours: number | null;
    overtime_hours: number | null;
    per_employee: EmployeeShift[];
  };
};

async function parseEmailWithClaude(bodyText: string, subject: string): Promise<ParsedLabor> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt = `You are extracting labor data from a Homebase daily summary email for Wonderland Playhouse.

Email subject: ${subject}

Email body (text/stripped):
${bodyText.slice(0, 6000)}

The email's subject contains a date — "Daily Report for Wonderland Playhouse on MM/DD/YYYY". That's the report date.

The email has TWO sections we need to extract:

1. "What's Happening Today" — shows TODAY's scheduled shifts (the report date).
   Sum the scheduled hours across all listed people to compute expected_hours.
   If the email shows an Est. Labor $ for today, capture that; otherwise leave
   expected_cost_cents null. per_employee for "expected" lists each person
   with their scheduled time range.

2. "Yesterday's Summary" — shows YESTERDAY's actual labor (report date − 1).
   Pull "Est. Labor $", "Est. Labor (hrs.)", "Overtime (hrs.)", and the
   time-card table (per_employee with scheduled + actual ranges).

If a field can't be found, return null for it. If a section is missing
entirely, return null for cost_cents and hours and an empty array for
per_employee.

Output JSON only, no prose, no markdown fences:
{
  "report_date": "YYYY-MM-DD",
  "expected": {
    "cost_cents": int|null,
    "hours": number|null,
    "per_employee": [{ "name": "string", "scheduled": "string|null", "actual": null }]
  },
  "actual": {
    "labor_date": "YYYY-MM-DD",
    "cost_cents": int|null,
    "hours": number|null,
    "overtime_hours": number|null,
    "per_employee": [{ "name": "string", "scheduled": "string|null", "actual": "string|null" }]
  }
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
      if (!parsed.report_date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.report_date)) {
        result.errors.push({ email_id: msgId, error: 'invalid report_date' });
        continue;
      }

      const now = new Date().toISOString();
      const rawSlice = body.slice(0, 4000);

      // TODAY's row gets the expected_* columns. We only touch expected_*
      // (not the actual_* / total_* columns) so a follow-up email landing
      // on a date that already has actuals doesn't wipe them. Same in
      // reverse for the yesterday row below.
      await upsertExpected(db, {
        labor_date: parsed.report_date,
        expected_cost_cents: parsed.expected.cost_cents ?? null,
        expected_hours: parsed.expected.hours ?? null,
        expected_per_employee: parsed.expected.per_employee ?? [],
        source_email_id: msgId,
        raw_text: rawSlice,
        parsed_at: now,
      });

      if (
        parsed.actual.labor_date &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.actual.labor_date)
      ) {
        await upsertActual(db, {
          labor_date: parsed.actual.labor_date,
          total_cost_cents: parsed.actual.cost_cents ?? 0,
          total_hours: parsed.actual.hours ?? null,
          per_employee: parsed.actual.per_employee ?? [],
          source_email_id: msgId,
          raw_text: rawSlice,
          parsed_at: now,
        });
      }

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

// Upsert-and-merge helpers: we can't use a single upsert call because the
// row might already exist with the OTHER half populated (yesterday's email
// wrote expected_*; today's email writes actual_* for the same row).
// Read-modify-write keeps both halves intact.
type DbClient = ReturnType<typeof supabaseAdmin>;

async function upsertExpected(
  db: DbClient,
  fields: {
    labor_date: string;
    expected_cost_cents: number | null;
    expected_hours: number | null;
    expected_per_employee: unknown;
    source_email_id: string;
    raw_text: string;
    parsed_at: string;
  },
) {
  const { data: existing } = await db
    .from('daily_labor')
    .select('id')
    .eq('labor_date', fields.labor_date)
    .maybeSingle();
  if (existing) {
    await db
      .from('daily_labor')
      .update({
        expected_cost_cents: fields.expected_cost_cents,
        expected_hours: fields.expected_hours,
        expected_per_employee: fields.expected_per_employee,
        parsed_at: fields.parsed_at,
      })
      .eq('id', existing.id);
    return;
  }
  await db.from('daily_labor').insert({
    labor_date: fields.labor_date,
    total_cost_cents: 0, // not-null in schema; actual hasn't arrived yet
    source: 'homebase_email',
    source_email_id: fields.source_email_id,
    raw_text: fields.raw_text,
    parsed_at: fields.parsed_at,
    expected_cost_cents: fields.expected_cost_cents,
    expected_hours: fields.expected_hours,
    expected_per_employee: fields.expected_per_employee,
  });
}

async function upsertActual(
  db: DbClient,
  fields: {
    labor_date: string;
    total_cost_cents: number;
    total_hours: number | null;
    per_employee: unknown;
    source_email_id: string;
    raw_text: string;
    parsed_at: string;
  },
) {
  const { data: existing } = await db
    .from('daily_labor')
    .select('id')
    .eq('labor_date', fields.labor_date)
    .maybeSingle();
  if (existing) {
    await db
      .from('daily_labor')
      .update({
        total_cost_cents: fields.total_cost_cents,
        total_hours: fields.total_hours,
        per_employee: fields.per_employee,
        source_email_id: fields.source_email_id,
        raw_text: fields.raw_text,
        parsed_at: fields.parsed_at,
      })
      .eq('id', existing.id);
    return;
  }
  await db.from('daily_labor').insert({
    labor_date: fields.labor_date,
    total_cost_cents: fields.total_cost_cents,
    total_hours: fields.total_hours,
    per_employee: fields.per_employee,
    source: 'homebase_email',
    source_email_id: fields.source_email_id,
    raw_text: fields.raw_text,
    parsed_at: fields.parsed_at,
  });
}
