import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// Edge-cached for performance. Stripe webhook calls revalidatePath('/api/availability') on success.
export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const days = Math.min(parseInt(searchParams.get('days') ?? '60'), 90);

  const from = fromParam ? new Date(fromParam) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + days);

  const supabase = await supabaseServer();

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
        start_time
      )
    `)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Normalize for the client
  const availability = (data ?? []).map((row: any) => ({
    date: row.date,
    blockType: row.block_type, // 'full' | 'partial'
    reason: row.reason,
    package: row.parties?.package,
    startTime: row.parties?.start_time,
  }));

  return NextResponse.json({
    availability,
    from: from.toISOString(),
    to: to.toISOString(),
  });
}
