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

  // Service-role client: parties has RLS that blocks anon SELECT (PII),
  // which means the embedded join below returns nothing under the anon
  // client. The fields we surface here are non-PII (date, package, start
  // time, duration only — no names, no emails, no phone), so it's safe
  // to bypass RLS for this read.
  const supabase = supabaseAdmin();

  // We read from blocked_dates (auto-populated by trigger) joined with parties for context
  const { data, error } = await supabase
    .from('blocked_dates')
    .select(`
      date,
      block_type,
      reason,
      parties (
        id,
        package,
        start_time,
        duration_minutes,
        extension_minutes
      )
    `)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Normalize for the client. totalMinutes = base duration + optional extension —
  // booking flow uses it to flag back-to-back overlaps when picking an extension.
  const availability = (data ?? []).map((row: any) => ({
    date: row.date,
    blockType: row.block_type, // 'full' | 'partial'
    reason: row.reason,
    package: row.parties?.package,
    startTime: row.parties?.start_time,
    totalMinutes:
      (row.parties?.duration_minutes ?? 120) +
      (row.parties?.extension_minutes ?? 0),
  }));

  return NextResponse.json({
    availability,
    from: from.toISOString(),
    to: to.toISOString(),
  });
}
