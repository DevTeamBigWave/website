import { logSms } from '@/lib/sms-log';

// Outbound SMS via the Twilio REST API. Every send is logged to sms_messages
// (success or failure) so it shows in the admin inbox. Used by manual replies
// and any automated notification.
//
// Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.

export type SendSmsResult =
  | { ok: true; sid: string | null }
  | { ok: false; error: string };

export async function sendSms({
  to,
  body,
  sender = 'owner',
}: {
  to: string;
  body: string;
  sender?: 'ai' | 'owner' | 'system';
}): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error:
        'Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.',
    };
  }

  let twilioSid: string | null = null;
  let status = 'sent';
  let error: string | null = null;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization:
            'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );
    const data = (await res.json()) as {
      sid?: string;
      status?: string;
      message?: string;
    };
    if (!res.ok) {
      status = 'failed';
      error = data?.message ?? `Twilio error ${res.status}`;
    } else {
      twilioSid = data.sid ?? null;
      status = data.status ?? 'sent';
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : 'send failed';
  }

  await logSms({
    contactPhone: to,
    direction: 'outbound',
    body,
    sender,
    status,
    twilioSid,
    error,
  });

  return error ? { ok: false, error } : { ok: true, sid: twilioSid };
}
