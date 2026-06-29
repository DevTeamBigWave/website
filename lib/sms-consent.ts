// Client helper: record an SMS opt-in, fire-and-forget. Uses keepalive so the
// request survives a navigation (e.g. when the booking form redirects to
// Stripe). Never throws — opt-in logging must not affect the form flow.
export function recordSmsConsent(input: {
  phone: string;
  name?: string;
  source: 'appointment' | 'party_booking' | 'open_play';
}): void {
  if (!input.phone?.trim()) return;
  try {
    void fetch('/api/sms/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
