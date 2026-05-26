// Open play hours: 12pm-7:30pm every day.
// Visitors can drop in any time in this window; their 2-hour pass starts when
// they check in. If their visit crosses 7:30pm closing time, that's fine — they
// get the full 2 hours from check-in.
export const OPEN_PLAY_HOURS = {
  startHour: 12, // noon
  endHour: 19, // 7:30pm — half hour represented in OPEN_PLAY_HOURS_DISPLAY
  endMinutes: 30,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Sun-Sat, every day
} as const;

export const OPEN_PLAY_HOURS_DISPLAY = '12pm–7:30pm daily';
export const OPEN_PLAY_HOURS_SHORT = '12–7:30pm';
