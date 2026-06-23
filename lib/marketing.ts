// Marketing helpers: subscriber list resolution, suppression checks,
// unsubscribe token mgmt.
//
// Two scopes we currently check: 'birthday_reminders' and 'promotions'.
// A customer with scope='all' is suppressed from EVERYTHING.

import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export type Scope = 'all' | 'birthday_reminders' | 'promotions' | 'special_events';

export type MarketingRecipient = {
  customer_id: string;
  email: string;
  parent_name: string;
};

// Returns recipients NOT unsubscribed from the given scope (or 'all').
export async function getMarketingRecipients(scope: Exclude<Scope, 'all'>): Promise<MarketingRecipient[]> {
  const db = supabaseAdmin();

  // All active customers
  const { data: customers = [] } = await db
    .from('customers')
    .select('id, email, parent_name')
    .order('created_at', { ascending: false });

  // All emails unsubscribed from this scope OR all
  const { data: unsubs = [] } = await db
    .from('marketing_unsubscribes')
    .select('email')
    .in('scope', ['all', scope]);

  const suppressed = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()));

  return (customers ?? [])
    .filter((c: any) => !suppressed.has(c.email.toLowerCase()))
    .map((c: any) => ({
      customer_id: c.id,
      email: c.email,
      parent_name: c.parent_name,
    }));
}

export async function isSuppressed(email: string, scope: Exclude<Scope, 'all'>): Promise<boolean> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('marketing_unsubscribes')
    .select('id')
    .ilike('email', email)
    .in('scope', ['all', scope])
    .maybeSingle();
  return !!data;
}

// Generate a stable token tied to an email — used in unsubscribe links.
// HMAC-ish: hash(email + secret) → first 24 hex chars. Idempotent so the
// same email always gets the same token (so we can verify without storing).
const SECRET = process.env.UNSUBSCRIBE_SECRET ?? 'wonderland-default-change-me';

export function tokenForEmail(email: string): string {
  return createHash('sha256')
    .update(`${email.trim().toLowerCase()}:${SECRET}`)
    .digest('hex')
    .slice(0, 24);
}

export function verifyEmailToken(email: string, token: string): boolean {
  return tokenForEmail(email) === token;
}

// Insert a marketing_unsubscribes row idempotently.
export async function unsubscribeEmail(email: string, scope: Scope, reason?: string): Promise<void> {
  const db = supabaseAdmin();
  const normalized = email.trim().toLowerCase();

  // Find linked customer (if any)
  const { data: customer } = await db
    .from('customers')
    .select('id')
    .ilike('email', normalized)
    .maybeSingle();

  // Upsert by (email, scope) — table has unique constraint on that pair
  await db
    .from('marketing_unsubscribes')
    .upsert(
      {
        email: normalized,
        customer_id: customer?.id ?? null,
        scope,
        reason: reason ?? null,
      },
      { onConflict: 'email,scope' },
    );
}

// Generate a per-email link to /unsubscribe. Includes scope so we can
// granularly remove (or pass 'all' to suppress everything).
export function unsubscribeUrl(siteBase: string, email: string, scope: Scope = 'all'): string {
  const token = tokenForEmail(email);
  const u = new URL(`${siteBase}/unsubscribe`);
  u.searchParams.set('email', email);
  u.searchParams.set('scope', scope);
  u.searchParams.set('token', token);
  return u.toString();
}
