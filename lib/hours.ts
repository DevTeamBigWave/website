// Open play hours: 11am–7pm every day. Single source of truth for the open
// window — the booking window math (lib/venue-hours), the Google Business
// Profile special-hours sync, the custom-hours admin defaults, and all
// customer-facing copy derive from these.
//
// Visitors drop in any time in this window; their 2-hour pass starts at
// check-in. If a visit crosses 7pm closing, that's fine — they still get the
// full 2 hours from check-in.
export const OPEN_PLAY_OPEN_MIN = 11 * 60; // 660 → 11:00
export const OPEN_PLAY_CLOSE_MIN = 19 * 60; // 1140 → 19:00
export const OPEN_PLAY_OPEN_HHMM = '11:00';
export const OPEN_PLAY_CLOSE_HHMM = '19:00';
export const OPEN_PLAY_HOURS_DISPLAY = '11am–7pm daily';
