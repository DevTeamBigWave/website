import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { generateAndPublishBatch } from '@/lib/blog-generator';

// Weekly cron — generates 3 fresh SEO blog posts per run.
//
// Schedule externally (Railway crons turn the web service off — use
// cron-job.org or similar):
//   Every Monday at 9am Eastern (14:00 UTC):
//     curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//       https://wonderlandplayhouse.com/api/cron/weekly-blog
//
// Override count by passing ?count=N (capped at 10). Used for the initial
// kickoff (?count=6).
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — generation can take a while

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode
  return request.headers.get('x-cron-secret') === secret;
}

export async function POST(request: Request) {
  return handler(request);
}

export async function GET(request: Request) {
  return handler(request);
}

async function handler(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requested = parseInt(searchParams.get('count') ?? '3', 10);
  const count = Math.min(Math.max(1, requested || 3), 10);

  try {
    const { saved, failures } = await generateAndPublishBatch(count);

    revalidatePath('/blog');
    revalidatePath('/');
    revalidatePath('/sitemap.xml');

    return NextResponse.json({
      ok: true,
      generated: saved.length,
      requested: count,
      failures,
      posts: saved.map((p) => ({ slug: p.slug, title: p.title, primary_keyword: p.primary_keyword })),
    });
  } catch (err) {
    console.error('Weekly blog cron failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
