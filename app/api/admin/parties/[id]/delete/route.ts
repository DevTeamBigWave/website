// Owner-only: deletes a party. Voids any open Stripe invoice + removes the
// Google Calendar event so nothing orphans, then emails the customer + owner
// so they're not left wondering. Add-ons cascade via FK.

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { deletePartyEvent } from '@/lib/google-calendar';
import {
  sendPartyCancelled,
  sendOwnerNotification,
} from '@/lib/email';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireOwner();
  const { id: partyId } = await params;
  const db = supabaseAdmin();

  // Pull the full customer-facing fields BEFORE deleting so the
  // cancellation email has names + dates.
  const { data: party } = await db
    .from('parties')
    .select(
      'id, parent_name, email, child_name, package, date, start_time, deposit_paid_at, balance_invoice_id, google_calendar_event_id',
    )
    .eq('id', partyId)
    .maybeSingle();

  if (!party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 });
  }

  if (party.balance_invoice_id) {
    try {
      const invoice = await stripe.invoices.retrieve(party.balance_invoice_id);
      if (invoice.status === 'open' || invoice.status === 'draft') {
        await stripe.invoices.voidInvoice(party.balance_invoice_id);
      }
    } catch (err) {
      console.warn('Stripe invoice void failed (continuing with delete):', err);
    }
  }

  if (party.google_calendar_event_id) {
    try {
      await deletePartyEvent(party.google_calendar_event_id);
    } catch (err) {
      console.warn('Calendar event delete failed (continuing):', err);
    }
  }

  const { error } = await db.from('parties').delete().eq('id', partyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cancellation notifications — fire-and-forget so a Resend hiccup
  // doesn't fail the API call.
  void (async () => {
    try {
      await sendPartyCancelled({ party });
    } catch (err) {
      console.error('Cancellation customer email failed:', err);
    }
    try {
      await sendOwnerNotification({
        subject: `✗ Cancelled · ${party.child_name ?? 'party'} · ${party.date}`,
        party,
      });
    } catch (err) {
      console.error('Cancellation owner email failed:', err);
    }
  })();

  return NextResponse.json({ ok: true });
}
