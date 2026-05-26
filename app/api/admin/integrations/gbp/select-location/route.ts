import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { getIntegration } from '@/lib/google-calendar';

const Schema = z.object({
  account_resource_name: z.string().regex(/^accounts\/[^/]+$/).optional(),
  location_resource_name: z.string().regex(/^locations\/[^/]+$/),
  location_title: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  await requireOwner();

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', detail: err }, { status: 400 });
  }

  const integration = await getIntegration();
  if (!integration) {
    return NextResponse.json(
      { error: 'Google integration not connected' },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  await db
    .from('google_integrations')
    .update({
      gbp_account_id: body.account_resource_name ?? null,
      gbp_location_id: body.location_resource_name,
      gbp_location_title: body.location_title ?? null,
    })
    .eq('id', integration.id);

  return NextResponse.json({ ok: true });
}
