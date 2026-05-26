import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { syncSpecialHoursToGbp } from '@/lib/gbp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  await requireOwner();
  try {
    const result = await syncSpecialHoursToGbp();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'sync failed' },
      { status: 500 },
    );
  }
}
