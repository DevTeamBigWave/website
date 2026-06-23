// Owner trigger for the Saturday auto-email. Same pipeline the Saturday
// cron uses — picks up today's draft (creating one if needed), AI-generates
// when subject/body are blank, sends to all 'promotions' subscribers.
//
// Exists so Gaby can recover when the cron didn't fire (cron-job.org
// misconfigured / paused / late) without waiting another week.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { runSaturdayMarketing, todayNYC } from '@/lib/weekly-marketing';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await requireOwner();

  // Allow targeting a specific date (e.g. resend today's draft) via ?date=
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? todayNYC();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }
  // ?force=1 bypasses the "already sent" guard — used when a prior
  // attempt marked the draft as sent but Resend has no record (RLS
  // misconfig, bad API key, etc.) and we want to retry without manual
  // DB cleanup.
  const force = searchParams.get('force') === '1';

  const result = await runSaturdayMarketing(date, { force });
  return NextResponse.json(result);
}
