import { supabaseAdmin } from '@/lib/supabase';

// Append to the SMS message log. Best-effort: never throws, so logging can't
// break an inbound reply or an outbound send.
export type SmsLogRow = {
  contactPhone: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sender?: 'ai' | 'owner' | 'system' | null;
  status?: string | null;
  twilioSid?: string | null;
  error?: string | null;
};

export async function logSms(rows: SmsLogRow | SmsLogRow[]): Promise<void> {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (arr.length === 0) return;
  try {
    await supabaseAdmin()
      .from('sms_messages')
      .insert(
        arr.map((r) => ({
          contact_phone: r.contactPhone,
          direction: r.direction,
          body: r.body,
          sender: r.sender ?? null,
          status: r.status ?? null,
          twilio_sid: r.twilioSid ?? null,
          error: r.error ?? null,
        })),
      );
  } catch (err) {
    console.error('[sms-log] insert failed (non-fatal):', err);
  }
}
