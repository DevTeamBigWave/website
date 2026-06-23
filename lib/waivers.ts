import { supabaseAdmin } from '@/lib/supabase';
import { WAIVER_VALIDITY_DAYS, WAIVER_VERSION } from '@/lib/waiver-text';

export type ChildOnWaiver = {
  id: string;
  child_id: string | null;
  child_name: string;
  child_dob: string | null;
  allergies: string | null;
  notes: string | null;
};

export type WaiverRow = {
  id: string;
  customer_id: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  signature_data_url: string;
  signature_typed_name: string;
  document_version: string;
  signed_at: string;
  expires_at: string;
  revoked_at: string | null;
  children?: ChildOnWaiver[];
};

export type WaiverLookupResult = {
  found: boolean;
  parent?: {
    name: string;
    email: string;
    phone: string;
    customer_id: string | null;
  };
  // Existing kids in the children table for this customer (whether or not currently covered)
  known_children: Array<{
    id: string;
    name: string;
    date_of_birth: string | null;
    notes: string | null;
  }>;
  // Active waiver, if one exists (not expired, not revoked)
  active_waiver?: {
    id: string;
    signed_at: string;
    expires_at: string;
    document_version: string;
    covered_children: ChildOnWaiver[];
    needs_resign_for_version: boolean;
  };
};

export async function lookupWaiverByEmail(emailRaw: string): Promise<WaiverLookupResult> {
  const email = emailRaw.trim().toLowerCase();
  const db = supabaseAdmin();

  // Find the customer (parent)
  const { data: customer } = await db
    .from('customers')
    .select('id, parent_name, email, phone')
    .ilike('email', email)
    .maybeSingle();

  // Find their kids
  let knownChildren: WaiverLookupResult['known_children'] = [];
  if (customer) {
    const { data: kids = [] } = await db
      .from('children')
      .select('id, name, date_of_birth, notes')
      .eq('customer_id', customer.id)
      .order('date_of_birth', { ascending: true });
    knownChildren = (kids ?? []).map((k: any) => ({
      id: k.id,
      name: k.name,
      date_of_birth: k.date_of_birth,
      notes: k.notes,
    }));
  }

  // Find an active waiver — not expired, not revoked
  const nowIso = new Date().toISOString();
  const { data: activeWaiver } = await db
    .from('waivers')
    .select(
      'id, signed_at, expires_at, document_version, waiver_children(id, child_id, child_name, child_dob, allergies, notes)',
    )
    .ilike('parent_email', email)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const result: WaiverLookupResult = {
    found: !!customer || !!activeWaiver,
    known_children: knownChildren,
  };

  if (customer) {
    result.parent = {
      name: customer.parent_name,
      email: customer.email,
      phone: customer.phone ?? '',
      customer_id: customer.id,
    };
  }

  if (activeWaiver) {
    result.active_waiver = {
      id: activeWaiver.id,
      signed_at: activeWaiver.signed_at,
      expires_at: activeWaiver.expires_at,
      document_version: activeWaiver.document_version,
      covered_children: (activeWaiver.waiver_children ?? []) as ChildOnWaiver[],
      needs_resign_for_version: activeWaiver.document_version !== WAIVER_VERSION,
    };
  }

  return result;
}

export function expiresAtFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + WAIVER_VALIDITY_DAYS);
  return d.toISOString();
}
