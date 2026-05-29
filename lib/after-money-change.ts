// Shared post-mutation side effects for every admin endpoint that changes
// a party's grand total (add-on add/remove, F&F discount apply/remove,
// reschedule that strips Mon-Thu discount, etc).
//
// What this does:
//   1. Void any open balance-invoice Stripe link — the amount on the
//      hosted invoice no longer matches what's owed.
//   2. Email the customer with the new totals so they aren't surprised
//      later (only if their deposit is actually paid — otherwise they
//      have no context for a "balance updated" message).
//   3. Notify the owner.
//   4. (Caller is responsible for re-syncing the calendar event — most
//      endpoints already call syncPartyEventByPartyId before this.)
//
// All fire-and-forget. Failures log but don't block. Call without await.

import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendPartyBalanceUpdated,
  sendOwnerNotification,
} from '@/lib/email';

export async function afterMoneyChange(partyId: string, changeNote: string) {
  try {
    const db = supabaseAdmin();
    const { data: party } = await db
      .from('parties')
      .select(
        'id, parent_name, email, child_name, package, date, start_time, subtotal_cents, total_cents, deposit_cents, deposit_paid_at, add_ons_total_cents, gift_card_applied_cents, balance_paid_amount_cents, balance_invoice_id, manual_discount_percent, manual_discount_cents',
      )
      .eq('id', partyId)
      .maybeSingle();
    if (!party) return;

    // Void a stale balance invoice if one is open — its line items and
    // total amount no longer match what the customer owes. Don't auto-
    // resend; Gaby may add several items in a row and we don't want to
    // spam the customer with an invoice per edit.
    if (party.balance_invoice_id) {
      try {
        const inv = await stripe.invoices.retrieve(party.balance_invoice_id);
        if (inv.status === 'open' || inv.status === 'draft') {
          await stripe.invoices.voidInvoice(party.balance_invoice_id);
          await db
            .from('parties')
            .update({ balance_invoice_id: null, balance_invoice_hosted_url: null })
            .eq('id', partyId);
        }
      } catch (err) {
        console.warn('Could not void stale balance invoice:', err);
      }
    }

    // Only email the customer if the deposit has actually been paid —
    // otherwise they don't know there's a balance and a "balance updated"
    // email reads as confusing noise.
    if (party.deposit_paid_at) {
      try {
        await sendPartyBalanceUpdated({ party, changeNote });
      } catch (err) {
        console.error('balance-updated customer email failed:', err);
      }
    }

    try {
      await sendOwnerNotification({
        subject: `↺ Balance updated · ${party.child_name ?? 'party'} · ${changeNote}`,
        party,
      });
    } catch (err) {
      console.error('balance-updated owner email failed:', err);
    }
  } catch (err) {
    console.error('afterMoneyChange failed:', err);
  }
}
