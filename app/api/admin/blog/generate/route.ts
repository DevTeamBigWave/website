import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { generateAndPublishBatch } from '@/lib/blog-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Schema = z.object({
  count: z.coerce.number().int().min(1).max(10).default(3),
});

export async function POST(request: Request) {
  await requireAdmin(); // throws if not signed in or not in allowlist

  let body: { count: number };
  try {
    body = Schema.parse(await request.json());
  } catch {
    body = { count: 3 };
  }

  try {
    const { saved, failures } = await generateAndPublishBatch(body.count);
    revalidatePath('/blog');
    revalidatePath('/');
    revalidatePath('/sitemap.xml');
    return NextResponse.json({
      ok: true,
      generated: saved.length,
      requested: body.count,
      failures,
      posts: saved.map((p) => ({ slug: p.slug, title: p.title })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 },
    );
  }
}
