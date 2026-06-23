'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export async function disconnectGoogleCalendar() {
  await requireOwner();
  const db = supabaseAdmin();
  await db.from('google_integrations').delete().eq('scope', 'calendar');
  revalidatePath('/admin/integrations/google');
}
