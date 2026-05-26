import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePartyPricing, PACKAGES, EXTENSIONS, fmt, type PackageId, type ExtensionId } from '@/lib/pricing';
import { getGiftCardByCode, balanceCents } from '@/lib/gift-cards';
import { finalizeParty } from '@/lib/finalize-booking';
import { findCatalogItem } from '@/lib/add-ons';
import { validatePromoCode, recordPromoUse } from '@/lib/promo-codes';

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
  headcount: z.coerce.number().int().min(1).max(40),
  notes: z.string().max(2000).optional(),
  decorTheme: z.string().max(120).optional(),
  addOns: z
    .array(
      z.object({
        catalog_id: z.string().min(1).max(80),
        qty: z.coerce.number().int().min(1).max(40).default(1),
      }),
    )
    .max(20)
    .optional(),
  inspirationImageUrls: z.array(z.string().url()).max(3).optional(),
  giftCardCode: z.string().max(40).optional(),
  promoCode: z.string().max(40).optional(),
});

function composeNotes(notes: string | undefined, decorTheme: string | undefined): string | null {
  const parts = [
    decorTheme ? `Decor theme: ${decorTheme.trim()}` : '',
    notes?.trim() ?? '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n').slice(0, 2000) : null;
}

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
    headcount: body.headcount,
  });

  const supabase = supabaseAdmin();

  // Pre-flight: is the date+package still available?
  // Race condition guard: even if the UI showed it as available 30 seconds ago, recheck now.
  const { data: existing } = await supabase
    .from('parties')
    .select('id, package, status, start_time, duration_minutes, extension_minutes')
    .eq('date', body.date.split('T')[0])
    .in('status', ['confirmed', 'hold']);

  if (existing && existing.length > 0) {
    const newStartMin = sqlTimeToMinutes(convertTimeToSql(body.time));
    const newDuration =
      PACKAGES[body.packageId as PackageId].durationMinutes +
      (body.extensionId ? EXTENSIONS[body.extensionId as ExtensionId].minutes : 0);
    const newEndMin = newStartMin + newDuration;

    // Conflict if either party is private and time ranges overlap,
    // OR both are semi and same start time (semi slots only allow one party).
    // Back-to-back overlap (1-hour extension running into next slot) IS a conflict.
    const conflict = existing.find((p: any) => {
      const pStart = sqlTimeToMinutes(p.start_time);
      const pTotal = (p.duration_minutes ?? 120) + (p.extension_minutes ?? 0);
      const pEnd = pStart + pTotal;
      const overlap = newStartMin < pEnd && pStart < newEndMin;

      if (!overlap) return false;
      if (body.packageId === 'private' || p.package === 'private') return true;
      // Two semi parties at the exact same start are allowed up to capacity —
      // for now, any time overlap is a conflict to keep semantics simple.
      return true;
    });

    if (conflict) {
      return NextResponse.json(
        {
          error:
            'That time conflicts with another booking on the same day. Please pick another slot, or call us to discuss.',
        },
        { status: 409 },
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
      notes: composeNotes(body.notes, body.decorTheme),
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
      inspiration_image_urls: body.inspirationImageUrls ?? [],
    })
    .select()
    .single();

  if (insertError || !party) {
    return NextResponse.json({ error: 'Could not create booking', detail: insertError?.message }, { status: 500 });
  }

  // Customer-picked add-ons. Validated against the catalog; price comes from
  // the catalog (not the client) so a customer can't tamper. NOT charged on
  // the deposit — they get itemized on the balance invoice the owner sends.
  if (body.addOns && body.addOns.length > 0) {
    const rows = body.addOns
      .map((a) => {
        const item = findCatalogItem(a.catalog_id);
        if (!item) return null;
        return {
          party_id: party.id,
          catalog_id: item.id,
          name: item.name,
          unit_price_cents: item.price_cents,
          qty: a.qty,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) {
      const { error: addOnErr } = await supabase.from('party_add_ons').insert(rows);
      if (addOnErr) {
        console.error('Add-on insert failed (party still created):', addOnErr);
      }
    }
  }

  // Promo code path: skip Stripe entirely. Party gets finalized in-place
  // (status=confirmed, calendar event fires, emails go out) but the deposit
  // is NOT recorded as paid — so admin sees the full grand-total as owed.
  if (body.promoCode) {
    const v = await validatePromoCode(body.promoCode);
    if (!v.ok) {
      // Roll the held party back so the slot reopens
      await supabase
        .from('parties')
        .update({ status: 'cancelled', cancellation_reason: 'invalid promo code' })
        .eq('id', party.id);
      return NextResponse.json({ error: v.reason }, { status: 400 });
    }
    if (v.kind === 'skip_deposit') {
      const finalized = await finalizeParty(party.id, {
        skipDeposit: true,
        promoCodeId: v.id,
      });
      if (!finalized) {
        return NextResponse.json(
          { error: 'Could not confirm booking with promo code.' },
          { status: 500 },
        );
      }
      // Best-effort usage counter
      void recordPromoUse(v.id);
      return NextResponse.json({
        ok: true,
        partyId: party.id,
        skipDeposit: true,
        // No checkout URL — the frontend redirects to the confirm page directly
        redirectTo: `/book/confirm?id=${party.id}`,
      });
    }
  }

  // Gift card lookup (if a code was passed) — applied against the deposit.
  let giftCardId: string | undefined;
  let giftCardApplyCents = 0;
  if (body.giftCardCode) {
    const card = await getGiftCardByCode(body.giftCardCode);
    if (!card || card.status !== 'active' || balanceCents(card) <= 0) {
      return NextResponse.json(
        { error: 'Invalid or empty gift card code.' },
        { status: 400 },
      );
    }
    giftCardId = card.id;
    giftCardApplyCents = Math.min(balanceCents(card), pricing.depositCents);
  }

  const chargeCents = pricing.depositCents - giftCardApplyCents;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';

  // $0 case: gift card covers entire deposit. Skip Stripe, confirm immediately.
  if (chargeCents <= 0) {
    await finalizeParty(party.id, {
      giftCardId,
      giftCardApplyCents,
    });
    return NextResponse.json({
      url: `${siteUrl}/book/confirm?party_id=${party.id}&gift=1`,
      partyId: party.id,
    });
  }

  // Stripe minimum is $0.50 — if the remainder is below that, top up the card
  // redemption back to allow Stripe to charge $0.50 minimum.
  if (chargeCents > 0 && chargeCents < 50) {
    giftCardApplyCents = Math.max(0, giftCardApplyCents - (50 - chargeCents));
  }
  const finalChargeCents = pricing.depositCents - giftCardApplyCents;

  // Create Stripe checkout session
  const pkg = PACKAGES[body.packageId as PackageId];
  const ageTurning = computeAgeTurning(body.childDob, date, body.childAge);
  const lineItemName = `${pkg.name} Birthday Party — ${body.childName}'s ${ageTurning ? `${ageTurning}th ` : ''}birthday`;
  const description = [
    new Date(body.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    body.time,
    pricing.discountApplied ? `20% Mon–Thu discount applied (saved ${fmt(pricing.discountCents)})` : null,
    giftCardApplyCents > 0 ? `Gift card applied (saved ${fmt(giftCardApplyCents)})` : null,
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
          unit_amount: finalChargeCents,
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
      ...(giftCardId ? { gift_card_id: giftCardId, gift_card_apply_cents: String(giftCardApplyCents) } : {}),
    },
    success_url: `${siteUrl}/book/confirm?party_id=${party.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/book?cancelled=true`,
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

// "HH:MM:SS" → minutes since midnight
function sqlTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
