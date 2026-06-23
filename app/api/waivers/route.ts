import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { WAIVER_VERSION } from '@/lib/waiver-text';
import { expiresAtFromNow } from '@/lib/waivers';

export const dynamic = 'force-dynamic';

const ChildSchema = z.object({
  child_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth must be YYYY-MM-DD')
    .nullable()
    .optional(),
  allergies: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const WaiverSchema = z.object({
  parent_name: z.string().min(2).max(120),
  parent_email: z.string().email(),
  parent_phone: z.string().min(7).max(40),
  emergency_contact_name: z.string().max(120).optional().or(z.literal('')),
  emergency_contact_phone: z.string().max(40).optional().or(z.literal('')),

  signature_data_url: z
    .string()
    .min(50, 'signature is required')
    .refine((s) => s.startsWith('data:image/'), 'signature_data_url must be a data: image URL'),
  signature_typed_name: z.string().min(2).max(120),

  agreed: z.literal(true, { errorMap: () => ({ message: 'You must affirm to continue' }) }),

  children: z.array(ChildSchema).min(1, 'At least one child is required').max(15),
});

export async function POST(request: Request) {
  let body;
  try {
    body = WaiverSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const db = supabaseAdmin();
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    null;
  const ua = hdrs.get('user-agent') ?? null;

  // Find or create the customer
  const email = body.parent_email.trim().toLowerCase();
  let customerId: string;
  const { data: existingCustomer } = await db
    .from('customers')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await db
      .from('customers')
      .update({
        parent_name: body.parent_name,
        phone: body.parent_phone,
      })
      .eq('id', customerId);
  } else {
    const { data: created, error: cErr } = await db
      .from('customers')
      .insert({
        email,
        parent_name: body.parent_name,
        phone: body.parent_phone,
        source: 'organic',
      })
      .select('id')
      .single();
    if (cErr || !created) {
      return NextResponse.json(
        { error: 'Could not create customer', detail: cErr?.message },
        { status: 500 },
      );
    }
    customerId = created.id;
  }

  // Create the waiver row
  const expiresAt = expiresAtFromNow();
  const { data: waiver, error: wErr } = await db
    .from('waivers')
    .insert({
      customer_id: customerId,
      parent_name: body.parent_name,
      parent_email: email,
      parent_phone: body.parent_phone,
      emergency_contact_name: body.emergency_contact_name || null,
      emergency_contact_phone: body.emergency_contact_phone || null,
      signature_data_url: body.signature_data_url,
      signature_typed_name: body.signature_typed_name,
      document_version: WAIVER_VERSION,
      signature_ip: ip,
      signature_ua: ua,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (wErr || !waiver) {
    return NextResponse.json(
      { error: 'Could not save waiver', detail: wErr?.message },
      { status: 500 },
    );
  }

  // Resolve each child: link to existing children row or create new one
  for (const kid of body.children) {
    let childId = kid.child_id ?? null;

    if (!childId) {
      // Try to match by name + dob under this customer
      const { data: match } = await db
        .from('children')
        .select('id')
        .eq('customer_id', customerId)
        .ilike('name', kid.name)
        .maybeSingle();
      if (match) {
        childId = match.id;
        // Update DOB / notes if we now have better info
        await db
          .from('children')
          .update({
            date_of_birth: kid.date_of_birth ?? undefined,
            notes: kid.allergies
              ? `Allergies: ${kid.allergies}${kid.notes ? `\n${kid.notes}` : ''}`
              : kid.notes ?? undefined,
          })
          .eq('id', childId);
      } else {
        const { data: newKid } = await db
          .from('children')
          .insert({
            customer_id: customerId,
            name: kid.name,
            date_of_birth: kid.date_of_birth ?? null,
            notes: kid.allergies
              ? `Allergies: ${kid.allergies}${kid.notes ? `\n${kid.notes}` : ''}`
              : kid.notes ?? null,
          })
          .select('id')
          .single();
        if (newKid) childId = newKid.id;
      }
    }

    await db.from('waiver_children').insert({
      waiver_id: waiver.id,
      child_id: childId,
      child_name: kid.name,
      child_dob: kid.date_of_birth ?? null,
      allergies: kid.allergies || null,
      notes: kid.notes || null,
    });
  }

  return NextResponse.json({
    ok: true,
    waiver_id: waiver.id,
    expires_at: expiresAt,
  });
}
