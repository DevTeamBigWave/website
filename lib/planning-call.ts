// Auto-fire the planning-call invite the moment a deposit is recorded
// for a party — any path (customer /book, admin mark-paid Zelle/Cash/
// Clover/Groupon, Stripe webhook for admin invoices, Groupon-prepaid
// creation). Idempotent via parties.planning_call_email_sent_at so the
// manual button on the admin page is still safe to click as a backup.

import { supabaseAdmin } from '@/lib/supabase';
import { sendPartyPlanningCallInvite } from '@/lib/email';

export async function maybeSendPlanningCallInvite(party: {
  id: string;
  parent_name: string;
  email: string;
  child_name: string | null;
  date: string;
  // Used to soften the invite copy when the customer has already picked
  // add-ons — call becomes optional rather than required.
  add_ons_total_cents?: number | null;
  planning_call_email_sent_at?: string | null;
}): Promise<boolean> {
  if (party.planning_call_email_sent_at) return false;

  try {
    await sendPartyPlanningCallInvite({
      parent_name: party.parent_name,
      email: party.email,
      child_name: party.child_name,
      date: party.date,
      add_ons_total_cents: party.add_ons_total_cents ?? 0,
    });
    await supabaseAdmin()
      .from('parties')
      .update({ planning_call_email_sent_at: new Date().toISOString() })
      .eq('id', party.id);
    return true;
  } catch (err) {
    console.error('Planning-call auto-send failed:', err);
    return false;
  }
}
