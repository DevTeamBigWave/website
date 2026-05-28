import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Edge-cached for performance. Stripe webhook calls revalidatePath('/api/availability') on success.
export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const days = Math.min(parseInt(searchParams.get('days') ?? '180'), 200);

  const from = fromParam ? new Date(fromParam) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + days);

  // Service-role read: blocked_dates and parties both have RLS that hides
  // these fields from the anon client. What we surface is non-PII (date,
  // start time, duration, reason text) so bypassing RLS for this read is
  // safe. start_time + duration_minutes live directly on blocked_dates as
  // of migration 0026, so both party-sourced and external-calendar-sourced
  // blocks come back through the same shape — no JOIN needed.
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from('blocked_dates')
    .select('date, block_type, reason, start_time, duration_minutes, package_type')
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const availability = (data ?? []).map((row: any) => ({
    date: row.date,
    blockType: row.block_type, // 'full' | 'partial'
    reason: row.reason,
    startTime: row.start_time,
    totalMinutes: row.duration_minutes ?? 120,
    packageType: row.package_type, // 'private' | 'semi' | null
  }));

  return NextResponse.json({
    availability,
    from: from.toISOString(),
    to: to.toISOString(),
  });
}
