import { NextResponse } from 'next/server';
import { isSaturdayNYC, runSaturdayMarketing } from '@/lib/weekly-marketing';

// Weekly cron — runs every Saturday morning. Picks up the queued draft for
// today's date (if any), uses it as-is OR fills in with AI generation, then
// sends to all promotion-subscribed customers.
//
// Schedule on cron-job.org:
//   URL:    https://<domain>/api/cron/weekly-marketing
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every Saturday at 09:00 America/New_York

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Guardrail: only run on Saturdays (in case cron is misconfigured)
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === '1';
  const wait = searchParams.get('wait') === '1';
  if (!isSaturdayNYC() && !force) {
    return NextResponse.json({ ok: true, skipped: 'not Saturday' });
  }

  // Fire-and-forget so cron-job.org doesn't time out waiting on Claude
  // generation + parallel email sends (can take 30-90s with many subscribers).
  // Pass ?wait=1 to await results.
  if (!wait) {
    runSaturdayMarketing()
      .then((r) => console.log('[weekly-marketing] background done:', r))
      .catch((err) => console.error('[weekly-marketing] background failed:', err));
    return NextResponse.json({
      ok: true,
      mode: 'background',
      message: 'Saturday marketing kicked off in background. Check /admin/marketing in ~60s.',
    });
  }

  const result = await runSaturdayMarketing();
  return NextResponse.json(result);
}
