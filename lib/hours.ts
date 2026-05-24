// Open play hours: 12pm-7pm every day.
// Visitors can drop in any time in this window; their 2-hour pass starts when
// they check in. If their visit crosses 7pm, that's fine — they get the full
// 2 hours from check-in.
export const OPEN_PLAY_HOURS = {
  startHour: 12, // noon
  endHour: 19, // 7pm
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Sun-Sat, all days
} as const;

export const OPEN_PLAY_HOURS_DISPLAY = '12pm–7pm daily';
