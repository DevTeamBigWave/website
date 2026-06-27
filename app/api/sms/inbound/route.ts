// ============================================================================
// Inbound SMS AI auto-responder  (Twilio Messaging webhook)  — DRAFT
//
// Status: INERT until Twilio is approved + configured. To go live:
//   1. Set TWILIO_AUTH_TOKEN in the environment (from the Twilio console).
//   2. In Twilio: Messaging > your number > "A message comes in" webhook →
//      POST https://www.wonderlandplayhouse.com/api/sms/inbound
//   3. Enable Twilio Advanced Opt-Out (recommended) so STOP/HELP are also
//      handled at the carrier layer.
//
// Until TWILIO_AUTH_TOKEN is set, this returns an empty TwiML <Response/> and
// never calls the AI — so deploying it changes nothing.
//
// Behavior when live:
//   - Verifies the Twilio signature (rejects forged requests).
//   - Honors STOP / HELP / START compliance keywords with fixed copy.
//   - Otherwise asks Claude (same brain as the website chat) for a short,
//     text-appropriate reply that points the sender to the website / phone.
//   - Stateless: single message in, single reply out. No conversation memory.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '@/lib/chat-system-prompt';
import {
  validateTwilioSignature,
  classifyKeyword,
  twiml,
  STOP_REPLY,
  HELP_REPLY,
  START_REPLY,
  SMS_SYSTEM_PROMPT_ADDENDUM,
} from '@/lib/sms';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 320;

const XML_HEADERS = { 'content-type': 'text/xml; charset=utf-8' } as const;

function xml(message?: string): Response {
  return new Response(twiml(message), { status: 200, headers: XML_HEADERS });
}

let _anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

export async function POST(request: Request) {
  // Twilio posts application/x-www-form-urlencoded.
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await request.text());
  } catch {
    return xml();
  }

  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = v;
  });

  const from = params.From ?? '';
  const body = (params.Body ?? '').trim();

  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // DRAFT GUARD: no auth token → not configured yet → do nothing, send nothing.
  if (!authToken) {
    console.warn(
      '[sms/inbound] TWILIO_AUTH_TOKEN not set — inbound SMS responder is inert (draft).',
    );
    return xml();
  }

  // Verify the request really came from Twilio. The URL must be the exact
  // public URL Twilio called; honor proxy headers since we sit behind one.
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const url = `${proto}://${host}/api/sms/inbound`;
  const signature = request.headers.get('x-twilio-signature');

  if (!validateTwilioSignature(authToken, url, params, signature)) {
    console.warn('[sms/inbound] Invalid Twilio signature — rejecting.');
    return new Response('Forbidden', { status: 403 });
  }

  if (!from || !body) return xml();

  // Compliance keywords first — never hand these to the AI.
  switch (classifyKeyword(body)) {
    case 'stop':
      return xml(STOP_REPLY);
    case 'help':
      return xml(HELP_REPLY);
    case 'start':
      return xml(START_REPLY);
  }

  // Otherwise, let the chat brain answer — briefly, for SMS.
  try {
    const message = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT + SMS_SYSTEM_PROMPT_ADDENDUM,
      messages: [{ role: 'user', content: body }],
    });

    const reply = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!reply) {
      return xml(
        'Thanks for texting Wonderland Playhouse! Info & booking: https://www.wonderlandplayhouse.com or call (718) 889-1777.',
      );
    }

    return xml(reply);
  } catch (err) {
    console.error('[sms/inbound] AI reply failed:', err);
    // Fail safe with a useful, on-brand fallback rather than silence.
    return xml(
      'Thanks for texting Wonderland Playhouse! For info & booking visit https://www.wonderlandplayhouse.com or call (718) 889-1777.',
    );
  }
}

// Twilio only POSTs. A GET is handy for a quick "is it deployed?" check.
export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'sms-inbound',
      configured: Boolean(process.env.TWILIO_AUTH_TOKEN),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
