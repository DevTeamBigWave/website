import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { importHomebaseDailyReports } from '@/lib/homebase-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST() {
  await requireAdmin();
  try {
    const result = await importHomebaseDailyReports(7);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
