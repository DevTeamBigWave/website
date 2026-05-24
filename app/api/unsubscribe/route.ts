import { NextResponse } from 'next/server';
import { z } from 'zod';
import { unsubscribeEmail, verifyEmailToken } from '@/lib/marketing';

const Schema = z.object({
  email: z.string().email(),
  scope: z.enum(['all', 'birthday_reminders', 'promotions', 'special_events']),
  token: z.string().min(8),
});

export async function POST(request: Request) {
  let body;
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  if (!verifyEmailToken(body.email, body.token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }
  await unsubscribeEmail(body.email, body.scope, 'user requested via /unsubscribe');
  return NextResponse.json({ ok: true });
}
