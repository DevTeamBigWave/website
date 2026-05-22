import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePartyPricing, PACKAGES, EXTENSIONS, fmt, type PackageId, type ExtensionId } from '@/lib/pricing';

const PartyCheckoutSchema = z.object({
  packageId: z.enum(['private', 'semi']),
  date: z.string(), // ISO date
  time: z.string(),
  extensionId: z.enum(['30m', '60m']).nullable().optional(),
  parentName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(40),
  childName: z.string().min(1).max(80),
  // DOB is the source of truth going forward — age is computed from it.
  // Optional for now to keep the older API contract working; the new
  // booking form will make this required.
  childDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'childDob must be YYYY-MM-DD')
    .optional(),
  childAge: z.coerce.number().int().min(0).max(18).optional(),
  headcount: z.coerce.number().int().min(1).max(60),
  notes: z.string().max(2000).optional(),
});

// If a DOB is provided, compute the age the kid is *turning* on the party date.
// Otherwise fall back to the client-supplied childAge.
function computeAgeTurning(dob: string | undefined, partyDate: Date, fallback: number | undefined): number | null {
  if (dob) {
    const [y, m, d] = dob.split('-').map(Number);
    // Age "turning" = how old they'll be at their next birthday on or before partyDate
    let age = partyDate.getFullYear() - y;
    const hadBirthday =
      partyDate.getMonth() + 1 > m ||
      (partyDate.getMonth() + 1 === m && partyDate.getDate() >= d);
    if (!hadBirthday) age -= 1;
    return age + 1; // age turning = current age + 1 (this is a birthday party)
  }
  return fallback ?? null;
}

export async function POST(request: Request) {
  let body;
  try {
    body = PartyCheckoutSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const date = new Date(body.date);

  // SERVER-AUTHORITATIVE PRICING — never trust client math
  const pricing = calculatePartyPricing({
    packageId: body.packageId as PackageId,
    date,
    time: body.time,
    extensionId: (body.extensionId ?? null) as ExtensionId | null,
  });

  const supabase = supabaseAdmin();

  // Pre-flight: is the date+package still available?
  // Race condition guard: even if the UI showed it as available 30 seconds ago, recheck now.
  const { data: existing } = await supabase
    .from('parties')
    .select('id, package, status, start_time')
    .eq('date', body.date.split('T')[0])
    .in('status', ['confirmed', 'hold']);

  if (existing && existing.length > 0) {
    // Private blocks everything. Semi blocks only same-time slots & other privates.
    const conflict = existing.find((p: any) => {
      if (body.packageId === 'private') return true; // Any existing booking blocks private
      if (p.package === 'private') return true; // Any private blocks any new booking
      if (p.start_time === convertTimeToSql(body.time)) return true; // Same time slot
      return false;
    });

    if (conflict) {
      return NextResponse.json(
        { error: 'That date is no longer available. Please pick another.' },
        { status: 409 }
      );
    }
  }

  // Create the party row in 'hold' status. Stripe webhook flips to 'confirmed' on payment.
  const { data: party, error: insertError } = await supabase
    .from('parties')
    .insert({
      package: body.packageId,
      date: body.date.split('T')[0],
      start_time: convertTimeToSql(body.time),
      duration_minutes: PACKAGES[body.packageId as PackageId].durationMinutes,
      extension_minutes: body.extensionId ? EXTENSIONS[body.extensionId as ExtensionId].minutes : 0,
      child_name: body.childName,
      child_age: computeAgeTurning(body.childDob, date, body.childAge),
      child_dob: body.childDob ?? null,
      headcount: body.headcount,
      notes: body.notes,
      parent_name: body.parentName,
      email: body.email,
      phone: body.phone,
      subtotal_cents: pricing.subtotalCents,
      discount_cents: pricing.discountCents,
      tax_cents: pricing.taxCents,
      total_cents: pricing.totalCents,
      deposit_cents: pricing.depositCents,
      status: 'hold',
      hold_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min hold for checkout
      weekday_discount_applied: pricing.discountApplied,
    })
    .select()
    .single();

  if (insertError || !party) {
    return NextResponse.json({ error: 'Could not create booking', detail: insertError?.message }, { status: 500 });
  }

  // Create Stripe checkout session
  const pkg = PACKAGES[body.packageId as PackageId];
  const ageTurning = computeAgeTurning(body.childDob, date, body.childAge);
  const lineItemName = `${pkg.name} Birthday Party — ${body.childName}'s ${ageTurning ? `${ageTurning}th ` : ''}birthday`;
  const description = [
    new Date(body.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    body.time,
    pricing.discountApplied ? `20% Mon–Thu discount applied (saved ${fmt(pricing.discountCents)})` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: body.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pricing.depositCents,
          product_data: {
            name: `Deposit · ${lineItemName}`,
            description,
          },
        },
      },
    ],
    metadata: {
      party_id: party.id,
      type: 'party_deposit',
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book/confirm?party_id=${party.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book?cancelled=true`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30min
  });

  // Stash the session id on the party row so we can correlate webhook to record
  await supabase
    .from('parties')
    .update({ stripe_deposit_session_id: session.id })
    .eq('id', party.id);

  return NextResponse.json({ url: session.url, partyId: party.id });
}

// Helper: convert "12:00 PM" → "12:00:00" for Postgres time column
function convertTimeToSql(displayTime: string): string {
  const [time, period] = displayTime.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}
