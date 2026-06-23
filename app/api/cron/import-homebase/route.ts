import { NextResponse } from 'next/server';
import { importHomebaseDailyReports } from '@/lib/homebase-import';

// Daily cron — pulls yesterday's Homebase email (and a few days back as
// safety) and parses with Claude. Idempotent on Gmail message id.
//
// Schedule on cron-job.org:
//   URL:    https://<domain>/api/cron/import-homebase
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every day at 10:00 America/New_York (Homebase emails around 2-6am ET)

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const result = await importHomebaseDailyReports(3);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
