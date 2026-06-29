import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { sendSms } from '@/lib/sms-send';

// Owner/staff manual SMS reply from the admin inbox. Sends via Twilio and logs
// the message (sendSms handles logging). Admin-only.

const Schema = z.object({
  to: z.string().min(7).max(40),
  body: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  await requireAdmin();

  let input: z.infer<typeof Schema>;
  try {
    input = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const result = await sendSms({
    to: input.to.trim(),
    body: input.body.trim(),
    sender: 'owner',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sid: result.sid });
}
