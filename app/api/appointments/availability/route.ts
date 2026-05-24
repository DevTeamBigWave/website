import { NextResponse } from 'next/server';
import {
  computeAvailableSlots,
  getAppointmentType,
  getAvailabilityWindows,
} from '@/lib/appointments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('type');
  const days = Math.min(parseInt(searchParams.get('days') ?? '14'), 30);

  if (!slug) {
    return NextResponse.json({ error: 'type query param required' }, { status: 400 });
  }

  const type = await getAppointmentType(slug);
  if (!type) {
    return NextResponse.json({ error: 'Unknown appointment type' }, { status: 404 });
  }

  const windows = await getAvailabilityWindows(type.id);

  const fromDate = new Date();
  fromDate.setHours(0, 0, 0, 0);

  const slots = await computeAvailableSlots(type, windows, fromDate, days);

  return NextResponse.json({
    type: { slug: type.slug, name: type.name, duration_minutes: type.duration_minutes },
    slots,
  });
}
