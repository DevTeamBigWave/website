import { NextResponse } from 'next/server';
import { lookupWaiverByEmail } from '@/lib/waivers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim();
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }
  const result = await lookupWaiverByEmail(email);
  return NextResponse.json(result);
}
