import { NextResponse } from 'next/server';
import { syncCloverPayments, cloverConfigured } from '@/lib/clover';

// Hourly cron — pulls Clover payments updated since last sync.
//
// Schedule on cron-job.org:
//   URL:    https://<domain>/api/cron/sync-clover
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every hour (or every 15 min if you want near-real-time)

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!cloverConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Clover not configured — set CLOVER_ACCESS_TOKEN + CLOVER_MERCHANT_ID' },
      { status: 503 },
    );
  }

  try {
    const result = await syncCloverPayments();
    console.log('[clover-sync] ok:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[clover-sync] failed:', message);
    if (stack) console.error('[clover-sync] stack:', stack);
    return NextResponse.json(
      { ok: false, error: message, stack: stack?.split('\n').slice(0, 5).join('\n') },
      { status: 500 },
    );
  }
}
