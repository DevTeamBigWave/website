// ============================================================================
// SMS helpers for the inbound AI auto-responder (Twilio webhook).
//
// DRAFT / INERT until Twilio is approved + configured. The inbound route is a
// no-op unless TWILIO_AUTH_TOKEN is set and the Twilio Messaging webhook is
// pointed at /api/sms/inbound. Nothing here runs on its own.
//
// What lives here:
//   - validateTwilioSignature: verify a request actually came from Twilio
//   - classifyKeyword:         detect A2P 10DLC compliance keywords (STOP/HELP/…)
//   - twiml / escapeXml:       build the TwiML <Response> Twilio expects back
//   - SMS_SYSTEM_PROMPT_ADDENDUM: SMS-specific tweaks layered on the chat brain
// ============================================================================

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Twilio request-signature validation
//
// Twilio signs every webhook with X-Twilio-Signature: an HMAC-SHA1 (base64) of
// the full request URL with the POSTed params appended in alphabetical order by
// key. We recompute it with the account auth token and compare in constant
// time. See https://www.twilio.com/docs/usage/security#validating-requests
// ---------------------------------------------------------------------------
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature) return false;

  // URL + each param key/value concatenated, keys sorted ascending.
  const data =
    url +
    Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], '');

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// A2P 10DLC compliance keywords
//
// Carriers require these to be honored. Twilio's Advanced Opt-Out handles the
// actual subscriber list automatically when enabled, but we still detect them
// so we never hand a STOP/HELP message to the AI and so our reply copy matches.
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
]);
const HELP_WORDS = new Set(['help', 'info']);
const START_WORDS = new Set(['start', 'yes', 'unstop']);

export type KeywordKind = 'stop' | 'help' | 'start' | null;

export function classifyKeyword(body: string): KeywordKind {
  const word = body.trim().toLowerCase().replace(/[.!]+$/, '');
  if (STOP_WORDS.has(word)) return 'stop';
  if (HELP_WORDS.has(word)) return 'help';
  if (START_WORDS.has(word)) return 'start';
  return null;
}

// Canonical compliance replies. Twilio's Advanced Opt-Out can also send these
// for us; kept here so the response is correct even with it disabled.
export const STOP_REPLY =
  'You are unsubscribed from Wonderland Playhouse texts and will receive no more messages. Reply START to resubscribe.';
export const HELP_REPLY =
  'Wonderland Playhouse: indoor play & party venue, Brooklyn. Info at https://www.wonderlandplayhouse.com or call (718) 889-1777. Reply STOP to opt out. Msg&data rates may apply.';
export const START_REPLY =
  "You're resubscribed to Wonderland Playhouse texts. Reply HELP for help, STOP to opt out.";

// ---------------------------------------------------------------------------
// TwiML response builder
//
// Twilio expects an XML <Response>. A <Message> child sends a reply SMS; an
// empty <Response/> sends nothing (used when Twilio's own opt-out flow already
// answered, or when we choose to stay silent).
// ---------------------------------------------------------------------------
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function twiml(message?: string): string {
  const body = message
    ? `<Message>${escapeXml(message)}</Message>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

// ---------------------------------------------------------------------------
// SMS-specific prompt addendum
//
// Layered AFTER the shared chat SYSTEM_PROMPT so the bot keeps the same facts
// and voice but writes for a 160-char text, not a chat window.
// ---------------------------------------------------------------------------
export const SMS_SYSTEM_PROMPT_ADDENDUM = `
# This is a TEXT MESSAGE (SMS), not the website chat

You are now replying to a text sent to the venue's business number. Adjust:

- Keep it SHORT — aim for under 320 characters (≈2 SMS segments). One or two sentences.
- Plain text only. No markdown, no bullet lists, no headers, no emoji-spam (one tasteful emoji max).
- Write FULL URLs since taps matter (not relative paths). Your default, most-pushed link is the PARTY BOOKING page: https://www.wonderlandplayhouse.com/book — that's where they pick a package/date/time and pay the deposit. Other links only when relevant: https://www.wonderlandplayhouse.com/book/open-play , /memberships , /gift-cards , /inquire .
- Your #1 job over text, same as the chat: get parties booked. Answer briefly and accurately, then nudge them to book at https://www.wonderlandplayhouse.com/book (one nudge, not pushy). For custom requests, point to a call at (718) 889-1777 or /inquire instead.
- You DO have tools here, same as the website chat: use check_availability for any date/calendar question, and use quote_party_price for any specific price (headcount, adults, extension, Mon–Thu discount, tax, deposit). ALWAYS use quote_party_price rather than doing the math yourself — then give just the bottom line (total + deposit) in the text, not the full itemized list.
- Never invent prices, availability, or dates. If a tool can answer it, use the tool; otherwise send them to the website or to call (718) 889-1777.
- For booking, scheduling changes, refunds, custom themes, or a real conversation, tell them to book online or call/text (718) 889-1777 or book a free call at https://www.wonderlandplayhouse.com/inquire .
- Do not ask for payment info or personal details over text.
- Sign-off is optional; if you use one, keep it tiny ("— Wonderland Playhouse").
`;
