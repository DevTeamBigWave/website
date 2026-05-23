'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export async function saveCustomerNotes(customerId: string, notes: string) {
  await requireAdmin();
  const db = supabaseAdmin();
  await db.from('customers').update({ notes }).eq('id', customerId);
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function addChild(
  customerId: string,
  data: { name: string; date_of_birth: string | null; notes: string | null },
) {
  await requireAdmin();
  if (!data.name.trim()) throw new Error('Name required');
  const db = supabaseAdmin();
  await db.from('children').insert({
    customer_id: customerId,
    name: data.name.trim(),
    date_of_birth: data.date_of_birth,
    notes: data.notes,
  });
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function updateChild(
  childId: string,
  customerId: string,
  data: {
    name: string;
    date_of_birth: string | null;
    notes: string | null;
    birthday_emails_subscribed: boolean;
  },
) {
  await requireAdmin();
  const db = supabaseAdmin();
  await db
    .from('children')
    .update({
      name: data.name.trim(),
      date_of_birth: data.date_of_birth,
      notes: data.notes,
      birthday_emails_subscribed: data.birthday_emails_subscribed,
    })
    .eq('id', childId);
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function deleteChild(childId: string, customerId: string) {
  await requireAdmin();
  const db = supabaseAdmin();
  await db.from('children').delete().eq('id', childId);
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function toggleMarketingSubscription(
  customerId: string,
  subscribed: boolean,
) {
  await requireAdmin();
  const db = supabaseAdmin();
  await db
    .from('customers')
    .update({ subscribed_to_marketing: subscribed })
    .eq('id', customerId);
  revalidatePath(`/admin/customers/${customerId}`);
}
