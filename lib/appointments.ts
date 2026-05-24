// Appointment helpers: compute available slots for a given type over a date
// range, given the type's weekly availability windows and the owner's Google
// Calendar busy times.

import { supabaseAdmin } from '@/lib/supabase';
import { getBusyRanges } from '@/lib/google-calendar';

export type AppointmentType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  is_public: boolean;
  active: boolean;
};

export type AvailabilityWindow = {
  day_of_week: number;
  start_time: string; // "HH:MM:SS"
  end_time: string;
};

export type Slot = {
  startISO: string;
  endISO: string;
};

// venue local timezone
const TZ = 'America/New_York';

export async function getAppointmentType(slug: string): Promise<AppointmentType | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('appointment_types')
    .select('id, slug, name, description, duration_minutes, buffer_minutes, is_public, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  return data as AppointmentType | null;
}

export async function getPublicAppointmentTypes(): Promise<AppointmentType[]> {
  const db = supabaseAdmin();
  const { data = [] } = await db
    .from('appointment_types')
    .select('id, slug, name, description, duration_minutes, buffer_minutes, is_public, active')
    .eq('active', true)
    .eq('is_public', true)
    .order('name');
  return (data ?? []) as AppointmentType[];
}

export async function getAvailabilityWindows(typeId: string): Promise<AvailabilityWindow[]> {
  const db = supabaseAdmin();
  const { data = [] } = await db
    .from('appointment_availability')
    .select('day_of_week, start_time, end_time')
    .eq('type_id', typeId)
    .order('day_of_week')
    .order('start_time');
  return (data ?? []) as AvailabilityWindow[];
}

// Convert a venue-local date + time to a UTC Date.
// Avoids timezone library dependency; computes NY offset via Intl.
function venueLocalToUtc(date: Date, hours: number, minutes: number): Date {
  // Build a date string in "YYYY-MM-DD HH:MM" venue time, then figure out UTC
  // by computing the offset for that local time. We do this with two formats.
  const y = date.getFullYear();
  const mo = date.getMonth();
  const d = date.getDate();

  // First guess: treat as UTC and find the offset
  const guess = new Date(Date.UTC(y, mo, d, hours, minutes));
  const localStr = guess.toLocaleString('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  // localStr is like "07/05/2026, 08:00"
  const m = localStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
  if (!m) return guess;
  const [, lmo, ld, ly, lh, lm] = m.map(Number);

  // Difference between intended (h:m) and what we got after timezone conversion
  const intendedMin = hours * 60 + minutes;
  const gotMin = lh * 60 + lm;
  // If date rolled, account for it (rare; only matters near DST changes)
  let offset = intendedMin - gotMin;
  // Day boundary correction
  if (ly !== y || lmo - 1 !== mo || ld !== d) {
    const dayDiff =
      (new Date(Date.UTC(ly, lmo - 1, ld)).getTime() -
        new Date(Date.UTC(y, mo, d)).getTime()) /
      (24 * 60 * 60 * 1000);
    offset += dayDiff * 24 * 60;
  }
  return new Date(guess.getTime() + offset * 60 * 1000);
}

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

// Given a type's windows + busy ranges, compute available slot starts for a date range.
export async function computeAvailableSlots(
  type: AppointmentType,
  windows: AvailabilityWindow[],
  fromDate: Date,
  days: number,
): Promise<Slot[]> {
  // Fetch busy times from Google Calendar for the range
  const rangeStart = new Date(fromDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + days);

  let busy: Array<{ start: string; end: string }> = [];
  try {
    busy = await getBusyRanges(rangeStart.toISOString(), rangeEnd.toISOString());
  } catch {
    // No Google integration / API error → fall back to no busy (slots still respect
    // existing appointments in DB below)
    busy = [];
  }

  // Also fetch existing appointments to avoid double-booking
  const db = supabaseAdmin();
  const { data: existingAppts = [] } = await db
    .from('appointments')
    .select('start_at, end_at')
    .eq('status', 'confirmed')
    .gte('start_at', rangeStart.toISOString())
    .lt('start_at', rangeEnd.toISOString());

  const busyRanges: Array<{ start: number; end: number }> = [
    ...busy.map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    })),
    ...((existingAppts ?? []) as Array<{ start_at: string; end_at: string }>).map((a) => ({
      start: new Date(a.start_at).getTime(),
      end: new Date(a.end_at).getTime(),
    })),
  ];

  const slots: Slot[] = [];
  const now = Date.now();
  // Minimum lead time: 2 hours in the future
  const earliestStart = now + 2 * 60 * 60 * 1000;

  for (let i = 0; i < days; i++) {
    const day = new Date(rangeStart);
    day.setDate(day.getDate() + i);
    const dow = day.getDay();

    const dayWindows = windows.filter((w) => w.day_of_week === dow);
    for (const w of dayWindows) {
      const winStart = parseTime(w.start_time);
      const winEnd = parseTime(w.end_time);

      const winStartUtc = venueLocalToUtc(day, winStart.h, winStart.m);
      const winEndUtc = venueLocalToUtc(day, winEnd.h, winEnd.m);
      const step = (type.duration_minutes + type.buffer_minutes) * 60 * 1000;
      const apptLen = type.duration_minutes * 60 * 1000;

      for (
        let t = winStartUtc.getTime();
        t + apptLen <= winEndUtc.getTime();
        t += step
      ) {
        if (t < earliestStart) continue;
        const end = t + apptLen;

        const conflicts = busyRanges.some((r) => t < r.end && r.start < end);
        if (conflicts) continue;

        slots.push({
          startISO: new Date(t).toISOString(),
          endISO: new Date(end).toISOString(),
        });
      }
    }
  }

  return slots;
}
