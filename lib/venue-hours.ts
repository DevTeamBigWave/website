// Venue hours overrides — admin-set custom hours / closures for a date.
// Single source of truth shared by the Google Business Profile special-hours
// sync (lib/gbp.ts) and on-site booking enforcement (parties + open play).

import { supabaseAdmin } from '@/lib/supabase';

// Default open-play window: 12:00–19:30 daily. Centralized here so the GBP
// sync and any window math agree.
export const VENUE_OPEN_START_MIN = 12 * 60; // 720
export const VENUE_OPEN_END_MIN = 19 * 60 + 30; // 1170

export type VenueHoursOverride = {
  date: string; // YYYY-MM-DD
  closed: boolean;
  open_minutes: number | null;
  close_minutes: number | null;
  note: string | null;
};

export async function getOverrideForDate(date: string): Promise<VenueHoursOverride | null> {
  const { data } = await supabaseAdmin()
    .from('venue_hours_override')
    .select('date, closed, open_minutes, close_minutes, note')
    .eq('date', date)
    .maybeSingle();
  return (data as VenueHoursOverride | null) ?? null;
}

export async function getOverridesInRange(
  startDate: string,
  endDate: string,
): Promise<VenueHoursOverride[]> {
  const { data } = await supabaseAdmin()
    .from('venue_hours_override')
    .select('date, closed, open_minutes, close_minutes, note')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  return (data ?? []) as VenueHoursOverride[];
}

// "HH:MM" / "HH:MM:SS" / "1:00 PM" → minutes since midnight.
export function timeToMinutes(t: string): number {
  if (/am|pm/i.test(t)) {
    const [hm, period] = t.trim().split(/\s+/);
    let [h, m] = hm.split(':').map(Number);
    if (/pm/i.test(period) && h !== 12) h += 12;
    if (/am/i.test(period) && h === 12) h = 0;
    return h * 60 + (m || 0);
  }
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

// Returns a customer-facing reason string if a party occupying
// [startMin, endMin] is NOT allowed by the override, else null.
export function partyBlockedByOverride(
  ov: VenueHoursOverride | null,
  startMin: number,
  endMin: number,
): string | null {
  if (!ov) return null;
  if (ov.closed) {
    return 'The venue is closed that day. Please pick another date.';
  }
  if (ov.open_minutes != null && ov.close_minutes != null) {
    if (startMin < ov.open_minutes || endMin > ov.close_minutes) {
      return `On that date the venue is only open ${minutesToLabel(ov.open_minutes)}–${minutesToLabel(ov.close_minutes)}. Please pick a time within those hours.`;
    }
  }
  return null;
}
